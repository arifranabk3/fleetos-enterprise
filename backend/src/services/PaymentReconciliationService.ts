import { Types } from 'mongoose';
import { Invoice, IInvoice } from '../models/Invoice';
import { PaymentReceipt, IPaymentReceipt } from '../models/PaymentReceipt';
import { ITenantContext } from '../repositories/BaseTenantRepository';
import { FinancialStateMachine } from './FinancialStateMachine';

export interface RecordReceiptInput {
  receiptNumber: string;
  customerId: Types.ObjectId;
  amountCents: number;
  currency?: string;
  paymentDate?: Date;
  paymentMethod: 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CHECK' | 'CASH' | 'ACH' | 'WIRE' | 'OTHER';
  referenceNumber: string;
  allocations: Array<{
    allocationId?: string;
    invoiceId: Types.ObjectId;
    invoiceNumber: string;
    allocatedAmountCents: number;
  }>;
  recordedBy: Types.ObjectId;
  idempotencyKey?: string;
  notes?: string;
}

export class PaymentReconciliationService {
  /**
   * Records a payment receipt and reconciles against allocated invoices.
   * Atomic within session or sequential with rollback integrity.
   */
  static async recordAndReconcilePayment(
    tenant: ITenantContext,
    input: RecordReceiptInput
  ): Promise<IPaymentReceipt> {
    const orgId = typeof tenant.organizationId === 'string' ? new Types.ObjectId(tenant.organizationId) : tenant.organizationId;

    // 1. Idempotency check with payload fingerprint verification
    if (input.idempotencyKey) {
      const existing = await PaymentReceipt.findOne({
        organizationId: orgId,
        idempotencyKey: input.idempotencyKey,
      });
      if (existing) {
        // Verify payload matches the original request
        if (
          existing.amountCents !== input.amountCents ||
          existing.customerId.toString() !== input.customerId.toString() ||
          existing.referenceNumber !== input.referenceNumber
        ) {
          throw new Error(
            `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH: Idempotency key '${input.idempotencyKey}' was already used with a different payment payload.`
          );
        }
        return existing;
      }
    }

    // 2. Allocation validation: total allocated must equal receipt total
    const totalAllocated = input.allocations.reduce((sum, a) => sum + Math.round(a.allocatedAmountCents), 0);
    if (totalAllocated !== Math.round(input.amountCents)) {
      throw new Error(
        `ALLOCATION_MISMATCH: Total allocations (${totalAllocated} cents) must equal receipt amount (${input.amountCents} cents).`
      );
    }

    // 3. Pre-validate each invoice allocation against outstanding balance
    const invoiceDocs: IInvoice[] = [];
    for (const alloc of input.allocations) {
      const inv = await Invoice.findOne({ organizationId: orgId, _id: alloc.invoiceId });
      if (!inv) {
        throw new Error(`INVOICE_NOT_FOUND: Invoice ID '${alloc.invoiceId}' does not exist in organization.`);
      }
      if (inv.status === 'PAID') {
        throw new Error(`INVOICE_ALREADY_PAID: Invoice '${inv.invoiceNumber}' is already fully paid.`);
      }
      if (inv.status === 'VOID') {
        throw new Error(`INVOICE_VOIDED: Cannot allocate payment to voided invoice '${inv.invoiceNumber}'.`);
      }
      if (alloc.allocatedAmountCents > inv.outstandingBalanceCents) {
        throw new Error(
          `ALLOCATION_EXCEEDS_BALANCE: Allocation (${alloc.allocatedAmountCents} cents) exceeds invoice '${inv.invoiceNumber}' outstanding balance (${inv.outstandingBalanceCents} cents).`
        );
      }
      invoiceDocs.push(inv);
    }

    // 4. Create the payment receipt with deterministic allocation IDs based on idempotency or unique IDs
    const enrichedAllocations = input.allocations.map((a, idx) => ({
      ...a,
      allocationId:
        a.allocationId ||
        (input.idempotencyKey
          ? `ALLOC-${input.idempotencyKey}-${idx + 1}`
          : `ALLOC-${new Types.ObjectId().toString()}`),
    }));

    const receipt = await PaymentReceipt.create({
      organizationId: orgId,
      receiptNumber: input.receiptNumber,
      customerId: input.customerId,
      amountCents: input.amountCents,
      currency: input.currency || 'USD',
      paymentDate: input.paymentDate || new Date(),
      paymentMethod: input.paymentMethod,
      referenceNumber: input.referenceNumber,
      allocations: enrichedAllocations,
      status: 'RECORDED',
      recordedBy: input.recordedBy,
      idempotencyKey: input.idempotencyKey,
      notes: input.notes,
      auditTrail: [
        {
          action: 'PAYMENT_RECORDED',
          performedBy: input.recordedBy,
          timestamp: new Date(),
          note: `Recorded receipt with ${enrichedAllocations.length} invoice allocations`,
        },
      ],
    });

    // 5. Update invoice balances atomically with CAS verification
    const successfullyUpdatedInvoices: Array<{ invoiceId: Types.ObjectId; amountCents: number; allocationId: string }> = [];

    try {
      for (let i = 0; i < enrichedAllocations.length; i++) {
        const alloc = enrichedAllocations[i];

        // Atomic CAS update: outstandingBalanceCents must be >= alloc.allocatedAmountCents
        const updatedInv = await Invoice.findOneAndUpdate(
          {
            _id: alloc.invoiceId,
            organizationId: orgId,
            status: { $in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
            outstandingBalanceCents: { $gte: alloc.allocatedAmountCents },
          },
          {
            $inc: {
              amountPaidCents: alloc.allocatedAmountCents,
              outstandingBalanceCents: -alloc.allocatedAmountCents,
            },
            $push: {
              auditTrail: {
                action: 'PAYMENT_APPLIED',
                performedBy: input.recordedBy,
                timestamp: new Date(),
                note: `[${alloc.allocationId}] Applied ${alloc.allocatedAmountCents} cents from Receipt ${receipt.receiptNumber}.`,
              },
            },
          },
          { new: true }
        );

        if (!updatedInv) {
          throw new Error(
            `ALLOCATION_RACE_DETECTED: Invoice ${alloc.invoiceNumber || alloc.invoiceId} outstanding balance changed or is insufficient.`
          );
        }

        // Set status to PAID if balance reached 0
        if (updatedInv.outstandingBalanceCents === 0) {
          updatedInv.status = 'PAID';
          updatedInv.paidAt = new Date();
          await updatedInv.save();
        } else if (updatedInv.status === 'ISSUED') {
          updatedInv.status = 'PARTIALLY_PAID';
          await updatedInv.save();
        }

        successfullyUpdatedInvoices.push({
          invoiceId: alloc.invoiceId,
          amountCents: alloc.allocatedAmountCents,
          allocationId: alloc.allocationId,
        });
      }
    } catch (allocError) {
      // Compensating transaction: rollback all allocations applied in this run and delete receipt
      for (const applied of successfullyUpdatedInvoices) {
        await Invoice.updateOne(
          { _id: applied.invoiceId, organizationId: orgId },
          {
            $inc: {
              amountPaidCents: -applied.amountCents,
              outstandingBalanceCents: applied.amountCents,
            },
            $push: {
              auditTrail: {
                action: 'PAYMENT_COMPENSATING_ROLLBACK',
                performedBy: input.recordedBy,
                timestamp: new Date(),
                note: `[${applied.allocationId}] Rolled back ${applied.amountCents} cents due to allocation race condition.`,
              },
            },
          }
        );
      }
      await PaymentReceipt.deleteOne({ _id: receipt._id, organizationId: orgId });
      throw allocError;
    }

    return receipt;
  }

  /**
   * Reverses an existing payment receipt and restores invoice outstanding balances.
   */
  static async reversePaymentReceipt(
    tenant: ITenantContext,
    receiptId: Types.ObjectId,
    reversalReason: string,
    reversedBy: Types.ObjectId
  ): Promise<IPaymentReceipt> {
    const orgId = typeof tenant.organizationId === 'string' ? new Types.ObjectId(tenant.organizationId) : tenant.organizationId;

    // Atomic CAS update: transition status from RECORDED/RECONCILED to REVERSED
    const receipt = await PaymentReceipt.findOneAndUpdate(
      {
        organizationId: orgId,
        _id: receiptId,
        status: { $in: ['RECORDED', 'RECONCILED'] },
      },
      {
        $set: {
          status: 'REVERSED',
          reversalReason,
          reversedBy,
          reversedAt: new Date(),
        },
        $push: {
          auditTrail: {
            action: 'RECEIPT_REVERSED',
            performedBy: reversedBy,
            timestamp: new Date(),
            note: `Reversed receipt. Reason: ${reversalReason}`,
          },
        },
      },
      { new: true }
    );

    if (!receipt) {
      const existing = await PaymentReceipt.findOne({ organizationId: orgId, _id: receiptId });
      if (!existing) {
        throw new Error('RECEIPT_NOT_FOUND: Payment receipt does not exist in organization.');
      }
      throw new Error('RECEIPT_ALREADY_REVERSED: This receipt has already been reversed.');
    }

    // Revert each invoice allocation atomically
    for (const alloc of receipt.allocations) {
      const inv = await Invoice.findOne({ organizationId: orgId, _id: alloc.invoiceId });
      if (inv) {
        inv.amountPaidCents = Math.max(0, inv.amountPaidCents - alloc.allocatedAmountCents);
        inv.outstandingBalanceCents = inv.totalAmountCents - inv.amountPaidCents;

        const revertedStatus: 'ISSUED' | 'PARTIALLY_PAID' = inv.amountPaidCents === 0 ? 'ISSUED' : 'PARTIALLY_PAID';
        inv.status = revertedStatus;
        inv.paidAt = undefined;

        inv.auditTrail.push({
          action: 'PAYMENT_REVERSED',
          performedBy: reversedBy,
          timestamp: new Date(),
          note: `Reversed allocation of ${alloc.allocatedAmountCents} cents from Receipt ${receipt.receiptNumber}. Reason: ${reversalReason}. Outstanding: ${inv.outstandingBalanceCents} cents.`,
        });

        await inv.save();
      }
    }

    return receipt;
  }
}
