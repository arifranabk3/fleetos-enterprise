import { Schema, model, Document, Types } from 'mongoose';

export type InvoiceStatus = 
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'DISPUTED'
  | 'VOID';

export interface IInvoiceLineItem {
  shipmentId?: Types.ObjectId;
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRatePercent: number; // e.g. 8.25 for 8.25%
  taxAmountCents: number;
  discountAmountCents: number;
  fuelSurchargeCents: number;
  totalCents: number;
}

export interface IRateSnapshot {
  rateMatrixId?: Types.ObjectId;
  code: string;
  version: number;
  pricingModel: string;
  baseFeeCents: number;
  perKmRateCents: number;
  perKgRateCents: number;
  fuelSurchargePercent: number;
  capturedAt: Date;
}

export interface IInvoice extends Document {
  organizationId: Types.ObjectId;
  invoiceNumber: string;
  shipmentIds: Types.ObjectId[];
  customerId?: Types.ObjectId;
  customer: {
    name: string;
    email: string;
    billingAddress: string;
    taxId?: string;
  };
  lineItems: IInvoiceLineItem[];
  rateSnapshot?: IRateSnapshot;

  // Exact integer-cent amounts
  subtotalCents: number;
  taxAmountCents: number;
  fuelSurchargeCents: number;
  discountCents: number;
  totalAmountCents: number;
  amountPaidCents: number;
  outstandingBalanceCents: number;

  // Legacy float fields preserved for backwards compatibility with Phase 02 tests
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;

  currency: string;
  status: InvoiceStatus;
  paymentTerms: 'NET_15' | 'NET_30' | 'NET_60' | 'DUE_ON_RECEIPT';
  issuedAt: Date;
  dueAt: Date;
  paidAt?: Date;
  voidedAt?: Date;
  voidReason?: string;
  notes?: string;

  auditTrail: Array<{
    action: string;
    performedBy?: Types.ObjectId;
    timestamp: Date;
    note?: string;
    previousStatus?: string;
    newStatus?: string;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    shipmentIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Shipment',
      },
    ],
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      index: true,
    },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      billingAddress: { type: String, required: true },
      taxId: { type: String },
    },
    lineItems: [
      {
        shipmentId: { type: Schema.Types.ObjectId, ref: 'Shipment' },
        description: { type: String, required: true },
        quantity: { type: Number, required: true, default: 1 },
        unitPriceCents: { type: Number, required: true, default: 0 },
        taxRatePercent: { type: Number, default: 0 },
        taxAmountCents: { type: Number, default: 0 },
        discountAmountCents: { type: Number, default: 0 },
        fuelSurchargeCents: { type: Number, default: 0 },
        totalCents: { type: Number, required: true, default: 0 },
      },
    ],
    rateSnapshot: {
      rateMatrixId: { type: Schema.Types.ObjectId, ref: 'RateMatrix' },
      code: { type: String },
      version: { type: Number },
      pricingModel: { type: String },
      baseFeeCents: { type: Number },
      perKmRateCents: { type: Number },
      perKgRateCents: { type: Number },
      fuelSurchargePercent: { type: Number },
      capturedAt: { type: Date, default: Date.now },
    },
    // Exact integer cents fields
    subtotalCents: { type: Number, required: true, default: 0 },
    taxAmountCents: { type: Number, required: true, default: 0 },
    fuelSurchargeCents: { type: Number, required: true, default: 0 },
    discountCents: { type: Number, required: true, default: 0 },
    totalAmountCents: { type: Number, required: true, default: 0 },
    amountPaidCents: { type: Number, required: true, default: 0 },
    outstandingBalanceCents: { type: Number, required: true, default: 0 },

    // Legacy float fields (auto-synced in pre-save)
    subtotalAmount: { type: Number, required: true },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },

    currency: { type: String, default: 'USD', uppercase: true },
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'DISPUTED', 'VOID'],
      default: 'ISSUED',
      index: true,
    },
    paymentTerms: {
      type: String,
      enum: ['NET_15', 'NET_30', 'NET_60', 'DUE_ON_RECEIPT'],
      default: 'NET_30',
    },
    issuedAt: { type: Date, default: Date.now, index: true },
    dueAt: { type: Date, required: true, index: true },
    paidAt: { type: Date },
    voidedAt: { type: Date },
    voidReason: { type: String },
    notes: { type: String },
    auditTrail: [
      {
        action: { type: String, required: true },
        performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
        previousStatus: { type: String },
        newStatus: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook: synchronize legacy float fields and integer cent fields automatically
InvoiceSchema.pre('validate', function (next) {
  if (this.totalAmountCents === 0 && this.totalAmount > 0) {
    this.totalAmountCents = Math.round(this.totalAmount * 100);
    this.subtotalCents = Math.round((this.subtotalAmount || this.totalAmount) * 100);
    this.taxAmountCents = Math.round((this.taxAmount || 0) * 100);
    this.outstandingBalanceCents = this.totalAmountCents - (this.amountPaidCents || 0);
  } else if (this.totalAmountCents > 0 && (!this.totalAmount || this.totalAmount === 0)) {
    this.totalAmount = this.totalAmountCents / 100;
    this.subtotalAmount = this.subtotalCents / 100;
    this.taxAmount = this.taxAmountCents / 100;
    this.outstandingBalanceCents = this.totalAmountCents - (this.amountPaidCents || 0);
  }
  next();
});

// Compound indexes for tenant isolation, unique numbering and querying
InvoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ organizationId: 1, customerId: 1, status: 1 });
InvoiceSchema.index({ organizationId: 1, status: 1, dueAt: 1 });
InvoiceSchema.index({ organizationId: 1, shipmentIds: 1 });

export const Invoice = model<IInvoice>('Invoice', InvoiceSchema);
