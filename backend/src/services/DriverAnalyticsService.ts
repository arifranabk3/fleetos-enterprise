import { Types } from 'mongoose';
import {
  Driver,
  DriverDocument,
  IDriverDocument,
  DriverShift,
  DriverIncident,
  Shipment,
  FuelTransaction,
  MaintenanceRecord,
} from '../models';
import { DriverDocumentType } from '../models/DriverDocument';

export interface DimensionMetricResult {
  score: number | null;
  evidenceCount: number;
  hasSufficientData: boolean;
  reportingPeriodDays: number;
  metadata: Record<string, any>;
}

export interface AttendanceAnalyticsResult extends DimensionMetricResult {
  eligibleScheduledShiftCount: number;
  completedShiftCount: number;
  completedOnTimeShiftCount: number;
  lateShiftCount: number;
  missedShiftCount: number;
  cancelledShiftCount: number;
  excusedAbsenceCount: number;
  attendanceReliabilityIndex: number | null;
  shiftPunctualityRate: number | null;
  totalPlannedHours: number;
  totalActualHours: number;
  netVarianceHours: number;
  overtimeHours: number;
}

export interface SafetyAnalyticsResult extends DimensionMetricResult {
  totalIncidents: number;
  criticalIncidents: number;
  highIncidents: number;
  mediumIncidents: number;
  lowIncidents: number;
  concludedResponsibleIncidents: number;
  sharedResponsibilityIncidents: number;
  exoneratedIncidents: number;
  pendingIncidents: number;
  duplicateIncidentsExcluded: number;
  totalDeductions: number;
  safetyScore: number | null;
}

export interface DeliveryAnalyticsResult extends DimensionMetricResult {
  totalAssignedShipments: number;
  deliveredCount: number;
  onTimeDeliveredCount: number;
  lateDeliveredCount: number;
  failedDeliveryCount: number;
  cancelledShipmentsExcluded: number;
  excusableDelaysApplied: number;
  missingTimestampFallbackApplied: number;
  deliveryCompletionRate: number | null;
  onTimeDeliveryRate: number | null;
  deliveryScore: number | null;
}

export interface DocumentComplianceResult extends DimensionMetricResult {
  totalDocuments: number;
  validRequiredDocs: number;
  expiredRequiredDocs: number;
  missingRequiredDocs: number;
  expiringSoonDocs: number;
  complianceRate: number | null;
}

export type DriverScoreTier = 'EXCELLENT' | 'GOOD' | 'SATISFACTORY' | 'NEEDS_IMPROVEMENT' | 'INSUFFICIENT_DATA';

export interface DriverScorecardAnalytics {
  driverId: string;
  driverName: string;
  reportingPeriodDays: number;
  hasSufficientData: boolean;
  scoreTier: DriverScoreTier;
  compositePerformanceScore: number | null;
  delivery: DeliveryAnalyticsResult;
  safety: SafetyAnalyticsResult;
  attendance: AttendanceAnalyticsResult;
  compliance: DocumentComplianceResult;
}

export interface DriverLeaderboardEntry {
  driverId: string;
  driverName: string;
  rank: number;
  compositePerformanceScore: number;
  scoreTier: DriverScoreTier;
  safetyScore: number;
  deliveryScore: number;
  attendanceScore: number;
  complianceScore: number;
  completedDeliveries: number;
}

export interface FleetWorkforceOverview {
  reportingPeriodDays: number;
  totalActiveDrivers: number;
  scoredDriversCount: number;
  insufficientDataDriversCount: number;
  fleetAverageCompositeScore: number | null;
  fleetOnTimeDeliveryRate: number | null;
  fleetAttendanceReliability: number | null;
  fleetSafetyAverageScore: number | null;
  totalIncidentsCount: number;
  tierDistribution: Record<DriverScoreTier, number>;
}

export interface ShiftVarianceAnalytics {
  reportingPeriodDays: number;
  totalScheduledHours: number;
  totalActualHours: number;
  netVarianceHours: number;
  totalOvertimeHours: number;
  lateStartsCount: number;
  fleetPunctualityRate: number;
  discrepancyDrivers: Array<{
    driverId: string;
    driverName: string;
    plannedHours: number;
    actualHours: number;
    varianceHours: number;
    overtimeHours: number;
    lateStarts: number;
  }>;
}

export interface DriverTrendPoint {
  periodLabel: string;
  startDate: string;
  endDate: string;
  compositePerformanceScore: number | null;
  deliveryScore: number | null;
  safetyScore: number | null;
  attendanceScore: number | null;
  completedDeliveries: number;
  concludedIncidents: number;
  attendanceReliabilityPercent: number | null;
  hasSufficientData: boolean;
}

