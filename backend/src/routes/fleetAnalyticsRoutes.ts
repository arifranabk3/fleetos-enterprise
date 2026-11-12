import { Router } from 'express';
import { authenticate, requireTenantMembership, requirePermission } from '../middleware/auth';
import { FleetAnalyticsController } from '../controllers/FleetAnalyticsController';

const router = Router();

// Base middleware for all fleet analytics endpoints
router.use(authenticate);
router.use(requireTenantMembership);

/**
 * @route   GET /api/v1/analytics/fleet/overview
 * @desc    Comprehensive fleet utilization, availability, motion & maintenance analytics
 * @access  Private (ANALYTICS:VIEW_FLEET or FLEET:VIEW)
 */
router.get(
  '/analytics/fleet/overview',
  requirePermission('FLEET:READ'),
  FleetAnalyticsController.getFleetOverview
);

/**
 * @route   GET /api/v1/analytics/fleet/vehicles/:id
 * @desc    Per-vehicle detailed historical utilization and motion intervals
 * @access  Private (FLEET:READ)
 */
router.get(
  '/analytics/fleet/vehicles/:id',
  requirePermission('FLEET:READ'),
  FleetAnalyticsController.getVehicleDetail
);

export default router;
