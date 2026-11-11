import { Response } from 'express';
import { TelemetryEvent, ITelemetryEvent, TelemetrySource, MotionStatus } from '../models/TelemetryEvent';
import { Vehicle } from '../models/Vehicle';
import { Shipment } from '../models/Shipment';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';
import { AuthRequest } from '../middleware/auth';
import { SocketService } from '../services/SocketService';
import { GeofenceEngine } from '../services/GeofenceEngine';
import { TelemetryAlertEngine } from '../services/TelemetryAlertEngine';

const telemetryRepo = new BaseTenantRepository(TelemetryEvent);

export class TelemetryController {
  /**
   * POST /api/v1/telemetry/ingest
   * Secure telemetry ingestion endpoint (supports hardware GPS devices and simulated streams)
   */
  public static async ingestTelemetry(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;

      const {
        vehicleId,
        latitude,
        longitude,
        speedKmh = 0,
        headingDeg = 0,
        altitudeMeters,
        accuracyMeters,
        odometerKm,
        engineStatus = 'RUNNING',
        batteryLevel,
        source = 'SIMULATED',
        recordedAt,
      } = req.body;

      // 1. Rigorous Range Validation
      if (!vehicleId) {
        res.status(400).json({ success: false, error: { message: 'vehicleId is required' } });
        return;
      }
      if (latitude === undefined || latitude < -90 || latitude > 90) {
        res.status(400).json({ success: false, error: { message: 'Invalid latitude (-90 to 90)' } });
        return;
      }
      if (longitude === undefined || longitude < -180 || longitude > 180) {
        res.status(400).json({ success: false, error: { message: 'Invalid longitude (-180 to 180)' } });
        return;
      }
      if (speedKmh < 0 || speedKmh > 250) {
        res.status(400).json({ success: false, error: { message: 'Speed out of realistic bounds (0 - 250 km/h)' } });
        return;
      }
      if (headingDeg < 0 || headingDeg > 360) {
        res.status(400).json({ success: false, error: { message: 'Heading out of compass bounds (0 - 360 degrees)' } });
        return;
      }

      const timestamp = recordedAt ? new Date(recordedAt) : new Date();
      if (isNaN(timestamp.getTime())) {
        res.status(400).json({ success: false, error: { message: 'Invalid recordedAt timestamp format' } });
        return;
      }

      // 2. Tenant Ownership Verification
      const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        organizationId: tenant.organizationId,
        isArchived: false,
      });

      if (!vehicle) {
        res.status(404).json({
          success: false,
          error: { message: 'Vehicle not found or does not belong to this organization.' },
        });
        return;
      }

      // 3. Stale Data Rejection: Do not allow older timestamp to overwrite newer location
      if (vehicle.lastLocation?.recordedAt && timestamp < new Date(vehicle.lastLocation.recordedAt)) {
        res.status(400).json({
          success: false,
          error: { message: 'Stale telemetry update rejected: recordedAt is older than current vehicle location.' },
        });
        return;
      }

      // 4. Derive Motion Status
      let motionStatus: MotionStatus = 'STOPPED';
      if (speedKmh > 5) {
        motionStatus = 'MOVING';
      } else if (engineStatus === 'RUNNING' || speedKmh > 0) {
        motionStatus = 'IDLE';
      }

      const isSimulated = source === 'SIMULATED';

      // 5. Persist Historical Breadcrumb Event
      const telemetryDoc = await telemetryRepo.create(tenant, {
        vehicleId: vehicle._id as any,
        driverId: vehicle.currentDriverId,
        latitude,
        longitude,
        speedKmh,
        headingDeg,
        altitudeMeters,
        accuracyMeters,
        odometerKm,
        motionStatus,
        engineStatus,
        batteryLevel,
        source: source as TelemetrySource,
        isSimulated,
        recordedAt: timestamp,
        serverReceivedAt: new Date(),
      } as any);

      // 6. Update Current Vehicle Location Cache
      vehicle.lastLocation = {
        latitude,
        longitude,
        speedKmh,
        headingDeg,
        motionStatus,
        source: source as TelemetrySource,
        isSimulated,
        recordedAt: timestamp,
        updatedAt: new Date(),
      };
      if (odometerKm && odometerKm > vehicle.odometerKm) {
        vehicle.odometerKm = odometerKm;
      }
      await vehicle.save();

      const telemetryPayload = {
        id: telemetryDoc._id,
        vehicleId: vehicle._id.toString(),
        plateNumber: vehicle.plateNumber,
        make: vehicle.make,
        modelName: vehicle.modelName,
        latitude,
        longitude,
        speedKmh,
        headingDeg,
        motionStatus,
        source,
        isSimulated,
        recordedAt: timestamp,
      };

      // 7. Socket.IO Real-Time Broadcast to Tenant Room
      SocketService.broadcastVehicleTelemetry(tenant.organizationId.toString(), telemetryPayload);

      // 8. Evaluate Geofences Asynchronously
      GeofenceEngine.evaluateGeofences(
        tenant.organizationId.toString(),
        vehicle._id.toString(),
        vehicle.plateNumber,
        latitude,
        longitude,
        source
      ).catch((err) => console.error('[Geofence Engine Error]:', err));

      // 9. Process Alerts (Overspeeding, etc.)
      TelemetryAlertEngine.processAlerts(tenant.organizationId.toString(), {
        vehicleId: vehicle._id.toString(),
        plateNumber: vehicle.plateNumber,
        speedKmh,
        motionStatus,
        source,
      }).catch((err) => console.error('[Alert Engine Error]:', err));

      res.status(201).json({
        success: true,
        message: 'Telemetry ingested and broadcasted successfully.',
        data: telemetryPayload,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/telemetry/vehicles/:vehicleId/latest
   */
  public static async getLatestVehicleLocation(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const { vehicleId } = req.params;

      const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        organizationId: req.tenant.organizationId,
        isArchived: false,
      })
        .select('plateNumber make modelName status lastLocation currentDriverId')
        .populate('currentDriverId', 'fullName phone');

      if (!vehicle) {
        res.status(404).json({ success: false, error: { message: 'Vehicle not found in this organization' } });
        return;
      }

      res.json({
        success: true,
        data: {
          vehicleId: vehicle._id,
          plateNumber: vehicle.plateNumber,
          make: vehicle.make,
          modelName: vehicle.modelName,
          status: vehicle.status,
          currentDriver: vehicle.currentDriverId,
          lastLocation: vehicle.lastLocation || null,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/telemetry/vehicles/:vehicleId/history
   */
  public static async getVehicleLocationHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const { vehicleId } = req.params;
      const { startDate, endDate, limit = 500 } = req.query;

      // Verify vehicle belongs to organization
      const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        organizationId: req.tenant.organizationId,
        isArchived: false,
      });

      if (!vehicle) {
        res.status(404).json({ success: false, error: { message: 'Vehicle not found' } });
        return;
      }

      const filter: any = {
        organizationId: req.tenant.organizationId,
        vehicleId,
      };

      if (startDate || endDate) {
        filter.recordedAt = {};
        if (startDate) filter.recordedAt.$gte = new Date(String(startDate));
        if (endDate) filter.recordedAt.$lte = new Date(String(endDate));
      }

      const limitNum = Math.min(2000, Math.max(1, parseInt(String(limit), 10) || 500));

      const points = await TelemetryEvent.find(filter)
        .sort({ recordedAt: 1 })
        .limit(limitNum)
        .select('latitude longitude speedKmh headingDeg motionStatus recordedAt source isSimulated')
        .lean();

      res.json({
        success: true,
        data: {
          vehicleId: vehicle._id,
          plateNumber: vehicle.plateNumber,
          count: points.length,
          points,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
}
