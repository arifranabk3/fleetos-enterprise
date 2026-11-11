import { Schema, model, Document, Types } from 'mongoose';

export type SupportedFuelType = 'DIESEL' | 'PETROL' | 'CNG' | 'ELECTRIC' | 'OTHER';

export interface IFuelVendor extends Document {
  organizationId: Types.ObjectId;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  supportedFuelTypes: SupportedFuelType[];
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FuelVendorSchema = new Schema<IFuelVendor>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    contactPerson: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String, default: 'USA' },
    },
    supportedFuelTypes: [
      {
        type: String,
        enum: ['DIESEL', 'PETROL', 'CNG', 'ELECTRIC', 'OTHER'],
        default: ['DIESEL'],
      },
    ],
    notes: { type: String },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  }
);

FuelVendorSchema.index({ organizationId: 1, name: 1 });
FuelVendorSchema.index({ organizationId: 1, isActive: 1 });

export const FuelVendor = model<IFuelVendor>('FuelVendor', FuelVendorSchema);
