import { Types } from 'mongoose';
import {
  Driver,
  DriverDocument,
  DriverShift,
  DriverIncident,
  Shipment,
  FuelTransaction,
  MaintenanceRecord,
} from '../models';

export interface DriverScorecardMetrics {
  driverId: string;
  driverName: string;
  reportingPeriodDays: number;
  // Delivery metrics
  totalAssignedShipments: number;
  completedDeliveries: number;
  failedDeliveries: number;
  cancelledShipmentsExcluded: number;
  completionRatePercent: number;
  onTimeDeliveryCount: number;
  onTimeDeliveryRatePercent: number;
  // Safety & Incidents
  totalIncidents: number;
  criticalIncidents: number;
  safetyScore: number; // 0 - 100
  // Fuel efficiency
  averageFuelEfficiencyKmPerL: number;
  fuelTransactionsCount: number;
  // Maintenance & Interruption
  maintenanceInterruptionsCount: number;
  // Compliance
  documentComplianceRatePercent: number;
  expiredDocumentsCount: number;
  missingRequiredDocsCount: number;
  // Attendance
  scheduledShiftsCount: number;
  completedShiftsCount: number;
  missedShiftsCount: number;
  lateStartsCount: number;
  attendanceReliabilityPercent: number;
  // Composite Score
  compositePerformanceScore: number; // 0 - 100
  scoreTier: 'EXCELLENT' | 'GOOD' | 'SATISFACTORY' | 'NEEDS_IMPROVEMENT' | 'INSUFFICIENT_DATA';
  hasSufficientData: boolean;
}

