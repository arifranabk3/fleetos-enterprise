import { Schema, model, Document, Types } from 'mongoose';
import { UserRole } from '../types/domain';

export interface IUser extends Document {
  organizationId: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'INVITED';
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for tenant isolation'],
      index: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
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
    phone: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'INVITED'],
      default: 'ACTIVE',
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound tenant isolation index: email must be unique per organization
UserSchema.index({ organizationId: 1, email: 1 }, { unique: true });

export const User = model<IUser>('User', UserSchema);