export class DriverAnalyticsService {
  public static readonly MIN_SHIFTS_THRESHOLD = 5;
  public static readonly MIN_SHIPMENTS_THRESHOLD = 5;
  public static readonly MIN_COMPLIANCE_THRESHOLD = 1;
  public static readonly DELIVERY_GRACE_PERIOD_MINUTES = 15;

  /**
   * Deterministic calculation: Attendance Reliability & Shift Variance
   */
  public static calculateAttendanceMetrics(
    shifts: any[],
    reportingPeriodDays: number
  ): AttendanceAnalyticsResult {
    // 1. Exclude cancelled shifts & approved absences
    const eligibleShifts = shifts.filter((s) => s.status !== 'CANCELLED');
    const cancelledCount = shifts.filter((s) => s.status === 'CANCELLED').length;

    let completedOnTime = 0;
    let completedLate = 0;
    let missedCount = 0;
    let totalPlannedMins = 0;
    let totalActualMins = 0;
    let totalOvertimeMins = 0;

    for (const shift of eligibleShifts) {
      const plannedStart = new Date(shift.plannedStart).getTime();
      const plannedEnd = new Date(shift.plannedEnd).getTime();
      const plannedDur = Math.max(0, Math.round((plannedEnd - plannedStart) / (60 * 1000)));
      totalPlannedMins += plannedDur;

      if (shift.status === 'COMPLETED') {
        const actualDur = shift.durationMinutes || 0;
        totalActualMins += actualDur;
        totalOvertimeMins += shift.overtimeMinutes || 0;

        if (shift.isLateStart) {
          completedLate++;
        } else {
          completedOnTime++;
        }
      } else if (shift.status === 'MISSED') {
        missedCount++;
      } else if (shift.status === 'IN_PROGRESS') {
        // Active shift, counts toward actual time logged so far
        totalActualMins += shift.durationMinutes || 0;
      }
    }

    const scheduledEligibleCount = completedOnTime + completedLate + missedCount;
    const completedCount = completedOnTime + completedLate;
    const hasSufficientData = scheduledEligibleCount >= this.MIN_SHIFTS_THRESHOLD;

    let ari: number | null = null;
    let spr: number | null = null;

    if (scheduledEligibleCount > 0) {
      // Approved formula: Completed on-time = 1.0, Completed late = 0.5, Missed = 0.0
      const rawAri = ((completedOnTime + 0.5 * completedLate) / scheduledEligibleCount) * 100;
      ari = Math.round(Math.min(100, Math.max(0, rawAri)) * 10) / 10;
    }

    if (completedCount > 0) {
      spr = Math.round((completedOnTime / completedCount) * 1000) / 10;
    }

    const plannedHours = Math.round((totalPlannedMins / 60) * 10) / 10;
    const actualHours = Math.round((totalActualMins / 60) * 10) / 10;
    const netVarianceHours = Math.round((actualHours - plannedHours) * 10) / 10;
    const overtimeHours = Math.round((totalOvertimeMins / 60) * 10) / 10;

    return {
      score: ari,
      evidenceCount: scheduledEligibleCount,
      hasSufficientData,
      reportingPeriodDays,
      eligibleScheduledShiftCount: scheduledEligibleCount,
      completedShiftCount: completedCount,
      completedOnTimeShiftCount: completedOnTime,
      lateShiftCount: completedLate,
      missedShiftCount: missedCount,
      cancelledShiftCount: cancelledCount,
      excusedAbsenceCount: cancelledCount, // Cancelled shifts model approved absences
      attendanceReliabilityIndex: ari,
      shiftPunctualityRate: spr,
      totalPlannedHours: plannedHours,
      totalActualHours: actualHours,
      netVarianceHours,
      overtimeHours,
      metadata: {
        scheduledEligibleCount,
        completedCount,
        hasSufficientData,
      },
    };
  }

