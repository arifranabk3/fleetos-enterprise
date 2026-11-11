import { Types } from 'mongoose';
import { Invoice } from '../models/Invoice';
import { PaymentReceipt } from '../models/PaymentReceipt';
import { JournalEntry } from '../models/JournalEntry';
import { Customer } from '../models/Customer';
import { AuditLog } from '../models/AuditLog';

export interface UnallocatedPaymentItem {
  receiptId: string;
  receiptNumber: string;
  customerId: string;
  customerName: string;
  amountCents: number;
  allocatedCents: number;
  unallocatedCents: number;
  paymentDate: Date;
  paymentMethod: string;
  referenceNumber: string;
}

export interface InvoiceBalanceMismatchItem {
  invoiceId: string;
  invoiceNumber: string;
  customerId?: string;
  customerName: string;
  totalAmountCents: number;
  amountPaidCents: number;
  recordedBalanceCents: number;
  computedBalanceCents: number;
  sumAllocatedCents: number;
  status: string;
}

export interface ReconciliationSummary {
  organizationId: string;
  asOfDate: Date;
  totalReceiptsCount: number;
  totalReceiptsAmountCents: number;
  totalAllocatedCents: number;
  totalUnallocatedCents: number;
  unallocatedPayments: UnallocatedPaymentItem[];
  invoiceMismatches: InvoiceBalanceMismatchItem[];
  reversedReceiptsCount: number;
  reversedReceiptsAmountCents: number;
  isFullyReconciled: boolean;
}

export class FinancialReconciliationService {
  /**
   * Generates a complete payment and accounts receivable reconciliation report
   * identifying unallocated cash, balance mismatches, and reversal records.
   */
  static async getReconciliationSummary(
    organizationId: string | Types.ObjectId,
    customerId?: string
  ): Promise<ReconciliationSummary> {
    const orgId = typeof organizationId === 'string' ? new Types.ObjectId(organizationId) : organizationId;

    const receiptFilter: any = { organizationId: orgId };
    const invoiceFilter: any = { organizationId: orgId };

    if (customerId) {
      receiptFilter.customerId = new Types.ObjectId(customerId);
      invoiceFilter.customerId = new Types.ObjectId(customerId);
    }

    const [receipts, invoices, customers] = await Promise.all([
      PaymentReceipt.find(receiptFilter).lean(),
      Invoice.find(invoiceFilter).lean(),
      Customer.find({ organizationId: orgId }).lean(),
    ]);

    const customerMap = new Map<string, string>();
    customers.forEach((c) => {
      customerMap.set(c._id.toString(), c.name);
    });

    let totalReceiptsAmountCents = 0;
    let totalAllocatedCents = 0;
    let totalUnallocatedCents = 0;
    let reversedReceiptsCount = 0;
    let reversedReceiptsAmountCents = 0;
    const unallocatedPayments: UnallocatedPaymentItem[] = [];

    // Process receipts
    for (const rcpt of receipts) {
      if (rcpt.status === 'REVERSED') {
        reversedReceiptsCount++;
        reversedReceiptsAmountCents += rcpt.amountCents || 0;
        continue;
      }

      totalReceiptsAmountCents += rcpt.amountCents || 0;
      const allocated = (rcpt.allocations || []).reduce(
        (sum, a) => sum + (a.allocatedAmountCents || 0),
        0
      );
      totalAllocatedCents += allocated;
      const unallocated = Math.max(0, (rcpt.amountCents || 0) - allocated);

      if (unallocated > 0) {
        totalUnallocatedCents += unallocated;
        const custIdStr = rcpt.customerId ? rcpt.customerId.toString() : '';
        unallocatedPayments.push({
          receiptId: rcpt._id.toString(),
          receiptNumber: rcpt.receiptNumber,
          customerId: custIdStr,
          customerName: customerMap.get(custIdStr) || 'Unknown Customer',
          amountCents: rcpt.amountCents,
          allocatedCents: allocated,
          unallocatedCents: unallocated,
          paymentDate: rcpt.paymentDate,
          paymentMethod: rcpt.paymentMethod,
          referenceNumber: rcpt.referenceNumber,
        });
      }
    }

    // Process invoices for mismatches
    const invoiceMismatches: InvoiceBalanceMismatchItem[] = [];

    for (const inv of invoices) {
      if (inv.status === 'VOID') continue;

      const expectedBal = Math.max(0, (inv.totalAmountCents || 0) - (inv.amountPaidCents || 0));
      const recordedBal = inv.outstandingBalanceCents !== undefined ? inv.outstandingBalanceCents : expectedBal;

      // Find sum of allocations for this invoice across valid receipts
      const activeAllocations = receipts
        .filter((r) => r.status !== 'REVERSED')
        .flatMap((r) => r.allocations || [])
        .filter((a) => a.invoiceId && a.invoiceId.toString() === inv._id.toString());

      const sumAllocated = activeAllocations.reduce(
        (sum, a) => sum + (a.allocatedAmountCents || 0),
        0
      );

      const hasBalanceMismatch = expectedBal !== recordedBal;
      const hasReceiptMismatch = (inv.amountPaidCents || 0) !== sumAllocated;

      if (hasBalanceMismatch || hasReceiptMismatch) {
        const custIdStr = inv.customerId ? inv.customerId.toString() : '';
        invoiceMismatches.push({
          invoiceId: inv._id.toString(),
          invoiceNumber: inv.invoiceNumber,
          customerId: custIdStr,
          customerName: inv.customer?.name || customerMap.get(custIdStr) || 'Unknown Customer',
          totalAmountCents: inv.totalAmountCents,
          amountPaidCents: inv.amountPaidCents || 0,
          recordedBalanceCents: recordedBal,
          computedBalanceCents: expectedBal,
          sumAllocatedCents: sumAllocated,
          status: inv.status,
        });
      }
    }

    const isFullyReconciled = unallocatedPayments.length === 0 && invoiceMismatches.length === 0;

    return {
      organizationId: orgId.toString(),
      asOfDate: new Date(),
      totalReceiptsCount: receipts.filter((r) => r.status !== 'REVERSED').length,
      totalReceiptsAmountCents,
      totalAllocatedCents,
      totalUnallocatedCents,
      unallocatedPayments,
      invoiceMismatches,
      reversedReceiptsCount,
      reversedReceiptsAmountCents,
      isFullyReconciled,
    };
  }

