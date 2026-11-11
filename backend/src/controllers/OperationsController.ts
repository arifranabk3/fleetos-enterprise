import { Response } from 'express';
import { Vehicle } from '../models/Vehicle';
import { Shipment } from '../models/Shipment';
import { TelemetryAlert } from '../models/TelemetryAlert';
import { Geofence } from '../models/Geofence';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';
import { AuthRequest } from '../middleware/auth';

const geofenceRepo = new BaseTenantRepository(Geofence);

export class OperationsController {
  /**
   * GET /api/v1/operations/overview
   * Returns aggregated real-time operational metrics for the Top KPI Strip
   */
  public static async getOperationsOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const orgId = req.tenant.organizationId;

      const [vehicles, activeShipments, criticalAlerts] = await Promise.all([
        Vehicle.find({ organizationId: orgId, isArchived: false }).select('status lastLocation').lean(),
        Shipment.countDocuments({
          organizationId: orgId,
          status: { $in: ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] },
          isArchived: false,
        }),
        TelemetryAlert.countDocuments({
          organizationId: orgId,
          severity: 'CRITICAL',
          isAcknowledged: false,
        }),
      ]);

      const totalVehicles = vehicles.length;
      let movingCount = 0;
      let idleCount = 0;
      let offlineCount = 0;
      let stoppedCount = 0;

      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      vehicles.forEach((v) => {
        if (!v.lastLocation || !v.lastLocation.recordedAt || new Date(v.lastLocation.recordedAt) < fifteenMinutesAgo) {
          offlineCount++;
        } else if (v.lastLocation.motionStatus === 'MOVING') {
          movingCount++;
        } else if (v.lastLocation.motionStatus === 'IDLE') {
          idleCount++;
        } else {
          stoppedCount++;
        }
      });

      res.json({
        success: true,
        data: {
          totalVehicles,
          movingVehicles: movingCount,
          idleVehicles: idleCount,
          stoppedVehicles: stoppedCount,
          offlineVehicles: offlineCount,
          activeShipments,
          criticalAlerts,
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/operations/vehicles
   * Returns all operational vehicles with current positions for the live map
   */
  public static async getOperationalVehicles(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const vehicles = await Vehicle.find({
        organizationId: req.tenant.organizationId,
        isArchived: false,
      })
        .select('plateNumber make modelName type status fuelType odometerKm lastLocation currentDriverId')
        .populate('currentDriverId', 'fullName phone licenseClass status')
        .lean();

      res.json({
        success: true,
        data: vehicles,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/operations/alerts
   */
  public static async getOperationsAlerts(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const { severity, isAcknowledged, limit = 50 } = req.query;

      const filter: any = { organizationId: req.tenant.organizationId };
      if (severity) filter.severity = severity;
      if (isAcknowledged !== undefined) filter.isAcknowledged = isAcknowledged === 'true';

      const alerts = await TelemetryAlert.find(filter)
        .sort({ timestamp: -1 })
        .limit(Math.min(100, parseInt(String(limit), 10) || 50))
        .populate('vehicleId', 'plateNumber make modelName')
        .lean();

      res.json({
        success: true,
        data: alerts,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /* ==========================================================================
     GEOFENCING APIS
     ========================================================================== */

  /**
   * POST /api/v1/geofences
   */
  public static async createGeofence(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const userId = tenant.userId as any;
      const { name, description, type = 'CIRCLE', circleConfig, polygonCoordinates, category } = req.body;

      if (!name) {
        res.status(400).json({ success: false, error: { message: 'Geofence name is required' } });
        return;
      }

      if (type === 'CIRCLE') {
        if (!circleConfig || circleConfig.latitude === undefined || circleConfig.longitude === undefined || !circleConfig.radiusMeters) {
          res.status(400).json({ success: false, error: { message: 'Valid circleConfig (latitude, longitude, radiusMeters) required' } });
          return;
        }
      }

      const geofence = await geofenceRepo.create(tenant, {
        name: name.trim(),
        description,
        type,
        circleConfig,
        polygonCoordinates,
        category: category || 'HUB',
        isActive: true,
        createdBy: userId,
      } as any);

      res.status(201).json({
        success: true,
        message: 'Geofence defined successfully',
        data: geofence,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/geofences
   */
  public static async listGeofences(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const geofences = await Geofence.find({
        organizationId: req.tenant.organizationId,
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        data: geofences,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * DELETE /api/v1/geofences/:id
   */
  public static async archiveGeofence(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const { id } = req.params;
      const geofence = await Geofence.findOneAndUpdate(
        { _id: id, organizationId: req.tenant.organizationId },
        { isActive: false },
        { new: true }
      );

      if (!geofence) {
        res.status(404).json({ success: false, error: { message: 'Geofence not found' } });
        return;
      }

      res.json({
        success: true,
        message: 'Geofence archived successfully',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
}
