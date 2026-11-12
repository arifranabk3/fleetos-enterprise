import { Router } from 'express';
import { authenticate, requireTenantMembership, requirePermission } from '../middleware/auth';
import { DriverAnalyticsController } from '../controllers/DriverAnalyticsController';

const router = Router();

// Base middleware for all driver analytics endpoints
router.use(authenticate);
router.use(requireTenantMembership);

// ============================================================================
// 1. STATIC ROUTES (Must be registered before dynamic /:driverId routes)
// ============================================================================

/**
 * @route   GET /api/v1/analytics/drivers/fleet-overview
 * @desc    Comprehensive fleet workforce score distribution, tiers, and average KPIs
 * @access  Private (driver.analytics.read: OWNER, ADMIN, FLEET_MANAGER, VIEWER)
 */
router.get(
  '/analytics/drivers/fleet-overview',
  requirePermission('driver.analytics.read'),
  DriverAnalyticsController.getFleetOverview
);

/**
 * @route   GET /api/v1/analytics/drivers/rankings
 * @desc    Comparative leaderboard of drivers with deterministic tie-breaking
 * @access  Private (driver.analytics.read: OWNER, ADMIN, FLEET_MANAGER, VIEWER)
 */
router.get(
  '/analytics/drivers/rankings',
  requirePermission('driver.analytics.read'),
  DriverAnalyticsController.getFleetRankings
);

/**
 * @route   GET /api/v1/analytics/drivers/shift-variance
 * @desc    Reconciliation of planned vs actual shift hours and overtime audit
 * @access  Private (driver.analytics.read: OWNER, ADMIN, FLEET_MANAGER, VIEWER)
 */
router.get(
  '/analytics/drivers/shift-variance',
  requirePermission('driver.analytics.read'),
  DriverAnalyticsController.getShiftVariance
);

/**
 * @route   GET /api/v1/analytics/drivers/me
 * @desc    Driver self-service performance scorecard (automatically resolves linked profile)
 * @access  Private (Any authenticated tenant member with active Driver profile)
 */
router.get(
  '/analytics/drivers/me',
  DriverAnalyticsController.getDriverSelfScorecard
);

// ============================================================================
// 2. PARAMETERIZED DYNAMIC ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/analytics/drivers/:driverId/trend
 * @desc    Historical monthly performance trend for a specific driver
 * @access  Private (driver.performance.read for managers; verified self-access for DRIVER)
 */
router.get(
  '/analytics/drivers/:driverId/trend',
  DriverAnalyticsController.getDriverTrend
);

/**
 * @route   GET /api/v1/analytics/drivers/:driverId
 * @desc    Detailed multi-dimensional scorecard for a specific driver
 * @access  Private (driver.performance.read for managers; verified self-access for DRIVER)
 */
router.get(
  '/analytics/drivers/:driverId',
  DriverAnalyticsController.getDriverScorecard
);

export default router;
