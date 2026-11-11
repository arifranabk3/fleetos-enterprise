import { Schema, model, Document, Types } from 'mongoose';

export type DriverShiftStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED' | 'CANCELLED';

export interface IDriverShift extends Document {
  organizationId: Types.ObjectId;
  driverId: Types.ObjectId;
  shiftDate: string; // YYYY-MM-DD for fast grouping & daily queries
  plannedStart: Date;
  plannedEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  durationMinutes?: number;
  overtimeMinutes?: number;
  isLateStart?: boolean;
  lateStartMinutes?: number;
  status: DriverShiftStatus;
  notes?: string;
  settlementId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DriverShiftSchema = new Schema<IDriverShift>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      index: true,
    },
    shiftDate: {
      type: String,
      required: true,
      index: true,
    },
    plannedStart: {
      type: Date,
      required: true,
    },
    plannedEnd: {
      type: Date,
      required: true,
    },
    actualStart: {
      type: Date,
    },
    actualEnd: {
      type: Date,
    },
    durationMinutes: {
      type: Number,
      default: 0,
    },
    overtimeMinutes: {
      type: Number,
      default: 0,
    },
    isLateStart: {
      type: Boolean,
      default: false,
    },
    lateStartMinutes: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED'],
      default: 'SCHEDULED',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    settlementId: {
      type: Schema.Types.ObjectId,
      ref: 'DriverSettlement',
      default: null,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes: prevent overlapping active/scheduled shifts and fast queries
DriverShiftSchema.index({ organizationId: 1, driverId: 1, shiftDate: 1 });
DriverShiftSchema.index({ organizationId: 1, driverId: 1, status: 1 });
DriverShiftSchema.index({ organizationId: 1, plannedStart: 1, plannedEnd: 1 });

export const DriverShift = model<IDriverShift>('DriverShift', DriverShiftSchema);
