import { Schema, model, Document, Types } from 'mongoose';
import { ShipmentStatus } from '../types/domain';

export interface IShipment extends Document {
  organizationId: Types.ObjectId;
  trackingNumber: string;
  vehicleId?: Types.ObjectId;
  driverId?: Types.ObjectId;
  status: ShipmentStatus;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  origin: {
    address: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    address: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  cargo: {
    description: string;
    weightKg: number;
    volumeCbm?: number;
    isHazardous?: boolean;
  };
  pricing: {
    quotedAmount: number;
    currency: string;
  };
  timeline: Array<{
    status: ShipmentStatus;
    timestamp: Date;
    note?: string;
    updatedBy?: Types.ObjectId;
  }>;
  proofOfDelivery?: {
    recipientName: string;
    signatureUrl?: string;
    deliveredAt: Date;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ShipmentSchema = new Schema<IShipment>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for tenant isolation'],
      index: true,
    },
    trackingNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PENDING_DISPATCH',
        'DISPATCHED',
        'IN_TRANSIT',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'EXCEPTION',
        'CANCELLED',
      ],
      default: 'PENDING_DISPATCH',
      index: true,
    },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    origin: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    destination: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    cargo: {
      description: { type: String, required: true },
      weightKg: { type: Number, required: true },
      volumeCbm: { type: Number },
      isHazardous: { type: Boolean, default: false },
    },
    pricing: {
      quotedAmount: { type: Number, required: true },
      currency: { type: String, default: 'USD' },
    },
    timeline: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    proofOfDelivery: {
      recipientName: { type: String },
      signatureUrl: { type: String },
      deliveredAt: { type: Date },
      notes: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Compound tenant isolation index: trackingNumber unique within organization
ShipmentSchema.index({ organizationId: 1, trackingNumber: 1 }, { unique: true });
ShipmentSchema.index({ trackingNumber: 1 }); // Public customer portal lookup

export const Shipment = model<IShipment>('Shipment', ShipmentSchema);
