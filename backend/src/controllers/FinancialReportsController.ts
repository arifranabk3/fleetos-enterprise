import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { FinancialReportingService } from '../services/FinancialReportingService';
import { FinancialReconciliationService } from '../services/FinancialReconciliationService';
import { FinancialIntegrityEngine } from '../services/FinancialIntegrityEngine';
import { SecureCSVExporter } from '../utils/SecureCSVExporter';
import { AuditLog } from '../models/AuditLog';

export class FinancialReportsController {
  /**
   * GET /api/v1/financial-reports/revenue
   */
  static async getRevenueReport(req: AuthRequest, res: Response) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { startDate, endDate, customerId, currency, format } = req.query;

      const report = await FinancialReportingService.getRevenueReport(orgId, {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        customerId: customerId ? (customerId as string) : undefined,
        currency: currency ? (currency as string) : undefined,
      });

      if (format === 'csv') {
        const csv = SecureCSVExporter.generateCSV(
          [
            { key: 'invoiceNumber', label: 'Invoice Number' },
            { key: 'customerName', label: 'Customer' },
            { key: 'issuedAt', label: 'Issue Date', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '' },
            { key: 'dueAt', label: 'Due Date', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '' },
            { key: 'status', label: 'Status' },
            { key: 'currency', label: 'Currency' },
            { key: 'subtotalCents', label: 'Subtotal ($)', formatter: (v) => (v / 100).toFixed(2) },
            { key: 'taxAmountCents', label: 'Tax ($)', formatter: (v) => (v / 100).toFixed(2) },
            { key: 'fuelSurchargeCents', label: 'Fuel Surcharge ($)', formatter: (v) => (v / 100).toFixed(2) },
            { key: 'totalAmountCents', label: 'Total Revenue ($)', formatter: (v) => (v / 100).toFixed(2) },
            { key: 'amountPaidCents', label: 'Amount Paid ($)', formatter: (v) => (v / 100).toFixed(2) },
            { key: 'balanceDueCents', label: 'Balance Due ($)', formatter: (v) => (v / 100).toFixed(2) },
          ],
          report.invoices
        );

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="revenue_report_${new Date().toISOString().split('T')[0]}.csv"`);
        return res.status(200).send(csv);
      }

      return res.status(200).json({ success: true, data: report });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message: err.message } });
    }
  }

  /**
   * GET /api/v1/financial-reports/cash-collections
   */
  static async getCashCollectionReport(req: AuthRequest, res: Response) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { startDate, endDate, customerId, paymentMethod, currency, format } = req.query;

      const report = await FinancialReportingService.getCashCollectionReport(orgId, {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        customerId: customerId ? (customerId as string) : undefined,
        paymentMethod: paymentMethod ? (paymentMethod as string) : undefined,
        currency: currency ? (currency as string) : undefined,
      });

      if (format === 'csv') {
        const csv = SecureCSVExporter.generateCSV(
          [
            { key: 'receiptNumber', label: 'Receipt Number' },
            { key: 'customerName', label: 'Customer' },
            { key: 'paymentDate', label: 'Payment Date', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '' },
            { key: 'paymentMethod', label: 'Payment Method' },
            { key: 'referenceNumber', label: 'Reference Number' },
            { key: 'currency', label: 'Currency' },
            { key: 'amountCents', label: 'Amount ($)', formatter: (v) => (v / 100).toFixed(2) },
            { key: 'status', label: 'Status' },
            { key: 'reversalReason', label: 'Reversal Reason', formatter: (v) => v || '' },
          ],
          report.receipts
        );

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="cash_collections_${new Date().toISOString().split('T')[0]}.csv"`);
        return res.status(200).send(csv);
      }

      return res.status(200).json({ success: true, data: report });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message: err.message } });
    }
  }

  /**
   * GET /api/v1/financial-reports/accounts-receivable
   */
  static async getAccountsReceivableAgingReport(req: AuthRequest, res: Response) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const report = await FinancialReportingService.getAccountsReceivableAgingReport(orgId);
      return res.status(200).json({ success: true, data: report });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message: err.message } });
    }
  }

  /**
   * GET /api/v1/financial-reports/customer-statement
   */
  static async getCustomerStatement(req: AuthRequest, res: Response) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { customerId, startDate, endDate, format } = req.query;

      if (!customerId) {
        return res.status(400).json({
          success: false,
          error: { code: 'PARAM_REQUIRED', message: 'customerId is required to generate customer statement.' },
        });
      }

      const report = await FinancialReportingService.getCustomerStatement(orgId, customerId as string, {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      if (format === 'csv') {
        const csv = SecureCSVExporter.generateCSV(
          [
            { key: 'date', label: 'Date', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '' },
            { key: 'type', label: 'Type' },
            { key: 'referenceNumber', label: 'Reference Number' },
            { key: 'description', label: 'Description' },
            { key: 'debitCents', label: 'Charges/Debits ($)', formatter: (v) => (v / 100).toFixed(2) },
            { key: 'creditCents', label: 'Credits/Payments ($)', formatter: (v) => (v / 100).toFixed(2) },
            { key: 'runningBalanceCents', label: 'Running Balance ($)', formatter: (v) => (v / 100).toFixed(2) },
            { key: 'status', label: 'Status' },
          ],
          report.ledger
        );

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="statement_${report.customer.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv"`);
        return res.status(200).send(csv);
      }

      return res.status(200).json({ success: true, data: report });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message: err.message } });
    }
  }

  /**
   * GET /api/v1/financial-reports/driver-settlements
   */
  static async getDriverSettlementReport(req: AuthRequest, res: Response) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { startDate, endDate, driverId, status, format } = req.query;

      const report = await FinancialReportingService.getDriverSettlementReport(orgId, {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        driverId: driverId ? (driverId as string) : undefined,
        status: status ? (status as string) : undefined,
      });

      if (format === 'csv') {
        const csv = SecureCSVExporter.generateCSV(
          [
            { key: 'settlementNumber', label: 'Settlement #' },
            { key: 'driverName', label: 'Driver' },
            { key: 'licenseNumber', label: 'CDL License' },
            { key: 'periodStart', label: 'Period Start', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '' },
            { key: 'periodEnd', label: 'Period End', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '' },
            { key: 'status', label: 'Status' },
            { key: 'totalHoursWorked', label: 'Hours' },
            { key: 'totalDistanceKm', label: 'Distance (km)' },
            { key: 'grossPayCents', label: 'Gross Pay ($)', formatter: (v) => (v / 100).toFixed(2) },
            { key: 'bonusCents', label: 'Bonuses ($)', formatter: (v) => (v / 100).toFixed(2) },
            { key: 'deductionCents', label: 'Deductions ($)', formatter: (v) => (v / 100).toFixed(2) },
            { key: 'netPayCents', label: 'Net Pay ($)', formatter: (v) => (v / 100).toFixed(2) },
            { key: 'paymentReference', label: 'Disbursement Ref', formatter: (v) => v || '' },
          ],
          report.settlements
        );

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="driver_settlements_${new Date().toISOString().split('T')[0]}.csv"`);
        return res.status(200).send(csv);
      }

      return res.status(200).json({ success: true, data: report });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message: err.message } });
    }
  }

  /**
   * GET /api/v1/financial-reports/general-ledger
   */
  static async getGeneralLedgerReport(req: AuthRequest, res: Response) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { startDate, endDate, format } = req.query;

      const report = await FinancialReportingService.getGeneralLedgerReport(orgId, {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      if (format === 'csv') {
        const csv = SecureCSVExporter.generateCSV(
          [
            { key: 'accountNumber', label: 'Account Number' },
            { key: 'name', label: 'Account Name' },
            { key: 'type', label: 'Type' },
            { key: 'normalBalance', label: 'Normal Balance' },
            { key: 'debitCents', label: 'Total Debits ($)', formatter: (v) => (v / 100).toFixed(2) },
            { key: 'creditCents', label: 'Total Credits ($)', formatter: (v) => (v / 100).toFixed(2) },
            { key: 'netBalanceCents', label: 'Ending Balance ($)', formatter: (v) => (v / 100).toFixed(2) },
          ],
          report.accounts
        );

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="trial_balance_${new Date().toISOString().split('T')[0]}.csv"`);
        return res.status(200).send(csv);
      }

      return res.status(200).json({ success: true, data: report });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message: err.message } });
    }
  }

  /**
   * GET /api/v1/financial-reports/reconciliation
   */
  static async getReconciliationSummary(req: AuthRequest, res: Response) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { customerId } = req.query;

      const summary = await FinancialReconciliationService.getReconciliationSummary(
        orgId,
        customerId as string | undefined
      );

      return res.status(200).json({ success: true, data: summary });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: { code: 'RECONCILIATION_ERROR', message: err.message } });
    }
  }

  /**
   * POST /api/v1/financial-reports/reconciliation/allocate
   */
  static async allocateReceiptBalance(req: AuthRequest, res: Response) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { receiptId, allocations, reason } = req.body;

      if (!receiptId || !allocations || !Array.isArray(allocations) || allocations.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PAYLOAD', message: 'receiptId and allocations array are required.' },
        });
      }

      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({
          success: false,
          error: { code: 'REASON_REQUIRED', message: 'A comprehensive audit reason is required for adjustments.' },
        });
      }

      const result = await FinancialReconciliationService.allocateReceiptBalance({
        organizationId: orgId,
        receiptId,
        allocations,
        actorId: req.user?.id,
        actorEmail: req.user?.email || 'system@fleetos.internal',
        reason,
      });

      return res.status(200).json({
        success: true,
        message: 'Receipt balance successfully allocated to open invoices.',
        data: result,
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: { code: 'ALLOCATION_FAILED', message: err.message } });
    }
  }

  /**
   * GET /api/v1/financial-reports/integrity
   */
  static async getIntegrityAudit(req: AuthRequest, res: Response) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const audit = await FinancialIntegrityEngine.runIntegrityAudit(orgId);
      return res.status(200).json({ success: true, data: audit });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: { code: 'AUDIT_ERROR', message: err.message } });
    }
  }
}

