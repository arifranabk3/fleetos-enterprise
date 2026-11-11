import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { PaymentReceipt } from '../models/PaymentReceipt';
import { Customer } from '../models/Customer';
import { Invoice } from '../models/Invoice';
import { LedgerAccount } from '../models/LedgerAccount';
import { PaymentReconciliationService } from '../services/PaymentReconciliationService';
import { FinancialLedgerService } from '../services/FinancialLedgerService';
import { RecordPaymentReceiptSchema } from '../validators/financialValidators';

export class PaymentReceiptController {
  /**
   * GET /api/v1/billing/receipts
   * List payment receipts with filtering and pagination.
   */
  static async listReceipts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { customerId, status, page = 1, limit = 20, startDate, endDate } = req.query;

      const filter: any = { organizationId: orgId };
      if (customerId && Types.ObjectId.isValid(customerId as string)) {
        filter.customerId = new Types.ObjectId(customerId as string);
      }
      if (status) filter.status = status;
      if (startDate || endDate) {
        filter.paymentDate = {};
        if (startDate) filter.paymentDate.$gte = new Date(startDate as string);
        if (endDate) filter.paymentDate.$lte = new Date(endDate as string);
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [receipts, total] = await Promise.all([
        PaymentReceipt.find(filter)
          .sort({ paymentDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .populate('customerId', 'name email')
          .populate('recordedBy', 'firstName lastName email'),
        PaymentReceipt.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          receipts,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/billing/receipts/:id
   * Get receipt details by ID.
   */
  static async getReceiptById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Invalid receipt ID' },
        });
      }

      const receipt = await PaymentReceipt.findOne({
        _id: new Types.ObjectId(id),
        organizationId: orgId,
      })
        .populate('customerId', 'name email phone billingAddress')
        .populate('recordedBy', 'firstName lastName email');

      if (!receipt) {
        return res.status(404).json({
          success: false,
          error: { code: 'RECEIPT_NOT_FOUND', message: 'Payment receipt not found in organization' },
        });
      }

      return res.status(200).json({
        success: true,
        data: receipt,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/billing/receipts
   * Record a new customer payment receipt and allocate to invoices.
   */
  static async recordReceipt(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantContext = { organizationId: req.tenant!.organizationId };
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const userId = new Types.ObjectId(req.tenant!.userId);

      const parsed = RecordPaymentReceiptSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid payment receipt data',
            details: parsed.error.format(),
          },
        });
      }

      const data = parsed.data;

      // Validate customer ownership
      const customer = await Customer.findOne({
        _id: new Types.ObjectId(data.customerId),
        organizationId: orgId,
      });
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer does not belong to organization' },
        });
      }

      // Check unique receipt number within organization
      const existingNumber = await PaymentReceipt.findOne({
        organizationId: orgId,
        receiptNumber: data.receiptNumber.toUpperCase(),
      });
      if (existingNumber) {
        return res.status(409).json({
          success: false,
          error: { code: 'RECEIPT_NUMBER_CONFLICT', message: `Receipt #${data.receiptNumber} already exists.` },
        });
      }

      // Check idempotency key if provided
      if (data.idempotencyKey) {
        const existingKey = await PaymentReceipt.findOne({
          organizationId: orgId,
          idempotencyKey: data.idempotencyKey,
        });
        if (existingKey) {
          return res.status(200).json({
            success: true,
            data: existingKey,
            idempotentReplay: true,
          });
        }
      }

      const receipt = await PaymentReconciliationService.recordAndReconcilePayment(tenantContext, {
        receiptNumber: data.receiptNumber.toUpperCase(),
        customerId: new Types.ObjectId(data.customerId),
        amountCents: data.amountCents,
        currency: data.currency.toUpperCase(),
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber,
        allocations: data.allocations.map((a) => ({
          invoiceId: new Types.ObjectId(a.invoiceId),
          invoiceNumber: a.invoiceNumber,
          allocatedAmountCents: a.allocatedAmountCents,
        })),
        recordedBy: userId,
        idempotencyKey: data.idempotencyKey,
        notes: data.notes,
      });

      // General ledger integration: Debit Cash (1010), Credit Accounts Receivable (1100)
      try {
        const cashAcc = await LedgerAccount.findOne({ organizationId: orgId, accountNumber: '1010' });
        const arAcc = await LedgerAccount.findOne({ organizationId: orgId, accountNumber: '1100' });

        if (cashAcc && arAcc) {
          await FinancialLedgerService.postJournalEntry(tenantContext, {
            entryNumber: `JE-RCP-${receipt.receiptNumber}`,
            postingDate: receipt.paymentDate,
            sourceType: 'PAYMENT_RECEIVED',
            sourceReferenceId: receipt._id as Types.ObjectId,
            sourceReferenceNumber: receipt.receiptNumber,
            description: `Payment received: Receipt ${receipt.receiptNumber} (${receipt.paymentMethod})`,
            lines: [
              {
                accountId: cashAcc._id as Types.ObjectId,
                entryType: 'DEBIT',
                amountCents: receipt.amountCents,
                description: 'Operating Cash',
              },
              {
                accountId: arAcc._id as Types.ObjectId,
                entryType: 'CREDIT',
                amountCents: receipt.amountCents,
                description: 'Accounts Receivable',
              },
            ],
            postedBy: userId,
            idempotencyKey: `JE-RCP-${receipt._id.toString()}`,
          });
        }
      } catch (ledgerErr) {
        console.warn('[Ledger Warning] Optional payment receipt auto-journaling skipped:', ledgerErr);
      }

      return res.status(201).json({
        success: true,
        data: receipt,
      });
    } catch (error: any) {
      if (error.message?.includes('ALLOCATION_MISMATCH') || error.message?.includes('ALLOCATION_EXCEEDS_BALANCE')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ALLOCATION', message: error.message },
        });
      }
      if (error.message?.includes('INVOICE_ALREADY_PAID') || error.message?.includes('INVOICE_VOIDED')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVOICE_STATUS_INVALID', message: error.message },
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/v1/billing/receipts/:id/reverse
   * Reverse a payment receipt and restore allocated invoice balances.
   */
  static async reverseReceipt(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantContext = { organizationId: req.tenant!.organizationId };
      const userId = new Types.ObjectId(req.tenant!.userId);
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'REASON_REQUIRED', message: 'A reason is required to reverse a payment receipt' },
        });
      }

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Invalid receipt ID' },
        });
      }

      const receipt = await PaymentReconciliationService.reversePaymentReceipt(
        tenantContext,
        new Types.ObjectId(id),
        reason,
        userId
      );

      // Reversal journal entry: Debit AR (1100), Credit Cash (1010)
      try {
        const orgId = new Types.ObjectId(req.tenant!.organizationId);
        const cashAcc = await LedgerAccount.findOne({ organizationId: orgId, accountNumber: '1010' });
        const arAcc = await LedgerAccount.findOne({ organizationId: orgId, accountNumber: '1100' });

        if (cashAcc && arAcc) {
          await FinancialLedgerService.postJournalEntry(tenantContext, {
            entryNumber: `JE-REV-${receipt.receiptNumber}`,
            postingDate: new Date(),
            sourceType: 'PAYMENT_REVERSED',
            sourceReferenceId: receipt._id as Types.ObjectId,
            sourceReferenceNumber: receipt.receiptNumber,
            description: `Payment reversed: Receipt ${receipt.receiptNumber}. Reason: ${reason}`,
            lines: [
              {
                accountId: arAcc._id as Types.ObjectId,
                entryType: 'DEBIT',
                amountCents: receipt.amountCents,
                description: 'Accounts Receivable Restored',
              },
              {
                accountId: cashAcc._id as Types.ObjectId,
                entryType: 'CREDIT',
                amountCents: receipt.amountCents,
                description: 'Operating Cash Reversed',
              },
            ],
            postedBy: userId,
            idempotencyKey: `JE-REV-${receipt._id.toString()}`,
          });
        }
      } catch (ledgerErr) {
        console.warn('[Ledger Warning] Reversal auto-journaling skipped:', ledgerErr);
      }

      return res.status(200).json({
        success: true,
        data: receipt,
      });
    } catch (error: any) {
      if (error.message?.includes('RECEIPT_ALREADY_REVERSED')) {
        return res.status(400).json({
          success: false,
          error: { code: 'ALREADY_REVERSED', message: error.message },
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/v1/billing/receipts/:id/audit-history
   * Get payment receipt history.
   */
  static async getReceiptAuditHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { id } = req.params;

      const receipt = await PaymentReceipt.findOne(
        { _id: new Types.ObjectId(id), organizationId: orgId },
        { receiptNumber: 1, auditTrail: 1 }
      ).populate('auditTrail.performedBy', 'firstName lastName email');

      if (!receipt) {
        return res.status(404).json({
          success: false,
          error: { code: 'RECEIPT_NOT_FOUND', message: 'Payment receipt not found' },
        });
      }

      return res.status(200).json({
        success: true,
        data: receipt.auditTrail,
      });
    } catch (error) {
      next(error);
    }
  }
}
