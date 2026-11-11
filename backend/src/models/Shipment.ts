import { Schema, model, Document, Types } from 'mongoose';
import { ShipmentStatus } from '../types/domain';

export interface IShipmentTimelineEntry {
  status: ShipmentStatus;
  timestamp: Date;
  note?: string;
  updatedBy?: Types.ObjectId;
  actorRole?: string;
  metadata?: Record<string, any>;
}

export interface IShipment extends Document {
  organizationId: Types.ObjectId;
  trackingNumber: string;
  customerId?: Types.ObjectId;
  customer: {
    name: string;
    email: string;
    phone: string;
    reference?: string;
  };
  sender: {
    name: string;
    company?: string;
    email?: string;
    phone: string;
    address: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  receiver: {
    name: string;
    company?: string;
    email?: string;
    phone: string;
    address: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  origin: {
    address: string;
    city: string;
    state?: string;
    country?: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    address: string;
    city: string;
    state?: string;
    country?: string;
    latitude: number;
    longitude: number;
  };
  cargo: {
    description: string;
    category: 'GENERAL' | 'PERISHABLE' | 'HAZARDOUS' | 'ELECTRONICS' | 'FRAGILE' | 'HEAVY_EQUIPMENT';
    weightKg: number;
    packageCount: number;
    dimensions?: {
      lengthCm: number;
      widthCm: number;
      heightCm: number;
    };
    declaredValue?: {
      amount: number;
      currency: string;
    };
    isHazardous?: boolean;
    specialInstructions?: string;
  };
  pricing: {
    quotedAmount: number;
    currency: string;
  };
  priority: 'STANDARD' | 'EXPRESS' | 'URGENT' | 'SAME_DAY';
  status: ShipmentStatus;
  activeDispatchId?: Types.ObjectId;
  vehicleId?: Types.ObjectId;
  driverId?: Types.ObjectId;
  requestedPickupDate?: Date;
  expectedDeliveryDate?: Date;
  timeline: IShipmentTimelineEntry[];
  proofOfDelivery?: {
    recipientName: string;
    signatureUrl?: string;
    deliveredAt: Date;
    notes?: string;
  };
  billedInvoiceId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  isArchived: boolean;
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
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      index: true,
    },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      reference: { type: String },
    },
    sender: {
      name: { type: String, required: true },
      company: { type: String },
      email: { type: String },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String, default: 'USA' },
    },
    receiver: {
      name: { type: String, required: true },
      company: { type: String },
      email: { type: String },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String, default: 'USA' },
    },
    origin: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String },
      country: { type: String, default: 'USA' },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    destination: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String },
      country: { type: String, default: 'USA' },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    cargo: {
      description: { type: String, required: true },
      category: {
        type: String,
        enum: ['GENERAL', 'PERISHABLE', 'HAZARDOUS', 'ELECTRONICS', 'FRAGILE', 'HEAVY_EQUIPMENT'],
        default: 'GENERAL',
      },
      weightKg: { type: Number, required: true },
      packageCount: { type: Number, required: true, default: 1 },
      dimensions: {
        lengthCm: { type: Number },
        widthCm: { type: Number },
        heightCm: { type: Number },
      },
      declaredValue: {
        amount: { type: Number },
        currency: { type: String, default: 'USD' },
      },
      isHazardous: { type: Boolean, default: false },
      specialInstructions: { type: String },
    },
    pricing: {
      quotedAmount: { type: Number, required: true },
      currency: { type: String, default: 'USD' },
    },
    priority: {
      type: String,
      enum: ['STANDARD', 'EXPRESS', 'URGENT', 'SAME_DAY'],
      default: 'STANDARD',
      index: true,
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PENDING_DISPATCH',
        'CONFIRMED',
        'READY_FOR_DISPATCH',
        'DISPATCHED',
        'IN_TRANSIT',
        'ARRIVED_AT_DESTINATION',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'ON_HOLD',
        'DELAYED',
        'FAILED_DELIVERY',
        'CANCELLED',
        'RETURNED',
      ],
      default: 'DRAFT',
      index: true,
    },
    activeDispatchId: {
      type: Schema.Types.ObjectId,
      ref: 'Dispatch',
      index: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      index: true,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      index: true,
    },
    requestedPickupDate: { type: Date },
    expectedDeliveryDate: { type: Date },
    timeline: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        actorRole: { type: String },
        metadata: { type: Schema.Types.Mixed },
      },
    ],
    proofOfDelivery: {
      recipientName: { type: String },
      signatureUrl: { type: String },
      deliveredAt: { type: Date },
      notes: { type: String },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    billedInvoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound tenant isolation index: trackingNumber unique within organization
ShipmentSchema.index({ organizationId: 1, trackingNumber: 1 }, { unique: true });
ShipmentSchema.index({ organizationId: 1, status: 1, isArchived: 1 });
ShipmentSchema.index({ organizationId: 1, customerId: 1 });
ShipmentSchema.index({ trackingNumber: 1 }); // Public tracking / lookup

export const Shipment = model<IShipment>('Shipment', ShipmentSchema);
