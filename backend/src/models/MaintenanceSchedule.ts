import { Schema, model, Document, Types } from 'mongoose';

export type MaintenanceScheduleIntervalType = 'DISTANCE' | 'TIME' | 'BOTH';

export interface IMaintenanceSchedule extends Document {
  organizationId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  maintenanceType: 'ROUTINE_INSPECTION' | 'OIL_CHANGE' | 'TIRE_ROTATION' | 'BRAKE_SERVICE' | 'ENGINE_REPAIR' | 'ANNUAL_DOT';
  title: string;
  intervalType: MaintenanceScheduleIntervalType;
  intervalDistanceKm?: number;
  intervalDays?: number;
  lastServiceDate?: Date;
  lastServiceOdometerKm?: number;
  nextDueDate?: Date;
  nextDueOdometerKm?: number;
  reminderDaysThreshold: number;
  reminderKmThreshold: number;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MaintenanceScheduleSchema = new Schema<IMaintenanceSchedule>(
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
    maintenanceType: {
      type: String,
      enum: ['ROUTINE_INSPECTION', 'OIL_CHANGE', 'TIRE_ROTATION', 'BRAKE_SERVICE', 'ENGINE_REPAIR', 'ANNUAL_DOT'],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    intervalType: {
      type: String,
      enum: ['DISTANCE', 'TIME', 'BOTH'],
      default: 'TIME',
    },
    intervalDistanceKm: { type: Number },
    intervalDays: { type: Number },
    lastServiceDate: { type: Date },
    lastServiceOdometerKm: { type: Number },
    nextDueDate: { type: Date, index: true },
    nextDueOdometerKm: { type: Number, index: true },
    reminderDaysThreshold: { type: Number, default: 14 },
    reminderKmThreshold: { type: Number, default: 1000 },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String },
  },
  {
    timestamps: true,
  }
);

MaintenanceScheduleSchema.index({ organizationId: 1, vehicleId: 1, isActive: 1 });
MaintenanceScheduleSchema.index({ organizationId: 1, nextDueDate: 1 });

export const MaintenanceSchedule = model<IMaintenanceSchedule>('MaintenanceSchedule', MaintenanceScheduleSchema);
