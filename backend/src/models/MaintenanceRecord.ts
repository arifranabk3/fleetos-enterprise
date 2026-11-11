import { Schema, model, Document, Types } from 'mongoose';

export type MaintenanceStatus =
  | 'SCHEDULED'
  | 'DUE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'CANCELLED';

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IMaintenanceRecord extends Document {
  organizationId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  scheduleId?: Types.ObjectId;
  vendorId?: Types.ObjectId;
  maintenanceType: 'ROUTINE_INSPECTION' | 'OIL_CHANGE' | 'TIRE_ROTATION' | 'BRAKE_SERVICE' | 'ENGINE_REPAIR' | 'ANNUAL_DOT' | 'EMERGENCY_REPAIR';
  title: string;
  description: string;
  scheduledDate: Date;
  startedDate?: Date;
  completedDate?: Date;
  odometerReadingKm: number;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  currency: string;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  initialVehicleStatus?: string; // Captured operational status prior to maintenance lock
  notes?: string;
  cancellationReason?: string;
  createdBy: Types.ObjectId;
  completedBy?: Types.ObjectId;
  timeline: Array<{
    status: MaintenanceStatus;
    timestamp: Date;
    note?: string;
    actorId?: Types.ObjectId;
  }>;
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
    scheduleId: {
      type: Schema.Types.ObjectId,
      ref: 'MaintenanceSchedule',
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'MaintenanceVendor',
      index: true,
    },
    maintenanceType: {
      type: String,
      enum: [
        'ROUTINE_INSPECTION',
        'OIL_CHANGE',
        'TIRE_ROTATION',
        'BRAKE_SERVICE',
        'ENGINE_REPAIR',
        'ANNUAL_DOT',
        'EMERGENCY_REPAIR',
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    scheduledDate: { type: Date, required: true, index: true },
    startedDate: { type: Date },
    completedDate: { type: Date },
    odometerReadingKm: { type: Number, required: true, min: 0 },
    laborCost: { type: Number, default: 0, min: 0 },
    partsCost: { type: Number, default: 0, min: 0 },
    totalCost: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },
    status: {
      type: String,
      enum: ['SCHEDULED', 'DUE', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED'],
      default: 'SCHEDULED',
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      index: true,
    },
    initialVehicleStatus: {
      type: String,
      enum: ['AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE', 'RETIRED'],
    },
    notes: { type: String },
    cancellationReason: { type: String },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    timeline: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
        actorId: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  {
    timestamps: true,
  }
);

MaintenanceRecordSchema.index({ organizationId: 1, vehicleId: 1, status: 1 });
MaintenanceRecordSchema.index({ organizationId: 1, scheduledDate: -1 });

export const MaintenanceRecord = model<IMaintenanceRecord>('MaintenanceRecord', MaintenanceRecordSchema);
