import { Schema, model, Document, Types } from 'mongoose';

export type DriverDocumentType =
  | 'DRIVING_LICENSE'
  | 'IDENTITY_DOCUMENT'
  | 'MEDICAL_FITNESS_CERTIFICATE'
  | 'TRAINING_CERTIFICATE'
  | 'BACKGROUND_CHECK'
  | 'OTHER';

export type DriverDocumentVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type DriverDocumentExpiryStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_APPLICABLE';

export interface IDriverDocument extends Document {
  organizationId: Types.ObjectId;
  driverId: Types.ObjectId;
  documentType: DriverDocumentType;
  documentNumber: string;
  issueDate?: Date;
  expiryDate?: Date;
  verificationStatus: DriverDocumentVerificationStatus;
  expiryStatus: DriverDocumentExpiryStatus;
  fileReference?: string;
  notes?: string;
  createdBy: Types.ObjectId;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DriverDocumentSchema = new Schema<IDriverDocument>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      enum: [
        'DRIVING_LICENSE',
        'IDENTITY_DOCUMENT',
        'MEDICAL_FITNESS_CERTIFICATE',
        'TRAINING_CERTIFICATE',
        'BACKGROUND_CHECK',
        'OTHER',
      ],
      required: true,
    },
    documentNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    expiryStatus: {
      type: String,
      enum: ['VALID', 'EXPIRING_SOON', 'EXPIRED', 'NOT_APPLICABLE'],
      default: 'VALID',
      index: true,
    },
    fileReference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound multi-tenant indexes
DriverDocumentSchema.index({ organizationId: 1, driverId: 1, documentType: 1 });
DriverDocumentSchema.index({ organizationId: 1, expiryDate: 1 });
DriverDocumentSchema.index({ organizationId: 1, verificationStatus: 1 });

export const DriverDocument = model<IDriverDocument>('DriverDocument', DriverDocumentSchema);
