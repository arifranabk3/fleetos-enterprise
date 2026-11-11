import { Schema, model, Document, Types } from 'mongoose';

export interface INotification extends Document {
  organizationId: Types.ObjectId;
  recipientUserId?: Types.ObjectId;
  type:
    | 'DISPATCH_ASSIGNED'
    | 'SHIPMENT_DELIVERED'
    | 'MAINTENANCE_DUE'
    | 'COMPLIANCE_EXPIRING'
    | 'SPEEDING_ALERT'
    | 'FUEL_ANOMALY'
    | 'DRIVER_LICENSE_EXPIRING'
    | 'DRIVER_DOCUMENT_EXPIRING'
    | 'DRIVER_SHIFT_ALERT'
    | 'DRIVER_INCIDENT_ALERT'
    | 'SYSTEM_ALERT';
  title: string;
  message: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    type: {
      type: String,
      enum: [
        'DISPATCH_ASSIGNED',
        'SHIPMENT_DELIVERED',
        'MAINTENANCE_DUE',
        'COMPLIANCE_EXPIRING',
        'SPEEDING_ALERT',
        'FUEL_ANOMALY',
        'DRIVER_LICENSE_EXPIRING',
        'DRIVER_DOCUMENT_EXPIRING',
        'DRIVER_SHIFT_ALERT',
        'DRIVER_INCIDENT_ALERT',
        'SYSTEM_ALERT',
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

NotificationSchema.index({ organizationId: 1, recipientUserId: 1, isRead: 1 });

export const Notification = model<INotification>('Notification', NotificationSchema);

