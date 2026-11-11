import { Schema, model, Document, Types } from 'mongoose';
import { UserRole } from '../types/domain';

export interface IInvitation extends Document {
  organizationId: Types.ObjectId;
  email: string;
  role: UserRole;
  tokenHash: string;
  invitedBy: Types.ObjectId;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvitationSchema = new Schema<IInvitation>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: [
        'SUPER_ADMIN',
        'ORGANIZATION_OWNER',
        'ADMIN',
        'FLEET_MANAGER',
        'DISPATCHER',
        'DRIVER',
        'ACCOUNTANT',
        'VIEWER',
      ],
      default: 'VIEWER',
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    acceptedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// One pending invitation per email per organization
InvitationSchema.index({ organizationId: 1, email: 1, status: 1 });

export const Invitation = model<IInvitation>('Invitation', InvitationSchema);

