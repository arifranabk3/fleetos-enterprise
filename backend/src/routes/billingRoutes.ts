import { Router } from 'express';
import { authenticate, requireTenantMembership, requirePermission } from '../middleware/auth';
import { RateMatrixController } from '../controllers/RateMatrixController';
import { InvoiceController } from '../controllers/InvoiceController';
import { PaymentReceiptController } from '../controllers/PaymentReceiptController';
import { DriverSettlementController } from '../controllers/DriverSettlementController';

const router = Router();

// All billing and settlement routes require authentication and validated organization context
router.use(authenticate);
router.use(requireTenantMembership);

/* ==========================================================================
   1. FREIGHT RATE MATRIX APIS (/api/v1/billing/rates)
   ========================================================================== */
router.get(
  '/billing/rates',
  requirePermission('billing.read'),
  RateMatrixController.listRates
);

router.post(
  '/billing/rates',
  requirePermission('billing.rates.manage'),
  RateMatrixController.createRate
);

router.post(
  '/billing/rates/quote',
  requirePermission('billing.read'),
  RateMatrixController.previewQuote
);

router.get(
  '/billing/rates/:id',
  requirePermission('billing.read'),
  RateMatrixController.getRateById
);

router.patch(
  '/billing/rates/:id',
  requirePermission('billing.rates.manage'),
  RateMatrixController.updateRate
);

router.post(
  '/billing/rates/:id/versions',
  requirePermission('billing.rates.manage'),
  RateMatrixController.createRateVersion
);

router.get(
  '/billing/rates/:id/versions',
  requirePermission('billing.read'),
  RateMatrixController.getRateVersions
);

/* ==========================================================================
   2. FREIGHT INVOICING APIS (/api/v1/billing/invoices)
   ========================================================================== */
router.get(
  '/billing/invoices/aging-report',
  requirePermission('billing.reports.read'),
  InvoiceController.getAgingReport
);

router.get(
  '/billing/invoices',
  requirePermission('billing.read'),
  InvoiceController.listInvoices
);

router.post(
  '/billing/invoices',
  requirePermission('billing.invoices.manage'),
  InvoiceController.createInvoice
);

router.post(
  '/billing/invoices/generate-from-shipments',
  requirePermission('billing.invoices.generate'),
  InvoiceController.generateFromShipments
);

router.get(
  '/billing/invoices/:id',
  requirePermission('billing.read'),
  InvoiceController.getInvoiceById
);

router.post(
  '/billing/invoices/:id/issue',
  requirePermission('billing.invoices.manage'),
  InvoiceController.issueInvoice
);

router.post(
  '/billing/invoices/:id/void',
  requirePermission('billing.invoices.manage'),
  InvoiceController.voidInvoice
);

router.get(
  '/billing/invoices/:id/audit-history',
  requirePermission('billing.read'),
  InvoiceController.getInvoiceAuditHistory
);

/* ==========================================================================
   3. PAYMENT RECEIPT APIS (/api/v1/billing/receipts)
   ========================================================================== */
router.get(
  '/billing/receipts',
  requirePermission('billing.read'),
  PaymentReceiptController.listReceipts
);

router.post(
  '/billing/receipts',
  requirePermission('billing.receipts.record'),
  PaymentReceiptController.recordReceipt
);

router.get(
  '/billing/receipts/:id',
  requirePermission('billing.read'),
  PaymentReceiptController.getReceiptById
);

router.post(
  '/billing/receipts/:id/reverse',
  requirePermission('billing.receipts.reverse'),
  PaymentReceiptController.reverseReceipt
);

router.get(
  '/billing/receipts/:id/audit-history',
  requirePermission('billing.read'),
  PaymentReceiptController.getReceiptAuditHistory
);

/* ==========================================================================
   4. DRIVER SETTLEMENT APIS (/api/v1/settlements)
   ========================================================================== */
router.get(
  '/settlements',
  requirePermission('billing.settlements.read'),
  DriverSettlementController.listSettlements
);

router.post(
  '/settlements/calculate',
  requirePermission('billing.settlements.manage'),
  DriverSettlementController.calculateSettlement
);

router.get(
  '/settlements/:id',
  requirePermission('billing.settlements.read'),
  DriverSettlementController.getSettlementById
);

router.post(
  '/settlements/:id/review',
  requirePermission('billing.settlements.manage'),
  DriverSettlementController.reviewSettlement
);

router.post(
  '/settlements/:id/approve',
  requirePermission('billing.settlements.manage'),
  DriverSettlementController.approveSettlement
);

router.post(
  '/settlements/:id/pay',
  requirePermission('billing.settlements.manage'),
  DriverSettlementController.recordPayment
);

router.post(
  '/settlements/:id/reverse',
  requirePermission('billing.settlements.manage'),
  DriverSettlementController.reverseSettlement
);

router.get(
  '/settlements/:id/audit-history',
  requirePermission('billing.settlements.read'),
  DriverSettlementController.getSettlementAuditHistory
);

export default router;
