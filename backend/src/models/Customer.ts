import { Schema, model, Document, Types } from 'mongoose';

export interface ICustomer extends Document {
  organizationId: Types.ObjectId;
  name: string;
  type: 'INDIVIDUAL' | 'BUSINESS' | 'ENTERPRISE';
  email: string;
  phone: string;
  billingAddress: {
    street: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  contactPerson?: {
    name: string;
    email?: string;
    phone?: string;
    designation?: string;
  };
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  notes?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for customer tenant isolation'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['INDIVIDUAL', 'BUSINESS', 'ENTERPRISE'],
      default: 'BUSINESS',
    },
    email: {
      type: String,
      required: [true, 'Customer email is required'],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, 'Customer phone number is required'],
      trim: true,
    },
    billingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String, required: true, default: 'USA' },
    },
    contactPerson: {
      name: { type: String },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String },
      designation: { type: String },
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
    notes: { type: String },
    isArchived: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

// Compound tenant isolation index: email or name can be scoped within tenant
CustomerSchema.index({ organizationId: 1, email: 1 });
CustomerSchema.index({ organizationId: 1, name: 1 });
CustomerSchema.index({ organizationId: 1, status: 1, isArchived: 1 });

export const Customer = model<ICustomer>('Customer', CustomerSchema);
