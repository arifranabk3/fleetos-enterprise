import { Schema, model, Document } from 'mongoose';

export interface IPermission extends Document {
  code: string;
  name: string;
  domain: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const PermissionSchema = new Schema<IPermission>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
    },
    domain: {
      type: String,
      required: true,
      enum: ['FLEET', 'DISPATCH', 'TRACKING', 'BILLING', 'MAINTENANCE', 'USERS', 'REPORTS'],
    },
    description: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const Permission = model<IPermission>('Permission', PermissionSchema);

