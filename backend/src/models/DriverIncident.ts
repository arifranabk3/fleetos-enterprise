import { Schema, model, Document, Types } from 'mongoose';

export type DriverIncidentCategory =
  | 'ACCIDENT'
  | 'TRAFFIC_VIOLATION'
  | 'VEHICLE_DAMAGE'
  | 'SAFETY_COMPLAINT'
  | 'DELIVERY_INCIDENT'
  | 'OTHER';

export type DriverIncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DriverIncidentStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED';
export type IncidentResponsibilityStatus =
  | 'UNDETERMINED'
  | 'DRIVER_RESPONSIBLE'
  | 'DRIVER_NOT_RESPONSIBLE'
  | 'SHARED_RESPONSIBILITY';

export interface IDriverIncident extends Document {
  organizationId: Types.ObjectId;
  incidentNumber: string;
  category: DriverIncidentCategory;
  severity: DriverIncidentSeverity;
  incidentDate: Date;
  driverId: Types.ObjectId;
  vehicleId?: Types.ObjectId;
  shipmentId?: Types.ObjectId;
  dispatchId?: Types.ObjectId;
  description: string;
  evidenceReference?: string;
  status: DriverIncidentStatus;
  responsibilityStatus: IncidentResponsibilityStatus;
  resolutionNotes?: string;
  resolvedAt?: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  reportedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DriverIncidentSchema = new Schema<IDriverIncident>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    incidentNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    category: {
      type: String,
      enum: ['ACCIDENT', 'TRAFFIC_VIOLATION', 'VEHICLE_DAMAGE', 'SAFETY_COMPLAINT', 'DELIVERY_INCIDENT', 'OTHER'],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true,
      index: true,
    },
    incidentDate: {
      type: Date,
      required: true,
      index: true,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      index: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      index: true,
    },
    shipmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Shipment',
    },
    dispatchId: {
      type: Schema.Types.ObjectId,
      ref: 'Dispatch',
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    evidenceReference: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    responsibilityStatus: {
      type: String,
      enum: ['UNDETERMINED', 'DRIVER_RESPONSIBLE', 'DRIVER_NOT_RESPONSIBLE', 'SHARED_RESPONSIBILITY'],
      default: 'UNDETERMINED',
      index: true,
    },
    resolutionNotes: {
      type: String,
      trim: true,
    },
    resolvedAt: {
      type: Date,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
      trim: true,
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound tenant isolation indexes
DriverIncidentSchema.index({ organizationId: 1, incidentNumber: 1 }, { unique: true });
DriverIncidentSchema.index({ organizationId: 1, driverId: 1, incidentDate: -1 });
DriverIncidentSchema.index({ organizationId: 1, driverId: 1, status: 1 });
DriverIncidentSchema.index({ organizationId: 1, driverId: 1, responsibilityStatus: 1 });
DriverIncidentSchema.index({ organizationId: 1, severity: 1, status: 1 });

export const DriverIncident = model<IDriverIncident>('DriverIncident', DriverIncidentSchema);
