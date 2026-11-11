import { Schema, model, Document, Types } from 'mongoose';

export type RatePricingModel = 'FLAT' | 'DISTANCE_BASED' | 'WEIGHT_BASED' | 'ZONE_BASED' | 'HYBRID';
export type RateMatrixStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

export interface IRateAdditionalCharge {
  code: string;
  name: string;
  amountCents: number;
  chargeType: 'FLAT' | 'PER_UNIT' | 'PERCENTAGE';
  description?: string;
}

export interface IRateTier {
  minDistanceKm?: number;
  maxDistanceKm?: number;
  minWeightKg?: number;
  maxWeightKg?: number;
  ratePerKmCents?: number;
  ratePerKgCents?: number;
  flatFeeCents?: number;
}

export interface IRateMatrix extends Document {
  organizationId: Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  customerId?: Types.ObjectId; // Nullable: if null, default fleet-wide tariff
  status: RateMatrixStatus;
  version: number;
  pricingModel: RatePricingModel;
  currency: string;
  vehicleCategory?: 'VAN' | 'BOX_TRUCK' | 'SEMI_TRUCK' | 'FLATBED' | 'REFRIGERATED' | 'TANKER' | 'OTHER';
  cargoCategory?: 'GENERAL' | 'PERISHABLE' | 'HAZARDOUS' | 'ELECTRONICS' | 'FRAGILE' | 'HEAVY_EQUIPMENT';
  originZone?: string;
  destinationZone?: string;
  
  // Base Rates in Integer Cents
  baseFeeCents: number;
  perKmRateCents: number;
  perKgRateCents: number;
  minimumChargeCents: number;
  waitingTimeRatePerHourCents: number;
  fuelSurchargePercent: number; // e.g. 5.5 for 5.5%

  // Tiered pricing
  tiers: IRateTier[];

  // Additional ancillary charges (e.g. liftgate, hazardous handling, inside delivery)
  additionalCharges: IRateAdditionalCharge[];

  effectiveFrom: Date;
  effectiveTo?: Date | null;
  isArchived: boolean;
  createdBy: Types.ObjectId;
  auditTrail: Array<{
    action: string;
    performedBy: Types.ObjectId;
    timestamp: Date;
    note?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const RateMatrixSchema = new Schema<IRateMatrix>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for rate matrix tenant isolation'],
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: { type: String, trim: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'DRAFT', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    pricingModel: {
      type: String,
      enum: ['FLAT', 'DISTANCE_BASED', 'WEIGHT_BASED', 'ZONE_BASED', 'HYBRID'],
      default: 'DISTANCE_BASED',
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      uppercase: true,
    },
    vehicleCategory: {
      type: String,
      enum: ['VAN', 'BOX_TRUCK', 'SEMI_TRUCK', 'FLATBED', 'REFRIGERATED', 'TANKER', 'OTHER'],
    },
    cargoCategory: {
      type: String,
      enum: ['GENERAL', 'PERISHABLE', 'HAZARDOUS', 'ELECTRONICS', 'FRAGILE', 'HEAVY_EQUIPMENT'],
    },
    originZone: { type: String, trim: true },
    destinationZone: { type: String, trim: true },

    baseFeeCents: { type: Number, required: true, default: 0 },
    perKmRateCents: { type: Number, required: true, default: 0 },
    perKgRateCents: { type: Number, required: true, default: 0 },
    minimumChargeCents: { type: Number, required: true, default: 0 },
    waitingTimeRatePerHourCents: { type: Number, default: 0 },
    fuelSurchargePercent: { type: Number, default: 0 },

    tiers: [
      {
        minDistanceKm: { type: Number },
        maxDistanceKm: { type: Number },
        minWeightKg: { type: Number },
        maxWeightKg: { type: Number },
        ratePerKmCents: { type: Number },
        ratePerKgCents: { type: Number },
        flatFeeCents: { type: Number },
      },
    ],

    additionalCharges: [
      {
        code: { type: String, required: true, uppercase: true },
        name: { type: String, required: true },
        amountCents: { type: Number, required: true },
        chargeType: { type: String, enum: ['FLAT', 'PER_UNIT', 'PERCENTAGE'], default: 'FLAT' },
        description: { type: String },
      },
    ],

    effectiveFrom: { type: Date, required: true, default: Date.now, index: true },
    effectiveTo: { type: Date, default: null, index: true },
    isArchived: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    auditTrail: [
      {
        action: { type: String, required: true },
        performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound indexes for rate lookup & tenant isolation
RateMatrixSchema.index({ organizationId: 1, code: 1, version: 1 }, { unique: true });
RateMatrixSchema.index({ organizationId: 1, customerId: 1, status: 1, effectiveFrom: 1, effectiveTo: 1 });
RateMatrixSchema.index({ organizationId: 1, status: 1, effectiveFrom: 1, effectiveTo: 1 });

export const RateMatrix = model<IRateMatrix>('RateMatrix', RateMatrixSchema);
