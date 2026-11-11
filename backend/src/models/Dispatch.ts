import { Schema, model, Document, Types } from 'mongoose';

export interface IDispatch extends Document {
  organizationId: Types.ObjectId;
  dispatchNumber: string;
  shipmentIds: Types.ObjectId[];
  vehicleId: Types.ObjectId;
  driverId: Types.ObjectId;
  status: 'PENDING' | 'ACCEPTED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  dispatchedAt?: Date;
  completedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DispatchSchema = new Schema<IDispatch>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
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
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    dispatchedAt: { type: Date },
    completedAt: { type: Date },
    notes: { type: String },
  },
  {
    timestamps: true,
  }
);

DispatchSchema.index({ organizationId: 1, dispatchNumber: 1 }, { unique: true });

export const Dispatch = model<IDispatch>('Dispatch', DispatchSchema);

