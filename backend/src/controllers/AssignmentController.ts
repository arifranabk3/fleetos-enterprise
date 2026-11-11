import { Response } from 'express';
import { Assignment, Vehicle, Driver, AuditLog } from '../models';
import { AuthRequest } from '../middleware/auth';
import { CreateAssignmentSchema } from '../validators/fleetValidators';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';

const assignmentRepo = new BaseTenantRepository(Assignment);

export class AssignmentController {
  /**
   * POST /api/v1/assignments
   * Securely assigns an AVAILABLE driver to an AVAILABLE vehicle.
   */
  static async assign(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const parsed = CreateAssignmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const { vehicleId, driverId, notes } = parsed.data;

      // 1. Verify Vehicle belongs to tenant & is AVAILABLE
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

      // 2. Verify Driver belongs to tenant & is AVAILABLE
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

      // 3. Concurrency check: Ensure no active assignment exists for either asset
      const activeVehAssignment = await assignmentRepo.findOne(req.tenant, { vehicleId, status: 'ACTIVE' });
      if (activeVehAssignment) {
        return res.status(409).json({ success: false, error: { message: 'Vehicle already has an active assignment.' } });
      }

      const activeDrvAssignment = await assignmentRepo.findOne(req.tenant, { driverId, status: 'ACTIVE' });
      if (activeDrvAssignment) {
        return res.status(409).json({ success: false, error: { message: 'Driver already has an active assignment.' } });
      }

      // 4. Create Assignment record
      const assignment = await assignmentRepo.create(req.tenant, {
        vehicleId: vehicle._id,
        driverId: driver._id,
        assignedBy: req.tenant.userId as any,
        assignedAt: new Date(),
        status: 'ACTIVE',
        startOdometerKm: vehicle.odometerKm,
        notes,
      } as any);

      // 5. Atomic state update on Vehicle & Driver
      vehicle.status = 'ASSIGNED';
      vehicle.currentDriverId = driver._id;
      await vehicle.save();

      driver.status = 'ASSIGNED';
      driver.assignedVehicleId = vehicle._id;
      await driver.save();

      // 6. Audit Log
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

      return res.status(201).json({
        success: true,
        data: {
          assignment,
          vehicle: { id: vehicle._id, plateNumber: vehicle.plateNumber, status: vehicle.status },
          driver: { id: driver._id, fullName: driver.fullName, status: driver.status },
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * POST /api/v1/assignments/:id/release
   * Safely releases an active assignment and restores assets to AVAILABLE.
   */
  static async release(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const assignment = await assignmentRepo.findById(req.tenant, req.params.id);
      if (!assignment || assignment.status !== 'ACTIVE') {
        return res.status(404).json({ success: false, error: { message: 'Active assignment not found.' } });
      }

      const { endOdometerKm, notes } = req.body;

      // Update Assignment status
      assignment.status = 'RELEASED';
      assignment.releasedAt = new Date();
      if (endOdometerKm) assignment.endOdometerKm = Number(endOdometerKm);
      if (notes) assignment.notes = notes;
      await assignment.save();

      // Restore Vehicle & Driver to AVAILABLE
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

      // Audit Log
      await AuditLog.create({
        organizationId: req.tenant.organizationId,
        actorId: req.tenant.userId,
        actorEmail: req.user?.email || 'operator',
        action: 'ASSIGNMENT_RELEASED',
        entity: 'ASSIGNMENT',
        entityId: assignment._id.toString(),
        ipAddress: req.ip,
      });

      return res.status(200).json({ success: true, message: 'Assignment released successfully.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/assignments
   */
  static async list(req: AuthRequest, res: Response) {
    try {
      if (!req.tenant) return res.status(401).json({ success: false });

      const assignments = await Assignment.find({
        organizationId: req.tenant.organizationId,
      })
        .populate('vehicleId', 'plateNumber make modelName')
        .populate('driverId', 'fullName licenseNumber')
        .populate('assignedBy', 'firstName lastName')
        .sort({ assignedAt: -1 });

      return res.status(200).json({ success: true, data: assignments });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
}

