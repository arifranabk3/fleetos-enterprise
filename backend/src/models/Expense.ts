import { Schema, model, Document, Types } from 'mongoose';

export interface IExpense extends Document {
  organizationId: Types.ObjectId;
  vehicleId?: Types.ObjectId;
  driverId?: Types.ObjectId;
  category: 'FUEL' | 'TOLL' | 'LODGING' | 'MAINTENANCE' | 'PERMIT' | 'MISCELLANEOUS';
  amount: number;
  currency: string;
  litersFuel?: number;
  fuelStation?: string;
  odometerReadingKm?: number;
  receiptUrl?: string;
  incurredAt: Date;
  approvedBy?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
    },
    category: {
      type: String,
      enum: ['FUEL', 'TOLL', 'LODGING', 'MAINTENANCE', 'PERMIT', 'MISCELLANEOUS'],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    litersFuel: { type: Number },
    fuelStation: { type: String },
    odometerReadingKm: { type: Number },
    receiptUrl: { type: String },
    incurredAt: { type: Date, default: Date.now, index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
  },
  {
    timestamps: true,
  }
);

ExpenseSchema.index({ organizationId: 1, category: 1, incurredAt: -1 });

export const Expense = model<IExpense>('Expense', ExpenseSchema);

