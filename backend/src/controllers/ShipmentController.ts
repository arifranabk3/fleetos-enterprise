import { Response } from 'express';
import { Shipment, IShipment } from '../models/Shipment';
import { Customer } from '../models/Customer';
import { Dispatch } from '../models/Dispatch';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';
import { ShipmentStateMachine } from '../services/ShipmentStateMachine';
import { eventBus } from '../services/DomainEventBus';
import { ShipmentStatus } from '../types/domain';
import { AuthRequest } from '../middleware/auth';
import { AuditLog } from '../models/AuditLog';
import crypto from 'crypto';

const shipmentRepo = new BaseTenantRepository(Shipment);

export class ShipmentController {
  private static generateTrackingNumber(): string {
    const datePrefix = new Date().toISOString().slice(2, 7).replace('-', '');
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `FOS-${datePrefix}-${randomHex}`;
  }

  /**
   * POST /api/v1/shipments
   */
  public static async createShipment(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const userId = tenant.userId as any;
      const userRole = tenant.role || 'DISPATCHER';

      const {
        customerId,
        customer,
        sender,
        receiver,
        origin,
        destination,
        cargo,
        pricing,
        priority,
        status,
        requestedPickupDate,
        expectedDeliveryDate,
      } = req.body;

      // Validate required fields
      if (!sender?.name || !sender?.phone || !sender?.address || !sender?.city) {
        res.status(400).json({ success: false, error: { message: 'Sender details (name, phone, address, city) are required' } });
        return;
      }
      if (!receiver?.name || !receiver?.phone || !receiver?.address || !receiver?.city) {
        res.status(400).json({ success: false, error: { message: 'Receiver details (name, phone, address, city) are required' } });
        return;
      }
      if (!origin?.address || !origin?.city || origin?.latitude === undefined || origin?.longitude === undefined) {
        res.status(400).json({ success: false, error: { message: 'Origin location with coordinates is required' } });
        return;
      }
      if (!destination?.address || !destination?.city || destination?.latitude === undefined || destination?.longitude === undefined) {
        res.status(400).json({ success: false, error: { message: 'Destination location with coordinates is required' } });
        return;
      }
      if (!cargo?.description || cargo?.weightKg === undefined || cargo.weightKg <= 0) {
        res.status(400).json({ success: false, error: { message: 'Valid cargo description and positive weightKg are required' } });
        return;
      }
      if (!pricing?.quotedAmount || pricing.quotedAmount <= 0) {
        res.status(400).json({ success: false, error: { message: 'Valid positive quotedAmount is required' } });
        return;
      }

      // Verify Customer if customerId provided
      let verifiedCustomer = customer;
      if (customerId) {
        const dbCust = await Customer.findOne({
          _id: customerId,
          organizationId: tenant.organizationId,
          isArchived: false,
        });
        if (!dbCust) {
          res.status(404).json({ success: false, error: { message: 'Customer referenced by customerId not found in this organization' } });
          return;
        }
        verifiedCustomer = {
          name: dbCust.name,
          email: dbCust.email,
          phone: dbCust.phone,
          reference: customer?.reference,
        };
      } else if (!customer?.name || !customer?.email || !customer?.phone) {
        res.status(400).json({ success: false, error: { message: 'Customer information (name, email, phone) or valid customerId is required' } });
        return;
      }

      // Generate tracking number with collision retry
      let trackingNumber = '';
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 5) {
        trackingNumber = ShipmentController.generateTrackingNumber();
        const existing = await Shipment.findOne({ trackingNumber });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }

      const initialStatus: ShipmentStatus = status === 'CONFIRMED' ? 'CONFIRMED' : 'DRAFT';

