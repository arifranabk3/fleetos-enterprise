import { Schema, model, Document, Types } from 'mongoose';

export type PaymentMethod = 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CHECK' | 'CASH' | 'ACH' | 'WIRE' | 'OTHER';
export type PaymentReceiptStatus = 'RECORDED' | 'RECONCILED' | 'REVERSED';

export interface IInvoiceAllocation {
  invoiceId: Types.ObjectId;
  invoiceNumber: string;
  allocatedAmountCents: number;
}

export interface IPaymentReceipt extends Document {
  organizationId: Types.ObjectId;
  receiptNumber: string;
  customerId: Types.ObjectId;
  amountCents: number;
  currency: string;
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  referenceNumber: string; // Check number, wire ref, transaction id
  allocations: IInvoiceAllocation[];
  status: PaymentReceiptStatus;
  recordedBy: Types.ObjectId;
  reversalReason?: string;
  reversedBy?: Types.ObjectId;
  reversedAt?: Date;
  idempotencyKey?: string;
  notes?: string;
  auditTrail: Array<{
    action: string;
    performedBy: Types.ObjectId;
    timestamp: Date;
    note?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentReceiptSchema = new Schema<IPaymentReceipt>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    receiptNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    amountCents: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      uppercase: true,
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['BANK_TRANSFER', 'CREDIT_CARD', 'CHECK', 'CASH', 'ACH', 'WIRE', 'OTHER'],
      required: true,
    },
    referenceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    allocations: [
      {
        invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
        invoiceNumber: { type: String, required: true },
        allocatedAmountCents: { type: Number, required: true, min: 1 },
      },
    ],
    status: {
      type: String,
      enum: ['RECORDED', 'RECONCILED', 'REVERSED'],
      default: 'RECORDED',
      index: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reversalReason: { type: String },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reversedAt: { type: Date },
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
    },
    notes: { type: String },
    auditTrail: [
      {
        action: { type: String, required: true },
        performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound indexes
PaymentReceiptSchema.index({ organizationId: 1, receiptNumber: 1 }, { unique: true });
PaymentReceiptSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
PaymentReceiptSchema.index({ organizationId: 1, customerId: 1, paymentDate: -1 });
PaymentReceiptSchema.index({ organizationId: 1, status: 1 });

export const PaymentReceipt = model<IPaymentReceipt>('PaymentReceipt', PaymentReceiptSchema);
