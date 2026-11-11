import { Schema, model, Document, Types } from 'mongoose';
import { VehicleStatus } from '../types/domain';

export interface IVehicle extends Document {
  organizationId: Types.ObjectId;
  vin: string;
  plateNumber: string;
  make: string;
  modelName: string;
  year: number;
  type: 'SEMI_TRUCK' | 'BOX_TRUCK' | 'CARGO_VAN' | 'FLATBED';
  capacityKg: number;
  status: VehicleStatus;
  currentDriverId?: Types.ObjectId;
  odometerKm: number;
  lastServiceDate?: Date;
  currentLocation?: {
    latitude: number;
    longitude: number;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

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
    make: { type: String, required: true },
    modelName: { type: String, required: true },
    year: { type: Number, required: true },
    type: {
      type: String,
      enum: ['SEMI_TRUCK', 'BOX_TRUCK', 'CARGO_VAN', 'FLATBED'],
      default: 'SEMI_TRUCK',
    },
    capacityKg: { type: Number, required: true },
    status: {
      type: String,
      enum: ['AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE'],
      default: 'AVAILABLE',
      index: true,
    },
    currentDriverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
    },
    odometerKm: { type: Number, default: 0 },
    lastServiceDate: { type: Date },
    currentLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      updatedAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

// Compound tenant isolation index: plateNumber & VIN unique within the organization
VehicleSchema.index({ organizationId: 1, plateNumber: 1 }, { unique: true });
VehicleSchema.index({ organizationId: 1, vin: 1 }, { unique: true });

export const Vehicle = model<IVehicle>('Vehicle', VehicleSchema);
