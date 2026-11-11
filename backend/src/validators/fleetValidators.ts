import { z } from 'zod';

export const CreateVehicleSchema = z.object({
  plateNumber: z.string().min(2).max(20).trim(),
  vin: z.string().min(11).max(17).trim().toUpperCase(),
  make: z.string().min(2).max(50).trim(),
  modelName: z.string().min(1).max(50).trim(),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 2),
  type: z.enum(['SEMI_TRUCK', 'BOX_TRUCK', 'CARGO_VAN', 'FLATBED']).default('SEMI_TRUCK'),
  fuelType: z.enum(['DIESEL', 'ELECTRIC', 'HYBRID', 'GASOLINE']).default('DIESEL'),
  color: z.string().optional(),
  capacityKg: z.number().positive(),
  odometerKm: z.number().nonnegative().default(0),
  insuranceExpiry: z.string().datetime().optional().or(z.date().optional()),
  registrationExpiry: z.string().datetime().optional().or(z.date().optional()),
  inspectionExpiry: z.string().datetime().optional().or(z.date().optional()),
  notes: z.string().max(500).optional(),
});

export const UpdateVehicleSchema = CreateVehicleSchema.partial();

export const VehicleStatusTransitionSchema = z.object({
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE', 'RETIRED']),
  notes: z.string().max(300).optional(),
});

export const CreateDriverSchema = z.object({
  fullName: z.string().min(2).max(100).trim(),
  email: z.string().email().trim().toLowerCase(),
  phone: z.string().min(7).max(25).trim(),
  address: z.string().max(200).optional(),
  licenseNumber: z.string().min(5).max(30).trim().toUpperCase(),
  licenseClass: z.string().default('CDL-A'),
  licenseExpiry: z.string().datetime().or(z.date()),
  employmentStatus: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR']).default('FULL_TIME'),
  emergencyContact: z.object({
    name: z.string().min(2).max(100),
    phone: z.string().min(7).max(25),
    relationship: z.string().optional(),
  }).optional(),
  notes: z.string().max(500).optional(),
});

export const UpdateDriverSchema = CreateDriverSchema.partial();

export const CreateAssignmentSchema = z.object({
  vehicleId: z.string().min(24).max(24),
  driverId: z.string().min(24).max(24),
  notes: z.string().max(300).optional(),
});

