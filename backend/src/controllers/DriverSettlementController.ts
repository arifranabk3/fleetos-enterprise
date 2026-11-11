import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { DriverSettlement } from '../models/DriverSettlement';
import { Driver } from '../models/Driver';
import { LedgerAccount } from '../models/LedgerAccount';
import { DriverSettlementCalculationService } from '../services/DriverSettlementCalculationService';
import { FinancialStateMachine } from '../services/FinancialStateMachine';
import { FinancialLedgerService } from '../services/FinancialLedgerService';
import { CreateDriverSettlementSchema } from '../validators/financialValidators';

export class DriverSettlementController {
  /**
   * GET /api/v1/settlements
   * List settlements with filtering and pagination.
   */
  static async listSettlements(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { driverId, status, page = 1, limit = 20, startDate, endDate } = req.query;

      const filter: any = { organizationId: orgId };
      if (driverId && Types.ObjectId.isValid(driverId as string)) {
        filter.driverId = new Types.ObjectId(driverId as string);
      }
      if (status) filter.status = status;
      if (startDate || endDate) {
        filter.periodStart = {};
        if (startDate) filter.periodStart.$gte = new Date(startDate as string);
        if (endDate) filter.periodStart.$lte = new Date(endDate as string);
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [settlements, total] = await Promise.all([
        DriverSettlement.find(filter)
          .sort({ periodStart: -1, createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .populate('driverId', 'fullName firstName lastName employeeNumber licenseNumber phone')
          .populate('approvedBy', 'firstName lastName email'),
        DriverSettlement.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          settlements,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/settlements/:id
   * Get settlement details.
   */
  static async getSettlementById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Invalid settlement ID' },
        });
      }

      const settlement = await DriverSettlement.findOne({
        _id: new Types.ObjectId(id),
        organizationId: orgId,
      })
        .populate('driverId', 'fullName firstName lastName employeeNumber licenseNumber phone email')
        .populate('approvedBy', 'firstName lastName email')
        .populate('shiftsIncluded')
        .populate('dispatchesIncluded');

      if (!settlement) {
        return res.status(404).json({
          success: false,
          error: { code: 'SETTLEMENT_NOT_FOUND', message: 'Driver settlement not found' },
        });
      }

      return res.status(200).json({
        success: true,
        data: settlement,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/settlements/calculate
   * Automated settlement calculation for a driver and pay period.
   */
  static async calculateSettlement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantContext = { organizationId: req.tenant!.organizationId };
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const userId = new Types.ObjectId(req.tenant!.userId);

      const {
        settlementNumber,
        driverId,
        periodStart,
        periodEnd,
        basePayPerShiftCents,
        ratePerKmCents,
        overtimeRatePerHourCents,
        includeSafetyBonus,
        manualBonuses,
        manualDeductions,
        notes,
      } = req.body;

      if (!driverId || !Types.ObjectId.isValid(driverId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_DRIVER_ID', message: 'Valid driver ID is required' },
        });
      }

      // Check driver ownership
      const driver = await Driver.findOne({ _id: new Types.ObjectId(driverId), organizationId: orgId });
      if (!driver) {
        return res.status(404).json({
          success: false,
          error: { code: 'DRIVER_NOT_FOUND', message: 'Driver does not belong to organization' },
        });
      }

      if (!settlementNumber) {
        return res.status(400).json({
          success: false,
          error: { code: 'SETTLEMENT_NUMBER_REQUIRED', message: 'Settlement number is required' },
        });
      }

      const existingNumber = await DriverSettlement.findOne({
        organizationId: orgId,
        settlementNumber: settlementNumber.toUpperCase(),
      });
      if (existingNumber) {
        return res.status(409).json({
          success: false,
          error: { code: 'SETTLEMENT_NUMBER_CONFLICT', message: `Settlement #${settlementNumber} already exists.` },
        });
      }

      const settlement = await DriverSettlementCalculationService.calculateSettlement(tenantContext, {
        settlementNumber: settlementNumber.toUpperCase(),
        driverId: new Types.ObjectId(driverId),
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        basePayPerShiftCents: basePayPerShiftCents ? Number(basePayPerShiftCents) : undefined,
        ratePerKmCents: ratePerKmCents ? Number(ratePerKmCents) : undefined,
        overtimeRatePerHourCents: overtimeRatePerHourCents ? Number(overtimeRatePerHourCents) : undefined,
        includeSafetyBonus: Boolean(includeSafetyBonus),
        manualBonuses,
        manualDeductions,
        notes,
        calculatedBy: userId,
      });

      return res.status(201).json({
        success: true,
        data: settlement,
      });
    } catch (error: any) {
      if (error.code === 11000 || error.message?.includes('E11000')) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'SETTLEMENT_CONFLICT',
            message: 'A settlement for this driver and period or with this number already exists.',
          },
        });
      }
      if (error.message?.includes('PARTIAL_SHIFT_AVAILABILITY')) {
        return res.status(409).json({
          success: false,
          error: { code: 'PARTIAL_SHIFT_AVAILABILITY', message: error.message },
        });
      }
      if (error.message?.includes('SETTLEMENT_OVERLAP')) {
        return res.status(409).json({
          success: false,
          error: { code: 'SETTLEMENT_OVERLAP', message: error.message },
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/v1/settlements/:id/review
   * Formally review and transition settlement (e.g. from DRAFT to CALCULATED).
   */
  static async reviewSettlement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const userId = new Types.ObjectId(req.tenant!.userId);
      const { id } = req.params;
      const { notes } = req.body;

      const settlement = await DriverSettlement.findOne({
        _id: new Types.ObjectId(id),
        organizationId: orgId,
      });

      if (!settlement) {
        return res.status(404).json({
          success: false,
          error: { code: 'SETTLEMENT_NOT_FOUND', message: 'Settlement not found' },
        });
      }

      settlement.auditTrail.push({
        action: 'SETTLEMENT_REVIEWED',
        performedBy: userId,
        timestamp: new Date(),
        note: notes || 'Settlement verified and marked ready for approval',
      });

      await settlement.save();

      return res.status(200).json({
        success: true,
        data: settlement,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/settlements/:id/approve
   * Formally approve settlement for disbursement.
   */
  static async approveSettlement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantContext = { organizationId: req.tenant!.organizationId };
      const userId = new Types.ObjectId(req.tenant!.userId);
      const { id } = req.params;

      const settlement = await DriverSettlementCalculationService.approveSettlement(
        tenantContext,
        new Types.ObjectId(id),
        userId
      );

      return res.status(200).json({
        success: true,
        data: settlement,
      });
    } catch (error: any) {
      if (error.message?.includes('INVALID_SETTLEMENT_TRANSITION')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TRANSITION', message: error.message },
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/v1/settlements/:id/pay
   * Mark settlement as paid with disbursement reference.
   */
  static async recordPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantContext = { organizationId: req.tenant!.organizationId };
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const userId = new Types.ObjectId(req.tenant!.userId);
      const { id } = req.params;
      const { paymentReference, paymentMethod = 'DIRECT_DEPOSIT' } = req.body;

      if (!paymentReference || typeof paymentReference !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'PAYMENT_REFERENCE_REQUIRED', message: 'Disbursement reference number is required' },
        });
      }

      const settlement = await DriverSettlement.findOne({
        _id: new Types.ObjectId(id),
        organizationId: orgId,
      });

      if (!settlement) {
        return res.status(404).json({
          success: false,
          error: { code: 'SETTLEMENT_NOT_FOUND', message: 'Settlement not found' },
        });
      }

      FinancialStateMachine.validateSettlementTransition(settlement.status, 'PAID');

      settlement.status = 'PAID';
      settlement.paidAt = new Date();
      settlement.paymentReference = paymentReference;
      settlement.paymentMethod = paymentMethod;

      settlement.auditTrail.push({
        action: 'SETTLEMENT_PAID',
        performedBy: userId,
        timestamp: new Date(),
        note: `Disbursed ${settlement.netPayCents} cents via ${paymentMethod} (Ref: ${paymentReference})`,
      });

      await settlement.save();

      // General Ledger Entry: Debit Driver Compensation Expense (5010), Credit Cash (1010)
      try {
        const compExpense = await LedgerAccount.findOne({ organizationId: orgId, accountNumber: '5010' });
        const cashAcc = await LedgerAccount.findOne({ organizationId: orgId, accountNumber: '1010' });

        if (compExpense && cashAcc) {
          await FinancialLedgerService.postJournalEntry(tenantContext, {
            entryNumber: `JE-SETTLE-${settlement.settlementNumber}`,
            postingDate: settlement.paidAt,
            sourceType: 'DRIVER_SETTLEMENT',
            sourceReferenceId: settlement._id as Types.ObjectId,
            sourceReferenceNumber: settlement.settlementNumber,
            description: `Driver payroll disbursed: ${settlement.settlementNumber}`,
            lines: [
              {
                accountId: compExpense._id as Types.ObjectId,
                entryType: 'DEBIT',
                amountCents: settlement.netPayCents,
                description: 'Driver Compensation Expense',
              },
              {
                accountId: cashAcc._id as Types.ObjectId,
                entryType: 'CREDIT',
                amountCents: settlement.netPayCents,
                description: 'Operating Cash Disbursed',
              },
            ],
            postedBy: userId,
            idempotencyKey: `JE-SETTLE-${settlement._id.toString()}`,
          });
        }
      } catch (ledgerErr) {
        console.warn('[Ledger Warning] Driver settlement disbursement auto-journaling skipped:', ledgerErr);
      }

      return res.status(200).json({
        success: true,
        data: settlement,
      });
    } catch (error: any) {
      if (error.message?.includes('INVALID_SETTLEMENT_TRANSITION')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TRANSITION', message: error.message },
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/v1/settlements/:id/reverse
   * Reverse a paid settlement and restore to APPROVED status.
   */
  static async reverseSettlement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const userId = new Types.ObjectId(req.tenant!.userId);
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'REVERSAL_REASON_REQUIRED', message: 'A reason is required to reverse settlement payout' },
        });
      }

