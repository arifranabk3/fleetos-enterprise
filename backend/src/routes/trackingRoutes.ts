import { Router } from 'express';
import { authenticate, requireTenantMembership, requirePermission } from '../middleware/auth';
import { TelemetryController } from '../controllers/TelemetryController';
import { OperationsController } from '../controllers/OperationsController';

const router = Router();

// Enforce authentication & verified tenant membership
router.use(authenticate);
router.use(requireTenantMembership);

/* ==========================================================================
   TELEMETRY INGESTION & VEHICLE LOCATIONS
   ========================================================================== */
router.post(
  '/telemetry/ingest',
  requirePermission('TRACKING:CREATE'),
  TelemetryController.ingestTelemetry
);

router.get(
  '/telemetry/vehicles/:vehicleId/latest',
  requirePermission('TRACKING:READ'),
  TelemetryController.getLatestVehicleLocation
);

router.get(
  '/telemetry/vehicles/:vehicleId/history',
  requirePermission('TRACKING:READ'),
  TelemetryController.getVehicleLocationHistory
);

/* ==========================================================================
   OPERATIONS CENTER & LIVE DASHBOARD METRICS
   ========================================================================== */
router.get(
  '/operations/overview',
  requirePermission('FLEET:READ'),
  OperationsController.getOperationsOverview
);

router.get(
  '/operations/vehicles',
  requirePermission('FLEET:READ'),
  OperationsController.getOperationalVehicles
);

router.get(
  '/operations/alerts',
  requirePermission('FLEET:READ'),
  OperationsController.getOperationsAlerts
);

/* ==========================================================================
   GEOFENCE MANAGEMENT APIS
   ========================================================================== */
router.post(
  '/geofences',
  requirePermission('FLEET:MANAGE'),
  OperationsController.createGeofence
);

router.get(
  '/geofences',
  requirePermission('FLEET:READ'),
  OperationsController.listGeofences
);

router.delete(
  '/geofences/:id',
  requirePermission('FLEET:MANAGE'),
  OperationsController.archiveGeofence
);

export default router;
