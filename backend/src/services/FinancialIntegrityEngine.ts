import { Types } from 'mongoose';
import { Invoice, IInvoice } from '../models/Invoice';
import { PaymentReceipt, IPaymentReceipt } from '../models/PaymentReceipt';
import { JournalEntry, IJournalEntry } from '../models/JournalEntry';
import { DriverSettlement, IDriverSettlement } from '../models/DriverSettlement';
import { LedgerAccount, ILedgerAccount } from '../models/LedgerAccount';
import { MonetaryPrecision } from '../utils/MonetaryPrecision';

export interface FinancialMismatch {
  code: string;
  severity: 'WARNING' | 'CRITICAL' | 'INFO';
  entityType: 'INVOICE' | 'PAYMENT_RECEIPT' | 'JOURNAL_ENTRY' | 'DRIVER_SETTLEMENT' | 'LEDGER_ACCOUNT';
  entityId: string;
  referenceNumber: string;
  description: string;
  expectedValue: any;
  actualValue: any;
  discrepancyCents?: number;
  recommendedAction: string;
}

export interface FinancialIntegrityReport {
  organizationId: string;
  generatedAt: Date;
  isHealthy: boolean;
  totalChecksExecuted: number;
  totalMismatchesFound: number;
  summaryBySeverity: {
    critical: number;
    warning: number;
    info: number;
  };
  mismatches: FinancialMismatch[];
  metrics: {
    invoicesAudited: number;
    receiptsAudited: number;
    journalsAudited: number;
    settlementsAudited: number;
    accountsAudited: number;
  };
}

