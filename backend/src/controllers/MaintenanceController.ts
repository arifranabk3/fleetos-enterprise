import { Response } from 'express';
import { MaintenanceRecord, IMaintenanceRecord, MaintenanceStatus } from '../models/MaintenanceRecord';
import { MaintenanceSchedule } from '../models/MaintenanceSchedule';
import { MaintenanceVendor } from '../models/MaintenanceVendor';
import { Vehicle } from '../models/Vehicle';
import { AuditLog } from '../models/AuditLog';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';
import { AuthRequest } from '../middleware/auth';
import { MaintenanceStateMachine } from '../services/MaintenanceStateMachine';
import { PreventiveMaintenanceEngine } from '../services/PreventativeMaintenanceEngine';
import { MaintenanceLockService } from '../services/MaintenanceLockService';

const maintenanceRepo = new BaseTenantRepository(MaintenanceRecord);
const scheduleRepo = new BaseTenantRepository(MaintenanceSchedule);
const vendorRepo = new BaseTenantRepository(MaintenanceVendor);

export class MaintenanceController {
  /* ==========================================================================
     MAINTENANCE RECORDS & WORK ORDERS
     ========================================================================== */

  /**
   * POST /api/v1/maintenance
   */
  public static async createRecord(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const userId = tenant.userId as any;
      const userRole = tenant.role || 'FLEET_MANAGER';

      const {
        vehicleId,
        scheduleId,
        vendorId,
        maintenanceType,
        title,
        description,
        scheduledDate,
        odometerReadingKm,
        laborCost = 0,
        partsCost = 0,
        priority = 'MEDIUM',
        notes,
      } = req.body;

      if (!vehicleId || !maintenanceType || !title || !description || !scheduledDate) {
        res.status(400).json({
          success: false,
          error: { message: 'vehicleId, maintenanceType, title, description, and scheduledDate are required.' },
        });
        return;
      }

      // Verify Vehicle belongs to tenant
      const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        organizationId: tenant.organizationId,
        isArchived: false,
      });

      if (!vehicle) {
        res.status(404).json({ success: false, error: { message: 'Vehicle not found in this organization.' } });
        return;
      }

      // Verify vendor if supplied
      if (vendorId) {
        const vendor = await vendorRepo.findById(tenant, vendorId);
        if (!vendor || !vendor.isActive) {
          res.status(404).json({ success: false, error: { message: 'Maintenance vendor not found or inactive.' } });
          return;
        }
      }

      const odometer = odometerReadingKm !== undefined ? Number(odometerReadingKm) : vehicle.odometerKm;
      const totalCost = Number(laborCost) + Number(partsCost);

      const record = await maintenanceRepo.create(tenant, {
        vehicleId: vehicle._id as any,
        scheduleId: scheduleId || undefined,
        vendorId: vendorId || undefined,
        maintenanceType,
        title: title.trim(),
        description: description.trim(),
        scheduledDate: new Date(scheduledDate),
        odometerReadingKm: odometer,
        laborCost: Number(laborCost),
        partsCost: Number(partsCost),
        totalCost,
        priority,
        status: 'SCHEDULED',
        notes,
        createdBy: userId,
        timeline: [
          {
            status: 'SCHEDULED',
            timestamp: new Date(),
            note: 'Service request created and scheduled.',
            actorId: userId,
          },
        ],
      } as any);

      await AuditLog.create({
        organizationId: tenant.organizationId,
        actorId: userId,
        actorEmail: req.user?.email || 'operator',
        action: 'MAINTENANCE_CREATED',
        entity: 'MAINTENANCE_RECORD',
        entityId: record._id.toString(),
        details: { vehicleId, title, scheduledDate },
      });

      res.status(201).json({
        success: true,
        message: 'Maintenance work order scheduled successfully.',
        data: record,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/maintenance
   */
  public static async listRecords(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const { vehicleId, status, priority, maintenanceType, search, page = 1, limit = 20 } = req.query;

      const filter: any = {};
      if (vehicleId) filter.vehicleId = vehicleId;
      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (maintenanceType) filter.maintenanceType = maintenanceType;

      if (search) {
        filter.$or = [
          { title: { $regex: String(search), $options: 'i' } },
          { description: { $regex: String(search), $options: 'i' } },
        ];
      }

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const total = await maintenanceRepo.count(req.tenant, filter);
      const records = await MaintenanceRecord.find({
        organizationId: req.tenant.organizationId,
        ...filter,
      })
        .sort({ scheduledDate: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('vehicleId', 'plateNumber make modelName status odometerKm')
        .populate('vendorId', 'name phone email')
        .populate('createdBy', 'firstName lastName email')
        .lean();

      res.json({
        success: true,
        data: records,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/maintenance/:id
   */
  public static async getRecord(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const { id } = req.params;
      const record = await MaintenanceRecord.findOne({
        _id: id,
        organizationId: req.tenant.organizationId,
      })
        .populate('vehicleId', 'plateNumber make modelName type year odometerKm status')
        .populate('vendorId')
        .populate('createdBy', 'firstName lastName email')
        .populate('completedBy', 'firstName lastName email');

      if (!record) {
        res.status(404).json({ success: false, error: { message: 'Maintenance record not found' } });
        return;
      }

      res.json({
        success: true,
        data: record,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * POST /api/v1/maintenance/:id/start
   * Starts service: sets status -> IN_PROGRESS and locks vehicle -> MAINTENANCE
   */
  public static async startMaintenance(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const userId = tenant.userId as any;
      const { id } = req.params;

      const record = await maintenanceRepo.findById(tenant, id);
      if (!record) {
        res.status(404).json({ success: false, error: { message: 'Maintenance record not found' } });
        return;
      }

      const transition = MaintenanceStateMachine.validateTransition(record.status, 'IN_PROGRESS', {
        userId: userId?.toString() || 'operator',
        userRole: tenant.role || 'FLEET_MANAGER',
      });

      if (!transition.allowed) {
        res.status(400).json({ success: false, error: { message: transition.reason } });
        return;
      }

      record.status = 'IN_PROGRESS';
      record.startedDate = new Date();
      record.timeline.push({
        status: 'IN_PROGRESS',
        timestamp: new Date(),
        note: 'Vehicle service started at maintenance bay.',
        actorId: userId,
      });
      await record.save();

      // Acquire maintenance lock on vehicle (preserves pre-maintenance operational status and handles concurrency)
      await MaintenanceLockService.acquireLock(record.vehicleId, record._id);

      res.json({
        success: true,
        message: 'Maintenance started. Vehicle status transitioned to MAINTENANCE.',
        data: record,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * POST /api/v1/maintenance/:id/complete
   * Completes service: calculates costs, recalculates preventive schedule, and releases vehicle -> AVAILABLE
   */
  public static async completeMaintenance(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const userId = tenant.userId as any;
      const { id } = req.params;
      const { laborCost, partsCost, odometerReadingKm, notes } = req.body;

      const record = await maintenanceRepo.findById(tenant, id);
      if (!record) {
        res.status(404).json({ success: false, error: { message: 'Maintenance record not found' } });
        return;
      }

      const transition = MaintenanceStateMachine.validateTransition(record.status, 'COMPLETED', {
        userId: userId?.toString() || 'operator',
        userRole: tenant.role || 'FLEET_MANAGER',
      });

      if (!transition.allowed) {
        res.status(400).json({ success: false, error: { message: transition.reason } });
        return;
      }

      const lCost = laborCost !== undefined ? Number(laborCost) : record.laborCost;
      const pCost = partsCost !== undefined ? Number(partsCost) : record.partsCost;
      const completedOdometer = odometerReadingKm !== undefined ? Number(odometerReadingKm) : record.odometerReadingKm;

      record.status = 'COMPLETED';
      record.completedDate = new Date();
      record.laborCost = lCost;
      record.partsCost = pCost;
      record.totalCost = lCost + pCost;
      record.odometerReadingKm = completedOdometer;
      record.completedBy = userId;
      if (notes) record.notes = notes;

      record.timeline.push({
        status: 'COMPLETED',
        timestamp: new Date(),
        note: `Maintenance completed. Total cost: $${record.totalCost}.`,
        actorId: userId,
      });
      await record.save();

      // Release maintenance lock safely restoring previous operational status
      const lockRelease = await MaintenanceLockService.releaseLock(
        record.vehicleId,
        record._id,
        completedOdometer
      );

      // If linked to a preventive schedule, recalculate next due date & odometer
      if (record.scheduleId) {
        await PreventiveMaintenanceEngine.onServiceCompleted(
          record.scheduleId.toString(),
          record.completedDate,
          completedOdometer
        );
      }

      res.json({
        success: true,
        message: `Maintenance completed successfully. Asset status: ${lockRelease.finalStatus}.`,
        data: record,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * POST /api/v1/maintenance/:id/cancel
   */
  public static async cancelMaintenance(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const userId = tenant.userId as any;
      const { id } = req.params;
      const { reason } = req.body;

      const record = await maintenanceRepo.findById(tenant, id);
      if (!record) {
        res.status(404).json({ success: false, error: { message: 'Maintenance record not found' } });
        return;
      }

      const transition = MaintenanceStateMachine.validateTransition(record.status, 'CANCELLED', {
        userId: userId?.toString() || 'operator',
        userRole: tenant.role || 'FLEET_MANAGER',
        reason,
      });

      if (!transition.allowed) {
        res.status(400).json({ success: false, error: { message: transition.reason } });
        return;
      }

      record.status = 'CANCELLED';
      record.cancellationReason = reason;
      record.timeline.push({
        status: 'CANCELLED',
        timestamp: new Date(),
        note: `Cancelled: ${reason}`,
        actorId: userId,
      });
      await record.save();

      // Release maintenance lock safely restoring previous operational status
      const lockRelease = await MaintenanceLockService.releaseLock(record.vehicleId, record._id);

      res.json({
        success: true,
        message: `Maintenance cancelled. Vehicle status: ${lockRelease.finalStatus}.`,
        data: record,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /* ==========================================================================
     PREVENTIVE SCHEDULES APIS
     ========================================================================== */

  /**
   * POST /api/v1/maintenance/schedules
   */
  public static async createSchedule(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;

      const {
        vehicleId,
        maintenanceType,
        title,
        intervalType = 'TIME',
        intervalDays,
        intervalDistanceKm,
        lastServiceDate,
        lastServiceOdometerKm,
        reminderDaysThreshold = 14,
        reminderKmThreshold = 1000,
        notes,
      } = req.body;

      if (!vehicleId || !maintenanceType || !title) {
        res.status(400).json({ success: false, error: { message: 'vehicleId, maintenanceType, and title are required.' } });
        return;
      }

      const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        organizationId: tenant.organizationId,
        isArchived: false,
      });

      if (!vehicle) {
        res.status(404).json({ success: false, error: { message: 'Vehicle not found.' } });
        return;
      }

      // Compute initial nextDueDate and nextDueOdometerKm
      const baseDate = lastServiceDate ? new Date(lastServiceDate) : new Date();
      const baseOdo = lastServiceOdometerKm !== undefined ? Number(lastServiceOdometerKm) : vehicle.odometerKm;

      let nextDueDate: Date | undefined;
      let nextDueOdometerKm: number | undefined;

      if (intervalDays) {
        nextDueDate = new Date(baseDate.getTime() + Number(intervalDays) * 24 * 60 * 60 * 1000);
      }
      if (intervalDistanceKm) {
        nextDueOdometerKm = baseOdo + Number(intervalDistanceKm);
      }

      const schedule = await scheduleRepo.create(tenant, {
        vehicleId: vehicle._id as any,
        maintenanceType,
        title: title.trim(),
        intervalType,
        intervalDays: intervalDays ? Number(intervalDays) : undefined,
        intervalDistanceKm: intervalDistanceKm ? Number(intervalDistanceKm) : undefined,
        lastServiceDate: lastServiceDate ? new Date(lastServiceDate) : undefined,
        lastServiceOdometerKm: baseOdo,
        nextDueDate,
        nextDueOdometerKm,
        reminderDaysThreshold: Number(reminderDaysThreshold),
        reminderKmThreshold: Number(reminderKmThreshold),
        isActive: true,
        notes,
      } as any);

      res.status(201).json({
        success: true,
        message: 'Preventive maintenance schedule configured successfully.',
        data: schedule,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/maintenance/schedules
   */
  public static async listSchedules(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const { vehicleId } = req.query;
      const filter: any = { organizationId: req.tenant.organizationId, isActive: true };
      if (vehicleId) filter.vehicleId = vehicleId;

      const schedules = await MaintenanceSchedule.find(filter)
        .populate('vehicleId', 'plateNumber make modelName odometerKm')
        .sort({ nextDueDate: 1 })
        .lean();

      res.json({
        success: true,
        data: schedules,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /* ==========================================================================
     VENDORS APIS
     ========================================================================== */

  /**
   * POST /api/v1/maintenance/vendors
   */
  public static async createVendor(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const { name, contactPerson, email, phone, address, services, notes } = req.body;

      if (!name || !email || !phone) {
        res.status(400).json({ success: false, error: { message: 'Vendor name, email, and phone are required.' } });
        return;
      }

      const vendor = await vendorRepo.create(req.tenant, {
        name: name.trim(),
        contactPerson: contactPerson?.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        address,
        services: services || [],
        notes,
        isActive: true,
      } as any);

      res.status(201).json({
        success: true,
        message: 'Maintenance service vendor registered successfully.',
        data: vendor,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/maintenance/vendors
   */
  public static async listVendors(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const vendors = await MaintenanceVendor.find({
        organizationId: req.tenant.organizationId,
        isActive: true,
      })
        .sort({ name: 1 })
        .lean();

      res.json({
        success: true,
        data: vendors,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /* ==========================================================================
     ANALYTICS & OVERVIEW APIS
     ========================================================================== */

  /**
   * GET /api/v1/maintenance/overview
   */
  public static async getOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const orgId = req.tenant.organizationId;

      const [totalRecords, scheduledCount, inProgressCount, overdueCount] = await Promise.all([
        MaintenanceRecord.countDocuments({ organizationId: orgId }),
        MaintenanceRecord.countDocuments({ organizationId: orgId, status: 'SCHEDULED' }),
        MaintenanceRecord.countDocuments({ organizationId: orgId, status: 'IN_PROGRESS' }),
        MaintenanceRecord.countDocuments({ organizationId: orgId, status: 'OVERDUE' }),
      ]);

      // Calculate total maintenance expenditure for current month
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const monthlyExpenditure = await MaintenanceRecord.aggregate([
        {
          $match: {
            organizationId: typeof orgId === 'string' ? new (require('mongoose').Types.ObjectId)(orgId) : orgId,
            status: 'COMPLETED',
            completedDate: { $gte: startOfMonth },
          },
        },
        { $group: { _id: null, total: { $sum: '$totalCost' } } },
      ]);

      res.json({
        success: true,
        data: {
          totalRecords,
          scheduledCount,
          inProgressCount,
          overdueCount,
          monthlyExpenditure: monthlyExpenditure[0]?.total || 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
}
