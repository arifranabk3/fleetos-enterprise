import { Schema, model, Document, Types } from 'mongoose';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'UNVERIFIED';
  isEmailVerified: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  lastLoginAt?: Date;
  lastActiveOrganizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
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
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'UNVERIFIED'],
      default: 'ACTIVE',
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: true, // Auto-verified in dev/demo environment
    },
    emailVerificationTokenHash: { type: String },
    emailVerificationExpiresAt: { type: Date },
    passwordResetTokenHash: { type: String },
    passwordResetExpiresAt: { type: Date },
    lastLoginAt: { type: Date },
    lastActiveOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
    },
  },
  {
    timestamps: true,
  }
);

export const User = model<IUser>('User', UserSchema);