  /**
   * Deterministic calculation: Driver Safety & Risk Deductions
   */
  public static calculateSafetyMetrics(
    incidents: any[],
    reportingPeriodDays: number
  ): SafetyAnalyticsResult {
    // Deduplicate incidents based on incidentNumber or identical dispatchId/shipmentId/incidentDate
    const seenIncidentNumbers = new Set<string>();
    const uniqueIncidents: any[] = [];
    let duplicatesExcluded = 0;

    for (const inc of incidents) {
      const incNum = inc.incidentNumber ? inc.incidentNumber.trim().toUpperCase() : null;
      if (incNum) {
        if (seenIncidentNumbers.has(incNum)) {
          duplicatesExcluded++;
          continue;
        }
        seenIncidentNumbers.add(incNum);
      }
      uniqueIncidents.push(inc);
    }

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let concludedResponsible = 0;
    let sharedResp = 0;
    let exonerated = 0;
    let pending = 0;
    let totalDeductions = 0;

    for (const inc of uniqueIncidents) {
      if (inc.severity === 'CRITICAL') criticalCount++;
      else if (inc.severity === 'HIGH') highCount++;
      else if (inc.severity === 'MEDIUM') mediumCount++;
      else lowCount++;

      const isConcluded = inc.status === 'RESOLVED' || inc.status === 'CLOSED';
      if (!isConcluded || inc.responsibilityStatus === 'UNDETERMINED') {
        pending++;
        continue; // Presumption of innocence: pending allegations never penalize score
      }

      if (inc.responsibilityStatus === 'DRIVER_NOT_RESPONSIBLE') {
        exonerated++;
        continue; // Exoneration: full dismissal, 0 deduction
      }

      let multiplier = 0;
      if (inc.responsibilityStatus === 'DRIVER_RESPONSIBLE') {
        multiplier = 1.0;
        concludedResponsible++;
      } else if (inc.responsibilityStatus === 'SHARED_RESPONSIBILITY') {
        multiplier = 0.5;
        sharedResp++;
      }

      let baseDeduction = 5;
      if (inc.severity === 'CRITICAL') baseDeduction = 35;
      else if (inc.severity === 'HIGH') baseDeduction = 20;
      else if (inc.severity === 'MEDIUM') baseDeduction = 10;
      else baseDeduction = 5;

      totalDeductions += Math.round(baseDeduction * multiplier);
    }

    totalDeductions = Math.min(100, Math.max(0, totalDeductions));
    const safetyScore = Math.max(0, 100 - totalDeductions);

    return {
      score: safetyScore,
      evidenceCount: uniqueIncidents.length,
      hasSufficientData: true, // Absence of verified incidents yields baseline 100
      reportingPeriodDays,
      totalIncidents: uniqueIncidents.length,
      criticalIncidents: criticalCount,
      highIncidents: highCount,
      mediumIncidents: mediumCount,
      lowIncidents: lowCount,
      concludedResponsibleIncidents: concludedResponsible,
      sharedResponsibilityIncidents: sharedResp,
      exoneratedIncidents: exonerated,
      pendingIncidents: pending,
      duplicateIncidentsExcluded: duplicatesExcluded,
      totalDeductions,
      safetyScore,
      metadata: {
        totalDeductions,
        duplicatesExcluded,
        hasConcludedLiabilities: concludedResponsible > 0 || sharedResp > 0,
      },
    };
  }

  /**
   * Deterministic calculation: Delivery Completion & On-Time Performance
   */
  public static calculateDeliveryMetrics(
    shipments: any[],
    reportingPeriodDays: number
  ): DeliveryAnalyticsResult {
    const nonCancelled = shipments.filter((s) => s.status !== 'CANCELLED' && s.status !== 'DRAFT');
    const cancelledCount = shipments.filter((s) => s.status === 'CANCELLED').length;

    const deliveredShipments = nonCancelled.filter((s) => s.status === 'DELIVERED');
    const failedDeliveries = nonCancelled.filter((s) => s.status === 'FAILED_DELIVERY');

    const totalEligible = deliveredShipments.length + failedDeliveries.length;
    const hasSufficientData = totalEligible >= this.MIN_SHIPMENTS_THRESHOLD;

    let onTimeCount = 0;
    let lateCount = 0;
    let excusableDelays = 0;
    let missingTimestampFallback = 0;

    const graceMs = this.DELIVERY_GRACE_PERIOD_MINUTES * 60 * 1000;

    for (const s of deliveredShipments) {
      let actualDeliveredAt: Date | null = null;
      if (s.proofOfDelivery?.deliveredAt) {
        actualDeliveredAt = new Date(s.proofOfDelivery.deliveredAt);
      } else if (Array.isArray(s.timeline)) {
        // Fallback: search timeline for DELIVERED status transition
        const deliveredEntry = s.timeline.find((t: any) => t.status === 'DELIVERED');
        if (deliveredEntry?.timestamp) {
          actualDeliveredAt = new Date(deliveredEntry.timestamp);
          missingTimestampFallback++;
        }
      }

      // Check for excusable delay in timeline (customer delay, dispatch hold, weather)
      let isExcusable = false;
      if (Array.isArray(s.timeline)) {
        const delayedEntry = s.timeline.find(
          (t: any) =>
            t.status === 'DELAYED' ||
            t.status === 'ON_HOLD' ||
            (t.note && /customer|access denied|consignee absent|force majeure/i.test(t.note))
        );
        if (delayedEntry) {
          isExcusable = true;
          excusableDelays++;
        }
      }

      if (isExcusable) {
        onTimeCount++;
      } else if (actualDeliveredAt && s.expectedDeliveryDate) {
        const deadline = new Date(s.expectedDeliveryDate).getTime() + graceMs;
        if (actualDeliveredAt.getTime() <= deadline) {
          onTimeCount++;
        } else {
          lateCount++;
        }
      } else if (!actualDeliveredAt && !s.expectedDeliveryDate) {
        // Baseline fallback when no commitment deadline exists
        onTimeCount++;
      } else {
        // Missing delivery timestamp without commitment fallback penalizes punctuality
        lateCount++;
      }
    }

    let dcr: number | null = null;
    let otd: number | null = null;
    let deliveryScore: number | null = null;

    if (totalEligible > 0) {
      dcr = Math.round((deliveredShipments.length / totalEligible) * 1000) / 10;
    }

    if (deliveredShipments.length > 0) {
      otd = Math.round((onTimeCount / deliveredShipments.length) * 1000) / 10;
    }

    if (dcr !== null && otd !== null) {
      deliveryScore = Math.round(((dcr * 0.5) + (otd * 0.5)) * 10) / 10;
    }

    return {
      score: deliveryScore,
      evidenceCount: totalEligible,
      hasSufficientData,
      reportingPeriodDays,
      totalAssignedShipments: totalEligible,
      deliveredCount: deliveredShipments.length,
      onTimeDeliveredCount: onTimeCount,
      lateDeliveredCount: lateCount,
      failedDeliveryCount: failedDeliveries.length,
      cancelledShipmentsExcluded: cancelledCount,
      excusableDelaysApplied: excusableDelays,
      missingTimestampFallbackApplied: missingTimestampFallback,
      deliveryCompletionRate: dcr,
      onTimeDeliveryRate: otd,
      deliveryScore,
      metadata: {
        totalEligible,
        hasSufficientData,
      },
    };
  }

