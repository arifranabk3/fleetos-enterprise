import { Schema, model, Document, Types } from 'mongoose';

export type ComplianceDocumentType =
  | 'REGISTRATION'
  | 'INSURANCE'
  | 'FITNESS_CERTIFICATE'
  | 'INSPECTION_CERTIFICATE'
  | 'DOT_PERMIT'
  | 'HAZMAT_PERMIT'
  | 'CUSTOM';

export type ComplianceStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'MISSING';

export interface IVehicleComplianceDocument extends Document {
  organizationId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  documentType: ComplianceDocumentType;
  documentNumber: string;
  issuingAuthority?: string;
  issueDate: Date;
  expiryDate: Date;
  fileReference?: string;
  reminderDays: number;
  status: ComplianceStatus;
  notes?: string;
  isArchived: boolean;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleComplianceDocumentSchema = new Schema<IVehicleComplianceDocument>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      enum: [
        'REGISTRATION',
        'INSURANCE',
        'FITNESS_CERTIFICATE',
        'INSPECTION_CERTIFICATE',
        'DOT_PERMIT',
        'HAZMAT_PERMIT',
        'CUSTOM',
      ],
      required: true,
    },
    documentNumber: { type: String, required: true, trim: true },
    issuingAuthority: { type: String, trim: true },
    issueDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true, index: true },
    fileReference: { type: String },
    reminderDays: { type: Number, default: 30 },
    status: {
      type: String,
      enum: ['VALID', 'EXPIRING_SOON', 'EXPIRED', 'MISSING'],
      default: 'VALID',
      index: true,
    },
    notes: { type: String },
    isArchived: { type: Boolean, default: false, index: true },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

VehicleComplianceDocumentSchema.index({ organizationId: 1, vehicleId: 1, isArchived: 1 });
VehicleComplianceDocumentSchema.index({ organizationId: 1, expiryDate: 1 });
VehicleComplianceDocumentSchema.index({ organizationId: 1, status: 1 });

export const VehicleComplianceDocument = model<IVehicleComplianceDocument>(
  'VehicleComplianceDocument',
  VehicleComplianceDocumentSchema
);
