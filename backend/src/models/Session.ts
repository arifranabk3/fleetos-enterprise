import { Schema, model, Document, Types } from 'mongoose';

export interface ISession extends Document {
  userId: Types.ObjectId;
  refreshTokenHash: string;
  familyId: string; // Token rotation family for reuse detection
  userAgent?: string;
  ipAddress?: string;
  isRevoked: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      index: true,
    },
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    userAgent: { type: String },
    ipAddress: { type: String },
    isRevoked: { type: Boolean, default: false, index: true },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index auto-deletes expired sessions
    },
  },
  {
    timestamps: true,
  }
);

SessionSchema.index({ userId: 1, isRevoked: 1 });

export const Session = model<ISession>('Session', SessionSchema);