export class FinancialIntegrityEngine {
  /**
   * Executes a comprehensive, strictly read-only integrity audit across all financial models
   * for the given organization context.
   */
  static async runIntegrityAudit(organizationId: string | Types.ObjectId): Promise<FinancialIntegrityReport> {
    const orgId = typeof organizationId === 'string' ? new Types.ObjectId(organizationId) : organizationId;
    const mismatches: FinancialMismatch[] = [];
    let checksExecuted = 0;

    // Fetch tenant-scoped datasets
    const [invoices, receipts, journals, settlements, accounts] = await Promise.all([
      Invoice.find({ organizationId: orgId }).lean(),
      PaymentReceipt.find({ organizationId: orgId }).lean(),
      JournalEntry.find({ organizationId: orgId }).lean(),
      DriverSettlement.find({ organizationId: orgId }).lean(),
      LedgerAccount.find({ organizationId: orgId }).lean(),
    ]);

    /* =========================================================================
       1. INVOICE INTEGRITY VERIFICATIONS
       ========================================================================= */
    for (const inv of invoices) {
      checksExecuted++;

      // Check 1A: Line item summation vs Invoice Subtotal & Total
      const computedSubtotalCents = (inv.lineItems || []).reduce(
        (sum, item) => sum + (item.quantity * item.unitPriceCents),
        0
      );
      const computedLineTotalsCents = (inv.lineItems || []).reduce(
        (sum, item) => sum + (item.totalCents || 0),
        0
      );

      if (inv.subtotalCents !== undefined && computedSubtotalCents !== inv.subtotalCents) {
        mismatches.push({
          code: 'INV_SUBTOTAL_MISMATCH',
          severity: 'WARNING',
          entityType: 'INVOICE',
          entityId: inv._id.toString(),
          referenceNumber: inv.invoiceNumber,
          description: `Invoice ${inv.invoiceNumber} recorded subtotal differs from sum of line items.`,
          expectedValue: computedSubtotalCents,
          actualValue: inv.subtotalCents,
          discrepancyCents: Math.abs(computedSubtotalCents - inv.subtotalCents),
          recommendedAction: 'Recompute line items and verify tax/discount calculations.',
        });
      }

      // Check 1B: Outstanding balance consistency: Total - AmountPaid = BalanceDue
      const expectedBalanceCents = Math.max(0, (inv.totalAmountCents || 0) - (inv.amountPaidCents || 0));
      const recordedBalanceCents = inv.outstandingBalanceCents !== undefined ? inv.outstandingBalanceCents : expectedBalanceCents;

      if (inv.status !== 'VOID' && expectedBalanceCents !== recordedBalanceCents) {
        mismatches.push({
          code: 'INV_BALANCE_MISMATCH',
          severity: 'CRITICAL',
          entityType: 'INVOICE',
          entityId: inv._id.toString(),
          referenceNumber: inv.invoiceNumber,
          description: `Invoice ${inv.invoiceNumber} recorded balance due does not equal Total Amount minus Amount Paid.`,
          expectedValue: expectedBalanceCents,
          actualValue: recordedBalanceCents,
          discrepancyCents: Math.abs(expectedBalanceCents - recordedBalanceCents),
          recommendedAction: 'Reconcile customer payment allocations against invoice amount.',
        });
      }

      // Check 1C: Invoice paid amount vs sum of active receipt allocations
      const activeReceiptAllocationsForInvoice = receipts
        .filter((r) => r.status !== 'REVERSED')
        .flatMap((r) => r.allocations || [])
        .filter((a) => a.invoiceId && a.invoiceId.toString() === inv._id.toString());

      const computedAllocatedCents = activeReceiptAllocationsForInvoice.reduce(
        (sum, a) => sum + (a.allocatedAmountCents || 0),
        0
      );

      if (inv.status !== 'VOID' && (inv.amountPaidCents || 0) !== computedAllocatedCents) {
        mismatches.push({
          code: 'INV_RECEIPT_ALLOCATION_MISMATCH',
          severity: 'CRITICAL',
          entityType: 'INVOICE',
          entityId: inv._id.toString(),
          referenceNumber: inv.invoiceNumber,
          description: `Invoice ${inv.invoiceNumber} amount paid (${inv.amountPaidCents}) does not match valid non-reversed receipt allocations (${computedAllocatedCents}).`,
          expectedValue: computedAllocatedCents,
          actualValue: inv.amountPaidCents,
          discrepancyCents: Math.abs(computedAllocatedCents - (inv.amountPaidCents || 0)),
          recommendedAction: 'Verify payment receipts ledger and reconcile allocated credit entries.',
        });
      }
    }

    /* =========================================================================
       2. PAYMENT RECEIPT INTEGRITY VERIFICATIONS
       ========================================================================= */
    for (const rcpt of receipts) {
      checksExecuted++;

      // Check 2A: Sum of allocations cannot exceed receipt total amount
      const totalAllocatedCents = (rcpt.allocations || []).reduce(
        (sum, a) => sum + (a.allocatedAmountCents || 0),
        0
      );

      if (totalAllocatedCents > rcpt.amountCents) {
        mismatches.push({
          code: 'RECEIPT_OVERALLOCATED',
          severity: 'CRITICAL',
          entityType: 'PAYMENT_RECEIPT',
          entityId: rcpt._id.toString(),
          referenceNumber: rcpt.receiptNumber,
          description: `Receipt ${rcpt.receiptNumber} total allocated (${totalAllocatedCents}) exceeds total receipt amount (${rcpt.amountCents}).`,
          expectedValue: rcpt.amountCents,
          actualValue: totalAllocatedCents,
          discrepancyCents: totalAllocatedCents - rcpt.amountCents,
          recommendedAction: 'Adjust allocation amounts across invoices or record supplementary receipt.',
        });
      }

      // Check 2B: Reversed receipt audit and allocation state
      if (rcpt.status === 'REVERSED') {
        if (!rcpt.reversalReason || rcpt.reversalReason.trim().length === 0) {
          mismatches.push({
            code: 'RECEIPT_REVERSAL_MISSING_REASON',
            severity: 'WARNING',
            entityType: 'PAYMENT_RECEIPT',
            entityId: rcpt._id.toString(),
            referenceNumber: rcpt.receiptNumber,
            description: `Reversed receipt ${rcpt.receiptNumber} lacks mandatory GAAP audit justification.`,
            expectedValue: 'Documented GAAP reason',
            actualValue: null,
            recommendedAction: 'Append audit memorandum detailing reversal justification.',
          });
        }
      }
    }

    /* =========================================================================
       3. GENERAL LEDGER JOURNAL BALANCING (DEBITS == CREDITS)
       ========================================================================= */
    for (const je of journals) {
      checksExecuted++;

      // Check 3A: Mathematical balance of lines
      const computedDebits = (je.lines || [])
        .filter((l) => l.entryType === 'DEBIT')
        .reduce((sum, l) => sum + (l.amountCents || 0), 0);

      const computedCredits = (je.lines || [])
        .filter((l) => l.entryType === 'CREDIT')
        .reduce((sum, l) => sum + (l.amountCents || 0), 0);

      if (computedDebits !== computedCredits) {
        mismatches.push({
          code: 'JOURNAL_OUT_OF_BALANCE',
          severity: 'CRITICAL',
          entityType: 'JOURNAL_ENTRY',
          entityId: je._id.toString(),
          referenceNumber: je.entryNumber,
          description: `Journal entry ${je.entryNumber} debits (${computedDebits}) do not equal credits (${computedCredits}).`,
          expectedValue: computedDebits,
          actualValue: computedCredits,
          discrepancyCents: Math.abs(computedDebits - computedCredits),
          recommendedAction: 'Investigate source transaction and post correcting balancing journal entry.',
        });
      }

      // Check 3B: Header recorded debit/credit vs computed
      if (je.totalDebitCents !== computedDebits || je.totalCreditCents !== computedCredits) {
        mismatches.push({
          code: 'JOURNAL_TOTALS_HEADER_MISMATCH',
          severity: 'WARNING',
          entityType: 'JOURNAL_ENTRY',
          entityId: je._id.toString(),
          referenceNumber: je.entryNumber,
          description: `Journal entry ${je.entryNumber} header totals mismatch line item computations.`,
          expectedValue: { debit: computedDebits, credit: computedCredits },
          actualValue: { debit: je.totalDebitCents, credit: je.totalCreditCents },
          recommendedAction: 'Recalculate journal header totals.',
        });
      }
    }

    /* =========================================================================
       4. DRIVER SETTLEMENT ARITHMETIC INTEGRITY
       ========================================================================= */
    for (const setl of settlements) {
      checksExecuted++;

      // Check 4A: Gross Pay = BasePay + MileagePay + OvertimePay + Bonuses
      const bonusesTotal = (setl.bonuses || []).reduce((sum, b) => sum + (b.amountCents || 0), 0);
      const computedGross = (setl.basePayCents || 0) + (setl.mileagePayCents || 0) + (setl.overtimePayCents || 0) + bonusesTotal;

      if (setl.grossPayCents !== computedGross) {
        mismatches.push({
          code: 'SETTLEMENT_GROSS_PAY_MISMATCH',
          severity: 'CRITICAL',
          entityType: 'DRIVER_SETTLEMENT',
          entityId: setl._id.toString(),
          referenceNumber: setl.settlementNumber,
          description: `Settlement ${setl.settlementNumber} gross pay does not match sum of base, mileage, overtime and bonuses.`,
          expectedValue: computedGross,
          actualValue: setl.grossPayCents,
          discrepancyCents: Math.abs(computedGross - setl.grossPayCents),
          recommendedAction: 'Recompute settlement pay run components.',
        });
      }

      // Check 4B: Net Pay = GrossPay - Deductions - TaxWithheld
      const deductionsTotal = (setl.deductions || []).reduce((sum, d) => sum + (d.amountCents || 0), 0);
      const computedNet = Math.max(0, (setl.grossPayCents || 0) - deductionsTotal - (setl.taxWithheldCents || 0));

      if (setl.netPayCents !== computedNet) {
        mismatches.push({
          code: 'SETTLEMENT_NET_PAY_MISMATCH',
          severity: 'CRITICAL',
          entityType: 'DRIVER_SETTLEMENT',
          entityId: setl._id.toString(),
          referenceNumber: setl.settlementNumber,
          description: `Settlement ${setl.settlementNumber} net pay does not equal gross minus deductions and taxes.`,
          expectedValue: computedNet,
          actualValue: setl.netPayCents,
          discrepancyCents: Math.abs(computedNet - setl.netPayCents),
          recommendedAction: 'Recheck deductions and tax withholding schedules.',
        });
      }

      // Check 4C: Paid status without payment reference
      if (setl.status === 'PAID' && (!setl.paymentReference || setl.paymentReference.trim().length === 0)) {
        mismatches.push({
          code: 'SETTLEMENT_PAID_WITHOUT_REFERENCE',
          severity: 'WARNING',
          entityType: 'DRIVER_SETTLEMENT',
          entityId: setl._id.toString(),
          referenceNumber: setl.settlementNumber,
          description: `Settlement ${setl.settlementNumber} marked PAID lacks disbursement batch/reference number.`,
          expectedValue: 'Valid payment reference',
          actualValue: null,
          recommendedAction: 'Record banking transfer reference or payroll check number.',
        });
      }
    }

    const criticalCount = mismatches.filter((m) => m.severity === 'CRITICAL').length;
    const warningCount = mismatches.filter((m) => m.severity === 'WARNING').length;
    const infoCount = mismatches.filter((m) => m.severity === 'INFO').length;

    return {
      organizationId: orgId.toString(),
      generatedAt: new Date(),
      isHealthy: criticalCount === 0,
      totalChecksExecuted: checksExecuted,
      totalMismatchesFound: mismatches.length,
      summaryBySeverity: {
        critical: criticalCount,
        warning: warningCount,
        info: infoCount,
      },
      mismatches,
      metrics: {
        invoicesAudited: invoices.length,
        receiptsAudited: receipts.length,
        journalsAudited: journals.length,
        settlementsAudited: settlements.length,
        accountsAudited: accounts.length,
      },
    };
  }
}

