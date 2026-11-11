import { z } from 'zod';

export const CreateDriverExtendedSchema = z.object({
  employeeNumber: z.string().max(50).trim().optional(),
  fullName: z.string().min(2).max(100).trim(),
  email: z.string().email().trim().toLowerCase(),
  phone: z.string().min(7).max(25).trim(),
  address: z.string().max(200).optional(),
  licenseNumber: z.string().min(5).max(30).trim().toUpperCase(),
  licenseClass: z.string().default('CDL-A'),
  licenseCategories: z.array(z.string()).optional(),
  licenseIssueDate: z.string().datetime().or(z.date()).optional(),
  licenseExpiry: z.string().datetime().or(z.date()),
  employmentStatus: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR']).default('FULL_TIME'),
  assignedDepot: z.string().max(100).optional(),
  joiningDate: z.string().datetime().or(z.date()).optional(),
  emergencyContact: z
    .object({
      name: z.string().min(2).max(100),
      phone: z.string().min(7).max(25),
      relationship: z.string().optional(),
    })
    .optional(),
  notes: z.string().max(500).optional(),
});

export const UpdateDriverExtendedSchema = CreateDriverExtendedSchema.partial();

export const DriverStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'ON_DUTY', 'OFF_DUTY', 'ON_LEAVE', 'SUSPENDED', 'INACTIVE']),
  reason: z.string().max(250).optional(),
});

export const CreateDriverDocumentSchema = z.object({
  documentType: z.enum([
    'DRIVING_LICENSE',
    'IDENTITY_DOCUMENT',
    'MEDICAL_FITNESS_CERTIFICATE',
    'TRAINING_CERTIFICATE',
    'BACKGROUND_CHECK',
    'OTHER',
  ]),
  documentNumber: z.string().min(3).max(50).trim().toUpperCase(),
  issueDate: z.string().datetime().or(z.date()).optional(),
  expiryDate: z.string().datetime().or(z.date()).optional(),
  fileReference: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});

export const UpdateDriverDocumentSchema = z.object({
  documentNumber: z.string().min(3).max(50).trim().toUpperCase().optional(),
  issueDate: z.string().datetime().or(z.date()).optional(),
  expiryDate: z.string().datetime().or(z.date()).optional(),
  verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
  fileReference: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});

export const CreateDriverShiftSchema = z.object({
  driverId: z.string().min(24).max(24),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'shiftDate must be YYYY-MM-DD'),
  plannedStart: z.string().datetime().or(z.date()),
  plannedEnd: z.string().datetime().or(z.date()),
  notes: z.string().max(500).optional(),
});

export const EndShiftSchema = z.object({
  actualEnd: z.string().datetime().or(z.date()).optional(),
  notes: z.string().max(500).optional(),
});

export const CreateDriverIncidentSchema = z.object({
  category: z.enum([
    'ACCIDENT',
    'TRAFFIC_VIOLATION',
    'VEHICLE_DAMAGE',
    'SAFETY_COMPLAINT',
    'DELIVERY_INCIDENT',
    'OTHER',
  ]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  incidentDate: z.string().datetime().or(z.date()),
  driverId: z.string().min(24).max(24),
  vehicleId: z.string().min(24).max(24).optional(),
  shipmentId: z.string().min(24).max(24).optional(),
  dispatchId: z.string().min(24).max(24).optional(),
  description: z.string().min(5).max(2000).trim(),
  evidenceReference: z.string().max(500).optional(),
});

export const UpdateDriverIncidentSchema = z.object({
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  description: z.string().min(5).max(2000).trim().optional(),
  evidenceReference: z.string().max(500).optional(),
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED']).optional(),
  resolutionNotes: z.string().max(1000).optional(),
});

export const ResolveDriverIncidentSchema = z.object({
  resolutionNotes: z.string().min(5).max(1000).trim(),
});