      const newShipment = await shipmentRepo.create(tenant, {
        trackingNumber,
        customerId: customerId || undefined,
        customer: verifiedCustomer,
        sender,
        receiver,
        origin,
        destination,
        cargo: {
          description: cargo.description,
          category: cargo.category || 'GENERAL',
          weightKg: Number(cargo.weightKg),
          packageCount: Number(cargo.packageCount) || 1,
          dimensions: cargo.dimensions,
          declaredValue: cargo.declaredValue,
          isHazardous: Boolean(cargo.isHazardous),
          specialInstructions: cargo.specialInstructions,
        },
        pricing: {
          quotedAmount: Number(pricing.quotedAmount),
          currency: pricing.currency || 'USD',
        },
        priority: priority || 'STANDARD',
        status: initialStatus,
        requestedPickupDate: requestedPickupDate ? new Date(requestedPickupDate) : undefined,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
        timeline: [
          {
            status: initialStatus,
            timestamp: new Date(),
            note: `Shipment order created as ${initialStatus}`,
            updatedBy: userId,
            actorRole: userRole,
          },
        ],
        createdBy: userId,
        isArchived: false,
      } as any);

      // Audit Log
      await AuditLog.create({
        organizationId: tenant.organizationId,
        actorId: userId,
        actorEmail: req.user?.email || 'operator',
        action: 'SHIPMENT_CREATED',
        entity: 'SHIPMENT',
        entityId: newShipment._id.toString(),
        details: { trackingNumber: newShipment.trackingNumber, status: newShipment.status },
      });

      // Publish event
      eventBus.publish('shipment.created', tenant.organizationId.toString(), {
        shipmentId: newShipment._id,
        trackingNumber: newShipment.trackingNumber,
        status: newShipment.status,
      }, userId ? userId.toString() : undefined);

