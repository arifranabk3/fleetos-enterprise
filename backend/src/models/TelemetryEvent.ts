import { Schema, model, Document, Types } from 'mongoose';

export type TelemetrySource = 'SIMULATED' | 'HARDWARE_GPS';
export type MotionStatus = 'MOVING' | 'IDLE' | 'STOPPED' | 'OFFLINE';

export interface ITelemetryEvent extends Document {
  organizationId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  driverId?: Types.ObjectId;
  shipmentId?: Types.ObjectId;
  dispatchId?: Types.ObjectId;
  latitude: number;
  longitude: number;
  speedKmh: number;
  headingDeg: number;
  altitudeMeters?: number;
  accuracyMeters?: number;
  odometerKm?: number;
  motionStatus: MotionStatus;
  engineStatus: 'RUNNING' | 'IDLE' | 'OFF';
  batteryLevel?: number;
  source: TelemetrySource;
  isSimulated: boolean;
  recordedAt: Date;
  serverReceivedAt: Date;
}

const TelemetryEventSchema = new Schema<ITelemetryEvent>(
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
    dispatchId: {
      type: Schema.Types.ObjectId,
      ref: 'Dispatch',
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    speedKmh: {
      type: Number,
      required: true,
      min: 0,
      max: 250,
      default: 0,
    },
    headingDeg: {
      type: Number,
      required: true,
      min: 0,
      max: 360,
      default: 0,
    },
    altitudeMeters: { type: Number },
    accuracyMeters: { type: Number },
    odometerKm: { type: Number },
    motionStatus: {
      type: String,
      enum: ['MOVING', 'IDLE', 'STOPPED', 'OFFLINE'],
      default: 'STOPPED',
      index: true,
    },
    engineStatus: {
      type: String,
      enum: ['RUNNING', 'IDLE', 'OFF'],
      default: 'RUNNING',
    },
    batteryLevel: { type: Number, default: 100 },
    source: {
      type: String,
      enum: ['SIMULATED', 'HARDWARE_GPS'],
      default: 'SIMULATED',
      index: true,
    },
    isSimulated: { type: Boolean, default: true },
    recordedAt: { type: Date, required: true, index: true },
    serverReceivedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

// Compound indexes for high performance telemetry queries
TelemetryEventSchema.index({ organizationId: 1, vehicleId: 1, recordedAt: -1 });
TelemetryEventSchema.index({ organizationId: 1, recordedAt: -1 });

export const TelemetryEvent = model<ITelemetryEvent>('TelemetryEvent', TelemetryEventSchema);
