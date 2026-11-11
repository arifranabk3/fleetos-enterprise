import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  organizationId?: Types.ObjectId;
  actorId?: Types.ObjectId;
  actorEmail: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    actorEmail: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entity: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
    },
    details: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

AuditLogSchema.index({ organizationId: 1, timestamp: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', AuditLogSchema);