export class DriverPerformanceEngine {
  /**
   * Calculates comprehensive scorecard metrics for a single driver within a tenant.
   * Period default is 30 days.
   */
  static async calculateDriverScorecard(
    organizationId: string | Types.ObjectId,
    driverId: string | Types.ObjectId,
    days: number = 30
  ): Promise<DriverScorecardMetrics> {
    const orgId = typeof organizationId === 'string' ? new Types.ObjectId(organizationId) : organizationId;
    const drvId = typeof driverId === 'string' ? new Types.ObjectId(driverId) : driverId;

    const driver = await Driver.findOne({ _id: drvId, organizationId: orgId });
    if (!driver) {
      throw new Error('Driver not found for performance calculation.');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 1. Deliveries & Shipments (Distinct Shipments where driver was assigned)
    const shipments = await Shipment.find({
      organizationId: orgId,
      driverId: drvId,
      createdAt: { $gte: startDate },
    });

    const nonCancelled = shipments.filter((s) => s.status !== 'CANCELLED' && s.status !== 'DRAFT');
    const cancelledCount = shipments.filter((s) => s.status === 'CANCELLED').length;
    const completedDeliveries = nonCancelled.filter((s) => s.status === 'DELIVERED').length;
    const failedDeliveries = nonCancelled.filter((s) => s.status === 'FAILED_DELIVERY').length;

    let onTimeCount = 0;
    nonCancelled.forEach((s) => {
      if (s.status === 'DELIVERED' && s.proofOfDelivery?.deliveredAt && s.expectedDeliveryDate) {
        if (new Date(s.proofOfDelivery.deliveredAt) <= new Date(s.expectedDeliveryDate)) {
          onTimeCount++;
        }
      } else if (s.status === 'DELIVERED') {
        // Fallback: if no expectedDeliveryDate was set, consider delivered as on-time baseline
        onTimeCount++;
      }
    });

    const totalEligible = nonCancelled.length;
    const completionRatePercent = totalEligible > 0 ? Math.round((completedDeliveries / totalEligible) * 1000) / 10 : 100;
    const onTimeDeliveryRatePercent = completedDeliveries > 0 ? Math.round((onTimeCount / completedDeliveries) * 1000) / 10 : 100;

    // 2. Safety & Incidents (Fairness: only validated reviewed incidents deduct safety points)
    const incidents = await DriverIncident.find({
      organizationId: orgId,
      driverId: drvId,
      incidentDate: { $gte: startDate },
    });

    const totalIncidents = incidents.length;
    const criticalIncidents = incidents.filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH').length;

    // Safety score deduction: 100 base
    // Only RESOLVED or CLOSED incidents with confirmed DRIVER_RESPONSIBLE or SHARED_RESPONSIBILITY deduct points
    // OPEN, UNDER_REVIEW, and DRIVER_NOT_RESPONSIBLE are strictly excluded from deductions.
    let safetyScore = 100;
    incidents.forEach((i) => {
      const isConcluded = i.status === 'RESOLVED' || i.status === 'CLOSED';
      if (!isConcluded) return; // Fair: Allegation under review never penalizes score

      let multiplier = 0;
      if (i.responsibilityStatus === 'DRIVER_RESPONSIBLE') {
        multiplier = 1.0;
      } else if (i.responsibilityStatus === 'SHARED_RESPONSIBILITY') {
        multiplier = 0.5; // Documented half deduction for shared responsibility
      } else {
        return; // DRIVER_NOT_RESPONSIBLE or UNDETERMINED: zero deduction
      }

      let deduction = 5;
      if (i.severity === 'CRITICAL') deduction = 35;
      else if (i.severity === 'HIGH') deduction = 20;
      else if (i.severity === 'MEDIUM') deduction = 10;
      else deduction = 5;

      safetyScore -= Math.round(deduction * multiplier);
    });
    if (safetyScore < 0) safetyScore = 0;

    // 3. Fuel Efficiency (Measured on driver's transactions)
    const fuelTxs = await FuelTransaction.find({
      organizationId: orgId,
      driverId: drvId,
      transactionDate: { $gte: startDate },
      efficiencyStatus: 'VERIFIED',
    });

    let avgFuelEff = 0;
    if (fuelTxs.length > 0) {
      const sumEff = fuelTxs.reduce((acc, t) => acc + (t.fuelEfficiency || 0), 0);
      avgFuelEff = Math.round((sumEff / fuelTxs.length) * 100) / 100;
    }

    // 4. Maintenance / Breakdown Interruptions
    // Look for unscheduled breakdown maintenance on assigned vehicle
    const maintenanceRecords = await MaintenanceRecord.find({
      organizationId: orgId,
      driverId: drvId,
      createdAt: { $gte: startDate },
      category: 'UNSCHEDULED_BREAKDOWN',
    });
    const maintenanceInterruptionsCount = maintenanceRecords.length;

    // 5. Document Compliance
    const now = new Date();
    const docs = await DriverDocument.find({
      organizationId: orgId,
      driverId: drvId,
      isArchived: false,
    });

    let expiredDocs = 0;
    const hasLicenseDoc = docs.some((d) => d.documentType === 'DRIVING_LICENSE');
    const hasMedDoc = docs.some((d) => d.documentType === 'MEDICAL_FITNESS_CERTIFICATE');

    docs.forEach((d) => {
      if (d.expiryDate && new Date(d.expiryDate) < now) {
        expiredDocs++;
      }
    });

    let missingRequired = 0;
    if (!hasLicenseDoc) missingRequired++;
    if (!hasMedDoc) missingRequired++;

    const docComplianceRate = Math.max(0, 100 - expiredDocs * 30 - missingRequired * 20);

    // 6. Attendance & Shift Reliability
    const shifts = await DriverShift.find({
      organizationId: orgId,
      driverId: drvId,
      plannedStart: { $gte: startDate },
    });

    const scheduledShiftsCount = shifts.length;
    const completedShiftsCount = shifts.filter((s) => s.status === 'COMPLETED').length;
    const missedShiftsCount = shifts.filter((s) => s.status === 'MISSED').length;
    const lateStartsCount = shifts.filter((s) => s.isLateStart).length;

    let attendanceReliabilityPercent = 100;
    if (scheduledShiftsCount > 0) {
      const successfulShifts = shifts.filter((s) => s.status === 'COMPLETED' && !s.isLateStart).length;
      attendanceReliabilityPercent = Math.round((successfulShifts / scheduledShiftsCount) * 1000) / 10;
    }

    // 7. Composite Performance Score
    // Weights:
    // Delivery On-Time & Completion: 40%
    // Safety & Zero Incidents: 30%
    // Attendance & Reliability: 20%
    // Document Compliance: 10%
    const deliveryScore = (completionRatePercent * 0.5) + (onTimeDeliveryRatePercent * 0.5);
    const compositeScore = Math.round(
      deliveryScore * 0.40 +
      safetyScore * 0.30 +
      attendanceReliabilityPercent * 0.20 +
      docComplianceRate * 0.10
    );

    const hasSufficientData = totalEligible > 0 || scheduledShiftsCount > 0;

    let scoreTier: DriverScorecardMetrics['scoreTier'] = 'INSUFFICIENT_DATA';
    if (hasSufficientData) {
      if (compositeScore >= 90) scoreTier = 'EXCELLENT';
      else if (compositeScore >= 75) scoreTier = 'GOOD';
      else if (compositeScore >= 60) scoreTier = 'SATISFACTORY';
      else scoreTier = 'NEEDS_IMPROVEMENT';
    }

    return {
      driverId: drvId.toString(),
      driverName: driver.fullName,
      reportingPeriodDays: days,
      totalAssignedShipments: totalEligible,
      completedDeliveries,
      failedDeliveries,
      cancelledShipmentsExcluded: cancelledCount,
      completionRatePercent,
      onTimeDeliveryCount: onTimeCount,
      onTimeDeliveryRatePercent,
      totalIncidents,
      criticalIncidents,
      safetyScore,
      averageFuelEfficiencyKmPerL: avgFuelEff,
      fuelTransactionsCount: fuelTxs.length,
      maintenanceInterruptionsCount,
      documentComplianceRatePercent: docComplianceRate,
      expiredDocumentsCount: expiredDocs,
      missingRequiredDocsCount: missingRequired,
      scheduledShiftsCount,
      completedShiftsCount,
      missedShiftsCount,
      lateStartsCount,
      attendanceReliabilityPercent,
      compositePerformanceScore: hasSufficientData ? compositeScore : 0,
      scoreTier,
      hasSufficientData,
    };
  }

  /**
   * Calculates fleet-wide performance rankings for all active drivers in a tenant.
   */
  static async calculateFleetRankings(
    organizationId: string | Types.ObjectId,
    days: number = 30
  ): Promise<DriverScorecardMetrics[]> {
    const orgId = typeof organizationId === 'string' ? new Types.ObjectId(organizationId) : organizationId;
    const drivers = await Driver.find({ organizationId: orgId, isArchived: false });

    const scorecards: DriverScorecardMetrics[] = [];
    for (const drv of drivers) {
      const card = await this.calculateDriverScorecard(orgId, drv._id, days);
      scorecards.push(card);
    }

    // Sort descending by composite score, then completed deliveries
    scorecards.sort((a, b) => {
      if (b.compositePerformanceScore !== a.compositePerformanceScore) {
        return b.compositePerformanceScore - a.compositePerformanceScore;
      }
      return b.completedDeliveries - a.completedDeliveries;
    });

    return scorecards;
  }
}
