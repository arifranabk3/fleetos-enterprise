import { Schema, model, Document, Types } from 'mongoose';

export interface IMaintenanceRecord extends Document {
  organizationId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  serviceType: 'ROUTINE_INSPECTION' | 'OIL_CHANGE' | 'TIRE_ROTATION' | 'BRAKE_SERVICE' | 'ENGINE_REPAIR';
  description: string;
  odometerReadingKm: number;
  cost: number;
  currency: string;
  serviceProvider: string;
  performedAt: Date;
  nextScheduledDate?: Date;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
}

const MaintenanceRecordSchema = new Schema<IMaintenanceRecord>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      index: true,
    },
    serviceType: {
      type: String,
      enum: ['ROUTINE_INSPECTION', 'OIL_CHANGE', 'TIRE_ROTATION', 'BRAKE_SERVICE', 'ENGINE_REPAIR'],
      required: true,
    },
    description: { type: String, required: true },
    odometerReadingKm: { type: Number, required: true },
    cost: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    serviceProvider: { type: String, required: true },
    performedAt: { type: Date, default: Date.now },
    nextScheduledDate: { type: Date },
    status: {
      type: String,
      enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'COMPLETED',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

MaintenanceRecordSchema.index({ organizationId: 1, vehicleId: 1, performedAt: -1 });

export const MaintenanceRecord = model<IMaintenanceRecord>('MaintenanceRecord', MaintenanceRecordSchema);

