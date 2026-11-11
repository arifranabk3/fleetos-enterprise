import { Schema, model, Document, Types } from 'mongoose';

export interface IMaintenanceVendor extends Document {
  organizationId: Types.ObjectId;
  name: string;
  contactPerson?: string;
  email: string;
  phone: string;
  address?: {
    street: string;
    city: string;
    state?: string;
    country: string;
  };
  services: string[]; // e.g. ['OIL_CHANGE', 'TIRE_ROTATION', 'BRAKE_SERVICE', 'ENGINE_REPAIR', 'INSPECTION']
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MaintenanceVendorSchema = new Schema<IMaintenanceVendor>(
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
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String, default: 'USA' },
    },
    services: [{ type: String, trim: true }],
    notes: { type: String },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  }
);

MaintenanceVendorSchema.index({ organizationId: 1, name: 1 });
MaintenanceVendorSchema.index({ organizationId: 1, isActive: 1 });

export const MaintenanceVendor = model<IMaintenanceVendor>('MaintenanceVendor', MaintenanceVendorSchema);
