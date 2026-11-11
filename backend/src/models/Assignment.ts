import { Schema, model, Document, Types } from 'mongoose';

export interface IAssignment extends Document {
  organizationId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  driverId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  releasedAt?: Date;
  status: 'ACTIVE' | 'RELEASED';
  startOdometerKm: number;
  endOdometerKm?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>(
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
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      index: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    releasedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'RELEASED'],
      default: 'ACTIVE',
      index: true,
    },
    startOdometerKm: {
      type: Number,
      required: true,
      default: 0,
    },
    endOdometerKm: {
      type: Number,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
AssignmentSchema.index({ organizationId: 1, vehicleId: 1, status: 1 });
AssignmentSchema.index({ organizationId: 1, driverId: 1, status: 1 });
AssignmentSchema.index({ organizationId: 1, assignedAt: -1 });

// Phase 09.1 Database-level partial unique indexes:
// Guarantees at most ONE ACTIVE assignment per vehicle and per driver within an organization
AssignmentSchema.index(
  { organizationId: 1, vehicleId: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);

AssignmentSchema.index(
  { organizationId: 1, driverId: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);

export const Assignment = model<IAssignment>('Assignment', AssignmentSchema);

