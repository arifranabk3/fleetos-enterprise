import { Types } from 'mongoose';
import { Invoice } from '../models/Invoice';
import { PaymentReceipt } from '../models/PaymentReceipt';
import { DriverSettlement } from '../models/DriverSettlement';
import { JournalEntry } from '../models/JournalEntry';
import { LedgerAccount } from '../models/LedgerAccount';
import { Customer } from '../models/Customer';
import { Driver } from '../models/Driver';

export interface RevenueReportOptions {
  startDate?: Date;
  endDate?: Date;
  customerId?: string;
  currency?: string;
}

export interface CashCollectionReportOptions {
  startDate?: Date;
  endDate?: Date;
  customerId?: string;
  paymentMethod?: string;
  currency?: string;
}

export interface DriverSettlementReportOptions {
  startDate?: Date;
  endDate?: Date;
  driverId?: string;
  status?: string;
  currency?: string;
}

export interface GeneralLedgerReportOptions {
  startDate?: Date;
  endDate?: Date;
  accountNumber?: string;
  currency?: string;
}

export class FinancialReportingService {
  /**
   * 1. REVENUE REPORT
   * Returns posted/issued earned revenue broken down by customer, currency, and period.
   * Draft and VOID invoices are strictly excluded.
   */
  static async getRevenueReport(orgId: Types.ObjectId, options: RevenueReportOptions = {}) {
    const filter: any = {
      organizationId: orgId,
      status: { $in: ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'DISPUTED'] },
    };

    if (options.startDate || options.endDate) {
      filter.issuedAt = {};
      if (options.startDate) filter.issuedAt.$gte = options.startDate;
      if (options.endDate) filter.issuedAt.$lte = options.endDate;
    }

    if (options.customerId) {
      filter.customerId = new Types.ObjectId(options.customerId);
    }

    if (options.currency) {
      filter.currency = options.currency.toUpperCase();
    }

    const invoices = await Invoice.find(filter).sort({ issuedAt: -1 }).lean();

    // Grouping by currency
    const summaryByCurrency: Record<
      string,
      {
        totalEarnedRevenueCents: number;
        totalTaxAmountCents: number;
        totalFuelSurchargeCents: number;
        totalSubtotalCents: number;
        invoiceCount: number;
      }
    > = {};

    const byCustomer: Record<
      string,
      {
        customerId: string;
        customerName: string;
        invoiceCount: number;
        totalRevenueCents: number;
      }
    > = {};

    for (const inv of invoices) {
      const cur = inv.currency || 'USD';
      if (!summaryByCurrency[cur]) {
        summaryByCurrency[cur] = {
          totalEarnedRevenueCents: 0,
          totalTaxAmountCents: 0,
          totalFuelSurchargeCents: 0,
          totalSubtotalCents: 0,
          invoiceCount: 0,
        };
      }

      summaryByCurrency[cur].totalEarnedRevenueCents += inv.totalAmountCents || 0;
      summaryByCurrency[cur].totalTaxAmountCents += inv.taxAmountCents || 0;
      summaryByCurrency[cur].totalFuelSurchargeCents += inv.fuelSurchargeCents || 0;
      summaryByCurrency[cur].totalSubtotalCents += inv.subtotalCents || 0;
      summaryByCurrency[cur].invoiceCount++;

      const custIdStr = inv.customerId ? inv.customerId.toString() : 'UNKNOWN';
      const custName = inv.customer?.name || 'Unknown Customer';

      if (!byCustomer[custIdStr]) {
        byCustomer[custIdStr] = {
          customerId: custIdStr,
          customerName: custName,
          invoiceCount: 0,
          totalRevenueCents: 0,
        };
      }
      byCustomer[custIdStr].invoiceCount++;
      byCustomer[custIdStr].totalRevenueCents += inv.totalAmountCents || 0;
    }