  /**
   * Deterministic calculation: Document Qualification Compliance
   * Requires established organization policy (configured required document types).
   * If requiredDocTypes is undefined, defaults to standard commercial carrier baseline:
   * ['DRIVING_LICENSE', 'MEDICAL_FITNESS_CERTIFICATE'].
   * If requiredDocTypes is empty or cannot be established, returns score: null, hasSufficientData: false.
   */
  public static calculateComplianceMetrics(
    documents: any[],
    reportingPeriodDays: number,
    requiredDocTypes?: DriverDocumentType[]
  ): DocumentComplianceResult {
    // If explicitly null or empty array, organization has no established document policy
    const effectiveRequired = requiredDocTypes !== undefined
      ? requiredDocTypes
      : (['DRIVING_LICENSE', 'MEDICAL_FITNESS_CERTIFICATE'] as DriverDocumentType[]);

    if (!effectiveRequired || effectiveRequired.length === 0) {
      return {
        score: null,
        evidenceCount: documents.length,
        hasSufficientData: false,
        reportingPeriodDays,
        totalDocuments: documents.length,
        validRequiredDocs: 0,
        expiredRequiredDocs: 0,
        missingRequiredDocs: 0,
        expiringSoonDocs: 0,
        complianceRate: null,
        metadata: {
          policyConfigured: false,
          requiredDocTypes: [],
        },
      };
    }

    const activeDocs = documents.filter((d) => !d.isArchived);
    const now = new Date();
    const warningMs = 30 * 24 * 60 * 60 * 1000; // 30-day expiry warning window

    let expiredRequired = 0;
    let expiringSoon = 0;
    let validRequired = 0;
    let missingRequired = 0;

    for (const reqType of effectiveRequired) {
      const matchDoc = activeDocs.find((d) => d.documentType === reqType);
      if (!matchDoc || matchDoc.verificationStatus === 'REJECTED') {
        missingRequired++;
      } else if (matchDoc.expiryDate) {
        const expTime = new Date(matchDoc.expiryDate).getTime();
        if (expTime < now.getTime() || matchDoc.expiryStatus === 'EXPIRED') {
          expiredRequired++;
        } else if (expTime <= now.getTime() + warningMs) {
          expiringSoon++;
          validRequired++;
        } else if (matchDoc.verificationStatus === 'VERIFIED') {
          validRequired++;
        }
      } else if (matchDoc.verificationStatus === 'VERIFIED') {
        validRequired++;
      }
    }

    // Formula: 100 base - (expired * 30) - (missing * 20)
    const deduction = (expiredRequired * 30) + (missingRequired * 20);
    const complianceRate = Math.max(0, 100 - deduction);

    return {
      score: complianceRate,
      evidenceCount: activeDocs.length,
      hasSufficientData: true,
      reportingPeriodDays,
      totalDocuments: activeDocs.length,
      validRequiredDocs: validRequired,
      expiredRequiredDocs: expiredRequired,
      missingRequiredDocs: missingRequired,
      expiringSoonDocs: expiringSoon,
      complianceRate,
      metadata: {
        policyConfigured: true,
        requiredDocTypes: effectiveRequired,
      },
    };
  }

