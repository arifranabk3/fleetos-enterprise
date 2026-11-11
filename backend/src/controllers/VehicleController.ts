import { Response } from 'express';
import { Vehicle, MaintenanceRecord, Assignment, AuditLog } from '../models';
import { AuthRequest } from '../middleware/auth';
import { CreateVehicleSchema, UpdateVehicleSchema, VehicleStatusTransitionSchema } from '../validators/fleetValidators';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';

const vehicleRepo = new BaseTenantRepository(Vehicle);

export class VehicleController {
  /**
   * POST /api/v1/vehicles
   */
  static async create(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const parsed = CreateVehicleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      // Check unique plate & VIN in tenant
      const existingPlate = await vehicleRepo.findOne(req.tenant, { plateNumber: parsed.data.plateNumber.toUpperCase() });
      if (existingPlate) {
        return res.status(409).json({ success: false, error: { message: 'Vehicle plate number already registered in this fleet.' } });
      }

      const existingVin = await vehicleRepo.findOne(req.tenant, { vin: parsed.data.vin.toUpperCase() });
      if (existingVin) {
        return res.status(409).json({ success: false, error: { message: 'VIN already registered in this fleet.' } });
      }

      const vehicle = await vehicleRepo.create(req.tenant, parsed.data as any);

      await AuditLog.create({
        organizationId: req.tenant.organizationId,
        actorId: req.tenant.userId,
        actorEmail: req.user?.email || 'operator',
        action: 'VEHICLE_CREATED',
        entity: 'VEHICLE',
        entityId: vehicle._id.toString(),
        details: { plateNumber: vehicle.plateNumber, vin: vehicle.vin },
        ipAddress: req.ip,
      });

      return res.status(201).json({ success: true, data: vehicle });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/vehicles
   */
  static async list(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const { search, status, type, page = '1', limit = '20' } = req.query;
      const filter: any = { isArchived: false };

      if (status) filter.status = status;
      if (type) filter.type = type;
      if (search) {
        const regex = new RegExp(search as string, 'i');
        filter.$or = [{ plateNumber: regex }, { vin: regex }, { make: regex }, { modelName: regex }];
      }

      const vehicles = await vehicleRepo.find(req.tenant, filter);
      const total = await Vehicle.countDocuments({ organizationId: req.tenant.organizationId, isArchived: false });

      return res.status(200).json({
        success: true,
        data: vehicles,
        meta: {
          total,
          page: Number(page),
          limit: Number(limit),
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/vehicles/:id
   */
  static async getById(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const vehicle = await vehicleRepo.findById(req.tenant, req.params.id);
      if (!vehicle || vehicle.isArchived) {
        return res.status(404).json({ success: false, error: { message: 'Vehicle not found.' } });
      }

      // Fetch active assignment if any
      const activeAssignment = await Assignment.findOne({
        organizationId: req.tenant.organizationId,
        vehicleId: vehicle._id,
        status: 'ACTIVE',
      }).populate('driverId');

      // Fetch maintenance records
      const maintenances = await MaintenanceRecord.find({
        organizationId: req.tenant.organizationId,
        vehicleId: vehicle._id,
      }).sort({ performedAt: -1 }).limit(5);

      return res.status(200).json({
        success: true,
        data: {
          ...vehicle.toObject(),
          activeAssignment,
          maintenances,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * PATCH /api/v1/vehicles/:id
   */
  static async update(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const parsed = UpdateVehicleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const vehicle = await vehicleRepo.findById(req.tenant, req.params.id);
      if (!vehicle || vehicle.isArchived) {
        return res.status(404).json({ success: false, error: { message: 'Vehicle not found.' } });
      }

      await vehicleRepo.updateOne(req.tenant, { _id: req.params.id }, { $set: parsed.data });
      const updated = await vehicleRepo.findById(req.tenant, req.params.id);

      await AuditLog.create({
        organizationId: req.tenant.organizationId,
        actorId: req.tenant.userId,
        actorEmail: req.user?.email || 'operator',
        action: 'VEHICLE_UPDATED',
        entity: 'VEHICLE',
        entityId: req.params.id,
        details: parsed.data,
        ipAddress: req.ip,
      });

      return res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * PATCH /api/v1/vehicles/:id/status
   */
  static async updateStatus(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const parsed = VehicleStatusTransitionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const vehicle = await vehicleRepo.findById(req.tenant, req.params.id);
      if (!vehicle || vehicle.isArchived) {
        return res.status(404).json({ success: false, error: { message: 'Vehicle not found.' } });
      }

      // Business rule: Cannot set to OUT_OF_SERVICE or RETIRED if assigned to active driver
      if (['OUT_OF_SERVICE', 'RETIRED'].includes(parsed.data.status) && vehicle.status === 'ASSIGNED') {
        return res.status(400).json({
          success: false,
          error: { message: 'Cannot take vehicle out of service while an active driver assignment exists. Release assignment first.' },
        });
      }

      await vehicleRepo.updateOne(req.tenant, { _id: req.params.id }, { $set: { status: parsed.data.status } });

      await AuditLog.create({
        organizationId: req.tenant.organizationId,
        actorId: req.tenant.userId,
        actorEmail: req.user?.email || 'operator',
        action: 'VEHICLE_STATUS_CHANGED',
        entity: 'VEHICLE',
        entityId: req.params.id,
        details: { oldStatus: vehicle.status, newStatus: parsed.data.status },
        ipAddress: req.ip,
      });

      return res.status(200).json({ success: true, data: { id: vehicle._id, status: parsed.data.status } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * DELETE /api/v1/vehicles/:id (Soft Archive)
   */
  static async archive(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const vehicle = await vehicleRepo.findById(req.tenant, req.params.id);
      if (!vehicle || vehicle.isArchived) {
        return res.status(404).json({ success: false, error: { message: 'Vehicle not found.' } });
      }

      if (vehicle.status === 'IN_TRANSIT' || vehicle.status === 'ASSIGNED') {
        return res.status(400).json({
          success: false,
          error: { message: 'Cannot archive a vehicle that is currently assigned or in transit.' },
        });
      }

      await vehicleRepo.updateOne(req.tenant, { _id: req.params.id }, { $set: { isArchived: true, status: 'RETIRED' } });

      await AuditLog.create({
        organizationId: req.tenant.organizationId,
        actorId: req.tenant.userId,
        actorEmail: req.user?.email || 'operator',
        action: 'VEHICLE_ARCHIVED',
        entity: 'VEHICLE',
        entityId: req.params.id,
        ipAddress: req.ip,
      });

      return res.status(200).json({ success: true, message: 'Vehicle archived successfully.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * POST /api/v1/vehicles/:id/documents
   */
  static async addDocument(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const { docType, documentNumber, issueDate, expiryDate, fileUrl } = req.body;
      if (!docType || !documentNumber || !issueDate || !expiryDate) {
        return res.status(400).json({ success: false, error: { message: 'Required document metadata missing.' } });
      }

      const vehicle = await vehicleRepo.findById(req.tenant, req.params.id);
      if (!vehicle || vehicle.isArchived) {
        return res.status(404).json({ success: false, error: { message: 'Vehicle not found.' } });
      }

      const docItem = {
        docType,
        documentNumber,
        issueDate: new Date(issueDate),
        expiryDate: new Date(expiryDate),
        fileUrl: fileUrl || '/uploads/dev-mock-doc.pdf',
        uploadedBy: req.tenant.userId,
        createdAt: new Date(),
      };

      await Vehicle.updateOne(
        { _id: vehicle._id, organizationId: req.tenant.organizationId },
        { $push: { documents: docItem } }
      );

      return res.status(201).json({ success: true, data: docItem });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
}