  /**
   * Authorized manual allocation of unallocated receipt amount to open invoices.
   * Never mutates records silently; requires actor authorization and produces audit log.
   */
  static async allocateReceiptBalance(params: {
    organizationId: string | Types.ObjectId;
    receiptId: string;
    allocations: Array<{ invoiceId: string; amountCents: number }>;
    actorId?: string;
    actorEmail: string;
    reason: string;
  }): Promise<{ receipt: any; updatedInvoices: any[] }> {
    const orgId = typeof params.organizationId === 'string' ? new Types.ObjectId(params.organizationId) : params.organizationId;

    const receipt = await PaymentReceipt.findOne({
      _id: new Types.ObjectId(params.receiptId),
      organizationId: orgId,
    });

    if (!receipt) {
      throw new Error('Payment receipt not found in organization context.');
    }

    if (receipt.status === 'REVERSED') {
      throw new Error('Cannot allocate reversed payment receipt.');
    }

    const currentAllocated = (receipt.allocations || []).reduce(
      (sum, a) => sum + (a.allocatedAmountCents || 0),
      0
    );
    const unallocatedAvailable = Math.max(0, receipt.amountCents - currentAllocated);

    const totalToAllocate = params.allocations.reduce((sum, a) => sum + a.amountCents, 0);
    if (totalToAllocate > unallocatedAvailable) {
      throw new Error(
        `Requested allocation (${totalToAllocate} cents) exceeds available unallocated receipt balance (${unallocatedAvailable} cents).`
      );
    }

    const updatedInvoices: any[] = [];

    // Apply allocations
    for (const allocReq of params.allocations) {
      const invoice = await Invoice.findOne({
        _id: new Types.ObjectId(allocReq.invoiceId),
        organizationId: orgId,
      });

      if (!invoice) {
        throw new Error(`Target invoice ${allocReq.invoiceId} not found.`);
      }

      if (invoice.status === 'VOID') {
        throw new Error(`Cannot allocate payments to VOID invoice ${invoice.invoiceNumber}.`);
      }

      const balDue = Math.max(0, (invoice.totalAmountCents || 0) - (invoice.amountPaidCents || 0));
      if (allocReq.amountCents > balDue) {
        throw new Error(
          `Allocation of ${allocReq.amountCents} cents exceeds invoice ${invoice.invoiceNumber} balance due of ${balDue} cents.`
        );
      }

      invoice.amountPaidCents = (invoice.amountPaidCents || 0) + allocReq.amountCents;
      invoice.outstandingBalanceCents = Math.max(0, invoice.totalAmountCents - invoice.amountPaidCents);

      if (invoice.outstandingBalanceCents === 0) {
        invoice.status = 'PAID';
        invoice.paidAt = new Date();
      } else {
        invoice.status = 'PARTIALLY_PAID';
      }

      invoice.auditTrail.push({
        action: 'MANUAL_RECONCILIATION_ALLOCATION',
        performedBy: params.actorId ? new Types.ObjectId(params.actorId) : undefined,
        timestamp: new Date(),
        note: `Applied ${allocReq.amountCents} cents from receipt ${receipt.receiptNumber}. Reason: ${params.reason}`,
      });

      await invoice.save();
      updatedInvoices.push(invoice);

      // Append to receipt allocations
      receipt.allocations.push({
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        allocatedAmountCents: allocReq.amountCents,
      });
    }

    if (receipt.allocations.reduce((s, a) => s + a.allocatedAmountCents, 0) === receipt.amountCents) {
      receipt.status = 'RECONCILED';
    }

    receipt.auditTrail.push({
      action: 'ALLOCATION_ADJUSTMENT',
      performedBy: params.actorId ? new Types.ObjectId(params.actorId) : (receipt.recordedBy as any),
      timestamp: new Date(),
      note: `Allocated balance across ${params.allocations.length} invoices. Reason: ${params.reason}`,
    });

    await receipt.save();

    // Log security audit trail
    await AuditLog.create({
      organizationId: orgId,
      actorId: params.actorId ? new Types.ObjectId(params.actorId) : undefined,
      actorEmail: params.actorEmail,
      action: 'FINANCIAL_RECONCILIATION_ADJUSTMENT',
      entity: 'PAYMENT_RECEIPT',
      entityId: receipt._id.toString(),
      details: {
        receiptNumber: receipt.receiptNumber,
        totalAllocatedCents: totalToAllocate,
        reason: params.reason,
        invoiceCount: updatedInvoices.length,
      },
      timestamp: new Date(),
    });

    return { receipt, updatedInvoices };
  }
}

