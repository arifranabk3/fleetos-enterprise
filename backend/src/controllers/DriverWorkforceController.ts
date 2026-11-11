import { Response } from 'express';
import { Types } from 'mongoose';
import {
  Driver,
  DriverDocument,
  DriverShift,
  DriverIncident,
  Assignment,
  Vehicle,
  AuditLog,
} from '../models';
import { AuthRequest } from '../middleware/auth';
import {
  CreateDriverExtendedSchema,
  UpdateDriverExtendedSchema,
  DriverStatusSchema,
  CreateDriverDocumentSchema,
  UpdateDriverDocumentSchema,
  CreateDriverShiftSchema,
  EndShiftSchema,
  CreateDriverIncidentSchema,
  UpdateDriverIncidentSchema,
  ResolveDriverIncidentSchema,
} from '../validators/driverValidators';
import { DriverPerformanceEngine } from '../services/DriverPerformanceEngine';
import { DriverAlertService } from '../services/DriverAlertService';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';

const driverRepo = new BaseTenantRepository(Driver);
const docRepo = new BaseTenantRepository(DriverDocument);
const shiftRepo = new BaseTenantRepository(DriverShift);
const incidentRepo = new BaseTenantRepository(DriverIncident);

export class DriverWorkforceController {
  // ==========================================================================
  // 1. DRIVER PROFILE MANAGEMENT
  // ==========================================================================

  static async createDriver(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const parsed = CreateDriverExtendedSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      // Check unique license in tenant
      const existing = await driverRepo.findOne(req.tenant, {
        licenseNumber: parsed.data.licenseNumber.toUpperCase(),
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: { message: 'Driver with this license number already exists in this organization.' },
        });
      }

      const driver = await driverRepo.create(req.tenant, {
        ...parsed.data,
        createdBy: req.tenant.userId as any,
      } as any);

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

