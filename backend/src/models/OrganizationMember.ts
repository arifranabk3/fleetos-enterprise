import { Schema, model, Document, Types } from 'mongoose';
import { UserRole } from '../types/domain';

export interface IOrganizationMember extends Document {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: UserRole;
  customRoleId?: Types.ObjectId;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  invitedBy?: Types.ObjectId;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationMemberSchema = new Schema<IOrganizationMember>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is mandatory'],
      index: true,
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
    customRoleId: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INVITED', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce single active membership per user per organization
OrganizationMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
OrganizationMemberSchema.index({ userId: 1, status: 1 });

export const OrganizationMember = model<IOrganizationMember>(
  'OrganizationMember',
  OrganizationMemberSchema
);
