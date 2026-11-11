import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Invoice } from '../models/Invoice';
import { Customer } from '../models/Customer';
import { LedgerAccount } from '../models/LedgerAccount';
import { ShipmentInvoicingService } from '../services/ShipmentInvoicingService';
import { FinancialStateMachine } from '../services/FinancialStateMachine';
import { FinancialLedgerService } from '../services/FinancialLedgerService';
import { CreateInvoiceSchema } from '../validators/financialValidators';

export class InvoiceController {
  /**
   * GET /api/v1/billing/invoices
   * List invoices with filtering, search, and pagination.
   */
  static async listInvoices(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { customerId, status, page = 1, limit = 20, startDate, endDate, search } = req.query;

      const filter: any = { organizationId: orgId };
      if (customerId && Types.ObjectId.isValid(customerId as string)) {
        filter.customerId = new Types.ObjectId(customerId as string);
      }
      if (status) filter.status = status;
      if (startDate || endDate) {
        filter.issuedAt = {};
        if (startDate) filter.issuedAt.$gte = new Date(startDate as string);
        if (endDate) filter.issuedAt.$lte = new Date(endDate as string);
      }
      if (search) {
        filter.$or = [
          { invoiceNumber: { $regex: String(search), $options: 'i' } },
          { 'customer.name': { $regex: String(search), $options: 'i' } },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [invoices, total] = await Promise.all([
        Invoice.find(filter)
          .sort({ issuedAt: -1, createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .populate('customerId', 'name email'),
        Invoice.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          invoices,
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
   * GET /api/v1/billing/invoices/:id
   * Get invoice by ID.
   */
  static async getInvoiceById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Invalid invoice ID' },
        });
      }

      const invoice = await Invoice.findOne({
        _id: new Types.ObjectId(id),
        organizationId: orgId,
      }).populate('customerId', 'name email phone billingAddress');

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found in organization' },
        });
      }

      return res.status(200).json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/billing/invoices
   * Create a manual freight invoice.
   */
  static async createInvoice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const userId = new Types.ObjectId(req.tenant!.userId);

      const parsed = CreateInvoiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid invoice data',
            details: parsed.error.format(),
          },
        });
      }

      const data = parsed.data;

      // Validate customer ownership if customerId provided
      if (data.customerId) {
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
      }

      // Check unique invoice number within organization
      const existing = await Invoice.findOne({
        organizationId: orgId,
        invoiceNumber: data.invoiceNumber.toUpperCase(),
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: { code: 'INVOICE_NUMBER_CONFLICT', message: `Invoice #${data.invoiceNumber} already exists.` },
        });
      }

      // Calculate totals server-side
      let subtotalCents = 0;
      let totalTaxCents = 0;
      let totalDiscountCents = 0;
      let totalFuelCents = 0;

      const formattedLineItems = data.lineItems.map((item) => {
        const lineTotal = item.unitPriceCents * item.quantity;
        const tax = Math.round(lineTotal * (item.taxRatePercent / 100));
        const finalLineTotal = lineTotal + tax + (item.fuelSurchargeCents || 0) - (item.discountAmountCents || 0);

        subtotalCents += lineTotal;
        totalTaxCents += tax;
        totalFuelCents += item.fuelSurchargeCents || 0;
        totalDiscountCents += item.discountAmountCents || 0;

        return {
          shipmentId: item.shipmentId ? new Types.ObjectId(item.shipmentId) : undefined,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          taxRatePercent: item.taxRatePercent,
          taxAmountCents: tax,
          discountAmountCents: item.discountAmountCents || 0,
          fuelSurchargeCents: item.fuelSurchargeCents || 0,
          totalCents: finalLineTotal,
        };
      });

      const totalAmountCents = subtotalCents + totalTaxCents + totalFuelCents - totalDiscountCents;

      const invoice = await Invoice.create({
        organizationId: orgId,
        invoiceNumber: data.invoiceNumber.toUpperCase(),
        customerId: data.customerId ? new Types.ObjectId(data.customerId) : undefined,
        customer: data.customer,
        shipmentIds: data.shipmentIds.map((s) => new Types.ObjectId(s)),
        lineItems: formattedLineItems,
        subtotalCents,
        taxAmountCents: totalTaxCents,
        fuelSurchargeCents: totalFuelCents,
        discountCents: totalDiscountCents,
        totalAmountCents,
        amountPaidCents: 0,
        outstandingBalanceCents: totalAmountCents,
        subtotalAmount: subtotalCents / 100,
        taxAmount: totalTaxCents / 100,
        totalAmount: totalAmountCents / 100,
        currency: data.currency.toUpperCase(),
        status: 'DRAFT',
        paymentTerms: data.paymentTerms,
        issuedAt: new Date(),
        dueAt: new Date(data.dueAt),
        notes: data.notes,
        auditTrail: [
          {
            action: 'INVOICE_CREATED_MANUAL',
            performedBy: userId,
            timestamp: new Date(),
            note: 'Draft invoice created manually',
            newStatus: 'DRAFT',
          },
        ],
      });

      return res.status(201).json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/billing/invoices/generate-from-shipments
   * Batch/single generation of invoice from delivered shipments.
   */
  static async generateFromShipments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantContext = { organizationId: req.tenant!.organizationId };
      const userId = new Types.ObjectId(req.tenant!.userId);
      const { shipmentIds, invoiceNumber, paymentTerms, dueAt, taxRatePercent, notes } = req.body;

      if (!shipmentIds || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_SHIPMENT_IDS', message: 'Array of shipment IDs is required' },
        });
      }

      if (!invoiceNumber || typeof invoiceNumber !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_INVOICE_NUMBER', message: 'Invoice number is required' },
        });
      }

      const existing = await Invoice.findOne({
        organizationId: new Types.ObjectId(req.tenant!.organizationId),
        invoiceNumber: invoiceNumber.toUpperCase(),
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: { code: 'INVOICE_NUMBER_CONFLICT', message: `Invoice #${invoiceNumber} already exists.` },
        });
      }

      const invoice = await ShipmentInvoicingService.generateInvoiceFromShipments(tenantContext, {
        shipmentIds: shipmentIds.map((s: string) => new Types.ObjectId(s)),
        invoiceNumber: invoiceNumber.toUpperCase(),
        paymentTerms: paymentTerms || 'NET_30',
        dueAt: dueAt ? new Date(dueAt) : new Date(Date.now() + 30 * 86400000),
        taxRatePercent: taxRatePercent ? Number(taxRatePercent) : 0,
        notes,
        createdBy: userId,
      });

      // Automatically post to general ledger if accounts receivable and freight revenue accounts exist
      try {
        const arAcc = await LedgerAccount.findOne({
          organizationId: new Types.ObjectId(req.tenant!.organizationId),
          accountNumber: '1100',
        });
        const revAcc = await LedgerAccount.findOne({
          organizationId: new Types.ObjectId(req.tenant!.organizationId),
          accountNumber: '4010',
        });

        if (arAcc && revAcc) {
          await FinancialLedgerService.postJournalEntry(tenantContext, {
            entryNumber: `JE-${invoice.invoiceNumber}`,
            postingDate: invoice.issuedAt,
            sourceType: 'INVOICE_ISSUED',
            sourceReferenceId: invoice._id as Types.ObjectId,
            sourceReferenceNumber: invoice.invoiceNumber,
            description: `Freight invoice generated: ${invoice.invoiceNumber}`,
            lines: [
              {
                accountId: arAcc._id as Types.ObjectId,
                entryType: 'DEBIT',
                amountCents: invoice.totalAmountCents,
                description: 'Accounts Receivable',
              },
              {
                accountId: revAcc._id as Types.ObjectId,
                entryType: 'CREDIT',
                amountCents: invoice.totalAmountCents,
                description: 'Freight Revenue',
              },
            ],
            postedBy: userId,
            idempotencyKey: `JE-INV-${invoice._id.toString()}`,
          });
        }
      } catch (ledgerErr) {
        console.warn('[Ledger Warning] Optional auto-journaling skipped:', ledgerErr);
      }

      return res.status(201).json({
        success: true,
        data: invoice,
      });
    } catch (error: any) {
      if (error.message?.includes('DUPLICATE_SHIPMENT_BILLING')) {
        return res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_SHIPMENT_BILLING', message: error.message },
        });
      }
      if (error.message?.includes('INELIGIBLE_SHIPMENT_STATUS')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INELIGIBLE_SHIPMENT_STATUS', message: error.message },
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/v1/billing/invoices/:id/issue
   * Transition draft invoice to ISSUED.
   */
  static async issueInvoice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const userId = new Types.ObjectId(req.tenant!.userId);
      const { id } = req.params;

      const invoice = await Invoice.findOne({ _id: new Types.ObjectId(id), organizationId: orgId });
      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' },
        });
      }

      FinancialStateMachine.validateInvoiceTransition(invoice.status, 'ISSUED');

      const oldStatus = invoice.status;
      invoice.status = 'ISSUED';
      invoice.issuedAt = new Date();
      invoice.auditTrail.push({
        action: 'INVOICE_ISSUED',
        performedBy: userId,
        timestamp: new Date(),
        previousStatus: oldStatus,
        newStatus: 'ISSUED',
        note: 'Invoice issued and sent to customer',
      });

      await invoice.save();

      return res.status(200).json({
        success: true,
        data: invoice,
      });
    } catch (error: any) {
      if (error.message?.includes('INVALID_INVOICE_TRANSITION')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TRANSITION', message: error.message },
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/v1/billing/invoices/:id/void
   * Void an eligible invoice using accounting workflow.
   */
  static async voidInvoice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const userId = new Types.ObjectId(req.tenant!.userId);
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'VOID_REASON_REQUIRED', message: 'A formal reason is required to void an invoice' },
        });
      }

      const invoice = await Invoice.findOne({ _id: new Types.ObjectId(id), organizationId: orgId });
      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' },
        });
      }

      if (invoice.amountPaidCents > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVOICE_HAS_PAYMENTS',
            message: 'Cannot void an invoice with recorded payments. Reverse payments first.',
          },
        });
      }

      FinancialStateMachine.validateInvoiceTransition(invoice.status, 'VOID');

      const oldStatus = invoice.status;
      invoice.status = 'VOID';
      invoice.voidedAt = new Date();
      invoice.voidReason = reason;
      invoice.auditTrail.push({
        action: 'INVOICE_VOIDED',
        performedBy: userId,
        timestamp: new Date(),
        previousStatus: oldStatus,
        newStatus: 'VOID',
        note: `Voided: ${reason}`,
      });

      await invoice.save();

      return res.status(200).json({
        success: true,
        data: invoice,
      });
    } catch (error: any) {
      if (error.message?.includes('INVALID_INVOICE_TRANSITION')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TRANSITION', message: error.message },
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/v1/billing/invoices/:id/audit-history
   * Get invoice audit log.
   */
  static async getInvoiceAuditHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { id } = req.params;

      const invoice = await Invoice.findOne(
        { _id: new Types.ObjectId(id), organizationId: orgId },
        { invoiceNumber: 1, auditTrail: 1 }
      ).populate('auditTrail.performedBy', 'firstName lastName email');

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' },
        });
      }

      return res.status(200).json({
        success: true,
        data: invoice.auditTrail,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/billing/invoices/aging-report
   * Accounts Receivable Aging Report with bucket calculations.
   */
  static async getAgingReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const asOfDate = req.query.asOf ? new Date(req.query.asOf as string) : new Date();

      // Find all active unpaid or partially paid invoices
      const invoices = await Invoice.find({
        organizationId: orgId,
        status: { $in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        outstandingBalanceCents: { $gt: 0 },
      }).populate('customerId', 'name email');

      const currencyBreakdown: Record<string, any> = {};

      for (const inv of invoices) {
        const curr = inv.currency || 'USD';
        if (!currencyBreakdown[curr]) {
          currencyBreakdown[curr] = {
            currentCents: 0,
            days1To30Cents: 0,
            days31To60Cents: 0,
            days61To90Cents: 0,
            over90DaysCents: 0,
            totalOutstandingCents: 0,
            invoiceCount: 0,
            customers: {},
          };
        }

        const bucket = currencyBreakdown[curr];
        const balance = inv.outstandingBalanceCents;
        bucket.totalOutstandingCents += balance;
        bucket.invoiceCount += 1;

        // Due date delta calculation
        const dueTime = new Date(inv.dueAt).getTime();
        const diffMs = asOfDate.getTime() - dueTime;
        const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let category = 'CURRENT';
        if (daysOverdue <= 0) {
          bucket.currentCents += balance;
          category = 'CURRENT';
        } else if (daysOverdue <= 30) {
          bucket.days1To30Cents += balance;
          category = '1-30_DAYS';
        } else if (daysOverdue <= 60) {
          bucket.days31To60Cents += balance;
          category = '31-60_DAYS';
        } else if (daysOverdue <= 90) {
          bucket.days61To90Cents += balance;
          category = '61-90_DAYS';
        } else {
          bucket.over90DaysCents += balance;
          category = 'OVER_90_DAYS';
        }

        // Customer aggregation
        const custKey = inv.customer?.name || 'Unknown Customer';
        if (!bucket.customers[custKey]) {
          bucket.customers[custKey] = {
            customerId: inv.customerId,
            customerName: custKey,
            outstandingBalanceCents: 0,
            invoices: [],
          };
        }
        bucket.customers[custKey].outstandingBalanceCents += balance;
        bucket.customers[custKey].invoices.push({
          id: inv._id,
          invoiceNumber: inv.invoiceNumber,
          dueAt: inv.dueAt,
          daysOverdue: Math.max(0, daysOverdue),
          balanceCents: balance,
          category,
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          asOfDate,
          currencies: currencyBreakdown,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
