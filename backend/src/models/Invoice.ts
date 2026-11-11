import { Schema, model, Document, Types } from 'mongoose';

export interface IInvoice extends Document {
  organizationId: Types.ObjectId;
  invoiceNumber: string;
  shipmentIds: Types.ObjectId[];
  customer: {
    name: string;
    email: string;
    billingAddress: string;
    taxId?: string;
  };
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'VOID';
  issuedAt: Date;
  dueAt: Date;
  paidAt?: Date;
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
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      billingAddress: { type: String, required: true },
      taxId: { type: String },
    },
    subtotalAmount: { type: Number, required: true },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'VOID'],
      default: 'ISSUED',
      index: true,
    },
    issuedAt: { type: Date, default: Date.now },
    dueAt: { type: Date, required: true },
    paidAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

InvoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });

export const Invoice = model<IInvoice>('Invoice', InvoiceSchema);

