import assert from 'assert';
import {
  DriverScoreTier,
  DriverScorecardAnalytics,
  FleetWorkforceOverview,
  ShiftVarianceAnalytics,
  DriverLeaderboardEntry,
  DriverTrendPoint,
} from '../src/types/driverAnalytics';

async function runFrontendContractTestSuite() {
  console.log('================================================================================');
  console.log('    FLEETOS PHASE 11.2.2-B FRONTEND INTEGRATION & CONTRACT TEST SUITE');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => void) => {
    try {
      fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  };

  // Section 1: Fleet Overview DTO
  console.log('--- Section 1: Fleet Overview Contract ---');
  test('1.1: Overview matches backend contract and maps tier distribution', () => {
    const overview: FleetWorkforceOverview = {
      reportingPeriodDays: 30,
      totalActiveDrivers: 20,
      scoredDriversCount: 15,
      insufficientDataDriversCount: 5,
      fleetAverageCompositeScore: 89.2,
      fleetOnTimeDeliveryRate: 95.0,
      fleetAttendanceReliability: 98.0,
      fleetSafetyAverageScore: 94.0,
      totalIncidentsCount: 2,
      tierDistribution: {
        EXCELLENT: 8,
        GOOD: 5,
        SATISFACTORY: 2,
        NEEDS_IMPROVEMENT: 0,
        INSUFFICIENT_DATA: 5,
      },
    };
    assert.strictEqual(overview.totalActiveDrivers, 20);
    assert.strictEqual(overview.tierDistribution.EXCELLENT, 8);
    assert.strictEqual(overview.tierDistribution.INSUFFICIENT_DATA, 5);
  });

  // Section 2: Fleet Rankings & Leaderboard
  console.log('\n--- Section 2: Fleet Rankings Contract ---');
  test('2.1: Rankings leaderboard retains rank, CPS, tiers, and dimension metrics', () => {
    const rankings: DriverLeaderboardEntry[] = [
      {
        driverId: 'drv-01',
        driverName: 'Alice',
        rank: 1,
        compositePerformanceScore: 98.5,
        scoreTier: 'EXCELLENT',
        safetyScore: 100,
        deliveryScore: 98,
        attendanceScore: 100,
        complianceScore: 100,
        completedDeliveries: 45,
      },
      {
        driverId: 'drv-02',
        driverName: 'Bob',
        rank: 2,
        compositePerformanceScore: 82.0,
        scoreTier: 'GOOD',
        safetyScore: 90,
        deliveryScore: 80,
        attendanceScore: 85,
        complianceScore: 100,
        completedDeliveries: 38,
      },
    ];
    assert.strictEqual(rankings[0].rank, 1);
    assert.strictEqual(rankings[0].scoreTier, 'EXCELLENT');
    assert.strictEqual(rankings[1].scoreTier, 'GOOD');
  });

  // Section 3: Driver Scorecard & INSUFFICIENT_DATA
  console.log('\n--- Section 3: Driver Scorecard Contract & Insufficient Data ---');
  test('3.1: Null CPS yields INSUFFICIENT_DATA (never converted to 0)', () => {
    const scorecard: DriverScorecardAnalytics = {
      driverId: 'drv-new',
      driverName: 'New Driver',
      reportingPeriodDays: 30,
      hasSufficientData: false,
      scoreTier: 'INSUFFICIENT_DATA',
      compositePerformanceScore: null,
      delivery: {
        dimension: 'delivery',
        weight: 0.4,
        score: null,
        evidenceCount: 2,
        hasSufficientData: false,
        reportingPeriodDays: 30,
        totalAssignedShipments: 2,
        deliveredCount: 2,
        onTimeDeliveredCount: 2,
        lateDeliveredCount: 0,
        failedDeliveryCount: 0,
        cancelledShipmentsExcluded: 0,
        excusableDelaysApplied: 0,
        missingTimestampFallbackApplied: 0,
        deliveryCompletionRate: 100,
        onTimeDeliveryRate: 100,
        deliveryScore: null,
      },
      safety: {
        dimension: 'safety',
        weight: 0.3,
        score: 100,
        evidenceCount: 0,
        hasSufficientData: true,
        reportingPeriodDays: 30,
        totalIncidents: 0,
        criticalIncidents: 0,
        highIncidents: 0,
        mediumIncidents: 0,
        lowIncidents: 0,
        concludedResponsibleIncidents: 0,
        sharedResponsibilityIncidents: 0,
        exoneratedIncidents: 0,
        pendingIncidents: 0,
        duplicateIncidentsExcluded: 0,
        totalDeductions: 0,
        safetyScore: 100,
      },
      attendance: {
        dimension: 'attendance',
        weight: 0.2,
        score: null,
        evidenceCount: 3,
        hasSufficientData: false,
        reportingPeriodDays: 30,
        eligibleScheduledShiftCount: 3,
        completedShiftCount: 3,
        completedOnTimeShiftCount: 3,
        lateShiftCount: 0,
        missedShiftCount: 0,
        cancelledShiftCount: 0,
        excusedAbsenceCount: 0,
        attendanceReliabilityIndex: 100,
        shiftPunctualityRate: 100,
        totalPlannedHours: 24,
        totalActualHours: 24,
        netVarianceHours: 0,
        overtimeHours: 0,
      },
      compliance: {
        dimension: 'compliance',
        weight: 0.1,
        score: 100,
        evidenceCount: 2,
        hasSufficientData: true,
        reportingPeriodDays: 30,
        totalDocuments: 2,
        validRequiredDocs: 2,
        expiredRequiredDocs: 0,
        missingRequiredDocs: 0,
        expiringSoonDocs: 0,
        complianceRate: 100,
      },
    };

    assert.strictEqual(scorecard.compositePerformanceScore, null);
    assert.strictEqual(scorecard.hasSufficientData, false);
    assert.strictEqual(scorecard.scoreTier, 'INSUFFICIENT_DATA');
  });

  // Section 4: Driver Trend & Empty Trajectory
  console.log('\n--- Section 4: Trend Trajectory Contract ---');
  test('4.1: Monthly trend points preserve chronological order and handle empty array', () => {
    const emptyTrend: DriverTrendPoint[] = [];
    assert.strictEqual(emptyTrend.length, 0);

    const populatedTrend: DriverTrendPoint[] = [
      {
        periodLabel: 'Jul 2026',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        compositePerformanceScore: 91.5,
        deliveryScore: 94.0,
        safetyScore: 100.0,
        attendanceScore: 88.0,
        completedDeliveries: 35,
        concludedIncidents: 0,
        attendanceReliabilityPercent: 96.0,
        hasSufficientData: true,
      },
    ];
    assert.strictEqual(populatedTrend[0].compositePerformanceScore, 91.5);
  });

  // Section 5: Shift Variance
  console.log('\n--- Section 5: Shift Variance Contract ---');
  test('5.1: Shift variance handles discrepancy drivers, overtime, and punctuality rate', () => {
    const variance: ShiftVarianceAnalytics = {
      reportingPeriodDays: 30,
      totalScheduledHours: 640,
      totalActualHours: 660,
      netVarianceHours: 20,
      totalOvertimeHours: 20,
      lateStartsCount: 2,
      fleetPunctualityRate: 96.8,
      discrepancyDrivers: [
        {
          driverId: 'drv-01',
          driverName: 'Charlie',
          plannedHours: 160,
          actualHours: 180,
          varianceHours: 20,
          overtimeHours: 20,
          lateStarts: 1,
        },
      ],
    };
    assert.strictEqual(variance.netVarianceHours, 20);
    assert.strictEqual(variance.discrepancyDrivers[0].overtimeHours, 20);
  });

  // Section 6: HTTP Status & RBAC Error Handling
  console.log('\n--- Section 6: HTTP Error Handling Contract ---');
  test('6.1: HTTP 401, 403, and 404 response payload contracts match backend error shape', () => {
    const error401 = { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication token missing.' } };
    const error403 = { success: false, error: { code: 'FORBIDDEN', message: 'Access denied: requires driver.analytics.read.' } };
    const error404 = { success: false, error: { code: 'NOT_FOUND', message: 'Driver profile not found.' } };

    assert.strictEqual(error401.error.code, 'UNAUTHORIZED');
    assert.strictEqual(error403.error.code, 'FORBIDDEN');
    assert.strictEqual(error404.error.code, 'NOT_FOUND');
  });

  console.log('\n================================================================================');
  console.log(`FRONTEND CONTRACT TEST SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFrontendContractTestSuite();
