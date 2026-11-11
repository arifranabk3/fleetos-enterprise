import { Schema, model, Document, Types } from 'mongoose';

export type JournalSourceType = 
  | 'INVOICE_ISSUED' 
  | 'PAYMENT_RECEIVED' 
  | 'PAYMENT_REVERSED' 
  | 'DRIVER_SETTLEMENT' 
  | 'EXPENSE_POSTED' 
  | 'MANUAL_ADJUSTMENT'
  | 'REVERSAL_ENTRY';

export type JournalStatus = 'POSTED' | 'REVERSED';

export interface IJournalLine {
  accountId: Types.ObjectId;
  accountNumber: string;
  accountName: string;
  entryType: 'DEBIT' | 'CREDIT';
  amountCents: number; // Must be strictly > 0
  description?: string;
}

export interface IJournalEntry extends Document {
  organizationId: Types.ObjectId;
  entryNumber: string; // e.g., 'JE-2026-000001'
  postingDate: Date;
  sourceType: JournalSourceType;
  sourceReferenceId: Types.ObjectId;
  sourceReferenceNumber?: string;
  description: string;
  currency: string;
  lines: IJournalLine[];
  totalDebitCents: number;
  totalCreditCents: number;
  status: JournalStatus;
  reversalEntryId?: Types.ObjectId;
  reversalReason?: string;
  postedBy: Types.ObjectId;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JournalEntrySchema = new Schema<IJournalEntry>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    entryNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    postingDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    sourceType: {
      type: String,
      enum: [
        'INVOICE_ISSUED',
        'PAYMENT_RECEIVED',
        'PAYMENT_REVERSED',
        'DRIVER_SETTLEMENT',
        'EXPENSE_POSTED',
        'MANUAL_ADJUSTMENT',
        'REVERSAL_ENTRY',
      ],
      required: true,
      index: true,
    },
    sourceReferenceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    sourceReferenceNumber: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      uppercase: true,
    },
    lines: [
      {
        accountId: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
        accountNumber: { type: String, required: true },
        accountName: { type: String, required: true },
        entryType: { type: String, enum: ['DEBIT', 'CREDIT'], required: true },
        amountCents: { type: Number, required: true, min: 1 },
        description: { type: String },
      },
    ],
    totalDebitCents: {
      type: Number,
      required: true,
    },
    totalCreditCents: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['POSTED', 'REVERSED'],
      default: 'POSTED',
      index: true,
    },
    reversalEntryId: {
      type: Schema.Types.ObjectId,
      ref: 'JournalEntry',
    },
    reversalReason: { type: String },
    postedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook: double-entry balancing validation
JournalEntrySchema.pre('validate', function (next) {
  let debits = 0;
  let credits = 0;

  if (this.lines && this.lines.length > 0) {
    for (const line of this.lines) {
      if (line.entryType === 'DEBIT') {
        debits += Math.round(line.amountCents);
      } else if (line.entryType === 'CREDIT') {
        credits += Math.round(line.amountCents);
      }
    }
  }

  this.totalDebitCents = debits;
  this.totalCreditCents = credits;

  if (debits !== credits) {
    return next(
      new Error(
        `ACCOUNTING_UNBALANCED_ENTRY: Total debits (${debits} cents) must strictly equal total credits (${credits} cents). Difference: ${Math.abs(debits - credits)} cents.`
      )
    );
  }

  if (debits === 0) {
    return next(new Error('ACCOUNTING_ZERO_ENTRY: Journal entry cannot be posted with zero amount.'));
  }

  next();
});

// Compound indexes
JournalEntrySchema.index({ organizationId: 1, entryNumber: 1 }, { unique: true });
JournalEntrySchema.index({ organizationId: 1, sourceType: 1, sourceReferenceId: 1 });
JournalEntrySchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
JournalEntrySchema.index({ organizationId: 1, postingDate: -1 });

export const JournalEntry = model<IJournalEntry>('JournalEntry', JournalEntrySchema);
