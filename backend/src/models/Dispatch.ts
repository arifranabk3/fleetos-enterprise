import { Schema, model, Document, Types } from 'mongoose';

export type DispatchStatus = 'PENDING' | 'ACCEPTED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface IDispatch extends Document {
  organizationId: Types.ObjectId;
  dispatchNumber: string;
  shipmentIds: Types.ObjectId[];
  vehicleId: Types.ObjectId;
  driverId: Types.ObjectId;
  assignmentId?: Types.ObjectId;
  status: DispatchStatus;
  originHub?: string;
  destinationHub?: string;
  notes?: string;
  assignedBy: Types.ObjectId;
  dispatchedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DispatchSchema = new Schema<IDispatch>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for dispatch tenant isolation'],
      index: true,
    },
    dispatchNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    shipmentIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Shipment',
        required: true,
      },
    ],
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
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Assignment',
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    originHub: { type: String },
    destinationHub: { type: String },
    notes: { type: String },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dispatchedAt: { type: Date, default: Date.now },
    startedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
  },
  {
    timestamps: true,
  }
);

// Compound tenant isolation index: dispatchNumber unique per tenant
DispatchSchema.index({ organizationId: 1, dispatchNumber: 1 }, { unique: true });
DispatchSchema.index({ organizationId: 1, status: 1 });
DispatchSchema.index({ organizationId: 1, vehicleId: 1, status: 1 });
DispatchSchema.index({ organizationId: 1, driverId: 1, status: 1 });

export const Dispatch = model<IDispatch>('Dispatch', DispatchSchema);