  /**
   * Synthesize Composite Performance Score (CPS) across dimensions
   * Strict Rule:
   * Each dimension must satisfy independent evidence criteria:
   * - Delivery: hasSufficientData (>= 5 actionable shipments)
   * - Safety: hasSufficientData (100 baseline or evaluated incidents)
   * - Attendance: hasSufficientData (>= 5 non-cancelled scheduled shifts)
   * - Compliance: hasSufficientData (established policy with >= 1 required doc)
   *
   * If any required operational dimension lacks sufficient evidence:
   * - Missing dimension score is null.
   * - Do NOT re-normalize remaining weights to 100% (which produces inflated, misleading scores).
   * - Return compositePerformanceScore = null and scoreTier = 'INSUFFICIENT_DATA'.
   */
  public static synthesizeScorecard(
    driverId: string,
    driverName: string,
    reportingPeriodDays: number,
    attendance: AttendanceAnalyticsResult,
    safety: SafetyAnalyticsResult,
    delivery: DeliveryAnalyticsResult,
    compliance: DocumentComplianceResult
  ): DriverScorecardAnalytics {
    // Check independent sufficiency for all core operational dimensions
    const isDeliverySufficient = delivery.hasSufficientData && delivery.score !== null;
    const isSafetySufficient = safety.hasSufficientData && safety.score !== null;
    const isAttendanceSufficient = attendance.hasSufficientData && attendance.score !== null;
    const isComplianceSufficient = compliance.hasSufficientData && compliance.score !== null;

    const allDimensionsSufficient =
      isDeliverySufficient &&
      isSafetySufficient &&
      isAttendanceSufficient &&
      isComplianceSufficient;

    if (!allDimensionsSufficient) {
      return {
        driverId,
        driverName,
        reportingPeriodDays,
        hasSufficientData: false,
        scoreTier: 'INSUFFICIENT_DATA',
        compositePerformanceScore: null,
        delivery,
        safety,
        attendance,
        compliance,
      };
    }

    // Full 40/30/20/10 weight calculation when all dimensions have valid evidence
    const deliveryPart = delivery.score! * 0.40;
    const safetyPart = safety.score! * 0.30;
    const attendancePart = attendance.score! * 0.20;
    const compliancePart = compliance.score! * 0.10;

    const cps = Math.round((deliveryPart + safetyPart + attendancePart + compliancePart) * 10) / 10;

    let scoreTier: DriverScoreTier = 'INSUFFICIENT_DATA';
    if (cps >= 90.0) scoreTier = 'EXCELLENT';
    else if (cps >= 75.0) scoreTier = 'GOOD';
    else if (cps >= 60.0) scoreTier = 'SATISFACTORY';
    else scoreTier = 'NEEDS_IMPROVEMENT';

    return {
      driverId,
      driverName,
      reportingPeriodDays,
      hasSufficientData: true,
      scoreTier,
      compositePerformanceScore: cps,
      delivery,
      safety,
      attendance,
      compliance,
    };
  }

