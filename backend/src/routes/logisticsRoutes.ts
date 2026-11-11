import { Router } from 'express';
import { authenticate, requireTenantMembership, requirePermission } from '../middleware/auth';
import { CustomerController } from '../controllers/CustomerController';
import { ShipmentController } from '../controllers/ShipmentController';
import { DispatchController } from '../controllers/DispatchController';

const router = Router();

// Mandatory Tenant Resolution & Authentication
router.use(authenticate);
router.use(requireTenantMembership);

/* ==========================================================================
   CUSTOMER MANAGEMENT APIS
   ========================================================================== */
router.post(
  '/customers',
  requirePermission('CUSTOMERS:CREATE'),
  CustomerController.createCustomer
);

router.get(
  '/customers',
  requirePermission('CUSTOMERS:READ'),
  CustomerController.listCustomers
);

router.get(
  '/customers/:id',
  requirePermission('CUSTOMERS:READ'),
  CustomerController.getCustomer
);

router.patch(
  '/customers/:id',
  requirePermission('CUSTOMERS:UPDATE'),
  CustomerController.updateCustomer
);

router.delete(
  '/customers/:id',
  requirePermission('CUSTOMERS:DELETE'),
  CustomerController.deleteCustomer
);

/* ==========================================================================
   SHIPMENT ORDER MANAGEMENT APIS
   ========================================================================== */
router.post(
  '/shipments',
  requirePermission('SHIPMENTS:CREATE'),
  ShipmentController.createShipment
);

router.get(
  '/shipments',
  requirePermission('SHIPMENTS:READ'),
  ShipmentController.listShipments
);

router.get(
  '/shipments/:id',
  requirePermission('SHIPMENTS:READ'),
  ShipmentController.getShipment
);

router.patch(
  '/shipments/:id',
  requirePermission('SHIPMENTS:UPDATE'),
  ShipmentController.updateShipment
);

router.post(
  '/shipments/:id/confirm',
  requirePermission('SHIPMENTS:UPDATE'),
  ShipmentController.confirmShipment
);

router.post(
  '/shipments/:id/cancel',
  requirePermission('SHIPMENTS:CANCEL'),
  ShipmentController.cancelShipment
);

router.get(
  '/shipments/:id/history',
  requirePermission('SHIPMENTS:READ'),
  ShipmentController.getShipmentHistory
);

router.get(
  '/shipments/:id/dispatches',
  requirePermission('SHIPMENTS:READ'),
  ShipmentController.getShipmentDispatches
);

/* ==========================================================================
   DISPATCH MANAGEMENT APIS
   ========================================================================== */
router.post(
  '/dispatches',
  requirePermission('DISPATCH:CREATE'),
  DispatchController.createDispatch
);

router.get(
  '/dispatches',
  requirePermission('DISPATCH:READ'),
  DispatchController.listDispatches
);

router.get(
  '/dispatches/:id',
  requirePermission('DISPATCH:READ'),
  DispatchController.getDispatch
);

router.post(
  '/dispatches/:id/start',
  requirePermission('DISPATCH:UPDATE'),
  DispatchController.startDispatch
);

router.post(
  '/dispatches/:id/complete',
  requirePermission('DISPATCH:UPDATE'),
  DispatchController.completeDispatch
);

router.post(
  '/dispatches/:id/cancel',
  requirePermission('DISPATCH:UPDATE'),
  DispatchController.cancelDispatch
);

router.patch(
  '/dispatches/:id/status',
  requirePermission('DISPATCH:UPDATE'),
  DispatchController.updateDispatchStatus
);

export default router;
