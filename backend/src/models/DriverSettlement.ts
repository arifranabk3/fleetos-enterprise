import { Schema, model, Document, Types } from 'mongoose';

export type DriverSettlementStatus = 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'PAID' | 'REJECTED';

export interface ISettlementBonus {
  code: string;
  description: string;
  amountCents: number;
  authorizedBy?: Types.ObjectId;
  metricType?: 'SAFETY_SCORE' | 'FUEL_EFFICIENCY' | 'ON_TIME_DELIVERY' | 'ATTENDANCE' | 'MANUAL';
  referenceId?: string;
}

export interface ISettlementDeduction {
  code: string;
  description: string;
  amountCents: number;
  authorizedBy: Types.ObjectId;
  reasonCategory: 'INCIDENT_PENALTY' | 'EQUIPMENT_DAMAGE' | 'POLICY_VIOLATION' | 'TAX_WITHHOLDING' | 'ADVANCE' | 'OTHER';
  incidentId?: Types.ObjectId;
}

export interface IDriverSettlement extends Document {
  organizationId: Types.ObjectId;
  settlementNumber: string;
  driverId: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  status: DriverSettlementStatus;
  currency: string;

  // Operational metrics in period
  totalDispatches: number;
  totalDistanceKm: number;
  totalHoursWorked: number;
  totalOvertimeHours: number;

  // Pay items in integer cents
  basePayCents: number;
  mileagePayCents: number;
  overtimePayCents: number;
  bonuses: ISettlementBonus[];
  totalBonusCents: number;
  deductions: ISettlementDeduction[];
  totalDeductionCents: number;

  grossPayCents: number;
  taxWithheldCents: number;
  netPayCents: number;

  // Linked operational entity references
  dispatchesIncluded: Types.ObjectId[];
  shiftsIncluded: Types.ObjectId[];

  calculatedAt?: Date;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  paidAt?: Date;
  paymentReference?: string;
  paymentMethod?: 'DIRECT_DEPOSIT' | 'CHECK' | 'WIRE' | 'CASH';

  rejectionReason?: string;
  notes?: string;
  auditTrail: Array<{
    action: string;
    performedBy: Types.ObjectId;
    timestamp: Date;
    note?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const DriverSettlementSchema = new Schema<IDriverSettlement>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    settlementNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      index: true,
    },
    periodStart: {
      type: Date,
      required: true,
      index: true,
    },
    periodEnd: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'CALCULATED', 'APPROVED', 'PAID', 'REJECTED'],
      default: 'DRAFT',
      index: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      uppercase: true,
    },

    totalDispatches: { type: Number, default: 0 },
    totalDistanceKm: { type: Number, default: 0 },
    totalHoursWorked: { type: Number, default: 0 },
    totalOvertimeHours: { type: Number, default: 0 },

    basePayCents: { type: Number, required: true, default: 0 },
    mileagePayCents: { type: Number, required: true, default: 0 },
    overtimePayCents: { type: Number, required: true, default: 0 },

    bonuses: [
      {
        code: { type: String, required: true },
        description: { type: String, required: true },
        amountCents: { type: Number, required: true, min: 0 },
        authorizedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        metricType: {
          type: String,
          enum: ['SAFETY_SCORE', 'FUEL_EFFICIENCY', 'ON_TIME_DELIVERY', 'ATTENDANCE', 'MANUAL'],
          default: 'MANUAL',
        },
        referenceId: { type: String },
      },
    ],
    totalBonusCents: { type: Number, default: 0 },

    deductions: [
      {
        code: { type: String, required: true },
        description: { type: String, required: true },
        amountCents: { type: Number, required: true, min: 0 },
        authorizedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        reasonCategory: {
          type: String,
          enum: ['INCIDENT_PENALTY', 'EQUIPMENT_DAMAGE', 'POLICY_VIOLATION', 'TAX_WITHHOLDING', 'ADVANCE', 'OTHER'],
          required: true,
        },
        incidentId: { type: Schema.Types.ObjectId, ref: 'DriverIncident' },
      },
    ],
    totalDeductionCents: { type: Number, default: 0 },

    grossPayCents: { type: Number, required: true, default: 0 },
    taxWithheldCents: { type: Number, default: 0 },
    netPayCents: { type: Number, required: true, default: 0 },

    dispatchesIncluded: [{ type: Schema.Types.ObjectId, ref: 'Dispatch' }],
    shiftsIncluded: [{ type: Schema.Types.ObjectId, ref: 'DriverShift' }],

    calculatedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    paidAt: { type: Date },
    paymentReference: { type: String, trim: true },
    paymentMethod: {
      type: String,
      enum: ['DIRECT_DEPOSIT', 'CHECK', 'WIRE', 'CASH'],
    },
    rejectionReason: { type: String },
    notes: { type: String },
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

// Compound indexes
DriverSettlementSchema.index({ organizationId: 1, settlementNumber: 1 }, { unique: true });
DriverSettlementSchema.index({ organizationId: 1, driverId: 1, periodStart: 1, periodEnd: 1 });
DriverSettlementSchema.index({ organizationId: 1, status: 1 });

export const DriverSettlement = model<IDriverSettlement>('DriverSettlement', DriverSettlementSchema);