    return {
      organizationId: orgId.toString(),
      generatedAt: new Date(),
      period: {
        startDate: options.startDate || null,
        endDate: options.endDate || null,
      },
      summaryByCurrency,
      byCustomer: Object.values(byCustomer),
      invoices: invoices.map((inv) => ({
        id: inv._id.toString(),
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customer?.name,
        issuedAt: inv.issuedAt,
        dueAt: inv.dueAt,
        status: inv.status,
        currency: inv.currency,
        subtotalCents: inv.subtotalCents,
        taxAmountCents: inv.taxAmountCents,
        fuelSurchargeCents: inv.fuelSurchargeCents,
        totalAmountCents: inv.totalAmountCents,
        amountPaidCents: inv.amountPaidCents || 0,
        balanceDueCents: inv.outstandingBalanceCents !== undefined ? inv.outstandingBalanceCents : Math.max(0, inv.totalAmountCents - (inv.amountPaidCents || 0)),
      })),
    };
  }

  /**
   * 2. CASH COLLECTION REPORT
   * Returns all payments received, payment methods, and net collections (gross minus reversals).
   */
  static async getCashCollectionReport(orgId: Types.ObjectId, options: CashCollectionReportOptions = {}) {
    const filter: any = { organizationId: orgId };

    if (options.startDate || options.endDate) {
      filter.paymentDate = {};
      if (options.startDate) filter.paymentDate.$gte = options.startDate;
      if (options.endDate) filter.paymentDate.$lte = options.endDate;
    }

    if (options.customerId) {
      filter.customerId = new Types.ObjectId(options.customerId);
    }

    if (options.paymentMethod) {
      filter.paymentMethod = options.paymentMethod;
    }

    if (options.currency) {
      filter.currency = options.currency.toUpperCase();
    }

    const [receipts, customers] = await Promise.all([
      PaymentReceipt.find(filter).sort({ paymentDate: -1 }).lean(),
      Customer.find({ organizationId: orgId }).lean(),
    ]);

    const customerMap = new Map<string, string>();
    customers.forEach((c) => customerMap.set(c._id.toString(), c.name));

    const summaryByCurrency: Record<
      string,
      {
        grossReceiptsCents: number;
        reversedReceiptsCents: number;
        netCollectionsCents: number;
        activeReceiptCount: number;
        reversedReceiptCount: number;
      }
    > = {};

    const byPaymentMethod: Record<string, { method: string; count: number; totalCents: number }> = {};

    for (const rcpt of receipts) {
      const cur = rcpt.currency || 'USD';
      if (!summaryByCurrency[cur]) {
        summaryByCurrency[cur] = {
          grossReceiptsCents: 0,
          reversedReceiptsCents: 0,
          netCollectionsCents: 0,
          activeReceiptCount: 0,
          reversedReceiptCount: 0,
        };
      }

      if (rcpt.status === 'REVERSED') {
        summaryByCurrency[cur].reversedReceiptsCents += rcpt.amountCents || 0;
        summaryByCurrency[cur].reversedReceiptCount++;
      } else {
        summaryByCurrency[cur].grossReceiptsCents += rcpt.amountCents || 0;
        summaryByCurrency[cur].activeReceiptCount++;
      }
      summaryByCurrency[cur].netCollectionsCents =
        summaryByCurrency[cur].grossReceiptsCents - summaryByCurrency[cur].reversedReceiptsCents;

      // Group by payment method (non-reversed only)
      if (rcpt.status !== 'REVERSED') {
        const method = rcpt.paymentMethod || 'OTHER';
        if (!byPaymentMethod[method]) {
          byPaymentMethod[method] = { method, count: 0, totalCents: 0 };
        }
        byPaymentMethod[method].count++;
        byPaymentMethod[method].totalCents += rcpt.amountCents || 0;
      }
    }

    return {
      organizationId: orgId.toString(),
      generatedAt: new Date(),
      period: {
        startDate: options.startDate || null,
        endDate: options.endDate || null,
      },
      summaryByCurrency,
      byPaymentMethod: Object.values(byPaymentMethod),
      receipts: receipts.map((r) => {
        const custIdStr = r.customerId ? r.customerId.toString() : '';
        return {
          id: r._id.toString(),
          receiptNumber: r.receiptNumber,
          customerName: customerMap.get(custIdStr) || 'Unknown Customer',
          customerId: custIdStr,
          paymentDate: r.paymentDate,
          paymentMethod: r.paymentMethod,
          referenceNumber: r.referenceNumber,
          amountCents: r.amountCents,
          currency: r.currency,
          status: r.status,
          reversalReason: r.reversalReason || null,
          reversedAt: r.reversedAt || null,
          allocationsCount: (r.allocations || []).length,
        };
      }),
    };
  }

  /**
   * 3. ACCOUNTS RECEIVABLE AGING REPORT
   * Returns aged receivables broken down into aging buckets (Current, 1-30, 31-60, 61-90, 90+ days).
   */
  static async getAccountsReceivableAgingReport(orgId: Types.ObjectId, asOfDate = new Date()) {
    const invoices = await Invoice.find({
      organizationId: orgId,
      status: { $in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE', 'DISPUTED'] },
    }).lean();

    const byCurrency: Record<
      string,
      {
        totalOutstandingCents: number;
        currentCents: number;
        days1To30Cents: number;
        days31To60Cents: number;
        days61To90Cents: number;
        over90DaysCents: number;
        invoiceCount: number;
        customers: Record<
          string,
          {
            customerId: string;
            customerName: string;
            outstandingBalanceCents: number;
            invoices: Array<{
              id: string;
              invoiceNumber: string;
              dueAt: Date;
              daysOverdue: number;
              balanceCents: number;
              bucket: string;
            }>;
          }
        >;
      }
    > = {};

    for (const inv of invoices) {
      const cur = inv.currency || 'USD';
      if (!byCurrency[cur]) {
        byCurrency[cur] = {
          totalOutstandingCents: 0,
          currentCents: 0,
          days1To30Cents: 0,
          days31To60Cents: 0,
          days61To90Cents: 0,
          over90DaysCents: 0,
          invoiceCount: 0,
          customers: {},
        };
      }

      const balCents = inv.outstandingBalanceCents !== undefined ? inv.outstandingBalanceCents : Math.max(0, inv.totalAmountCents - (inv.amountPaidCents || 0));
      if (balCents <= 0) continue;

      const dueDate = new Date(inv.dueAt);
      const diffTime = asOfDate.getTime() - dueDate.getTime();
      const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      let bucket = 'CURRENT';
      if (daysOverdue > 90) {
        bucket = 'OVER_90';
        byCurrency[cur].over90DaysCents += balCents;
      } else if (daysOverdue >= 61) {
        bucket = 'DAYS_61_TO_90';
        byCurrency[cur].days61To90Cents += balCents;
      } else if (daysOverdue >= 31) {
        bucket = 'DAYS_31_TO_60';
        byCurrency[cur].days31To60Cents += balCents;
      } else if (daysOverdue >= 1) {
        bucket = 'DAYS_1_TO_30';
        byCurrency[cur].days1To30Cents += balCents;
      } else {
        byCurrency[cur].currentCents += balCents;
      }

      byCurrency[cur].totalOutstandingCents += balCents;
      byCurrency[cur].invoiceCount++;

      const custIdStr = inv.customerId ? inv.customerId.toString() : 'UNKNOWN';
      const custName = inv.customer?.name || 'Unknown Customer';

      if (!byCurrency[cur].customers[custIdStr]) {
        byCurrency[cur].customers[custIdStr] = {
          customerId: custIdStr,
          customerName: custName,
          outstandingBalanceCents: 0,
          invoices: [],
        };
      }

      byCurrency[cur].customers[custIdStr].outstandingBalanceCents += balCents;
      byCurrency[cur].customers[custIdStr].invoices.push({
        id: inv._id.toString(),
        invoiceNumber: inv.invoiceNumber,
        dueAt: inv.dueAt,
        daysOverdue: Math.max(0, daysOverdue),
        balanceCents: balCents,
        bucket,
      });
    }

    return {
      organizationId: orgId.toString(),
      asOfDate,
      byCurrency,
    };
  }

  /**
   * 4. CUSTOMER ACCOUNT STATEMENT
   * Reconciles all invoices, payments, credit applications, and reversals for a specific customer.
   */
  static async getCustomerStatement(
    orgId: Types.ObjectId,
    customerId: string,
    options: { startDate?: Date; endDate?: Date } = {}
  ) {
    const custObjectId = new Types.ObjectId(customerId);
    const customer = await Customer.findOne({ _id: custObjectId, organizationId: orgId }).lean();

    if (!customer) {
      throw new Error('Customer account not found in organization context.');
    }

    // Invoices for customer
    const invoiceFilter: any = {
      organizationId: orgId,
      customerId: custObjectId,
    };
    if (options.startDate || options.endDate) {
      invoiceFilter.issuedAt = {};
      if (options.startDate) invoiceFilter.issuedAt.$gte = options.startDate;
      if (options.endDate) invoiceFilter.issuedAt.$lte = options.endDate;
    }
    const invoices = await Invoice.find(invoiceFilter).sort({ issuedAt: 1 }).lean();

    // Receipts for customer
    const receiptFilter: any = {
      organizationId: orgId,
      customerId: custObjectId,
    };
    if (options.startDate || options.endDate) {
      receiptFilter.paymentDate = {};
      if (options.startDate) receiptFilter.paymentDate.$gte = options.startDate;
      if (options.endDate) receiptFilter.paymentDate.$lte = options.endDate;
    }
    const receipts = await PaymentReceipt.find(receiptFilter).sort({ paymentDate: 1 }).lean();

    // Compile chronological activity ledger
    type StatementEntry = {
      date: Date;
      type: 'INVOICE' | 'PAYMENT' | 'REVERSAL';
      referenceNumber: string;
      description: string;
      debitCents: number; // Increases customer balance (Invoice)
      creditCents: number; // Decreases customer balance (Payment)
      status: string;
    };

    const entries: StatementEntry[] = [];

    for (const inv of invoices) {
      if (inv.status === 'VOID') continue;
      entries.push({
        date: inv.issuedAt,
        type: 'INVOICE',
        referenceNumber: inv.invoiceNumber,
        description: `Freight Invoice ${inv.invoiceNumber} (Due ${new Date(inv.dueAt).toISOString().split('T')[0]})`,
        debitCents: inv.totalAmountCents,
        creditCents: 0,
        status: inv.status,
      });
    }

    for (const rcpt of receipts) {
      if (rcpt.status === 'REVERSED') {
        entries.push({
          date: rcpt.reversedAt || rcpt.paymentDate,
          type: 'REVERSAL',
          referenceNumber: `REV-${rcpt.receiptNumber}`,
          description: `Payment Reversal for ${rcpt.receiptNumber}: ${rcpt.reversalReason || 'NSF / Error'}`,
          debitCents: rcpt.amountCents, // Reversal reinstates customer balance
          creditCents: 0,
          status: 'REVERSED',
        });
      } else {
        entries.push({
          date: rcpt.paymentDate,
          type: 'PAYMENT',
          referenceNumber: rcpt.receiptNumber,
          description: `Payment Received via ${rcpt.paymentMethod} (Ref: ${rcpt.referenceNumber || 'N/A'})`,
          debitCents: 0,
          creditCents: rcpt.amountCents,
          status: rcpt.status,
        });
      }
    }

    // Sort chronologically
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalanceCents = 0;
    const ledger = entries.map((e) => {
      runningBalanceCents += e.debitCents - e.creditCents;
      return {
        ...e,
        runningBalanceCents,
      };
    });

    const totalInvoicedCents = entries.filter((e) => e.type === 'INVOICE').reduce((s, e) => s + e.debitCents, 0);
    const totalPaidCents = entries.filter((e) => e.type === 'PAYMENT').reduce((s, e) => s + e.creditCents, 0);
    const totalReversedCents = entries.filter((e) => e.type === 'REVERSAL').reduce((s, e) => s + e.debitCents, 0);

    return {
      organizationId: orgId.toString(),
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        billingAddress: customer.billingAddress,
      },
      period: {
        startDate: options.startDate || null,
        endDate: options.endDate || null,
      },
      summary: {
        totalInvoicedCents,
        totalPaidCents,
        totalReversedCents,
        closingBalanceCents: runningBalanceCents,
      },
      ledger,
    };
  }

  /**
   * 5. DRIVER SETTLEMENT & PAYROLL REPORT
   * Returns gross pay, safety bonuses, deductions, and payout status for driver workforce.
   */
  static async getDriverSettlementReport(orgId: Types.ObjectId, options: DriverSettlementReportOptions = {}) {
    const filter: any = { organizationId: orgId };

    if (options.startDate || options.endDate) {
      filter.periodStart = {};
      if (options.startDate) filter.periodStart.$gte = options.startDate;
      if (options.endDate) filter.periodStart.$lte = options.endDate;
    }

    if (options.driverId) {
      filter.driverId = new Types.ObjectId(options.driverId);
    }

    if (options.status) {
      filter.status = options.status;
    }

    const [settlements, drivers] = await Promise.all([
      DriverSettlement.find(filter).sort({ periodStart: -1 }).lean(),
      Driver.find({ organizationId: orgId }).lean(),
    ]);

    const driverMap = new Map<string, any>();
    drivers.forEach((d) => driverMap.set(d._id.toString(), d));

    const summary = {
      totalGrossPayCents: 0,
      totalSafetyBonusCents: 0,
      totalDeductionsCents: 0,
      totalNetPayCents: 0,
      totalPaidCents: 0,
      totalPayableOutstandingCents: 0,
      countDraft: 0,
      countApproved: 0,
      countPaid: 0,
    };

    const records = settlements.map((s) => {
      const driver = driverMap.get(s.driverId.toString());
      const bonusesTotal = (s.bonuses || []).reduce((sum, b) => sum + (b.amountCents || 0), 0);
      const deductionsTotal = (s.deductions || []).reduce((sum, d) => sum + (d.amountCents || 0), 0);

      summary.totalGrossPayCents += s.grossPayCents || 0;
      summary.totalSafetyBonusCents += bonusesTotal;
      summary.totalDeductionsCents += deductionsTotal;
      summary.totalNetPayCents += s.netPayCents || 0;

      if (s.status === 'PAID') {
        summary.totalPaidCents += s.netPayCents || 0;
        summary.countPaid++;
      } else {
        summary.totalPayableOutstandingCents += s.netPayCents || 0;
        if (s.status === 'APPROVED') summary.countApproved++;
        else summary.countDraft++;
      }

      return {
        id: s._id.toString(),
        settlementNumber: s.settlementNumber,
        driverId: s.driverId.toString(),
        driverName: driver?.fullName || driver?.name || 'Driver',
        licenseNumber: driver?.licenseNumber || driver?.driverLicenseNumber || '',
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        status: s.status,
        currency: s.currency,
        totalDispatches: s.totalDispatches || 0,
        totalDistanceKm: s.totalDistanceKm || 0,
        totalHoursWorked: s.totalHoursWorked || 0,
        grossPayCents: s.grossPayCents,
        bonusCents: bonusesTotal,
        deductionCents: deductionsTotal,
        netPayCents: s.netPayCents,
        paidAt: s.paidAt || null,
        paymentReference: s.paymentReference || null,
      };
    });

    return {
      organizationId: orgId.toString(),
      generatedAt: new Date(),
      period: {
        startDate: options.startDate || null,
        endDate: options.endDate || null,
      },
      summary,
      settlements: records,
    };
  }

  /**
   * 6. GENERAL LEDGER TRIAL BALANCE & JOURNAL REPORT
   * Returns trial balance by account code and itemized journal movements.
   */
  static async getGeneralLedgerReport(orgId: Types.ObjectId, options: GeneralLedgerReportOptions = {}) {
    const journalFilter: any = { organizationId: orgId };

    if (options.startDate || options.endDate) {
      journalFilter.postingDate = {};
      if (options.startDate) journalFilter.postingDate.$gte = options.startDate;
      if (options.endDate) journalFilter.postingDate.$lte = options.endDate;
    }

    const [accounts, journals] = await Promise.all([
      LedgerAccount.find({ organizationId: orgId }).sort({ accountNumber: 1 }).lean(),
      JournalEntry.find(journalFilter).sort({ postingDate: 1 }).lean(),
    ]);

    // Compute movements per account
    const accountMovements: Record<
      string,
      {
        accountNumber: string;
        name: string;
        type: string;
        normalBalance: string;
        currency: string;
        debitCents: number;
        creditCents: number;
        netBalanceCents: number;
      }
    > = {};

    accounts.forEach((acc) => {
      accountMovements[acc.accountNumber] = {
        accountNumber: acc.accountNumber,
        name: acc.name,
        type: acc.type,
        normalBalance: acc.normalBalance,
        currency: acc.currency,
        debitCents: 0,
        creditCents: 0,
        netBalanceCents: 0,
      };
    });

    let totalDebitsCents = 0;
    let totalCreditsCents = 0;

    for (const je of journals) {
      if (je.status === 'REVERSED') continue;

      for (const line of je.lines || []) {
        if (!accountMovements[line.accountNumber]) {
          accountMovements[line.accountNumber] = {
            accountNumber: line.accountNumber,
            name: line.accountName || line.accountNumber,
            type: 'UNKNOWN',
            normalBalance: 'DEBIT',
            currency: je.currency || 'USD',
            debitCents: 0,
            creditCents: 0,
            netBalanceCents: 0,
          };
        }

        if (line.entryType === 'DEBIT') {
          accountMovements[line.accountNumber].debitCents += line.amountCents;
          totalDebitsCents += line.amountCents;
        } else {
          accountMovements[line.accountNumber].creditCents += line.amountCents;
          totalCreditsCents += line.amountCents;
        }
      }
    }

    // Compute net ending balance based on normal balance convention
    const trialBalance = Object.values(accountMovements).map((acc) => {
      if (acc.normalBalance === 'DEBIT') {
        acc.netBalanceCents = acc.debitCents - acc.creditCents;
      } else {
        acc.netBalanceCents = acc.creditCents - acc.debitCents;
      }
      return acc;
    });

    return {
      organizationId: orgId.toString(),
      generatedAt: new Date(),
      period: {
        startDate: options.startDate || null,
        endDate: options.endDate || null,
      },
      trialBalanceTotals: {
        totalDebitsCents,
        totalCreditsCents,
        isBalanced: totalDebitsCents === totalCreditsCents,
      },
      accounts: trialBalance,
      journals: journals.map((j) => ({
        id: j._id.toString(),
        entryNumber: j.entryNumber,
        postingDate: j.postingDate,
        sourceType: j.sourceType,
        sourceReferenceNumber: j.sourceReferenceNumber,
        description: j.description,
        totalDebitCents: j.totalDebitCents,
        totalCreditCents: j.totalCreditCents,
        status: j.status,
        linesCount: (j.lines || []).length,
      })),
    };
  }
}

