import { Router } from 'express';
import { DriverWorkforceController } from '../controllers/DriverWorkforceController';
import { authenticate, requireTenantMembership, requirePermission } from '../middleware/auth';

const router = Router();

// ============================================================================
// DRIVER PROFILE ROUTES
// ============================================================================
router.get(
  '/drivers',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.read'),
  DriverWorkforceController.listDrivers
);

router.post(
  '/drivers',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.create'),
  DriverWorkforceController.createDriver
);

// NOTE: Specific performance routes before parameter :id to avoid collision
router.get(
  '/drivers/performance/overview',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.analytics.read'),
  DriverWorkforceController.getPerformanceOverview
);

router.get(
  '/drivers/performance/rankings',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.performance.read'),
  DriverWorkforceController.getPerformanceRankings
);

router.get(
  '/drivers/:id',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.read'),
  DriverWorkforceController.getDriverById
);

router.patch(
  '/drivers/:id',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.update'),
  DriverWorkforceController.updateDriver
);

router.post(
  '/drivers/:id/status',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.status.manage'),
  DriverWorkforceController.updateDriverStatus
);

// ============================================================================
// DRIVER DOCUMENTS
// ============================================================================
router.get(
  '/drivers/:id/documents',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.document.read'),
  DriverWorkforceController.listDriverDocuments
);

router.post(
  '/drivers/:id/documents',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.document.manage'),
  DriverWorkforceController.addDriverDocument
);

router.patch(
  '/driver-documents/:id',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.document.manage'),
  DriverWorkforceController.updateDriverDocument
);

router.delete(
  '/driver-documents/:id',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.document.manage'),
  DriverWorkforceController.archiveDriverDocument
);

// ============================================================================
// DRIVER ASSIGNMENT ROUTES
// ============================================================================
router.get(
  '/driver-assignments',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.assignment.manage'),
  DriverWorkforceController.listDrivers // Provides assignment-aware list
);

router.post(
  '/driver-assignments',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.assignment.manage'),
  DriverWorkforceController.createAssignment
);

router.post(
  '/driver-assignments/:id/end',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.assignment.manage'),
  DriverWorkforceController.endAssignment
);

router.get(
  '/drivers/:id/assignment-history',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.assignment.manage'),
  DriverWorkforceController.getDriverAssignmentHistory
);

// ============================================================================
// DRIVER SHIFTS & ATTENDANCE
// ============================================================================
router.get(
  '/driver-shifts',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.shift.read'),
  DriverWorkforceController.listShifts
);

router.post(
  '/driver-shifts',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.shift.manage'),
  DriverWorkforceController.createShift
);

router.post(
  '/driver-shifts/:id/start',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.shift.manage'),
  DriverWorkforceController.startShift
);

router.post(
  '/driver-shifts/:id/end',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.shift.manage'),
  DriverWorkforceController.endShift
);

// ============================================================================
// DRIVER PERFORMANCE
// ============================================================================
router.get(
  '/drivers/:id/performance',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.performance.read'),
  DriverWorkforceController.getDriverPerformance
);

// ============================================================================
// DRIVER INCIDENTS & SAFETY
// ============================================================================
router.get(
  '/driver-incidents',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.incident.create'),
  DriverWorkforceController.listIncidents
);

router.post(
  '/driver-incidents',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.incident.create'),
  DriverWorkforceController.createIncident
);

router.get(
  '/driver-incidents/:id',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.incident.create'),
  DriverWorkforceController.getIncidentById
);

router.patch(
  '/driver-incidents/:id',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.incident.review'),
  DriverWorkforceController.updateIncident
);

router.post(
  '/driver-incidents/:id/resolve',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.incident.review'),
  DriverWorkforceController.resolveIncident
);

// ============================================================================
// ATTENDANCE & SHIFT SETTINGS (Phase 09.1)
// ============================================================================
router.get(
  '/attendance/settings',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.shift.read'),
  DriverWorkforceController.getAttendanceSettings
);

router.patch(
  '/attendance/settings',
  authenticate,
  requireTenantMembership,
  requirePermission('driver.shift.manage'),
  DriverWorkforceController.updateAttendanceSettings
);

export default router;
