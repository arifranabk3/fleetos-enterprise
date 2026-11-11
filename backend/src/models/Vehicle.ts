import { Schema, model, Document, Types } from 'mongoose';
import { VehicleStatus } from '../types/domain';

export interface IVehicleDocument {
  docType: 'REGISTRATION' | 'INSURANCE' | 'DOT_INSPECTION' | 'LEASE_AGREEMENT';
  documentNumber: string;
  issueDate: Date;
  expiryDate: Date;
  fileUrl?: string;
  uploadedBy?: Types.ObjectId;
  createdAt: Date;
}

export interface IVehicle extends Document {
  organizationId: Types.ObjectId;
  vin: string;
  plateNumber: string;
  make: string;
  modelName: string;
  year: number;
  type: 'SEMI_TRUCK' | 'BOX_TRUCK' | 'CARGO_VAN' | 'FLATBED';
  fuelType: 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'GASOLINE';
  color?: string;
  capacityKg: number;
  status: VehicleStatus;
  currentDriverId?: Types.ObjectId;
  lastLocation?: {
    latitude: number;
    longitude: number;
    speedKmh: number;
    headingDeg: number;
    motionStatus: 'MOVING' | 'IDLE' | 'STOPPED' | 'OFFLINE';
    source: 'SIMULATED' | 'HARDWARE_GPS';
    isSimulated: boolean;
    recordedAt: Date;
    updatedAt: Date;
  };
  odometerKm: number;
  insuranceExpiry?: Date;
  registrationExpiry?: Date;
  inspectionExpiry?: Date;
  purchaseDate?: Date;
  documents: IVehicleDocument[];
  notes?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleDocumentSchema = new Schema<IVehicleDocument>(
  {
    docType: {
      type: String,
      enum: ['REGISTRATION', 'INSURANCE', 'DOT_INSPECTION', 'LEASE_AGREEMENT'],
      required: true,
    },
    documentNumber: { type: String, required: true },
    issueDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    fileUrl: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const VehicleSchema = new Schema<IVehicle>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for tenant isolation'],
      index: true,
    },
    vin: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    plateNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    make: { type: String, required: true, trim: true },
    modelName: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    type: {
      type: String,
      enum: ['SEMI_TRUCK', 'BOX_TRUCK', 'CARGO_VAN', 'FLATBED'],
      default: 'SEMI_TRUCK',
      index: true,
    },
    fuelType: {
      type: String,
      enum: ['DIESEL', 'ELECTRIC', 'HYBRID', 'GASOLINE'],
      default: 'DIESEL',
    },
    color: { type: String, default: 'White' },
    capacityKg: { type: Number, required: true },
    status: {
      type: String,
      enum: ['AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE', 'RETIRED'],
      default: 'AVAILABLE',
      index: true,
    },
    currentDriverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
    },
    lastLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      speedKmh: { type: Number, default: 0 },
      headingDeg: { type: Number, default: 0 },
      motionStatus: {
        type: String,
        enum: ['MOVING', 'IDLE', 'STOPPED', 'OFFLINE'],
        default: 'STOPPED',
      },
      source: {
        type: String,
        enum: ['SIMULATED', 'HARDWARE_GPS'],
        default: 'SIMULATED',
      },
      isSimulated: { type: Boolean, default: true },
      recordedAt: { type: Date },
      updatedAt: { type: Date, default: Date.now },
    },
    odometerKm: { type: Number, default: 0 },
    insuranceExpiry: { type: Date },
    registrationExpiry: { type: Date },
    inspectionExpiry: { type: Date },
    purchaseDate: { type: Date },
    documents: [VehicleDocumentSchema],
    notes: { type: String },
    isArchived: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

// Compound tenant isolation index: plateNumber & VIN unique within organization
VehicleSchema.index({ organizationId: 1, plateNumber: 1 }, { unique: true });
VehicleSchema.index({ organizationId: 1, vin: 1 }, { unique: true });
VehicleSchema.index({ organizationId: 1, status: 1, isArchived: 1 });

export const Vehicle = model<IVehicle>('Vehicle', VehicleSchema);
