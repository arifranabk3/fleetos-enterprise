import { Schema, model, Document } from 'mongoose';

export interface IOrganization extends Document {
  name: string;
  slug: string;
  plan: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  settings: {
    telemetryIntervalSeconds: number;
    allowSimulatedGps: boolean;
    currency: string;
    attendanceSettings?: {
      lateStartGracePeriodMinutes: number;
      timezone?: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: [true, 'Organization slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    plan: {
      type: String,
      enum: ['STARTER', 'GROWTH', 'ENTERPRISE'],
      default: 'GROWTH',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'TRIAL'],
      default: 'ACTIVE',
    },
    settings: {
      telemetryIntervalSeconds: { type: Number, default: 5 },
      allowSimulatedGps: { type: Boolean, default: true },
      currency: { type: String, default: 'USD' },
      attendanceSettings: {
        lateStartGracePeriodMinutes: { type: Number, default: 15, min: 0, max: 120 },
        timezone: { type: String, default: 'UTC' },
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
OrganizationSchema.index({ slug: 1 }, { unique: true });

export const Organization = model<IOrganization>('Organization', OrganizationSchema);
