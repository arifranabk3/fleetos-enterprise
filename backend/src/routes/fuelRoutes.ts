import { Router } from 'express';
import { FuelController } from '../controllers/FuelController';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

// All fuel routes require authentication and tenant context
router.use(authenticate);

/* ==========================================================================
   FUEL TRANSACTIONS
   ========================================================================== */
router.post(
  '/fuel/transactions',
  requirePermission('FUEL:CREATE'),
  FuelController.createTransaction
);

router.get(
  '/fuel/transactions',
  requirePermission('FUEL:READ'),
  FuelController.listTransactions
);

router.get(
  '/fuel/transactions/:id',
  requirePermission('FUEL:READ'),
  FuelController.getTransaction
);

router.patch(
  '/fuel/transactions/:id',
  requirePermission('FUEL:UPDATE'),
  FuelController.updateTransaction
);

router.post(
  '/fuel/transactions/:id/void',
  requirePermission('FUEL:VOID'),
  FuelController.voidTransaction
);

/* ==========================================================================
   FUEL VENDORS
   ========================================================================== */
router.get(
  '/fuel/vendors',
  requirePermission('FUEL:READ'),
  FuelController.listVendors
);

router.post(
  '/fuel/vendors',
  requirePermission('FUEL:MANAGE'),
  FuelController.createVendor
);

router.patch(
  '/fuel/vendors/:id',
  requirePermission('FUEL:MANAGE'),
  FuelController.updateVendor
);

/* ==========================================================================
   ANALYTICS & ANOMALIES
   ========================================================================== */
router.get(
  '/fuel/overview',
  requirePermission('FUEL:READ'),
  FuelController.getOverview
);

router.get(
  '/fuel/vehicle/:vehicleId/efficiency',
  requirePermission('FUEL:READ'),
  FuelController.getVehicleEfficiency
);

router.get(
  '/fuel/anomalies',
  requirePermission('FUEL:READ'),
  FuelController.listAnomalies
);

router.post(
  '/fuel/anomalies/:id/resolve',
  requirePermission('FUEL:UPDATE'),
  FuelController.resolveAnomaly
);

export default router;
