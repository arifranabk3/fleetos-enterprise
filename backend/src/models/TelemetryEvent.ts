import { Schema, model, Document, Types } from 'mongoose';

export interface ITelemetryEvent extends Document {
  organizationId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  shipmentId?: Types.ObjectId;
  latitude: number;
  longitude: number;
  speedKmh: number;
  headingDeg: number;
  isSimulated: boolean;
  batteryLevel?: number;
  engineStatus: 'RUNNING' | 'IDLE' | 'OFF';
  timestamp: Date;
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
    shipmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Shipment',
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    speedKmh: { type: Number, default: 0 },
    headingDeg: { type: Number, default: 0 },
    isSimulated: { type: Boolean, default: true },
    batteryLevel: { type: Number, default: 100 },
    engineStatus: {
      type: String,
      enum: ['RUNNING', 'IDLE', 'OFF'],
      default: 'RUNNING',
    },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
  }
);

// High-speed telemetry compound index
TelemetryEventSchema.index({ organizationId: 1, vehicleId: 1, timestamp: -1 });

export const TelemetryEvent = model<ITelemetryEvent>('TelemetryEvent', TelemetryEventSchema);