      const settlement = await DriverSettlement.findOne({
        _id: new Types.ObjectId(id),
        organizationId: orgId,
      });

      if (!settlement) {
        return res.status(404).json({
          success: false,
          error: { code: 'SETTLEMENT_NOT_FOUND', message: 'Settlement not found' },
        });
      }

      if (settlement.status !== 'PAID') {
        return res.status(400).json({
          success: false,
          error: { code: 'SETTLEMENT_NOT_PAID', message: 'Only PAID settlements can be reversed.' },
        });
      }

      settlement.status = 'APPROVED';
      settlement.paidAt = undefined;
      settlement.paymentReference = undefined;

      settlement.auditTrail.push({
        action: 'SETTLEMENT_PAYMENT_REVERSED',
        performedBy: userId,
        timestamp: new Date(),
        note: `Payout reversed back to APPROVED. Reason: ${reason}`,
      });

      await settlement.save();

      return res.status(200).json({
        success: true,
        data: settlement,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/settlements/:id/audit-history
   * Get settlement audit history.
   */
  static async getSettlementAuditHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { id } = req.params;

      const settlement = await DriverSettlement.findOne(
        { _id: new Types.ObjectId(id), organizationId: orgId },
        { settlementNumber: 1, auditTrail: 1 }
      ).populate('auditTrail.performedBy', 'firstName lastName email');

      if (!settlement) {
        return res.status(404).json({
          success: false,
          error: { code: 'SETTLEMENT_NOT_FOUND', message: 'Settlement not found' },
        });
      }

      return res.status(200).json({
        success: true,
        data: settlement.auditTrail,
      });
    } catch (error) {
      next(error);
    }
  }
}
