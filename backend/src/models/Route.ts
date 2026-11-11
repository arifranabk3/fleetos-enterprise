import { Schema, model, Document, Types } from 'mongoose';

export interface IRoute extends Document {
  organizationId: Types.ObjectId;
  name: string;
  code: string;
  origin: {
    name: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    name: string;
    latitude: number;
    longitude: number;
  };
  waypoints: Array<{
    name: string;
    latitude: number;
    longitude: number;
    stopOrder: number;
  }>;
  estimatedDistanceKm: number;
  estimatedDurationHours: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RouteSchema = new Schema<IRoute>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true },
    origin: {
      name: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    destination: {
      name: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    waypoints: [
      {
        name: { type: String, required: true },
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        stopOrder: { type: Number, required: true },
      },
    ],
    estimatedDistanceKm: { type: Number, default: 0 },
    estimatedDurationHours: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

RouteSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export const Route = model<IRoute>('Route', RouteSchema);

