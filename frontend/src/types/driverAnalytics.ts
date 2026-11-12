export type DriverScoreTier =
  | 'EXCELLENT'
  | 'GOOD'
  | 'SATISFACTORY'
  | 'NEEDS_IMPROVEMENT'
  | 'INSUFFICIENT_DATA';

export interface DimensionMetricResult {
  dimension: string;
  weight: number;
  score: number | null;
  evidenceCount: number;
  hasSufficientData: boolean;
  reportingPeriodDays: number;
  metadata?: Record<string, any>;
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
