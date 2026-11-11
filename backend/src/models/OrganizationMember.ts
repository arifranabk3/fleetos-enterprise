import { Schema, model, Document, Types } from 'mongoose';
import { UserRole } from '../types/domain';

export interface IOrganizationMember extends Document {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: UserRole;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
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
        'PLATFORM_SUPER_ADMIN',
        'ORGANIZATION_ADMIN',
        'DISPATCH_MANAGER',
        'FLEET_MANAGER',
        'SAFETY_OFFICER',
        'DRIVER',
        'CUSTOMER',
      ],
      default: 'ORGANIZATION_ADMIN',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INVITED', 'SUSPENDED'],
      default: 'ACTIVE',
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

// One active membership per user per organization
OrganizationMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

export const OrganizationMember = model<IOrganizationMember>(
  'OrganizationMember',
  OrganizationMemberSchema
);

