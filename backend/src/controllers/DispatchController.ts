import { Response } from 'express';
import { Dispatch, IDispatch } from '../models/Dispatch';
import { Shipment, IShipment } from '../models/Shipment';
import { Vehicle } from '../models/Vehicle';
import { Driver } from '../models/Driver';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';
import { eventBus } from '../services/DomainEventBus';
import { AuthRequest } from '../middleware/auth';
import { AuditLog } from '../models/AuditLog';
import crypto from 'crypto';

const dispatchRepo = new BaseTenantRepository(Dispatch);

export class DispatchController {
  private static generateDispatchNumber(): string {
    const datePrefix = new Date().toISOString().slice(2, 7).replace('-', '');
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `DSP-${datePrefix}-${randomHex}`;
  }

  /**
   * POST /api/v1/dispatches
   */
  public static async createDispatch(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const userId = tenant.userId as any;
      const userRole = tenant.role || 'DISPATCHER';

      const {
        shipmentIds,
        vehicleId,
        driverId,
        originHub,
        destinationHub,
        notes,
      } = req.body;

      if (!shipmentIds || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
        res.status(400).json({ success: false, error: { message: 'At least one shipmentId is required for dispatch' } });
        return;
      }
      if (!vehicleId || !driverId) {
        res.status(400).json({ success: false, error: { message: 'vehicleId and driverId are required for dispatch' } });
        return;
      }

      // 1. Verify Vehicle belongs to tenant and is operational
      const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        organizationId: tenant.organizationId,
        isArchived: false,
      });
      if (!vehicle) {
        res.status(404).json({ success: false, error: { message: 'Vehicle not found in this organization' } });
        return;
      }
      if (vehicle.status === 'MAINTENANCE' || vehicle.status === 'OUT_OF_SERVICE' || vehicle.status === 'RETIRED') {
        res.status(400).json({ success: false, error: { message: `Vehicle ${vehicle.plateNumber} is unavailable due to status '${vehicle.status}'.` } });
        return;
      }

      // 2. Verify Driver belongs to tenant and is eligible
      const driver = await Driver.findOne({
        _id: driverId,
        organizationId: tenant.organizationId,
        isArchived: false,
      });
      if (!driver) {
        res.status(404).json({ success: false, error: { message: 'Driver not found in this organization' } });
        return;
      }
      if (driver.status === 'SUSPENDED' || driver.status === 'INACTIVE' || driver.status === 'ON_LEAVE') {
        res.status(400).json({ success: false, error: { message: `Driver ${driver.fullName} is not eligible for dispatch due to status '${driver.status}'.` } });
        return;
      }

      // 3. Check for conflicting ACTIVE dispatches for this vehicle or driver
      const activeVehicleDispatch = await Dispatch.findOne({
        organizationId: tenant.organizationId,
        vehicleId,
        status: { $in: ['PENDING', 'ACCEPTED', 'ACTIVE'] },
      });
      if (activeVehicleDispatch) {
        res.status(409).json({ success: false, error: { message: `Vehicle ${vehicle.plateNumber} is already engaged in active dispatch ${activeVehicleDispatch.dispatchNumber}.` } });
        return;
      }

      const activeDriverDispatch = await Dispatch.findOne({
        organizationId: tenant.organizationId,
        driverId,
        status: { $in: ['PENDING', 'ACCEPTED', 'ACTIVE'] },
      });
      if (activeDriverDispatch) {
        res.status(409).json({ success: false, error: { message: `Driver ${driver.fullName} is already engaged in active dispatch ${activeDriverDispatch.dispatchNumber}.` } });
        return;
      }

      // 4. Verify all shipments exist, belong to tenant, and are ready/confirmed for dispatch
      const shipments = await Shipment.find({
        _id: { $in: shipmentIds },
        organizationId: tenant.organizationId,
        isArchived: false,
      });

      if (shipments.length !== shipmentIds.length) {
        res.status(404).json({ success: false, error: { message: 'One or more requested shipments could not be found in this organization' } });
        return;
      }

      for (const sh of shipments) {
        if (sh.status !== 'CONFIRMED' && sh.status !== 'READY_FOR_DISPATCH' && sh.status !== 'PENDING_DISPATCH') {
          res.status(400).json({ success: false, error: { message: `Shipment ${sh.trackingNumber} is not ready for dispatch (current status: '${sh.status}').` } });
          return;
        }
        if (sh.activeDispatchId) {
          res.status(409).json({ success: false, error: { message: `Shipment ${sh.trackingNumber} already has an active dispatch.` } });
          return;
        }
      }

      // 5. Generate dispatchNumber with collision prevention
      let dispatchNumber = '';
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 5) {
        dispatchNumber = DispatchController.generateDispatchNumber();
        const existing = await Dispatch.findOne({ dispatchNumber });
        if (!existing) isUnique = true;
        attempts++;
      }

      // 6. Create dispatch record
      const dispatch = await dispatchRepo.create(tenant, {
        dispatchNumber,
        shipmentIds,
        vehicleId,
        driverId,
        status: 'PENDING',
        originHub,
        destinationHub,
        notes,
        assignedBy: userId,
        dispatchedAt: new Date(),
      } as any);

      // 7. Update all shipments: status -> DISPATCHED, bind vehicleId, driverId, activeDispatchId
      for (const sh of shipments) {
        sh.status = 'DISPATCHED';
        sh.vehicleId = vehicle._id as any;
        sh.driverId = driver._id as any;
        sh.activeDispatchId = dispatch._id as any;
        sh.timeline.push({
          status: 'DISPATCHED',
          timestamp: new Date(),
          note: `Dispatched under Manifest ${dispatch.dispatchNumber} to Vehicle ${vehicle.plateNumber}`,
          updatedBy: userId,
          actorRole: userRole,
        });
        await sh.save();
      }

      // 8. Update vehicle & driver status to ASSIGNED if available
      if (vehicle.status === 'AVAILABLE') {
        vehicle.status = 'ASSIGNED';
        await vehicle.save();
      }
      if (driver.status === 'AVAILABLE') {
        driver.status = 'ASSIGNED';
        await driver.save();
      }

      await AuditLog.create({
        organizationId: tenant.organizationId,
        actorId: userId,
        actorEmail: req.user?.email || 'operator',
        action: 'DISPATCH_CREATED',
        entity: 'DISPATCH',
        entityId: dispatch._id.toString(),
        details: { dispatchNumber: dispatch.dispatchNumber, vehicleId, driverId, shipmentCount: shipmentIds.length },
      });

      // Publish event
      eventBus.publish('dispatch.created', tenant.organizationId.toString(), {
        dispatchId: dispatch._id,
        dispatchNumber: dispatch.dispatchNumber,
        vehicleId,
        driverId,
        shipmentCount: shipmentIds.length,
      }, userId ? userId.toString() : undefined);

      res.status(201).json({
        success: true,
        message: 'Dispatch manifest created and shipments dispatched successfully',
        data: dispatch,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/dispatches
   */
  public static async listDispatches(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const { status, vehicleId, driverId, search, page = 1, limit = 20 } = req.query;

      const filter: any = {};
      if (status) filter.status = status;
      if (vehicleId) filter.vehicleId = vehicleId;
      if (driverId) filter.driverId = driverId;
      if (search) {
        filter.$or = [
          { dispatchNumber: { $regex: String(search), $options: 'i' } },
          { originHub: { $regex: String(search), $options: 'i' } },
          { destinationHub: { $regex: String(search), $options: 'i' } },
        ];
      }

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const total = await dispatchRepo.count(tenant, filter);
      const dispatches = await Dispatch.find({
        organizationId: tenant.organizationId,
        ...filter,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('vehicleId', 'plateNumber make model vehicleType')
        .populate('driverId', 'fullName phone licenseNumber')
        .populate('shipmentIds', 'trackingNumber status customer origin destination cargo')
        .populate('assignedBy', 'firstName lastName email')
        .lean();

      res.json({
        success: true,
        data: dispatches,
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
   * GET /api/v1/dispatches/:id
   */
  public static async getDispatch(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const { id } = req.params;

      const dispatch = await Dispatch.findOne({
        _id: id,
        organizationId: tenant.organizationId,
      })
        .populate('vehicleId', 'plateNumber make model vehicleType fuelType odometer')
        .populate('driverId', 'fullName phone email licenseNumber status')
        .populate('shipmentIds')
        .populate('assignedBy', 'firstName lastName email');

      if (!dispatch) {
        res.status(404).json({ success: false, error: { message: 'Dispatch manifest not found in this organization' } });
        return;
      }

      res.json({
        success: true,
        data: dispatch,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * POST /api/v1/dispatches/:id/start
   */
  public static async startDispatch(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const userId = tenant.userId as any;
      const userRole = tenant.role || 'DISPATCHER';
      const { id } = req.params;

      const dispatch = await dispatchRepo.findById(tenant, id);
      if (!dispatch) {
        res.status(404).json({ success: false, error: { message: 'Dispatch manifest not found' } });
        return;
      }

      if (dispatch.status !== 'PENDING' && dispatch.status !== 'ACCEPTED') {
        res.status(400).json({ success: false, error: { message: `Cannot start dispatch in status '${dispatch.status}'. Must be PENDING or ACCEPTED.` } });
        return;
      }

      dispatch.status = 'ACTIVE';
      dispatch.startedAt = new Date();
      await dispatch.save();

      // Update Vehicle to IN_TRANSIT
      await Vehicle.findByIdAndUpdate(dispatch.vehicleId, { status: 'IN_TRANSIT' });

      // Update Driver to ON_DUTY
      await Driver.findByIdAndUpdate(dispatch.driverId, { status: 'ON_DUTY' });

      // Update Shipments to IN_TRANSIT
      await Shipment.updateMany(
        { _id: { $in: dispatch.shipmentIds }, organizationId: tenant.organizationId },
        {
          $set: { status: 'IN_TRANSIT' },
          $push: {
            timeline: {
              status: 'IN_TRANSIT',
              timestamp: new Date(),
              note: `Journey started under Manifest ${dispatch.dispatchNumber}`,
              updatedBy: userId,
              actorRole: userRole,
            },
          },
        }
      );

      eventBus.publish('dispatch.started', tenant.organizationId.toString(), {
        dispatchId: dispatch._id,
        dispatchNumber: dispatch.dispatchNumber,
      }, userId ? userId.toString() : undefined);

      res.json({
        success: true,
        message: 'Dispatch journey started successfully. Fleet asset is now in-transit.',
        data: dispatch,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * POST /api/v1/dispatches/:id/complete
   */
  public static async completeDispatch(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const userId = tenant.userId as any;
      const userRole = tenant.role || 'DISPATCHER';
      const { id } = req.params;

      const dispatch = await dispatchRepo.findById(tenant, id);
      if (!dispatch) {
        res.status(404).json({ success: false, error: { message: 'Dispatch manifest not found' } });
        return;
      }

      if (dispatch.status !== 'ACTIVE') {
        res.status(400).json({ success: false, error: { message: `Cannot complete dispatch in status '${dispatch.status}'. Must be ACTIVE.` } });
        return;
      }

      dispatch.status = 'COMPLETED';
      dispatch.completedAt = new Date();
      await dispatch.save();

      // Release Vehicle to AVAILABLE
      await Vehicle.findByIdAndUpdate(dispatch.vehicleId, { status: 'AVAILABLE' });

      // Release Driver to AVAILABLE
      await Driver.findByIdAndUpdate(dispatch.driverId, { status: 'AVAILABLE' });

      // Update Shipments to DELIVERED and release activeDispatchId
      await Shipment.updateMany(
        { _id: { $in: dispatch.shipmentIds }, organizationId: tenant.organizationId },
        {
          $set: { status: 'DELIVERED', activeDispatchId: null },
          $push: {
            timeline: {
              status: 'DELIVERED',
              timestamp: new Date(),
              note: `Manifest ${dispatch.dispatchNumber} completed successfully. Delivered.`,
              updatedBy: userId,
              actorRole: userRole,
            },
          },
        }
      );

      eventBus.publish('dispatch.completed', tenant.organizationId.toString(), {
        dispatchId: dispatch._id,
        dispatchNumber: dispatch.dispatchNumber,
      }, userId ? userId.toString() : undefined);

      res.json({
        success: true,
        message: 'Dispatch manifest completed successfully. Assets released.',
        data: dispatch,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * POST /api/v1/dispatches/:id/cancel
   */
  public static async cancelDispatch(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const userId = tenant.userId as any;
      const userRole = tenant.role || 'DISPATCHER';
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || String(reason).trim().length < 5) {
        res.status(400).json({ success: false, error: { message: 'A valid cancellation reason (minimum 5 characters) is required' } });
        return;
      }

      const dispatch = await dispatchRepo.findById(tenant, id);
      if (!dispatch) {
        res.status(404).json({ success: false, error: { message: 'Dispatch manifest not found' } });
        return;
      }

      if (dispatch.status === 'COMPLETED' || dispatch.status === 'CANCELLED') {
        res.status(400).json({ success: false, error: { message: `Cannot cancel dispatch in status '${dispatch.status}'.` } });
        return;
      }

      dispatch.status = 'CANCELLED';
      dispatch.cancelledAt = new Date();
      dispatch.cancellationReason = reason;
      await dispatch.save();

      // Release Vehicle and Driver to AVAILABLE
      await Vehicle.findByIdAndUpdate(dispatch.vehicleId, { status: 'AVAILABLE' });
      await Driver.findByIdAndUpdate(dispatch.driverId, { status: 'AVAILABLE' });

      // Reset shipments back to CONFIRMED so they can be redispatched
      await Shipment.updateMany(
        { _id: { $in: dispatch.shipmentIds }, organizationId: tenant.organizationId },
        {
          $set: { status: 'CONFIRMED', activeDispatchId: null, vehicleId: null, driverId: null },
          $push: {
            timeline: {
              status: 'CONFIRMED',
              timestamp: new Date(),
              note: `Dispatch ${dispatch.dispatchNumber} cancelled: ${reason}. Returned to queue.`,
              updatedBy: userId,
              actorRole: userRole,
            },
          },
        }
      );

      eventBus.publish('dispatch.cancelled', tenant.organizationId.toString(), {
        dispatchId: dispatch._id,
        dispatchNumber: dispatch.dispatchNumber,
        reason,
      }, userId ? userId.toString() : undefined);

      res.json({
        success: true,
        message: 'Dispatch manifest cancelled. Shipments returned to queue.',
        data: dispatch,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * PATCH /api/v1/dispatches/:id/status
   */
  public static async updateDispatchStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['PENDING', 'ACCEPTED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ success: false, error: { message: `Invalid dispatch status: ${status}` } });
        return;
      }

      const dispatch = await dispatchRepo.findById(tenant, id);
      if (!dispatch) {
        res.status(404).json({ success: false, error: { message: 'Dispatch manifest not found' } });
        return;
      }

      dispatch.status = status;
      await dispatch.save();

      res.json({
        success: true,
        message: `Dispatch status updated to ${status}`,
        data: dispatch,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
}