  /**
   * Calculate single driver scorecard via database queries
   */
  public static async calculateDriverScorecard(
    organizationId: string | Types.ObjectId,
    driverId: string | Types.ObjectId,
    days: number = 30
  ): Promise<DriverScorecardAnalytics> {
    const orgId = typeof organizationId === 'string' ? new Types.ObjectId(organizationId) : organizationId;
    const drvId = typeof driverId === 'string' ? new Types.ObjectId(driverId) : driverId;

    const driver = await Driver.findOne({ _id: drvId, organizationId: orgId });
    if (!driver) {
      throw new Error('Driver not found for performance calculation.');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Parallel queries to MongoDB collections
    const [shifts, incidents, shipments, documents] = await Promise.all([
      DriverShift.find({
        organizationId: orgId,
        driverId: drvId,
        plannedStart: { $gte: startDate },
      }),
      DriverIncident.find({
        organizationId: orgId,
        driverId: drvId,
        incidentDate: { $gte: startDate },
      }),
      Shipment.find({
        organizationId: orgId,
        driverId: drvId,
        createdAt: { $gte: startDate },
      }),
      DriverDocument.find({
        organizationId: orgId,
        driverId: drvId,
        isArchived: false,
      }),
    ]);

    const attendanceMetrics = this.calculateAttendanceMetrics(shifts, days);
    const safetyMetrics = this.calculateSafetyMetrics(incidents, days);
    const deliveryMetrics = this.calculateDeliveryMetrics(shipments, days);
    const complianceMetrics = this.calculateComplianceMetrics(documents, days);

    return this.synthesizeScorecard(
      drvId.toString(),
      driver.fullName,
      days,
      attendanceMetrics,
      safetyMetrics,
      deliveryMetrics,
      complianceMetrics
    );
  }

  /**
   * Fleet-wide driver performance rankings with deterministic tie-breaking.
   * Utilizes batch queries to avoid N+1 per-driver loops.
   */
  public static async calculateFleetRankings(
    organizationId: string | Types.ObjectId,
    days: number = 30,
    limit: number = 50
  ): Promise<DriverLeaderboardEntry[]> {
    const orgId = typeof organizationId === 'string' ? new Types.ObjectId(organizationId) : organizationId;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 1. Fetch all active/operational drivers (excluding INACTIVE, SUSPENDED, and isArchived)
    const activeDrivers = await Driver.find({
      organizationId: orgId,
      status: { $nin: ['INACTIVE', 'SUSPENDED'] },
      isArchived: false,
    });

    if (activeDrivers.length === 0) {
      return [];
    }

    // 2. Fetch all required data in 4 batch queries
    const driverIds = activeDrivers.map((d) => d._id);

    const [allShifts, allIncidents, allShipments, allDocs] = await Promise.all([
      DriverShift.find({
        organizationId: orgId,
        driverId: { $in: driverIds },
        plannedStart: { $gte: startDate },
      }),
      DriverIncident.find({
        organizationId: orgId,
        driverId: { $in: driverIds },
        incidentDate: { $gte: startDate },
      }),
      Shipment.find({
        organizationId: orgId,
        driverId: { $in: driverIds },
        createdAt: { $gte: startDate },
      }),
      DriverDocument.find({
        organizationId: orgId,
        driverId: { $in: driverIds },
        isArchived: false,
      }),
    ]);

    // Group in memory by driverId for O(1) retrieval
    const shiftsByDriver = new Map<string, any[]>();
    const incidentsByDriver = new Map<string, any[]>();
    const shipmentsByDriver = new Map<string, any[]>();
    const docsByDriver = new Map<string, any[]>();

    for (const s of allShifts) {
      const key = s.driverId.toString();
      if (!shiftsByDriver.has(key)) shiftsByDriver.set(key, []);
      shiftsByDriver.get(key)!.push(s);
    }
    for (const inc of allIncidents) {
      const key = inc.driverId.toString();
      if (!incidentsByDriver.has(key)) incidentsByDriver.set(key, []);
      incidentsByDriver.get(key)!.push(inc);
    }
    for (const sh of allShipments) {
      const key = sh.driverId ? sh.driverId.toString() : '';
      if (key) {
        if (!shipmentsByDriver.has(key)) shipmentsByDriver.set(key, []);
        shipmentsByDriver.get(key)!.push(sh);
      }
    }
    for (const d of allDocs) {
      const key = d.driverId.toString();
      if (!docsByDriver.has(key)) docsByDriver.set(key, []);
      docsByDriver.get(key)!.push(d);
    }

    // 3. Score each driver
    const eligibleScorecards: DriverScorecardAnalytics[] = [];

    for (const drv of activeDrivers) {
      const dId = drv._id.toString();
      const shifts = shiftsByDriver.get(dId) || [];
      const incidents = incidentsByDriver.get(dId) || [];
      const shipments = shipmentsByDriver.get(dId) || [];
      const docs = docsByDriver.get(dId) || [];

      const att = this.calculateAttendanceMetrics(shifts, days);
      const safe = this.calculateSafetyMetrics(incidents, days);
      const del = this.calculateDeliveryMetrics(shipments, days);
      const comp = this.calculateComplianceMetrics(docs, days);

      const scorecard = this.synthesizeScorecard(dId, drv.fullName, days, att, safe, del, comp);

      // Only rank drivers with sufficient data and a valid CPS
      if (scorecard.hasSufficientData && scorecard.compositePerformanceScore !== null) {
        eligibleScorecards.push(scorecard);
      }
    }

    // 4. Deterministic Tie-Breaking Sort:
    // 1. CPS (desc)
    // 2. Safety Score (desc)
    // 3. Delivery Score (desc)
    // 4. Completed Deliveries (desc)
    // 5. driverId (asc)
    eligibleScorecards.sort((a, b) => {
      if (b.compositePerformanceScore !== a.compositePerformanceScore) {
        return (b.compositePerformanceScore || 0) - (a.compositePerformanceScore || 0);
      }
      if (b.safety.score !== a.safety.score) {
        return (b.safety.score || 0) - (a.safety.score || 0);
      }
      if (b.delivery.score !== a.delivery.score) {
        return (b.delivery.score || 0) - (a.delivery.score || 0);
      }
      if (b.delivery.deliveredCount !== a.delivery.deliveredCount) {
        return b.delivery.deliveredCount - a.delivery.deliveredCount;
      }
      return a.driverId.localeCompare(b.driverId);
    });

    const paginated = eligibleScorecards.slice(0, Math.min(limit, 100));

    return paginated.map((sc, idx) => ({
      driverId: sc.driverId,
      driverName: sc.driverName,
      rank: idx + 1,
      compositePerformanceScore: sc.compositePerformanceScore!,
      scoreTier: sc.scoreTier,
      safetyScore: sc.safety.score || 100,
      deliveryScore: sc.delivery.score || 100,
      attendanceScore: sc.attendance.score || 100,
      complianceScore: sc.compliance.score || 100,
      completedDeliveries: sc.delivery.deliveredCount,
    }));
  }

  /**
   * Fleet-wide workforce overview KPI aggregation
   */
  public static async calculateFleetOverview(
    organizationId: string | Types.ObjectId,
    days: number = 30
  ): Promise<FleetWorkforceOverview> {
    const orgId = typeof organizationId === 'string' ? new Types.ObjectId(organizationId) : organizationId;
    const rankings = await this.calculateFleetRankings(orgId, days, 500);

    const activeDriversCount = await Driver.countDocuments({
      organizationId: orgId,
      status: { $nin: ['INACTIVE', 'SUSPENDED'] },
      isArchived: false,
    });

    const tierDistribution: Record<DriverScoreTier, number> = {
      EXCELLENT: 0,
      GOOD: 0,
      SATISFACTORY: 0,
      NEEDS_IMPROVEMENT: 0,
      INSUFFICIENT_DATA: 0,
    };

    let totalCps = 0;
    let totalOtd = 0;
    let totalAri = 0;
    let totalSafe = 0;

    for (const r of rankings) {
      tierDistribution[r.scoreTier]++;
      totalCps += r.compositePerformanceScore;
      totalOtd += r.deliveryScore;
      totalAri += r.attendanceScore;
      totalSafe += r.safetyScore;
    }

    const scoredCount = rankings.length;
    const insufficientCount = Math.max(0, activeDriversCount - scoredCount);
    tierDistribution['INSUFFICIENT_DATA'] = insufficientCount;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const totalIncidentsCount = await DriverIncident.countDocuments({
      organizationId: orgId,
      incidentDate: { $gte: startDate },
    });

    return {
      reportingPeriodDays: days,
      totalActiveDrivers: activeDriversCount,
      scoredDriversCount: scoredCount,
      insufficientDataDriversCount: insufficientCount,
      fleetAverageCompositeScore: scoredCount > 0 ? Math.round((totalCps / scoredCount) * 10) / 10 : null,
      fleetOnTimeDeliveryRate: scoredCount > 0 ? Math.round((totalOtd / scoredCount) * 10) / 10 : null,
      fleetAttendanceReliability: scoredCount > 0 ? Math.round((totalAri / scoredCount) * 10) / 10 : null,
      fleetSafetyAverageScore: scoredCount > 0 ? Math.round((totalSafe / scoredCount) * 10) / 10 : null,
      totalIncidentsCount,
      tierDistribution,
    };
  }

  /**
   * Shift hours reconciliation and overtime variance aggregation
   */
  public static async calculateShiftVariance(
    organizationId: string | Types.ObjectId,
    days: number = 30
  ): Promise<ShiftVarianceAnalytics> {
    const orgId = typeof organizationId === 'string' ? new Types.ObjectId(organizationId) : organizationId;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const shifts = await DriverShift.find({
      organizationId: orgId,
      plannedStart: { $gte: startDate },
      status: { $ne: 'CANCELLED' },
    }).populate('driverId', 'fullName');

    let totalPlannedMins = 0;
    let totalActualMins = 0;
    let totalOvertimeMins = 0;
    let lateStarts = 0;
    let completedShifts = 0;

    const driverVarianceMap = new Map<string, {
      driverName: string;
      plannedMins: number;
      actualMins: number;
      overtimeMins: number;
      lateStarts: number;
    }>();

    for (const s of shifts) {
      const pStart = new Date(s.plannedStart).getTime();
      const pEnd = new Date(s.plannedEnd).getTime();
      const pDur = Math.max(0, Math.round((pEnd - pStart) / (60 * 1000)));
      totalPlannedMins += pDur;

      const aDur = s.durationMinutes || 0;
      totalActualMins += aDur;
      totalOvertimeMins += s.overtimeMinutes || 0;

      if (s.isLateStart) lateStarts++;
      if (s.status === 'COMPLETED') completedShifts++;

      const drvId = s.driverId?._id ? s.driverId._id.toString() : s.driverId?.toString() || 'unknown';
      const drvName = (s.driverId as any)?.fullName || 'Driver';

      if (!driverVarianceMap.has(drvId)) {
        driverVarianceMap.set(drvId, {
          driverName: drvName,
          plannedMins: 0,
          actualMins: 0,
          overtimeMins: 0,
          lateStarts: 0,
        });
      }
      const record = driverVarianceMap.get(drvId)!;
      record.plannedMins += pDur;
      record.actualMins += aDur;
      record.overtimeMins += s.overtimeMinutes || 0;
      if (s.isLateStart) record.lateStarts++;
    }

    const discrepancyDrivers = Array.from(driverVarianceMap.entries()).map(([driverId, data]) => {
      const pHours = Math.round((data.plannedMins / 60) * 10) / 10;
      const aHours = Math.round((data.actualMins / 60) * 10) / 10;
      return {
        driverId,
        driverName: data.driverName,
        plannedHours: pHours,
        actualHours: aHours,
        varianceHours: Math.round((aHours - pHours) * 10) / 10,
        overtimeHours: Math.round((data.overtimeMins / 60) * 10) / 10,
        lateStarts: data.lateStarts,
      };
    });

    const plannedHours = Math.round((totalPlannedMins / 60) * 10) / 10;
    const actualHours = Math.round((totalActualMins / 60) * 10) / 10;
    const netVarianceHours = Math.round((actualHours - plannedHours) * 10) / 10;
    const overtimeHours = Math.round((totalOvertimeMins / 60) * 10) / 10;
    const punctualityRate = completedShifts > 0
      ? Math.round(((completedShifts - lateStarts) / completedShifts) * 1000) / 10
      : 100.0;

    return {
      reportingPeriodDays: days,
      totalScheduledHours: plannedHours,
      totalActualHours: actualHours,
      netVarianceHours,
      totalOvertimeHours: overtimeHours,
      lateStartsCount: lateStarts,
      fleetPunctualityRate: punctualityRate,
      discrepancyDrivers,
    };
  }

  /**
   * Driver historical rolling monthly performance trend
   */
  public static async calculateDriverTrend(
    organizationId: string | Types.ObjectId,
    driverId: string | Types.ObjectId,
    months: number = 6
  ): Promise<DriverTrendPoint[]> {
    const orgId = typeof organizationId === 'string' ? new Types.ObjectId(organizationId) : organizationId;
    const drvId = typeof driverId === 'string' ? new Types.ObjectId(driverId) : driverId;

    const clampedMonths = Math.min(Math.max(1, months), 12);
    const trendPoints: DriverTrendPoint[] = [];

    for (let i = clampedMonths - 1; i >= 0; i--) {
      const periodStart = new Date();
      periodStart.setMonth(periodStart.getMonth() - (i + 1));
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() - i);

      const [shifts, incidents, shipments, docs] = await Promise.all([
        DriverShift.find({
          organizationId: orgId,
          driverId: drvId,
          plannedStart: { $gte: periodStart, $lt: periodEnd },
        }),
        DriverIncident.find({
          organizationId: orgId,
          driverId: drvId,
          incidentDate: { $gte: periodStart, $lt: periodEnd },
        }),
        Shipment.find({
          organizationId: orgId,
          driverId: drvId,
          createdAt: { $gte: periodStart, $lt: periodEnd },
        }),
        DriverDocument.find({
          organizationId: orgId,
          driverId: drvId,
          isArchived: false,
        }),
      ]);

      const att = this.calculateAttendanceMetrics(shifts, 30);
      const safe = this.calculateSafetyMetrics(incidents, 30);
      const del = this.calculateDeliveryMetrics(shipments, 30);
      const comp = this.calculateComplianceMetrics(docs, 30);

      const card = this.synthesizeScorecard(drvId.toString(), '', 30, att, safe, del, comp);

      const monthLabel = periodStart.toLocaleString('default', { month: 'short', year: 'numeric' });

      trendPoints.push({
        periodLabel: monthLabel,
        startDate: periodStart.toISOString(),
        endDate: periodEnd.toISOString(),
        compositePerformanceScore: card.compositePerformanceScore,
        deliveryScore: del.score,
        safetyScore: safe.score,
        attendanceScore: att.score,
        completedDeliveries: del.deliveredCount,
        concludedIncidents: safe.concludedResponsibleIncidents + safe.sharedResponsibilityIncidents,
        attendanceReliabilityPercent: att.attendanceReliabilityIndex,
        hasSufficientData: card.hasSufficientData,
      });
    }

    return trendPoints;
  }
}
