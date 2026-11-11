import { Schema, model, Document, Types } from 'mongoose';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertType =
  | 'OVERSPEEDING'
  | 'PROLONGED_IDLE'
  | 'VEHICLE_OFFLINE'
  | 'STALE_GPS'
  | 'INVALID_TELEMETRY'
  | 'GEOFENCE_ENTER'
  | 'GEOFENCE_EXIT';

export interface ITelemetryAlert extends Document {
  organizationId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  driverId?: Types.ObjectId;
  shipmentId?: Types.ObjectId;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: 'SIMULATED' | 'HARDWARE_GPS';
  metadata?: Record<string, any>;
  isAcknowledged: boolean;
  acknowledgedBy?: Types.ObjectId;
  acknowledgedAt?: Date;
  timestamp: Date;
  createdAt: Date;
}

const TelemetryAlertSchema = new Schema<ITelemetryAlert>(
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
    },
    shipmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Shipment',
    },
    type: {
      type: String,
      enum: [
        'OVERSPEEDING',
        'PROLONGED_IDLE',
        'VEHICLE_OFFLINE',
        'STALE_GPS',
        'INVALID_TELEMETRY',
        'GEOFENCE_ENTER',
        'GEOFENCE_EXIT',
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['INFO', 'WARNING', 'CRITICAL'],
      default: 'INFO',
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    source: {
      type: String,
      enum: ['SIMULATED', 'HARDWARE_GPS'],
      default: 'SIMULATED',
    },
    metadata: { type: Schema.Types.Mixed },
    isAcknowledged: { type: Boolean, default: false, index: true },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: { type: Date },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true,
  }
);

// Compound tenant index
TelemetryAlertSchema.index({ organizationId: 1, isAcknowledged: 1, timestamp: -1 });
TelemetryAlertSchema.index({ organizationId: 1, vehicleId: 1, type: 1, timestamp: -1 });

export const TelemetryAlert = model<ITelemetryAlert>('TelemetryAlert', TelemetryAlertSchema);
