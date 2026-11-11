import { Schema, model, Document, Types } from 'mongoose';

export type FiscalPeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED';

export interface IFinancialPeriod extends Document {
  organizationId: Types.ObjectId;
  periodName: string; // e.g. '2026-Q1', '2026-11'
  startDate: Date;
  endDate: Date;
  status: FiscalPeriodStatus;
  closedBy?: Types.ObjectId;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FinancialPeriodSchema = new Schema<IFinancialPeriod>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    periodName: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED', 'LOCKED'],
      default: 'OPEN',
      index: true,
    },
    closedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    closedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

FinancialPeriodSchema.index({ organizationId: 1, periodName: 1 }, { unique: true });
FinancialPeriodSchema.index({ organizationId: 1, startDate: 1, endDate: 1 });

export const FinancialPeriod = model<IFinancialPeriod>('FinancialPeriod', FinancialPeriodSchema);