  static async listDrivers(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const { status, search, depot, page = '1', limit = '50' } = req.query;
      const filter: any = { isArchived: false };

      if (status) filter.status = status;
      if (depot) filter.assignedDepot = depot;
      if (search) {
        const regex = new RegExp(search as string, 'i');
        filter.$or = [
          { fullName: regex },
          { email: regex },
          { licenseNumber: regex },
          { phone: regex },
          { employeeNumber: regex },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const drivers = await Driver.find({
        organizationId: req.tenant.organizationId,
        ...filter,
      })
        .populate('assignedVehicleId', 'plateNumber make modelName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await Driver.countDocuments({
        organizationId: req.tenant.organizationId,
        ...filter,
      });

      return res.status(200).json({
        success: true,
        data: drivers,
        meta: { total, page: Number(page), limit: Number(limit) },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async getDriverById(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const driver = await Driver.findOne({
        _id: req.params.id,
        organizationId: req.tenant.organizationId,
        isArchived: false,
      }).populate('assignedVehicleId', 'plateNumber make modelName');

      if (!driver) {
        return res.status(404).json({ success: false, error: { message: 'Driver not found.' } });
      }

      // Fetch active assignment & recent documents
      const activeAssignment = await Assignment.findOne({
        organizationId: req.tenant.organizationId,
        driverId: driver._id,
        status: 'ACTIVE',
      }).populate('vehicleId', 'plateNumber make modelName');

      const documents = await DriverDocument.find({
        organizationId: req.tenant.organizationId,
        driverId: driver._id,
        isArchived: false,
      }).sort({ createdAt: -1 });

      const openIncidents = await DriverIncident.countDocuments({
        organizationId: req.tenant.organizationId,
        driverId: driver._id,
        status: { $in: ['OPEN', 'UNDER_REVIEW'] },
      });

      return res.status(200).json({
        success: true,
        data: {
          ...driver.toObject(),
          activeAssignment,
          documents,
          openIncidentsCount: openIncidents,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async updateDriver(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const parsed = UpdateDriverExtendedSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const driver = await driverRepo.findById(req.tenant, req.params.id);
      if (!driver || driver.isArchived) {
        return res.status(404).json({ success: false, error: { message: 'Driver not found.' } });
      }

      await driverRepo.updateOne(
        req.tenant,
        { _id: req.params.id },
        { $set: { ...parsed.data, updatedBy: req.tenant.userId } }
      );

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

  static async updateDriverStatus(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const parsed = DriverStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const driver = await driverRepo.findById(req.tenant, req.params.id);
      if (!driver || driver.isArchived) {
        return res.status(404).json({ success: false, error: { message: 'Driver not found.' } });
      }

      // Disallow moving to ON_LEAVE or SUSPENDED while actively on a trip or assigned
      if ((parsed.data.status === 'ON_LEAVE' || parsed.data.status === 'SUSPENDED') && driver.status === 'ASSIGNED') {
        const activeAssignment = await Assignment.findOne({
          organizationId: req.tenant.organizationId,
          driverId: driver._id,
          status: 'ACTIVE',
        });
        if (activeAssignment) {
          return res.status(400).json({
            success: false,
            error: { message: 'Cannot place driver on leave or suspension while an active vehicle assignment exists. Release assignment first.' },
          });
        }
      }

      await driverRepo.updateOne(req.tenant, { _id: req.params.id }, { $set: { status: parsed.data.status } });

      await AuditLog.create({
        organizationId: req.tenant.organizationId,
        actorId: req.tenant.userId,
        actorEmail: req.user?.email || 'operator',
        action: 'DRIVER_STATUS_CHANGED',
        entity: 'DRIVER',
        entityId: req.params.id,
        details: { previousStatus: driver.status, newStatus: parsed.data.status, reason: parsed.data.reason },
        ipAddress: req.ip,
      });

      return res.status(200).json({ success: true, data: { id: driver._id, status: parsed.data.status } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  // ==========================================================================
  // 2. DRIVER DOCUMENTS
  // ==========================================================================

  static async listDriverDocuments(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const docs = await DriverDocument.find({
        organizationId: req.tenant.organizationId,
        driverId: req.params.id,
        isArchived: false,
      }).sort({ createdAt: -1 });

      return res.status(200).json({ success: true, data: docs });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async addDriverDocument(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const parsed = CreateDriverDocumentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const driver = await driverRepo.findById(req.tenant, req.params.id);
      if (!driver || driver.isArchived) {
        return res.status(404).json({ success: false, error: { message: 'Driver not found.' } });
      }

      let expiryStatus = 'VALID';
      if (parsed.data.expiryDate) {
        const exp = new Date(parsed.data.expiryDate);
        const now = new Date();
        const thirtyDaysAhead = new Date();
        thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
        if (exp < now) expiryStatus = 'EXPIRED';
        else if (exp <= thirtyDaysAhead) expiryStatus = 'EXPIRING_SOON';
      } else {
        expiryStatus = 'NOT_APPLICABLE';
      }

      const doc = await docRepo.create(req.tenant, {
        ...parsed.data,
        driverId: driver._id,
        expiryStatus,
        createdBy: req.tenant.userId as any,
      } as any);

      return res.status(201).json({ success: true, data: doc });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async updateDriverDocument(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const parsed = UpdateDriverDocumentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const doc = await docRepo.findById(req.tenant, req.params.id);
      if (!doc || doc.isArchived) {
        return res.status(404).json({ success: false, error: { message: 'Document not found.' } });
      }

      let expiryStatus = doc.expiryStatus;
      if (parsed.data.expiryDate) {
        const exp = new Date(parsed.data.expiryDate);
        const now = new Date();
        const thirtyDaysAhead = new Date();
        thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
        if (exp < now) expiryStatus = 'EXPIRED';
        else if (exp <= thirtyDaysAhead) expiryStatus = 'EXPIRING_SOON';
        else expiryStatus = 'VALID';
      }

      await docRepo.updateOne(
        req.tenant,
        { _id: req.params.id },
        { $set: { ...parsed.data, expiryStatus } }
      );

      const updated = await docRepo.findById(req.tenant, req.params.id);
      return res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async archiveDriverDocument(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const doc = await docRepo.findById(req.tenant, req.params.id);
      if (!doc || doc.isArchived) {
        return res.status(404).json({ success: false, error: { message: 'Document not found.' } });
      }

      await docRepo.updateOne(req.tenant, { _id: req.params.id }, { $set: { isArchived: true } });
      return res.status(200).json({ success: true, message: 'Document archived successfully.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  // ==========================================================================
  // 3. DRIVER ASSIGNMENTS
  // ==========================================================================

  static async getDriverAssignmentHistory(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const assignments = await Assignment.find({
        organizationId: req.tenant.organizationId,
        driverId: req.params.id,
      })
        .populate('vehicleId', 'plateNumber make modelName status')
        .populate('assignedBy', 'firstName lastName')
        .sort({ assignedAt: -1 });

      return res.status(200).json({ success: true, data: assignments });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async createAssignment(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const { vehicleId, driverId, notes } = req.body;
      if (!vehicleId || !driverId) {
        return res.status(400).json({ success: false, error: { message: 'vehicleId and driverId are required.' } });
      }

      // Check vehicle
      const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        organizationId: req.tenant.organizationId,
        isArchived: false,
      });

      if (!vehicle) {
        return res.status(404).json({ success: false, error: { message: 'Vehicle not found in your fleet.' } });
      }

      if (vehicle.status !== 'AVAILABLE') {
        return res.status(400).json({
          success: false,
          error: { message: `Cannot assign vehicle: Vehicle is currently '${vehicle.status}'. Must be 'AVAILABLE'.` },
        });
      }

      // Check driver
      const driver = await Driver.findOne({
        _id: driverId,
        organizationId: req.tenant.organizationId,
        isArchived: false,
      });

      if (!driver) {
        return res.status(404).json({ success: false, error: { message: 'Driver not found in your organization.' } });
      }

      if (driver.status !== 'AVAILABLE') {
        return res.status(400).json({
          success: false,
          error: { message: `Cannot assign driver: Driver is currently '${driver.status}'. Must be 'AVAILABLE'.` },
        });
      }

      // Prevent conflicting active assignments
      const activeVeh = await Assignment.findOne({
        organizationId: req.tenant.organizationId,
        vehicleId,
        status: 'ACTIVE',
      });
      if (activeVeh) {
        return res.status(409).json({ success: false, error: { message: 'Vehicle already has an active assignment.' } });
      }

      const activeDrv = await Assignment.findOne({
        organizationId: req.tenant.organizationId,
        driverId,
        status: 'ACTIVE',
      });
      if (activeDrv) {
        return res.status(409).json({ success: false, error: { message: 'Driver already has an active assignment.' } });
      }

      const assignment = await Assignment.create({
        organizationId: req.tenant.organizationId,
        vehicleId: vehicle._id,
        driverId: driver._id,
        assignedBy: req.tenant.userId as any,
        assignedAt: new Date(),
        status: 'ACTIVE',
        startOdometerKm: vehicle.odometerKm || 0,
        notes,
      });

      vehicle.status = 'ASSIGNED';
      vehicle.currentDriverId = driver._id;
      await vehicle.save();

      driver.status = 'ASSIGNED';
      driver.assignedVehicleId = vehicle._id;
      await driver.save();

      await AuditLog.create({
        organizationId: req.tenant.organizationId,
        actorId: req.tenant.userId,
        actorEmail: req.user?.email || 'operator',
        action: 'VEHICLE_ASSIGNED',
        entity: 'ASSIGNMENT',
        entityId: assignment._id.toString(),
        details: { vehiclePlate: vehicle.plateNumber, driverName: driver.fullName },
        ipAddress: req.ip,
      });

      return res.status(201).json({ success: true, data: assignment });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async endAssignment(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const assignment = await Assignment.findOne({
        _id: req.params.id,
        organizationId: req.tenant.organizationId,
        status: 'ACTIVE',
      });

      if (!assignment) {
        return res.status(404).json({ success: false, error: { message: 'Active assignment not found.' } });
      }

      const { endOdometerKm, notes } = req.body;
      assignment.status = 'RELEASED';
      assignment.releasedAt = new Date();
      if (endOdometerKm) assignment.endOdometerKm = Number(endOdometerKm);
      if (notes) assignment.notes = notes;
      await assignment.save();

      await Vehicle.updateOne(
        { _id: assignment.vehicleId, organizationId: req.tenant.organizationId },
        {
          $set: {
            status: 'AVAILABLE',
            ...(endOdometerKm ? { odometerKm: Number(endOdometerKm) } : {}),
          },
          $unset: { currentDriverId: 1 },
        }
      );

      await Driver.updateOne(
        { _id: assignment.driverId, organizationId: req.tenant.organizationId },
        {
          $set: { status: 'AVAILABLE' },
          $unset: { assignedVehicleId: 1 },
        }
      );

      return res.status(200).json({ success: true, message: 'Assignment ended successfully.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  // ==========================================================================
  // 4. DRIVER SHIFTS & ATTENDANCE
  // ==========================================================================

  static async listShifts(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const { driverId, shiftDate, status } = req.query;
      const filter: any = { organizationId: req.tenant.organizationId };

      if (driverId) filter.driverId = driverId;
      if (shiftDate) filter.shiftDate = shiftDate;
      if (status) filter.status = status;

      const shifts = await DriverShift.find(filter)
        .populate('driverId', 'fullName licenseNumber')
        .sort({ plannedStart: -1 });

      return res.status(200).json({ success: true, data: shifts });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async createShift(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const parsed = CreateDriverShiftSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const pStart = new Date(parsed.data.plannedStart);
      const pEnd = new Date(parsed.data.plannedEnd);

      if (pEnd <= pStart) {
        return res.status(400).json({ success: false, error: { message: 'plannedEnd must be after plannedStart.' } });
      }

      // Prevent overlapping shifts for the same driver
      const overlap = await DriverShift.findOne({
        organizationId: req.tenant.organizationId,
        driverId: parsed.data.driverId,
        status: { $in: ['SCHEDULED', 'IN_PROGRESS'] },
        $or: [
          { plannedStart: { $lte: pStart }, plannedEnd: { $gte: pStart } },
          { plannedStart: { $lte: pEnd }, plannedEnd: { $gte: pEnd } },
          { plannedStart: { $gte: pStart, $lte: pEnd } },
        ],
      });

      if (overlap) {
        return res.status(409).json({
          success: false,
          error: { message: 'Driver already has an active or overlapping scheduled shift during this time window.' },
        });
      }

      const shift = await shiftRepo.create(req.tenant, {
        ...parsed.data,
        plannedStart: pStart,
        plannedEnd: pEnd,
        createdBy: req.tenant.userId as any,
      } as any);

      return res.status(201).json({ success: true, data: shift });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async startShift(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const shift = await shiftRepo.findById(req.tenant, req.params.id);
      if (!shift) {
        return res.status(404).json({ success: false, error: { message: 'Shift not found.' } });
      }

      if (shift.status !== 'SCHEDULED') {
        return res.status(400).json({
          success: false,
          error: { message: `Cannot start shift in status '${shift.status}'. Must be 'SCHEDULED'.` },
        });
      }

      const now = new Date();
      const plannedStart = new Date(shift.plannedStart);
      const lateDiffMinutes = Math.round((now.getTime() - plannedStart.getTime()) / (1000 * 60));

      const isLateStart = lateDiffMinutes > 15; // 15 min grace period
      const lateStartMinutes = isLateStart ? lateDiffMinutes : 0;

      shift.status = 'IN_PROGRESS';
      shift.actualStart = now;
      shift.isLateStart = isLateStart;
      shift.lateStartMinutes = lateStartMinutes;
      await shift.save();

      // Update driver duty state to ON_DUTY
      await Driver.updateOne(
        { _id: shift.driverId, organizationId: req.tenant.organizationId },
        { $set: { status: 'ON_DUTY' } }
      );

      return res.status(200).json({ success: true, data: shift });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async endShift(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const shift = await shiftRepo.findById(req.tenant, req.params.id);
      if (!shift) {
        return res.status(404).json({ success: false, error: { message: 'Shift not found.' } });
      }

      if (shift.status !== 'IN_PROGRESS') {
        return res.status(400).json({
          success: false,
          error: { message: `Cannot end shift in status '${shift.status}'. Must be 'IN_PROGRESS'.` },
        });
      }

      const actualEnd = req.body.actualEnd ? new Date(req.body.actualEnd) : new Date();
      const actualStart = shift.actualStart ? new Date(shift.actualStart) : new Date(shift.plannedStart);

      const durationMinutes = Math.max(0, Math.round((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60)));
      const plannedDuration = Math.round((new Date(shift.plannedEnd).getTime() - new Date(shift.plannedStart).getTime()) / (1000 * 60));
      const overtimeMinutes = Math.max(0, durationMinutes - plannedDuration);

      shift.status = 'COMPLETED';
      shift.actualEnd = actualEnd;
      shift.durationMinutes = durationMinutes;
      shift.overtimeMinutes = overtimeMinutes;
      if (req.body.notes) shift.notes = req.body.notes;
      await shift.save();

      // Restore driver status to AVAILABLE (or keep ASSIGNED if vehicle attached)
      const driver = await Driver.findOne({ _id: shift.driverId, organizationId: req.tenant.organizationId });
      if (driver) {
        const nextStatus = driver.assignedVehicleId ? 'ASSIGNED' : 'AVAILABLE';
        driver.status = nextStatus;
        await driver.save();
      }

      return res.status(200).json({ success: true, data: shift });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  // ==========================================================================
  // 5. DRIVER SAFETY & INCIDENT MANAGEMENT
  // ==========================================================================

  static async listIncidents(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const { driverId, status, severity } = req.query;
      const filter: any = { organizationId: req.tenant.organizationId };

      if (driverId) filter.driverId = driverId;
      if (status) filter.status = status;
      if (severity) filter.severity = severity;

      const incidents = await DriverIncident.find(filter)
        .populate('driverId', 'fullName licenseNumber')
        .populate('vehicleId', 'plateNumber make modelName')
        .populate('reportedBy', 'firstName lastName')
        .populate('reviewedBy', 'firstName lastName')
        .sort({ incidentDate: -1 });

      return res.status(200).json({ success: true, data: incidents });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async createIncident(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const parsed = CreateDriverIncidentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      // Generate unique incident number: INC-YYYYMMDD-XXXX
      const datePrefix = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const count = await DriverIncident.countDocuments({ organizationId: req.tenant.organizationId });
      const incidentNumber = `INC-${datePrefix}-${String(count + 1).padStart(4, '0')}`;

      const incident = await incidentRepo.create(req.tenant, {
        ...parsed.data,
        incidentNumber,
        status: 'OPEN',
        reportedBy: req.tenant.userId as any,
      } as any);

      // Trigger alerts if high or critical
      await DriverAlertService.triggerIncidentAlert(incident);

      await AuditLog.create({
        organizationId: req.tenant.organizationId,
        actorId: req.tenant.userId,
        actorEmail: req.user?.email || 'operator',
        action: 'SAFETY_INCIDENT_REPORTED',
        entity: 'INCIDENT',
        entityId: incident._id.toString(),
        details: { incidentNumber, category: incident.category, severity: incident.severity },
        ipAddress: req.ip,
      });

      return res.status(201).json({ success: true, data: incident });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async getIncidentById(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const incident = await DriverIncident.findOne({
        _id: req.params.id,
        organizationId: req.tenant.organizationId,
      })
        .populate('driverId', 'fullName licenseNumber phone')
        .populate('vehicleId', 'plateNumber make modelName')
        .populate('reportedBy', 'firstName lastName')
        .populate('reviewedBy', 'firstName lastName');

      if (!incident) {
        return res.status(404).json({ success: false, error: { message: 'Incident not found.' } });
      }

      return res.status(200).json({ success: true, data: incident });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async updateIncident(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const parsed = UpdateDriverIncidentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const incident = await incidentRepo.findById(req.tenant, req.params.id);
      if (!incident) {
        return res.status(404).json({ success: false, error: { message: 'Incident not found.' } });
      }

      await incidentRepo.updateOne(req.tenant, { _id: req.params.id }, { $set: parsed.data });
      const updated = await incidentRepo.findById(req.tenant, req.params.id);

      return res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async resolveIncident(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const parsed = ResolveDriverIncidentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const incident = await incidentRepo.findById(req.tenant, req.params.id);
      if (!incident) {
        return res.status(404).json({ success: false, error: { message: 'Incident not found.' } });
      }

      incident.status = 'RESOLVED';
      incident.resolutionNotes = parsed.data.resolutionNotes;
      incident.resolvedAt = new Date();
      incident.reviewedBy = req.tenant.userId as any;
      await incident.save();

      await AuditLog.create({
        organizationId: req.tenant.organizationId,
        actorId: req.tenant.userId,
        actorEmail: req.user?.email || 'operator',
        action: 'SAFETY_INCIDENT_RESOLVED',
        entity: 'INCIDENT',
        entityId: incident._id.toString(),
        details: { incidentNumber: incident.incidentNumber },
        ipAddress: req.ip,
      });

      return res.status(200).json({ success: true, data: incident });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  // ==========================================================================
  // 6. DRIVER PERFORMANCE & ANALYTICS
  // ==========================================================================

  static async getDriverPerformance(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const days = req.query.days ? Number(req.query.days) : 30;
      const metrics = await DriverPerformanceEngine.calculateDriverScorecard(
        req.tenant.organizationId,
        req.params.id,
        days
      );

      return res.status(200).json({ success: true, data: metrics });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async getPerformanceOverview(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const days = req.query.days ? Number(req.query.days) : 30;
      const rankings = await DriverPerformanceEngine.calculateFleetRankings(
        req.tenant.organizationId,
        days
      );

      const totalDrivers = rankings.length;
      const averageCompositeScore =
        totalDrivers > 0
          ? Math.round(rankings.reduce((sum, r) => sum + r.compositePerformanceScore, 0) / totalDrivers)
          : 0;

      const excellentCount = rankings.filter((r) => r.scoreTier === 'EXCELLENT').length;
      const needsImprovementCount = rankings.filter((r) => r.scoreTier === 'NEEDS_IMPROVEMENT').length;

      return res.status(200).json({
        success: true,
        data: {
          periodDays: days,
          totalDrivers,
          averageCompositeScore,
          excellentCount,
          needsImprovementCount,
          topPerformers: rankings.slice(0, 5),
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  static async getPerformanceRankings(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const days = req.query.days ? Number(req.query.days) : 30;
      const rankings = await DriverPerformanceEngine.calculateFleetRankings(
        req.tenant.organizationId,
        days
      );

      return res.status(200).json({ success: true, data: rankings });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
}
