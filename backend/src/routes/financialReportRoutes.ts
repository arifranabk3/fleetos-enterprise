import { Router } from 'express';
import { authenticate, requireTenantMembership, requirePermission } from '../middleware/auth';
import { FinancialReportsController } from '../controllers/FinancialReportsController';

const router = Router();

// All reporting and reconciliation routes require authenticated session & validated organization tenant context
router.use(authenticate);
router.use(requireTenantMembership);

/* ==========================================================================
   FINANCIAL REPORTING APIS (/api/v1/financial-reports)
   ========================================================================== */

// 1. Revenue Report
router.get(
  '/financial-reports/revenue',
  requirePermission('billing.reports.read'),
  FinancialReportsController.getRevenueReport
);

// 2. Cash Collection Report
router.get(
  '/financial-reports/cash-collections',
  requirePermission('billing.reports.read'),
  FinancialReportsController.getCashCollectionReport
);

// 3. Accounts Receivable Aging Report
router.get(
  '/financial-reports/accounts-receivable',
  requirePermission('billing.reports.read'),
  FinancialReportsController.getAccountsReceivableAgingReport
);

// 4. Customer Statement
router.get(
  '/financial-reports/customer-statement',
  requirePermission('billing.reports.read'),
  FinancialReportsController.getCustomerStatement
);

// 5. Driver Settlement Report
router.get(
  '/financial-reports/driver-settlements',
  requirePermission('billing.reports.read'),
  FinancialReportsController.getDriverSettlementReport
);

// 6. General Ledger Trial Balance Report
router.get(
  '/financial-reports/general-ledger',
  requirePermission('billing.reports.read'),
  FinancialReportsController.getGeneralLedgerReport
);

// 7. Payment & AR Reconciliation Summary
router.get(
  '/financial-reports/reconciliation',
  requirePermission('billing.reports.read'),
  FinancialReportsController.getReconciliationSummary
);

// 8. Authorized Manual Receipt Allocation Adjustment
router.post(
  '/financial-reports/reconciliation/allocate',
  requirePermission('billing.receipts.record'),
  FinancialReportsController.allocateReceiptBalance
);

// 9. Financial Integrity Engine Audit
router.get(
  '/financial-reports/integrity',
  requirePermission('billing.reports.read'),
  FinancialReportsController.getIntegrityAudit
);

export default router;

