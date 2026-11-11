import { Types } from 'mongoose';
import { DriverSettlement, IDriverSettlement } from '../models/DriverSettlement';
import { DriverShift } from '../models/DriverShift';
import { Dispatch } from '../models/Dispatch';
import { DriverIncident } from '../models/DriverIncident';
import { ITenantContext } from '../repositories/BaseTenantRepository';
import { FinancialStateMachine } from './FinancialStateMachine';

export interface CalculateSettlementInput {
  settlementNumber: string;
  driverId: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  basePayPerShiftCents?: number;
  ratePerKmCents?: number;
  overtimeRatePerHourCents?: number;
  includeSafetyBonus?: boolean;
  manualBonuses?: Array<{ code: string; description: string; amountCents: number }>;
  manualDeductions?: Array<{ code: string; description: string; amountCents: number; reasonCategory: any }>;
  notes?: string;
  calculatedBy: Types.ObjectId;
}

export class DriverSettlementCalculationService {
  /**
   * Calculates a driver settlement for a specific pay period.
   * Prevents duplicate overlapping settlements and incorporates:
   * - Shifts and actual hours worked
   * - Completed dispatches and distance travelled
   * - Authorized deductions (e.g. at-fault safety incidents)
   * - Performance/safety bonuses
   */
  static async calculateSettlement(
    tenant: ITenantContext,
    input: CalculateSettlementInput
  ): Promise<IDriverSettlement> {
    const orgId = typeof tenant.organizationId === 'string' ? new Types.ObjectId(tenant.organizationId) : tenant.organizationId;

    // 1. Prevent duplicate active settlements for the same driver and period
    const existingSettlement = await DriverSettlement.findOne({
      organizationId: orgId,
      driverId: input.driverId,
      periodStart: { $lte: input.periodEnd },
      periodEnd: { $gte: input.periodStart },
      status: { $ne: 'REJECTED' },
    });

    if (existingSettlement) {
      throw new Error(
        `SETTLEMENT_OVERLAP: Driver already has an active settlement ('${existingSettlement.settlementNumber}' in status '${existingSettlement.status}') for this time window.`
      );
    }

    // 2. Fetch driver shifts in the period
    const shifts = await DriverShift.find({
      organizationId: orgId,
      driverId: input.driverId,
      plannedStart: { $gte: input.periodStart, $lte: input.periodEnd },
      status: 'COMPLETED',
    });

    let totalHoursWorked = 0;
    let totalOvertimeHours = 0;
    shifts.forEach((s) => {
      totalHoursWorked += (s.durationMinutes || 0) / 60;
      totalOvertimeHours += (s.overtimeMinutes || 0) / 60;
    });

    // 3. Fetch completed dispatches in the period
    const dispatches = await Dispatch.find({
      organizationId: orgId,
      driverId: input.driverId,
      $or: [
        { completedAt: { $gte: input.periodStart, $lte: input.periodEnd } },
        { createdAt: { $gte: input.periodStart, $lte: input.periodEnd } },
      ],
      status: 'COMPLETED',
    });

    const totalDispatches = dispatches.length;
    let totalDistanceKm = 0;
    dispatches.forEach((d) => {
      // Use estimated distance default per completed dispatch run
      totalDistanceKm += (d as any).route?.estimatedDistanceKm || 120;
    });

    // 4. Calculate Earnings
    const basePayPerShiftCents = input.basePayPerShiftCents ?? 15000; // $150 / shift default
    const ratePerKmCents = input.ratePerKmCents ?? 45; // $0.45 / km default
    const overtimeRatePerHourCents = input.overtimeRatePerHourCents ?? 3000; // $30 / hr overtime default

    const basePayCents = shifts.length * basePayPerShiftCents;
    const mileagePayCents = Math.round(totalDistanceKm * ratePerKmCents);
    const overtimePayCents = Math.round(totalOvertimeHours * overtimeRatePerHourCents);

    // 5. Bonuses
    const bonuses: Array<{
      code: string;
      description: string;
      amountCents: number;
      authorizedBy?: Types.ObjectId;
      metricType?: 'SAFETY_SCORE' | 'FUEL_EFFICIENCY' | 'ON_TIME_DELIVERY' | 'ATTENDANCE' | 'MANUAL';
      referenceId?: string;
    }> = [];

    if (input.includeSafetyBonus) {
      // Check for clean incident record in period
      const incidentCount = await DriverIncident.countDocuments({
        organizationId: orgId,
        driverId: input.driverId,
        occurredAt: { $gte: input.periodStart, $lte: input.periodEnd },
        driverFault: { $in: ['FULL_RESPONSIBILITY', 'SHARED_RESPONSIBILITY'] },
      });

      if (incidentCount === 0) {
        bonuses.push({
          code: 'SAFETY_BONUS',
          description: 'Zero at-fault safety incidents during settlement period',
          amountCents: 25000, // $250.00
          authorizedBy: input.calculatedBy,
          metricType: 'SAFETY_SCORE',
        });
      }
    }

    if (input.manualBonuses && input.manualBonuses.length > 0) {
      input.manualBonuses.forEach((b) => {
        bonuses.push({
          code: b.code,
          description: b.description,
          amountCents: b.amountCents,
          authorizedBy: input.calculatedBy,
          metricType: 'MANUAL',
        });
      });
    }

    const totalBonusCents = bonuses.reduce((sum, b) => sum + b.amountCents, 0);

    // 6. Deductions
    const deductions: Array<{
      code: string;
      description: string;
      amountCents: number;
      authorizedBy: Types.ObjectId;
      reasonCategory: 'INCIDENT_PENALTY' | 'EQUIPMENT_DAMAGE' | 'POLICY_VIOLATION' | 'TAX_WITHHOLDING' | 'ADVANCE' | 'OTHER';
      incidentId?: Types.ObjectId;
    }> = [];

    if (input.manualDeductions && input.manualDeductions.length > 0) {
      input.manualDeductions.forEach((d) => {
        deductions.push({
          code: d.code,
          description: d.description,
          amountCents: d.amountCents,
          authorizedBy: input.calculatedBy,
          reasonCategory: d.reasonCategory,
        });
      });
    }

    const totalDeductionCents = deductions.reduce((sum, d) => sum + d.amountCents, 0);

    // 7. Net Pay
    const grossPayCents = basePayCents + mileagePayCents + overtimePayCents + totalBonusCents;
    const taxWithheldCents = Math.round(grossPayCents * 0.15); // Standard 15% withholding example
    const netPayCents = Math.max(0, grossPayCents - totalDeductionCents - taxWithheldCents);

    // 8. Create Settlement
    const settlement = await DriverSettlement.create({
      organizationId: orgId,
      settlementNumber: input.settlementNumber,
      driverId: input.driverId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: 'CALCULATED',
      currency: 'USD',
      totalDispatches,
      totalDistanceKm: Math.round(totalDistanceKm),
      totalHoursWorked: Math.round(totalHoursWorked * 10) / 10,
      totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
      basePayCents,
      mileagePayCents,
      overtimePayCents,
      bonuses,
      totalBonusCents,
      deductions,
      totalDeductionCents,
      grossPayCents,
      taxWithheldCents,
      netPayCents,
      dispatchesIncluded: dispatches.map((d) => d._id as Types.ObjectId),
      shiftsIncluded: shifts.map((s) => s._id as Types.ObjectId),
      calculatedAt: new Date(),
      notes: input.notes,
      auditTrail: [
        {
          action: 'SETTLEMENT_CALCULATED',
          performedBy: input.calculatedBy,
          timestamp: new Date(),
          note: `Calculated from ${shifts.length} shifts and ${dispatches.length} dispatches. Net pay: ${netPayCents} cents.`,
        },
      ],
    });

    return settlement;
  }

  /**
   * Approves a calculated settlement, freezing all figures.
   */
  static async approveSettlement(
    tenant: ITenantContext,
    settlementId: Types.ObjectId,
    approverId: Types.ObjectId
  ): Promise<IDriverSettlement> {
    const orgId = typeof tenant.organizationId === 'string' ? new Types.ObjectId(tenant.organizationId) : tenant.organizationId;

    const settlement = await DriverSettlement.findOne({ organizationId: orgId, _id: settlementId });
    if (!settlement) {
      throw new Error('SETTLEMENT_NOT_FOUND: Driver settlement does not exist in organization.');
    }

    FinancialStateMachine.validateSettlementTransition(settlement.status, 'APPROVED');

    settlement.status = 'APPROVED';
    settlement.approvedBy = approverId;
    settlement.approvedAt = new Date();
    settlement.auditTrail.push({
      action: 'SETTLEMENT_APPROVED',
      performedBy: approverId,
      timestamp: new Date(),
      note: 'Settlement formally approved for disbursement.',
    });

    await settlement.save();
    return settlement;
  }
}
