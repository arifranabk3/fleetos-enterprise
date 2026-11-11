import { Schema, model, Document, Types } from 'mongoose';

export interface IGeofence extends Document {
  organizationId: Types.ObjectId;
  name: string;
  description?: string;
  type: 'CIRCLE' | 'POLYGON';
  circleConfig?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  };
  polygonCoordinates?: Array<[number, number]>; // [latitude, longitude] pairs
  category: 'HUB' | 'CUSTOMER_DEPOT' | 'SERVICE_CENTER' | 'RESTRICTED_ZONE';
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GeofenceSchema = new Schema<IGeofence>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: { type: String },
    type: {
      type: String,
      enum: ['CIRCLE', 'POLYGON'],
      default: 'CIRCLE',
    },
    circleConfig: {
      latitude: { type: Number },
      longitude: { type: Number },
      radiusMeters: { type: Number },
    },
    polygonCoordinates: {
      type: [[Number]],
    },
    category: {
      type: String,
      enum: ['HUB', 'CUSTOMER_DEPOT', 'SERVICE_CENTER', 'RESTRICTED_ZONE'],
      default: 'HUB',
    },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound tenant index
GeofenceSchema.index({ organizationId: 1, name: 1 });
GeofenceSchema.index({ organizationId: 1, isActive: 1 });

export const Geofence = model<IGeofence>('Geofence', GeofenceSchema);
