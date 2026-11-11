import { Router } from 'express';
import { VehicleController } from '../controllers/VehicleController';
import { DriverController } from '../controllers/DriverController';
import { AssignmentController } from '../controllers/AssignmentController';
import { authenticate, requireTenantMembership, requirePermission } from '../middleware/auth';

const router = Router();

// ============================================================================
// VEHICLE ROUTES
// ============================================================================
router.post(
  '/vehicles',
  authenticate,
  requireTenantMembership,
  requirePermission('FLEET:MANAGE'),
  VehicleController.create
);

router.get(
  '/vehicles',
  authenticate,
  requireTenantMembership,
  requirePermission('FLEET:READ'),
  VehicleController.list
);

router.get(
  '/vehicles/:id',
  authenticate,
  requireTenantMembership,
  requirePermission('FLEET:READ'),
  VehicleController.getById
);

router.patch(
  '/vehicles/:id',
  authenticate,
  requireTenantMembership,
  requirePermission('FLEET:MANAGE'),
  VehicleController.update
);

router.patch(
  '/vehicles/:id/status',
  authenticate,
  requireTenantMembership,
  requirePermission('FLEET:MANAGE'),
  VehicleController.updateStatus
);

router.delete(
  '/vehicles/:id',
  authenticate,
  requireTenantMembership,
  requirePermission('FLEET:MANAGE'),
  VehicleController.archive
);

router.post(
  '/vehicles/:id/documents',
  authenticate,
  requireTenantMembership,
  requirePermission('FLEET:MANAGE'),
  VehicleController.addDocument
);

// ============================================================================
// DRIVER ROUTES
// ============================================================================
router.post(
  '/drivers',
  authenticate,
  requireTenantMembership,
  requirePermission('DRIVERS:MANAGE'),
  DriverController.create
);

router.get(
  '/drivers',
  authenticate,
  requireTenantMembership,
  requirePermission('DRIVERS:READ'),
  DriverController.list
);

router.get(
  '/drivers/:id',
  authenticate,
  requireTenantMembership,
  requirePermission('DRIVERS:READ'),
  DriverController.getById
);

router.patch(
  '/drivers/:id',
  authenticate,
  requireTenantMembership,
  requirePermission('DRIVERS:MANAGE'),
  DriverController.update
);

router.patch(
  '/drivers/:id/status',
  authenticate,
  requireTenantMembership,
  requirePermission('DRIVERS:MANAGE'),
  DriverController.updateStatus
);

router.delete(
  '/drivers/:id',
  authenticate,
  requireTenantMembership,
  requirePermission('DRIVERS:MANAGE'),
  DriverController.archive
);

// ============================================================================
// ASSIGNMENT ROUTES
// ============================================================================
router.post(
  '/assignments',
  authenticate,
  requireTenantMembership,
  requirePermission('DISPATCH:MANAGE'),
  AssignmentController.assign
);

router.get(
  '/assignments',
  authenticate,
  requireTenantMembership,
  requirePermission('FLEET:READ'),
  AssignmentController.list
);

router.post(
  '/assignments/:id/release',
  authenticate,
  requireTenantMembership,
  requirePermission('DISPATCH:MANAGE'),
  AssignmentController.release
);

export default router;

