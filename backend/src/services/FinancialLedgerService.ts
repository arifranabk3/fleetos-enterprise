import { Types } from 'mongoose';
import { JournalEntry, IJournalEntry, IJournalLine, JournalSourceType } from '../models/JournalEntry';
import { LedgerAccount } from '../models/LedgerAccount';
import { FinancialPeriod } from '../models/FinancialPeriod';
import { ITenantContext } from '../repositories/BaseTenantRepository';

export interface PostJournalParams {
  entryNumber: string;
  postingDate?: Date;
  sourceType: JournalSourceType;
  sourceReferenceId: Types.ObjectId;
  sourceReferenceNumber?: string;
  description: string;
  currency?: string;
  lines: Array<{
    accountId: Types.ObjectId;
    entryType: 'DEBIT' | 'CREDIT';
    amountCents: number;
    description?: string;
  }>;
  postedBy: Types.ObjectId;
  idempotencyKey?: string;
}

export class FinancialLedgerService {
  /**
   * Initializes standard Chart of Accounts for a new or existing organization.
   * Idempotent: existing accounts are preserved.
   */
  static async initializeChartOfAccounts(tenant: ITenantContext): Promise<void> {
    const orgId = typeof tenant.organizationId === 'string' ? new Types.ObjectId(tenant.organizationId) : tenant.organizationId;

    const defaultAccounts = [
      { accountNumber: '1010', name: 'Operating Cash', type: 'ASSET', normalBalance: 'DEBIT' },
      { accountNumber: '1100', name: 'Accounts Receivable', type: 'ASSET', normalBalance: 'DEBIT' },
      { accountNumber: '1200', name: 'Prepaid Expenses', type: 'ASSET', normalBalance: 'DEBIT' },
      { accountNumber: '2010', name: 'Accounts Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
      { accountNumber: '2100', name: 'Driver Settlements Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
      { accountNumber: '2200', name: 'Sales Tax Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
      { accountNumber: '3000', name: 'Retained Earnings', type: 'EQUITY', normalBalance: 'CREDIT' },
      { accountNumber: '4010', name: 'Freight Transportation Revenue', type: 'REVENUE', normalBalance: 'CREDIT' },
      { accountNumber: '4020', name: 'Fuel Surcharge Revenue', type: 'REVENUE', normalBalance: 'CREDIT' },
      { accountNumber: '4030', name: 'Accessorial & Ancillary Revenue', type: 'REVENUE', normalBalance: 'CREDIT' },
      { accountNumber: '5010', name: 'Driver Compensation Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
      { accountNumber: '5020', name: 'Fuel Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
      { accountNumber: '5030', name: 'Vehicle Maintenance Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
    ];

    for (const acc of defaultAccounts) {
      await LedgerAccount.findOneAndUpdate(
        { organizationId: orgId, accountNumber: acc.accountNumber },
        {
          $setOnInsert: {
            organizationId: orgId,
            accountNumber: acc.accountNumber,
            name: acc.name,
            type: acc.type,
            normalBalance: acc.normalBalance,
            isActive: true,
            balanceCents: 0,
            currency: 'USD',
          },
        },
        { upsert: true, new: true }
      );
    }
  }

  /**
   * Posts a balanced, immutable journal entry to the general ledger.
   * Strictly enforces:
   * 1. Tenant isolation
   * 2. Double-entry balancing (total debits = total credits)
   * 3. Open financial period verification
   * 4. Idempotency protection against duplicate postings
   * 5. Running balance updates on ledger accounts
   */
  static async postJournalEntry(tenant: ITenantContext, params: PostJournalParams): Promise<IJournalEntry> {
    const orgId = typeof tenant.organizationId === 'string' ? new Types.ObjectId(tenant.organizationId) : tenant.organizationId;

    // 1. Check idempotency key if provided
    if (params.idempotencyKey) {
      const existing = await JournalEntry.findOne({
        organizationId: orgId,
        idempotencyKey: params.idempotencyKey,
      });
      if (existing) {
        return existing;
      }
    }

    const postingDate = params.postingDate || new Date();

    // 2. Verify financial period is not closed
    const closedPeriod = await FinancialPeriod.findOne({
      organizationId: orgId,
      startDate: { $lte: postingDate },
      endDate: { $gte: postingDate },
      status: { $in: ['CLOSED', 'LOCKED'] },
    });
    if (closedPeriod) {
      throw new Error(`ACCOUNTING_PERIOD_CLOSED: Cannot post transaction to closed/locked period '${closedPeriod.periodName}'.`);
    }

    // 3. Hydrate account details and build lines
    const hydratedLines: IJournalLine[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const line of params.lines) {
      const account = await LedgerAccount.findOne({
        organizationId: orgId,
        _id: line.accountId,
      });
      if (!account) {
        throw new Error(`ACCOUNT_NOT_FOUND: Account ID '${line.accountId}' does not exist in organization.`);
      }
      if (!account.isActive) {
        throw new Error(`ACCOUNT_INACTIVE: Account '${account.accountNumber}' is inactive.`);
      }

      const amountCents = Math.round(line.amountCents);
      if (amountCents <= 0) {
        throw new Error('LINE_AMOUNT_INVALID: Journal line amount must be greater than zero.');
      }

      if (line.entryType === 'DEBIT') {
        totalDebits += amountCents;
      } else {
        totalCredits += amountCents;
      }

      hydratedLines.push({
        accountId: account._id as Types.ObjectId,
        accountNumber: account.accountNumber,
        accountName: account.name,
        entryType: line.entryType,
        amountCents,
        description: line.description,
      });
    }

    // 4. Double-entry balancing rule check
    if (totalDebits !== totalCredits) {
      throw new Error(
        `ACCOUNTING_UNBALANCED_ENTRY: Debits (${totalDebits} cents) must strictly equal credits (${totalCredits} cents). Difference: ${Math.abs(totalDebits - totalCredits)} cents.`
      );
    }

    // 5. Create immutable journal entry
    const entry = await JournalEntry.create({
      organizationId: orgId,
      entryNumber: params.entryNumber,
      postingDate,
      sourceType: params.sourceType,
      sourceReferenceId: params.sourceReferenceId,
      sourceReferenceNumber: params.sourceReferenceNumber,
      description: params.description,
      currency: params.currency || 'USD',
      lines: hydratedLines,
      totalDebitCents: totalDebits,
      totalCreditCents: totalCredits,
      status: 'POSTED',
      postedBy: params.postedBy,
      idempotencyKey: params.idempotencyKey,
    });

    // 6. Update running account balances
    for (const line of hydratedLines) {
      const account = await LedgerAccount.findOne({ organizationId: orgId, _id: line.accountId });
      if (account) {
        const isDebitNormal = account.normalBalance === 'DEBIT';
        const change = line.entryType === 'DEBIT' ? line.amountCents : -line.amountCents;
        account.balanceCents += isDebitNormal ? change : -change;
        await account.save();
      }
    }

    return entry;
  }

  /**
   * Reverses a posted journal entry with a balanced counter-entry.
   * Adheres strictly to immutability: posted journal entries are never modified or deleted.
   */
  static async reverseJournalEntry(
    tenant: ITenantContext,
    originalEntryId: Types.ObjectId,
    reversalReason: string,
    reversedBy: Types.ObjectId
  ): Promise<IJournalEntry> {
    const orgId = typeof tenant.organizationId === 'string' ? new Types.ObjectId(tenant.organizationId) : tenant.organizationId;

    const original = await JournalEntry.findOne({ organizationId: orgId, _id: originalEntryId });
    if (!original) {
      throw new Error('JOURNAL_NOT_FOUND: Original journal entry does not exist.');
    }
    if (original.status === 'REVERSED') {
      throw new Error('JOURNAL_ALREADY_REVERSED: This journal entry has already been reversed.');
    }

    // Build counter-lines (swapping DEBIT and CREDIT)
    const reversedLines = original.lines.map((l) => ({
      accountId: l.accountId,
      entryType: (l.entryType === 'DEBIT' ? 'CREDIT' : 'DEBIT') as 'DEBIT' | 'CREDIT',
      amountCents: l.amountCents,
      description: `Reversal of line: ${l.description || original.description}`,
    }));

    const reversalEntryNumber = `${original.entryNumber}-REV`;

    const reversalEntry = await this.postJournalEntry(tenant, {
      entryNumber: reversalEntryNumber,
      postingDate: new Date(),
      sourceType: 'REVERSAL_ENTRY',
      sourceReferenceId: original._id as Types.ObjectId,
      sourceReferenceNumber: original.entryNumber,
      description: `Reversal: ${reversalReason} (Ref: ${original.entryNumber})`,
      currency: original.currency,
      lines: reversedLines,
      postedBy: reversedBy,
      idempotencyKey: `REV-${original._id.toString()}`,
    });

    original.status = 'REVERSED';
    original.reversalEntryId = reversalEntry._id as Types.ObjectId;
    original.reversalReason = reversalReason;
    await original.save();

    return reversalEntry;
  }
}
