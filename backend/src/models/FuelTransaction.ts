import { Schema, model, Document, Types } from 'mongoose';
import { SupportedFuelType } from './FuelVendor';

export type FuelTransactionSource = 'MANUAL' | 'IMPORT' | 'DEVICE';
export type FuelVerificationStatus = 'VERIFIED' | 'PENDING_REVIEW' | 'FLAGGED_ANOMALY' | 'REJECTED';
export type FuelPaymentMethod = 'FUEL_CARD' | 'CREDIT_CARD' | 'CASH' | 'COMPANY_ACCOUNT';

export interface IFuelTransaction extends Document {
  organizationId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  driverId?: Types.ObjectId;
  fuelVendorId?: Types.ObjectId;
  transactionReference: string;
  transactionDate: Date;
  fuelType: SupportedFuelType;
  quantityLiters: number; // or kWh for electric vehicles
  pricePerLiter: number;  // or price per kWh
  totalCost: number;
  odometerReading: number;
  previousOdometerReading?: number;
  distanceSinceLastRefuel?: number;
  fuelEfficiency?: number; // km/L or km/kWh
  efficiencyStatus: 'CALCULATED' | 'ESTIMATED' | 'UNAVAILABLE';
  paymentMethod: FuelPaymentMethod;
  receiptReference?: string;
  expenseId?: Types.ObjectId; // Traceable reference to synced Expense record
  notes?: string;
  source: FuelTransactionSource;
  verificationStatus: FuelVerificationStatus;
  anomalyFlags?: string[];
  isVoided: boolean;
  voidReason?: string;
  voidedAt?: Date;
  voidedBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FuelTransactionSchema = new Schema<IFuelTransaction>(
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
      required: true,
      index: true,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      index: true,
    },
    fuelVendorId: {
      type: Schema.Types.ObjectId,
      ref: 'FuelVendor',
      index: true,
    },
    transactionReference: {
      type: String,
      required: true,
      trim: true,
    },
    transactionDate: {
      type: Date,
      required: true,
      index: true,
    },
    fuelType: {
      type: String,
      enum: ['DIESEL', 'PETROL', 'CNG', 'ELECTRIC', 'OTHER'],
      required: true,
      index: true,
    },
    quantityLiters: {
      type: Number,
      required: true,
      min: [0.01, 'Quantity must be positive'],
    },
    pricePerLiter: {
      type: Number,
      required: true,
      min: [0.01, 'Price per unit must be positive'],
    },
    totalCost: {
      type: Number,
      required: true,
      min: [0.01, 'Total cost must be positive'],
    },
    odometerReading: {
      type: Number,
      required: true,
      min: [0, 'Odometer reading cannot be negative'],
    },
    previousOdometerReading: {
      type: Number,
      min: 0,
    },
    distanceSinceLastRefuel: {
      type: Number,
      min: 0,
    },
    fuelEfficiency: {
      type: Number,
      min: 0,
    },
    efficiencyStatus: {
      type: String,
      enum: ['CALCULATED', 'ESTIMATED', 'UNAVAILABLE'],
      default: 'UNAVAILABLE',
    },
    paymentMethod: {
      type: String,
      enum: ['FUEL_CARD', 'CREDIT_CARD', 'CASH', 'COMPANY_ACCOUNT'],
      default: 'COMPANY_ACCOUNT',
    },
    receiptReference: {
      type: String,
      trim: true,
    },
    expenseId: {
      type: Schema.Types.ObjectId,
      ref: 'Expense',
      index: true,
    },
    notes: { type: String },
    source: {
      type: String,
      enum: ['MANUAL', 'IMPORT', 'DEVICE'],
      default: 'MANUAL',
    },
    verificationStatus: {
      type: String,
      enum: ['VERIFIED', 'PENDING_REVIEW', 'FLAGGED_ANOMALY', 'REJECTED'],
      default: 'VERIFIED',
      index: true,
    },
    anomalyFlags: [{ type: String }],
    isVoided: {
      type: Boolean,
      default: false,
      index: true,
    },
    voidReason: { type: String },
    voidedAt: { type: Date },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound tenant index: prevent duplicate transactionReference in the same organization
FuelTransactionSchema.index({ organizationId: 1, transactionReference: 1 }, { unique: true });
FuelTransactionSchema.index({ organizationId: 1, vehicleId: 1, transactionDate: -1 });
FuelTransactionSchema.index({ organizationId: 1, verificationStatus: 1 });

export const FuelTransaction = model<IFuelTransaction>('FuelTransaction', FuelTransactionSchema);
