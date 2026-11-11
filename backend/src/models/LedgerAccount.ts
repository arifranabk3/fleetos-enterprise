import { Schema, model, Document, Types } from 'mongoose';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';

export interface ILedgerAccount extends Document {
  organizationId: Types.ObjectId;
  accountNumber: string; // e.g., '1100' for Accounts Receivable, '4100' for Freight Revenue
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  description?: string;
  isActive: boolean;
  currency: string;
  balanceCents: number; // Running balance in integer cents
  createdAt: Date;
  updatedAt: Date;
}

const LedgerAccountSchema = new Schema<ILedgerAccount>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
      required: true,
    },
    normalBalance: {
      type: String,
      enum: ['DEBIT', 'CREDIT'],
      required: true,
    },
    description: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    currency: { type: String, default: 'USD', uppercase: true },
    balanceCents: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

LedgerAccountSchema.index({ organizationId: 1, accountNumber: 1 }, { unique: true });
LedgerAccountSchema.index({ organizationId: 1, type: 1 });

export const LedgerAccount = model<ILedgerAccount>('LedgerAccount', LedgerAccountSchema);