      res.status(201).json({
        success: true,
        message: 'Shipment order created successfully',
        data: newShipment,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/shipments
   */
  public static async listShipments(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const {
        status,
        priority,
        customerId,
        search,
        page = 1,
        limit = 20,
      } = req.query;

      const filter: any = { isArchived: false };

      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (customerId) filter.customerId = customerId;

      if (search) {
        filter.$or = [
          { trackingNumber: { $regex: String(search), $options: 'i' } },
          { 'customer.name': { $regex: String(search), $options: 'i' } },
          { 'sender.name': { $regex: String(search), $options: 'i' } },
          { 'receiver.name': { $regex: String(search), $options: 'i' } },
          { 'cargo.description': { $regex: String(search), $options: 'i' } },
        ];
      }

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const total = await shipmentRepo.count(tenant, filter);
      const shipments = await Shipment.find({
        organizationId: tenant.organizationId,
        ...filter,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('vehicleId', 'plateNumber make model type')
        .populate('driverId', 'fullName phone licenseNumber')
        .populate('customerId', 'name email phone type')
        .lean();

      res.json({
        success: true,
        data: shipments,
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
   * GET /api/v1/shipments/:id
   */
  public static async getShipment(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const { id } = req.params;

      const shipment = await Shipment.findOne({
        _id: id,
        organizationId: tenant.organizationId,
        isArchived: false,
      })
        .populate('vehicleId', 'plateNumber make model vehicleType status')
        .populate('driverId', 'fullName phone licenseNumber status')
        .populate('customerId', 'name email phone billingAddress')
        .populate('activeDispatchId');

      if (!shipment) {
        res.status(404).json({ success: false, error: { message: 'Shipment not found in this organization' } });
        return;
      }

      res.json({
        success: true,
        data: shipment,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * PATCH /api/v1/shipments/:id
   */
  public static async updateShipment(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const { id } = req.params;
      const {
        sender,
        receiver,
        cargo,
        pricing,
        priority,
        requestedPickupDate,
        expectedDeliveryDate,
      } = req.body;

      const shipment = await shipmentRepo.findById(tenant, id);
      if (!shipment || shipment.isArchived) {
        res.status(404).json({ success: false, error: { message: 'Shipment not found' } });
        return;
      }

      // Do not permit core detail edits once dispatched
      const immutableStatuses: ShipmentStatus[] = [
        'DISPATCHED',
        'IN_TRANSIT',
        'ARRIVED_AT_DESTINATION',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
        'RETURNED',
      ];
      if (immutableStatuses.includes(shipment.status)) {
        res.status(400).json({ success: false, error: { message: `Cannot modify shipment details in status '${shipment.status}'.` } });
        return;
      }

      const updates: any = {};
      const currentObj = shipment.toObject();
      if (sender) updates.sender = { ...currentObj.sender, ...sender };
      if (receiver) updates.receiver = { ...currentObj.receiver, ...receiver };
      if (cargo) updates.cargo = { ...currentObj.cargo, ...cargo };
      if (pricing) updates.pricing = { ...currentObj.pricing, ...pricing };
      if (priority) updates.priority = priority;
      if (requestedPickupDate) updates.requestedPickupDate = new Date(requestedPickupDate);
      if (expectedDeliveryDate) updates.expectedDeliveryDate = new Date(expectedDeliveryDate);

      const updated = await shipmentRepo.updateById(tenant, id, updates);

      res.json({
        success: true,
        message: 'Shipment updated successfully',
        data: updated,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * POST /api/v1/shipments/:id/confirm
   */
  public static async confirmShipment(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const userId = tenant.userId as any;
      const userRole = tenant.role || 'DISPATCHER';
      const { id } = req.params;

      const shipment = await shipmentRepo.findById(tenant, id);
      if (!shipment || shipment.isArchived) {
        res.status(404).json({ success: false, error: { message: 'Shipment not found' } });
        return;
      }

      const transition = ShipmentStateMachine.validateTransition(shipment.status, 'CONFIRMED', {
        userId: userId ? userId.toString() : 'system',
        userRole,
      });

      if (!transition.allowed) {
        res.status(400).json({ success: false, error: { message: transition.reason || 'Invalid state transition' } });
        return;
      }

      shipment.status = 'CONFIRMED';
      shipment.timeline.push({
        status: 'CONFIRMED',
        timestamp: new Date(),
        note: 'Shipment confirmed and ready for dispatch planning',
        updatedBy: userId,
        actorRole: userRole,
      });

      await shipment.save();

      eventBus.publish('shipment.confirmed', tenant.organizationId.toString(), {
        shipmentId: shipment._id,
        trackingNumber: shipment.trackingNumber,
      }, userId ? userId.toString() : undefined);

      res.json({
        success: true,
        message: 'Shipment confirmed successfully',
        data: shipment,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * POST /api/v1/shipments/:id/cancel
   */
  public static async cancelShipment(req: AuthRequest, res: Response): Promise<void> {
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

      const shipment = await shipmentRepo.findById(tenant, id);
      if (!shipment || shipment.isArchived) {
        res.status(404).json({ success: false, error: { message: 'Shipment not found' } });
        return;
      }

      const transition = ShipmentStateMachine.validateTransition(shipment.status, 'CANCELLED', {
        userId: userId ? userId.toString() : 'system',
        userRole,
        reason,
      });

      if (!transition.allowed) {
        res.status(400).json({ success: false, error: { message: transition.reason || 'Invalid state transition' } });
        return;
      }

      shipment.status = 'CANCELLED';
      shipment.timeline.push({
        status: 'CANCELLED',
        timestamp: new Date(),
        note: `Cancelled: ${reason}`,
        updatedBy: userId,
        actorRole: userRole,
      });

      await shipment.save();

      eventBus.publish('shipment.cancelled', tenant.organizationId.toString(), {
        shipmentId: shipment._id,
        trackingNumber: shipment.trackingNumber,
        reason,
      }, userId ? userId.toString() : undefined);

      res.json({
        success: true,
        message: 'Shipment cancelled successfully',
        data: shipment,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/shipments/:id/history
   */
  public static async getShipmentHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const { id } = req.params;

      const shipment = await shipmentRepo.findById(tenant, id);
      if (!shipment || shipment.isArchived) {
        res.status(404).json({ success: false, error: { message: 'Shipment not found' } });
        return;
      }

      res.json({
        success: true,
        data: {
          trackingNumber: shipment.trackingNumber,
          currentStatus: shipment.status,
          timeline: shipment.timeline,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/shipments/:id/dispatches
   */
  public static async getShipmentDispatches(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const { id } = req.params;

      const dispatches = await Dispatch.find({
        organizationId: tenant.organizationId,
        shipmentIds: id,
      })
        .populate('vehicleId', 'plateNumber make model')
        .populate('driverId', 'fullName phone')
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        data: dispatches,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
}
