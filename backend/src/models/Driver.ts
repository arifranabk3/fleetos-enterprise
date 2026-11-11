import { Schema, model, Document, Types } from 'mongoose';

export interface IDriver extends Document {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  licenseNumber: string;
  licenseClass: string;
  licenseExpiry: Date;
  assignedVehicleId?: Types.ObjectId;
  status: 'AVAILABLE' | 'ON_DUTY' | 'DRIVING' | 'RESTING' | 'OFF_DUTY';
  rating: number;
  emergencyContact: {
    name: string;
    phone: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DriverSchema = new Schema<IDriver>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for tenant isolation'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    licenseNumber: {
      type: String,
      required: true,
      trim: true,
    },
    licenseClass: {
      type: String,
      default: 'CDL-A',
    },
    licenseExpiry: {
      type: Date,
      required: true,
    },
    assignedVehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'ON_DUTY', 'DRIVING', 'RESTING', 'OFF_DUTY'],
      default: 'AVAILABLE',
      index: true,
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 1,
      max: 5,
    },
    emergencyContact: {
      name: { type: String, default: 'Dispatch Center' },
      phone: { type: String, default: '+1-800-555-0199' },
    },
  },
  {
    timestamps: true,
  }
);

// Compound tenant isolation index: license unique within organization
DriverSchema.index({ organizationId: 1, licenseNumber: 1 }, { unique: true });
DriverSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

export const Driver = model<IDriver>('Driver', DriverSchema);

