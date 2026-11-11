import { Response } from 'express';
import { Driver, Assignment, AuditLog } from '../models';
import { AuthRequest } from '../middleware/auth';
import { CreateDriverSchema, UpdateDriverSchema } from '../validators/fleetValidators';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';

const driverRepo = new BaseTenantRepository(Driver);

export class DriverController {
  /**
   * POST /api/v1/drivers
   */
  static async create(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const parsed = CreateDriverSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      // Check duplicate license in tenant
      const existingLicense = await driverRepo.findOne(req.tenant, {
        licenseNumber: parsed.data.licenseNumber.toUpperCase(),
      });
      if (existingLicense) {
        return res.status(409).json({ success: false, error: { message: 'Driver license number already exists in this organization.' } });
      }

      const driver = await driverRepo.create(req.tenant, parsed.data as any);

      await AuditLog.create({
        organizationId: req.tenant.organizationId,
        actorId: req.tenant.userId,
        actorEmail: req.user?.email || 'operator',
        action: 'DRIVER_CREATED',
        entity: 'DRIVER',
        entityId: driver._id.toString(),
        details: { fullName: driver.fullName, licenseNumber: driver.licenseNumber },
        ipAddress: req.ip,
      });

      return res.status(201).json({ success: true, data: driver });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/drivers
   */
  static async list(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const { search, status, page = '1', limit = '20' } = req.query;
      const filter: any = { isArchived: false };

      if (status) filter.status = status;
      if (search) {
        const regex = new RegExp(search as string, 'i');
        filter.$or = [{ fullName: regex }, { email: regex }, { licenseNumber: regex }, { phone: regex }];
      }

      const drivers = await driverRepo.find(req.tenant, filter);
      const total = await Driver.countDocuments({ organizationId: req.tenant.organizationId, isArchived: false });

      return res.status(200).json({
        success: true,
        data: drivers,
        meta: { total, page: Number(page), limit: Number(limit) },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/drivers/:id
   */
  static async getById(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const driver = await driverRepo.findById(req.tenant, req.params.id);
      if (!driver || driver.isArchived) {
        return res.status(404).json({ success: false, error: { message: 'Driver not found.' } });
      }

      // Fetch assignment history
      const assignments = await Assignment.find({
        organizationId: req.tenant.organizationId,
        driverId: driver._id,
      }).populate('vehicleId').sort({ assignedAt: -1 });

      return res.status(200).json({
        success: true,
        data: {
          ...driver.toObject(),
          assignments,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * PATCH /api/v1/drivers/:id
   */
  static async update(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const parsed = UpdateDriverSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const driver = await driverRepo.findById(req.tenant, req.params.id);
      if (!driver || driver.isArchived) {
        return res.status(404).json({ success: false, error: { message: 'Driver not found.' } });
      }

      await driverRepo.updateOne(req.tenant, { _id: req.params.id }, { $set: parsed.data });
      const updated = await driverRepo.findById(req.tenant, req.params.id);

      await AuditLog.create({
        organizationId: req.tenant.organizationId,
        actorId: req.tenant.userId,
        actorEmail: req.user?.email || 'operator',
        action: 'DRIVER_UPDATED',
        entity: 'DRIVER',
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
   * PATCH /api/v1/drivers/:id/status
   */
  static async updateStatus(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const { status } = req.body;
      const validStatuses = ['AVAILABLE', 'ASSIGNED', 'ON_DUTY', 'OFF_DUTY', 'ON_LEAVE', 'SUSPENDED', 'INACTIVE'];

      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: { message: 'Invalid driver status value.' } });
      }

      const driver = await driverRepo.findById(req.tenant, req.params.id);
      if (!driver || driver.isArchived) {
        return res.status(404).json({ success: false, error: { message: 'Driver not found.' } });
      }

      await driverRepo.updateOne(req.tenant, { _id: req.params.id }, { $set: { status } });

      return res.status(200).json({ success: true, data: { id: driver._id, status } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * DELETE /api/v1/drivers/:id (Soft Archive)
   */
  static async archive(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const driver = await driverRepo.findById(req.tenant, req.params.id);
      if (!driver || driver.isArchived) {
        return res.status(404).json({ success: false, error: { message: 'Driver not found.' } });
      }

      if (driver.status === 'ASSIGNED' || driver.status === 'ON_DUTY') {
        return res.status(400).json({
          success: false,
          error: { message: 'Cannot archive driver while actively assigned to a vehicle.' },
        });
      }

      await driverRepo.updateOne(req.tenant, { _id: req.params.id }, { $set: { isArchived: true, status: 'INACTIVE' } });

      return res.status(200).json({ success: true, message: 'Driver archived successfully.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
}

