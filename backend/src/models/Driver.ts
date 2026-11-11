import { Schema, model, Document, Types } from 'mongoose';
import { DriverStatus } from '../types/domain';

export interface IDriver extends Document {
  organizationId: Types.ObjectId;
  userId?: Types.ObjectId;
  employeeNumber?: string;
  fullName: string;
  email: string;
  phone: string;
  address?: string;
  licenseNumber: string;
  licenseClass: string;
  licenseCategories?: string[];
  licenseIssueDate?: Date;
  licenseExpiry: Date;
  employmentStatus: 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR';
  status: DriverStatus;
  assignedVehicleId?: Types.ObjectId;
  assignedDepot?: string;
  rating: number;
  emergencyContact: {
    name: string;
    phone: string;
    relationship?: string;
  };
  joiningDate: Date;
  notes?: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  isArchived: boolean;
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
    },
    employeeNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
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
    address: { type: String },
    licenseNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    licenseClass: {
      type: String,
      default: 'CDL-A',
    },
    licenseCategories: [{ type: String, trim: true, uppercase: true }],
    licenseIssueDate: { type: Date },
    licenseExpiry: {
      type: Date,
      required: true,
    },
    employmentStatus: {
      type: String,
      enum: ['FULL_TIME', 'PART_TIME', 'CONTRACTOR'],
      default: 'FULL_TIME',
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'ASSIGNED', 'ON_DUTY', 'OFF_DUTY', 'ON_LEAVE', 'SUSPENDED', 'INACTIVE'],
      default: 'AVAILABLE',
      index: true,
    },
    assignedVehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
    },
    assignedDepot: {
      type: String,
      trim: true,
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
      relationship: { type: String, default: 'Employer' },
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    notes: { type: String },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    isArchived: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

// Compound tenant isolation index: license unique within organization
DriverSchema.index({ organizationId: 1, licenseNumber: 1 }, { unique: true });
DriverSchema.index({ organizationId: 1, employeeNumber: 1 }, { sparse: true });
DriverSchema.index({ organizationId: 1, email: 1 });
DriverSchema.index({ organizationId: 1, status: 1, isArchived: 1 });

export const Driver = model<IDriver>('Driver', DriverSchema);
