import { Schema, model, Document, Types } from 'mongoose';

export interface IDelivery extends Document {
  organizationId: Types.ObjectId;
  shipmentId: Types.ObjectId;
  recipientName: string;
  signatureUrl?: string;
  photoProofUrl?: string;
  deliveredAt: Date;
  latitude: number;
  longitude: number;
  conditionNote: string;
  status: 'SUCCESSFUL' | 'PARTIAL' | 'REJECTED';
  createdAt: Date;
  updatedAt: Date;
}

const DeliverySchema = new Schema<IDelivery>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    shipmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Shipment',
      required: true,
      index: true,
    },
    recipientName: { type: String, required: true },
    signatureUrl: { type: String },
    photoProofUrl: { type: String },
    deliveredAt: { type: Date, default: Date.now },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    conditionNote: { type: String, default: 'Delivered in pristine condition' },
    status: {
      type: String,
      enum: ['SUCCESSFUL', 'PARTIAL', 'REJECTED'],
      default: 'SUCCESSFUL',
    },
  },
  {
    timestamps: true,
  }
);

DeliverySchema.index({ organizationId: 1, shipmentId: 1 }, { unique: true });

export const Delivery = model<IDelivery>('Delivery', DeliverySchema);

