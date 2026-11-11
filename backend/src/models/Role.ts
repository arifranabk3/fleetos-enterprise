import { Schema, model, Document, Types } from 'mongoose';

export interface IRole extends Document {
  organizationId?: Types.ObjectId; // Optional: null for system-defined global roles
  name: string;
  code: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      default: '',
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    permissions: [
      {
        type: String,
        required: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

RoleSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export const Role = model<IRole>('Role', RoleSchema);

