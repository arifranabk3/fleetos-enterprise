import { Router } from 'express';
import { authenticate, requireTenantMembership, requirePermission } from '../middleware/auth';
import { MaintenanceController } from '../controllers/MaintenanceController';
import { ComplianceController } from '../controllers/ComplianceController';

const router = Router();

// Enforce authentication & tenant scope
router.use(authenticate);
router.use(requireTenantMembership);

/* ==========================================================================
   MAINTENANCE WORK ORDERS & RECORDS
   ========================================================================== */
router.post(
  '/maintenance',
  requirePermission('MAINTENANCE:CREATE'),
  MaintenanceController.createRecord
);

router.get(
  '/maintenance',
  requirePermission('MAINTENANCE:READ'),
  MaintenanceController.listRecords
);

router.get(
  '/maintenance/overview',
  requirePermission('MAINTENANCE:READ'),
  MaintenanceController.getOverview
);

router.get(
  '/maintenance/schedules',
  requirePermission('MAINTENANCE:READ'),
  MaintenanceController.listSchedules
);

router.post(
  '/maintenance/schedules',
  requirePermission('MAINTENANCE:MANAGE'),
  MaintenanceController.createSchedule
);

router.get(
  '/maintenance/vendors',
  requirePermission('MAINTENANCE:READ'),
  MaintenanceController.listVendors
);

router.post(
  '/maintenance/vendors',
  requirePermission('MAINTENANCE:MANAGE'),
  MaintenanceController.createVendor
);

router.get(
  '/maintenance/:id',
  requirePermission('MAINTENANCE:READ'),
  MaintenanceController.getRecord
);

router.post(
  '/maintenance/:id/start',
  requirePermission('MAINTENANCE:UPDATE'),
  MaintenanceController.startMaintenance
);

router.post(
  '/maintenance/:id/complete',
  requirePermission('MAINTENANCE:UPDATE'),
  MaintenanceController.completeMaintenance
);

router.post(
  '/maintenance/:id/cancel',
  requirePermission('MAINTENANCE:UPDATE'),
  MaintenanceController.cancelMaintenance
);

/* ==========================================================================
   VEHICLE COMPLIANCE DOCUMENTS
   ========================================================================== */
router.post(
  '/compliance/documents',
  requirePermission('COMPLIANCE:CREATE'),
  ComplianceController.createDocument
);

router.get(
  '/compliance/documents',
  requirePermission('COMPLIANCE:READ'),
  ComplianceController.listDocuments
);

router.get(
  '/compliance/overview',
  requirePermission('COMPLIANCE:READ'),
  ComplianceController.getComplianceOverview
);

router.delete(
  '/compliance/documents/:id',
  requirePermission('COMPLIANCE:DELETE'),
  ComplianceController.archiveDocument
);

export default router;
