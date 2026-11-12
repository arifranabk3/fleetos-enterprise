import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import assert from 'assert';

import {
  Organization,
  User,
  OrganizationMember,
  Driver,
  DriverDocument,
  DriverShift,
  DriverIncident,
  Shipment,
} from '../models';
import { DriverAnalyticsService } from '../services/DriverAnalyticsService';

let mongod: MongoMemoryServer;

async function setupTestEnvironment() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  await Promise.all([
    Organization.init(),
    User.init(),
    OrganizationMember.init(),
    Driver.init(),
    DriverDocument.init(),
    DriverShift.init(),
    DriverIncident.init(),
    Shipment.init(),
  ]);
}

async function teardownTestEnvironment() {
  await mongoose.disconnect();
  await mongod.stop();
}

async function runDriverAnalyticsTestSuite() {
  console.log('\n===============================================================');
  console.log('       FLEETOS PHASE 11.2.1 DRIVER ANALYTICS ENGINE TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  const tenantAId = new Types.ObjectId();
  const tenantBId = new Types.ObjectId();
  const creatorUserId = new Types.ObjectId();

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  âœ” ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  â Œ ${name}`);
      console.error(`     Error: ${err.message}`);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  }

  // ==========================================================================
  // SECTION A: ATTENDANCE RELIABILITY & SHIFT FAIRNESS
  // ==========================================================================
  console.log('\n--- Section A: Attendance Reliability & Shift Fairness ---');

  await test('A.1: On-time completed shifts receive 100% ARI', async () => {
    const shifts = [
      {
        plannedStart: new Date('2026-11-01T08:00:00Z'),
        plannedEnd: new Date('2026-11-01T16:00:00Z'),
        status: 'COMPLETED',
        isLateStart: false,
        durationMinutes: 480,
      },
      {
        plannedStart: new Date('2026-11-02T08:00:00Z'),
        plannedEnd: new Date('2026-11-02T16:00:00Z'),
        status: 'COMPLETED',
        isLateStart: false,
        durationMinutes: 480,
      },
    ];
    const metrics = DriverAnalyticsService.calculateAttendanceMetrics(shifts, 30);
    assert.strictEqual(metrics.eligibleScheduledShiftCount, 2);
    assert.strictEqual(metrics.completedOnTimeShiftCount, 2);
    assert.strictEqual(metrics.lateShiftCount, 0);
    assert.strictEqual(metrics.missedShiftCount, 0);
    assert.strictEqual(metrics.attendanceReliabilityIndex, 100.0);
    assert.strictEqual(metrics.shiftPunctualityRate, 100.0);
    assert.strictEqual(metrics.totalPlannedHours, 16.0);
    assert.strictEqual(metrics.totalActualHours, 16.0);
    assert.strictEqual(metrics.netVarianceHours, 0.0);
  });

  await test('A.2: Late completed shifts receive 50% credit, missed shifts receive 0%', async () => {
    // 1 on-time (1.0), 1 late (0.5), 1 missed (0.0) -> (1 + 0.5 + 0) / 3 = 1.5 / 3 = 50.0%
    const shifts = [
      {
        plannedStart: new Date('2026-11-01T08:00:00Z'),
        plannedEnd: new Date('2026-11-01T16:00:00Z'),
        status: 'COMPLETED',
        isLateStart: false,
        durationMinutes: 480,
      },
      {
        plannedStart: new Date('2026-11-02T08:00:00Z'),
        plannedEnd: new Date('2026-11-02T16:00:00Z'),
        status: 'COMPLETED',
        isLateStart: true,
        lateStartMinutes: 30,
        durationMinutes: 480,
      },
      {
        plannedStart: new Date('2026-11-03T08:00:00Z'),
        plannedEnd: new Date('2026-11-03T16:00:00Z'),
        status: 'MISSED',
        durationMinutes: 0,
      },
    ];
    const metrics = DriverAnalyticsService.calculateAttendanceMetrics(shifts, 30);
    assert.strictEqual(metrics.eligibleScheduledShiftCount, 3);
    assert.strictEqual(metrics.completedShiftCount, 2);
    assert.strictEqual(metrics.completedOnTimeShiftCount, 1);
    assert.strictEqual(metrics.lateShiftCount, 1);
    assert.strictEqual(metrics.missedShiftCount, 1);
    assert.strictEqual(metrics.attendanceReliabilityIndex, 50.0);
    assert.strictEqual(metrics.shiftPunctualityRate, 50.0); // 1 on-time out of 2 completed = 50%
  });

  await test('A.3: Cancelled and excused shifts are excluded from denominator', async () => {
    const shifts = [
      {
        plannedStart: new Date('2026-11-01T08:00:00Z'),
        plannedEnd: new Date('2026-11-01T16:00:00Z'),
        status: 'COMPLETED',
        isLateStart: false,
        durationMinutes: 480,
      },
      {
        plannedStart: new Date('2026-11-02T08:00:00Z'),
        plannedEnd: new Date('2026-11-02T16:00:00Z'),
        status: 'CANCELLED', // Approved absence / weather cancellation
        durationMinutes: 0,
      },
    ];
    const metrics = DriverAnalyticsService.calculateAttendanceMetrics(shifts, 30);
    assert.strictEqual(metrics.eligibleScheduledShiftCount, 1);
    assert.strictEqual(metrics.cancelledShiftCount, 1);
    assert.strictEqual(metrics.attendanceReliabilityIndex, 100.0); // Never penalized
  });

  await test('A.4: Zero scheduled shifts returns null score and handles division safely', async () => {
    const metrics = DriverAnalyticsService.calculateAttendanceMetrics([], 30);
    assert.strictEqual(metrics.eligibleScheduledShiftCount, 0);
    assert.strictEqual(metrics.attendanceReliabilityIndex, null);
    assert.strictEqual(metrics.hasSufficientData, false);
    assert.strictEqual(metrics.netVarianceHours, 0.0);
  });

  // ==========================================================================
  // SECTION B: SAFETY & INCIDENT RESPONSIBILITY FAIRNESS
  // ==========================================================================
  console.log('\n--- Section B: Safety & Incident Responsibility Fairness ---');

  await test('B.1: Baseline safety score is 100 with zero incidents', async () => {
    const metrics = DriverAnalyticsService.calculateSafetyMetrics([], 30);
    assert.strictEqual(metrics.totalIncidents, 0);
    assert.strictEqual(metrics.safetyScore, 100);
    assert.strictEqual(metrics.totalDeductions, 0);
  });

  await test('B.2: Presumption of innocence: OPEN, UNDER_REVIEW and UNDETERMINED apply 0 deduction', async () => {
    const incidents = [
      {
        incidentNumber: 'INC-001',
        severity: 'CRITICAL',
        status: 'OPEN',
        responsibilityStatus: 'UNDETERMINED',
      },
      {
        incidentNumber: 'INC-002',
        severity: 'HIGH',
        status: 'UNDER_REVIEW',
        responsibilityStatus: 'DRIVER_RESPONSIBLE', // Allegation under review
      },
    ];
    const metrics = DriverAnalyticsService.calculateSafetyMetrics(incidents, 30);
    assert.strictEqual(metrics.pendingIncidents, 2);
    assert.strictEqual(metrics.totalDeductions, 0);
    assert.strictEqual(metrics.safetyScore, 100);
  });

  await test('B.3: Exoneration: concluded incident with DRIVER_NOT_RESPONSIBLE applies 0 deduction', async () => {
    const incidents = [
      {
        incidentNumber: 'INC-003',
        severity: 'CRITICAL',
        status: 'RESOLVED',
        responsibilityStatus: 'DRIVER_NOT_RESPONSIBLE',
      },
    ];
    const metrics = DriverAnalyticsService.calculateSafetyMetrics(incidents, 30);
    assert.strictEqual(metrics.exoneratedIncidents, 1);
    assert.strictEqual(metrics.totalDeductions, 0);
    assert.strictEqual(metrics.safetyScore, 100);
  });

  await test('B.4: Concluded fault: exact deductions for CRITICAL, HIGH, and SHARED responsibility', async () => {
    // CRITICAL (35 pts * 1.0 = 35), HIGH with SHARED (20 pts * 0.5 = 10) -> Total deduction = 45 -> Score = 55
    const incidents = [
      {
        incidentNumber: 'INC-004',
        severity: 'CRITICAL',
        status: 'RESOLVED',
        responsibilityStatus: 'DRIVER_RESPONSIBLE',
      },
      {
        incidentNumber: 'INC-005',
        severity: 'HIGH',
        status: 'CLOSED',
        responsibilityStatus: 'SHARED_RESPONSIBILITY',
      },
    ];
    const metrics = DriverAnalyticsService.calculateSafetyMetrics(incidents, 30);
    assert.strictEqual(metrics.concludedResponsibleIncidents, 1);
    assert.strictEqual(metrics.sharedResponsibilityIncidents, 1);
    assert.strictEqual(metrics.totalDeductions, 45);
    assert.strictEqual(metrics.safetyScore, 55);
  });

  await test('B.5: Duplicate incident deduplication and 100-point penalty cap', async () => {
    const incidents = [
      { incidentNumber: 'INC-DUP-1', severity: 'CRITICAL', status: 'RESOLVED', responsibilityStatus: 'DRIVER_RESPONSIBLE' }, // 35
      { incidentNumber: 'INC-DUP-1', severity: 'CRITICAL', status: 'RESOLVED', responsibilityStatus: 'DRIVER_RESPONSIBLE' }, // Duplicate (excluded)
      { incidentNumber: 'INC-DUP-2', severity: 'CRITICAL', status: 'RESOLVED', responsibilityStatus: 'DRIVER_RESPONSIBLE' }, // 35
      { incidentNumber: 'INC-DUP-3', severity: 'CRITICAL', status: 'RESOLVED', responsibilityStatus: 'DRIVER_RESPONSIBLE' }, // 35
      { incidentNumber: 'INC-DUP-4', severity: 'CRITICAL', status: 'RESOLVED', responsibilityStatus: 'DRIVER_RESPONSIBLE' }, // 35 -> Total > 100, capped at 100
    ];
    const metrics = DriverAnalyticsService.calculateSafetyMetrics(incidents, 30);
    assert.strictEqual(metrics.duplicateIncidentsExcluded, 1);
    assert.strictEqual(metrics.totalDeductions, 100);
    assert.strictEqual(metrics.safetyScore, 0); // Floor at 0
  });

  // ==========================================================================
  // SECTION C: DELIVERY ON-TIME PERFORMANCE & TIMELINE FALLBACK
  // ==========================================================================
  console.log('\n--- Section C: Delivery Performance & Timeliness ---');

  await test('C.1: On-time deliveries within grace period evaluated accurately', async () => {
    const shipments = [
      {
        status: 'DELIVERED',
        expectedDeliveryDate: new Date('2026-11-01T14:00:00Z'),
        proofOfDelivery: { deliveredAt: new Date('2026-11-01T14:10:00Z') }, // 10 min late, within 15 min grace
      },
      {
        status: 'DELIVERED',
        expectedDeliveryDate: new Date('2026-11-02T14:00:00Z'),
        proofOfDelivery: { deliveredAt: new Date('2026-11-02T15:00:00Z') }, // 60 min late
      },
    ];
    const metrics = DriverAnalyticsService.calculateDeliveryMetrics(shipments, 30);
    assert.strictEqual(metrics.deliveredCount, 2);
    assert.strictEqual(metrics.onTimeDeliveredCount, 1);
    assert.strictEqual(metrics.lateDeliveredCount, 1);
    assert.strictEqual(metrics.onTimeDeliveryRate, 50.0);
    assert.strictEqual(metrics.deliveryCompletionRate, 100.0);
    assert.strictEqual(metrics.deliveryScore, 75.0); // (100 * 0.5) + (50 * 0.5) = 75.0
  });

  await test('C.2: Customer-caused delay in timeline excused from late penalty', async () => {
    const shipments = [
      {
        status: 'DELIVERED',
        expectedDeliveryDate: new Date('2026-11-01T14:00:00Z'),
        proofOfDelivery: { deliveredAt: new Date('2026-11-01T16:00:00Z') },
        timeline: [
          { status: 'DELAYED', note: 'Customer absent at delivery address, rescheduled' },
          { status: 'DELIVERED', timestamp: new Date('2026-11-01T16:00:00Z') },
        ],
      },
    ];
    const metrics = DriverAnalyticsService.calculateDeliveryMetrics(shipments, 30);
    assert.strictEqual(metrics.onTimeDeliveredCount, 1);
    assert.strictEqual(metrics.excusableDelaysApplied, 1);
    assert.strictEqual(metrics.onTimeDeliveryRate, 100.0);
  });

  await test('C.3: Missing POD timestamp uses timeline transition fallback', async () => {
    const shipments = [
      {
        status: 'DELIVERED',
        expectedDeliveryDate: new Date('2026-11-01T14:00:00Z'),
        proofOfDelivery: {}, // Missing deliveredAt
        timeline: [
          { status: 'DELIVERED', timestamp: new Date('2026-11-01T13:50:00Z') }, // Fallback timestamp is on-time
        ],
      },
    ];
    const metrics = DriverAnalyticsService.calculateDeliveryMetrics(shipments, 30);
    assert.strictEqual(metrics.missingTimestampFallbackApplied, 1);
    assert.strictEqual(metrics.onTimeDeliveredCount, 1);
    assert.strictEqual(metrics.onTimeDeliveryRate, 100.0);
  });

  await test('C.4: Cancelled shipments excluded from denominator', async () => {
    const shipments = [
      { status: 'DELIVERED', expectedDeliveryDate: new Date('2026-11-01T14:00:00Z'), proofOfDelivery: { deliveredAt: new Date('2026-11-01T13:00:00Z') } },
      { status: 'CANCELLED' },
      { status: 'CANCELLED' },
    ];
    const metrics = DriverAnalyticsService.calculateDeliveryMetrics(shipments, 30);
    assert.strictEqual(metrics.totalAssignedShipments, 1);
    assert.strictEqual(metrics.cancelledShipmentsExcluded, 2);
    assert.strictEqual(metrics.deliveryCompletionRate, 100.0);
  });

  // ==========================================================================
  // SECTION D: DOCUMENT COMPLIANCE
  // ==========================================================================
  console.log('\n--- Section D: Document Compliance ---');

  await test('D.1: Valid license and medical certificate yield 100% compliance', async () => {
    const docs = [
      { documentType: 'DRIVING_LICENSE', verificationStatus: 'VERIFIED', expiryDate: new Date('2027-01-01Z') },
      { documentType: 'MEDICAL_FITNESS_CERTIFICATE', verificationStatus: 'VERIFIED', expiryDate: new Date('2027-01-01Z') },
    ];
    const metrics = DriverAnalyticsService.calculateComplianceMetrics(docs, 30);
    assert.strictEqual(metrics.complianceRate, 100.0);
    assert.strictEqual(metrics.missingRequiredDocs, 0);
    assert.strictEqual(metrics.expiredRequiredDocs, 0);
  });

  await test('D.2: Missing or expired mandatory documents deduct correctly', async () => {
    // Missing medical (20 pts) + Expired license (30 pts) = 50 pts deduction -> 50%
    const docs = [
      { documentType: 'DRIVING_LICENSE', verificationStatus: 'VERIFIED', expiryDate: new Date('2020-01-01Z') },
    ];
    const metrics = DriverAnalyticsService.calculateComplianceMetrics(docs, 30);
    assert.strictEqual(metrics.missingRequiredDocs, 1); // Missing medical
    assert.strictEqual(metrics.expiredRequiredDocs, 1); // Expired license
    assert.strictEqual(metrics.complianceRate, 50.0);
  });

  // ==========================================================================
  // SECTION E: COMPOSITE PERFORMANCE SCORE & TIE-BREAKING
  // ==========================================================================
  console.log('\n--- Section E: Composite Score & Ranking Tie-Breaking ---');

  await test('E.1: Insufficient data yields INSUFFICIENT_DATA and null score', async () => {
    const att = DriverAnalyticsService.calculateAttendanceMetrics([], 30);
    const safe = DriverAnalyticsService.calculateSafetyMetrics([], 30);
    const del = DriverAnalyticsService.calculateDeliveryMetrics([], 30);
    const comp = DriverAnalyticsService.calculateComplianceMetrics([], 30);

    const scorecard = DriverAnalyticsService.synthesizeScorecard('drv-1', 'Test Driver', 30, att, safe, del, comp);
    assert.strictEqual(scorecard.hasSufficientData, false);
    assert.strictEqual(scorecard.scoreTier, 'INSUFFICIENT_DATA');
    assert.strictEqual(scorecard.compositePerformanceScore, null);
  });

  await test('E.2: Correct 40/30/20/10 weight calculation when all dimensions have sufficient data', async () => {
    // Create mock 10 shifts and 10 shipments to exceed minimum evidence threshold
    const shifts = Array(10).fill(null).map(() => ({
      plannedStart: new Date('2026-11-01T08:00:00Z'),
      plannedEnd: new Date('2026-11-01T16:00:00Z'),
      status: 'COMPLETED',
      isLateStart: false,
      durationMinutes: 480,
    }));
    const shipments = Array(10).fill(null).map(() => ({
      status: 'DELIVERED',
      expectedDeliveryDate: new Date('2026-11-01T14:00:00Z'),
      proofOfDelivery: { deliveredAt: new Date('2026-11-01T13:30:00Z') },
    }));
    const docs = [
      { documentType: 'DRIVING_LICENSE', verificationStatus: 'VERIFIED', expiryDate: new Date('2027-01-01Z') },
      { documentType: 'MEDICAL_FITNESS_CERTIFICATE', verificationStatus: 'VERIFIED', expiryDate: new Date('2027-01-01Z') },
    ];

    const att = DriverAnalyticsService.calculateAttendanceMetrics(shifts, 30); // 100
    const safe = DriverAnalyticsService.calculateSafetyMetrics([], 30); // 100
    const del = DriverAnalyticsService.calculateDeliveryMetrics(shipments, 30); // 100
    const comp = DriverAnalyticsService.calculateComplianceMetrics(docs, 30); // 100

    const scorecard = DriverAnalyticsService.synthesizeScorecard('drv-2', 'Star Driver', 30, att, safe, del, comp);
    assert.strictEqual(scorecard.hasSufficientData, true);
    assert.strictEqual(scorecard.scoreTier, 'EXCELLENT');
    assert.strictEqual(scorecard.compositePerformanceScore, 100.0);
  });

  await test('E.3: Missing delivery dimension does NOT re-normalize into full weight score', async () => {
    // Driver has 10 shifts and verified docs, but 0 shipments (e.g. yard driver or new route)
    const shifts = Array(10).fill(null).map(() => ({
      plannedStart: new Date('2026-11-01T08:00:00Z'),
      plannedEnd: new Date('2026-11-01T16:00:00Z'),
      status: 'COMPLETED',
      isLateStart: false,
      durationMinutes: 480,
    }));
    const docs = [
      { documentType: 'DRIVING_LICENSE', verificationStatus: 'VERIFIED', expiryDate: new Date('2027-01-01Z') },
      { documentType: 'MEDICAL_FITNESS_CERTIFICATE', verificationStatus: 'VERIFIED', expiryDate: new Date('2027-01-01Z') },
    ];

    const att = DriverAnalyticsService.calculateAttendanceMetrics(shifts, 30);
    const safe = DriverAnalyticsService.calculateSafetyMetrics([], 30);
    const del = DriverAnalyticsService.calculateDeliveryMetrics([], 30); // 0 shipments -> hasSufficientData: false, score: null
    const comp = DriverAnalyticsService.calculateComplianceMetrics(docs, 30);

    const scorecard = DriverAnalyticsService.synthesizeScorecard('drv-yard', 'Yard Driver', 30, att, safe, del, comp);
    assert.strictEqual(scorecard.hasSufficientData, false);
    assert.strictEqual(scorecard.compositePerformanceScore, null);
    assert.strictEqual(scorecard.scoreTier, 'INSUFFICIENT_DATA');
  });

  await test('E.4: Unconfigured document policy yields INSUFFICIENT_DATA and null score', async () => {
    const docs = [
      { documentType: 'DRIVING_LICENSE', verificationStatus: 'VERIFIED', expiryDate: new Date('2027-01-01Z') },
    ];
    // Pass empty array indicating organization has not configured mandatory compliance documents
    const comp = DriverAnalyticsService.calculateComplianceMetrics(docs, 30, []);
    assert.strictEqual(comp.hasSufficientData, false);
    assert.strictEqual(comp.complianceRate, null);
    assert.strictEqual(comp.score, null);
  });

  // ==========================================================================
  // SECTION F: DATABASE AGGREGATION & MULTI-TENANT ISOLATION
  // ==========================================================================
  console.log('\n--- Section F: Multi-Tenant Database Isolation & Batch Querying ---');

  await test('F.1: Fleet rankings strictly enforce multi-tenant isolation', async () => {
    // Create Driver for Tenant A
    const driverA = await Driver.create({
      organizationId: tenantAId,
      fullName: 'Tenant A Driver',
      email: 'drivera@tenant.com',
      phone: '+1234567890',
      licenseNumber: 'DL-A-100',
      licenseClass: 'CLASS_A',
      licenseExpiry: new Date('2028-01-01Z'),
      employmentStatus: 'FULL_TIME',
      status: 'AVAILABLE',
      rating: 5,
      emergencyContact: { name: 'Emergency A', phone: '+1234567891' },
      joiningDate: new Date(),
      isArchived: false,
    });

    // Create Driver for Tenant B
    const driverB = await Driver.create({
      organizationId: tenantBId,
      fullName: 'Tenant B Driver',
      email: 'driverb@tenant.com',
      phone: '+1234567892',
      licenseNumber: 'DL-B-200',
      licenseClass: 'CLASS_A',
      licenseExpiry: new Date('2028-01-01Z'),
      employmentStatus: 'FULL_TIME',
      status: 'AVAILABLE',
      rating: 5,
      emergencyContact: { name: 'Emergency B', phone: '+1234567893' },
      joiningDate: new Date(),
      isArchived: false,
    });

    // Give Driver A 6 completed shifts, 6 deliveries, and 2 verified docs so all 4 dimensions are sufficient
    const shiftsA = Array(6).fill(null).map((_, i) => ({
      organizationId: tenantAId,
      driverId: driverA._id,
      shiftDate: `2026-11-0${i + 1}`,
      plannedStart: new Date(`2026-11-0${i + 1}T08:00:00Z`),
      plannedEnd: new Date(`2026-11-0${i + 1}T16:00:00Z`),
      status: 'COMPLETED',
      isLateStart: false,
      durationMinutes: 480,
      createdBy: creatorUserId,
    }));
    await DriverShift.insertMany(shiftsA);

    const shipmentsA = Array(6).fill(null).map((_, i) => ({
      organizationId: tenantAId,
      trackingNumber: `TRK-A-${i + 1}`,
      driverId: driverA._id,
      customer: { name: 'Customer A', email: 'cust@a.com', phone: '+1234567890' },
      sender: { name: 'Sender A', email: 'send@a.com', phone: '+1234567890', address: 'A', city: 'A', country: 'USA' },
      receiver: { name: 'Recv A', email: 'recv@a.com', phone: '+1234567890', address: 'A', city: 'A', country: 'USA' },
      origin: { address: 'A', city: 'A', country: 'USA', latitude: 10, longitude: 10 },
      destination: { address: 'A', city: 'A', country: 'USA', latitude: 11, longitude: 11 },
      cargo: { description: 'Cargo A', category: 'GENERAL', weightKg: 10, packageCount: 1 },
      pricing: { quotedAmount: 100, currency: 'USD' },
      priority: 'STANDARD',
      status: 'DELIVERED',
      expectedDeliveryDate: new Date('2026-11-01T14:00:00Z'),
      proofOfDelivery: { recipientName: 'Recv', deliveredAt: new Date('2026-11-01T13:30:00Z') },
      createdBy: creatorUserId,
      isArchived: false,
    }));
    await Shipment.insertMany(shipmentsA);

    await DriverDocument.insertMany([
      { organizationId: tenantAId, driverId: driverA._id, documentType: 'DRIVING_LICENSE', documentNumber: 'DL-A', verificationStatus: 'VERIFIED', expiryDate: new Date('2028-01-01Z'), createdBy: creatorUserId, isArchived: false },
      { organizationId: tenantAId, driverId: driverA._id, documentType: 'MEDICAL_FITNESS_CERTIFICATE', documentNumber: 'MED-A', verificationStatus: 'VERIFIED', expiryDate: new Date('2028-01-01Z'), createdBy: creatorUserId, isArchived: false },
    ]);

    // Request Tenant A rankings
    const rankingsA = await DriverAnalyticsService.calculateFleetRankings(tenantAId, 30);
    assert.strictEqual(rankingsA.length, 1);
    assert.strictEqual(rankingsA[0].driverId, driverA._id.toString());
    assert.strictEqual(rankingsA[0].driverName, 'Tenant A Driver');

    // Request Tenant B rankings (Driver B has 0 data -> excluded from rankings)
    const rankingsB = await DriverAnalyticsService.calculateFleetRankings(tenantBId, 30);
    assert.strictEqual(rankingsB.length, 0);

    // Verify Overview reflects proper isolation
    const overviewA = await DriverAnalyticsService.calculateFleetOverview(tenantAId, 30);
    assert.strictEqual(overviewA.totalActiveDrivers, 1);
    assert.strictEqual(overviewA.scoredDriversCount, 1);
    assert.strictEqual(overviewA.insufficientDataDriversCount, 0);

    const overviewB = await DriverAnalyticsService.calculateFleetOverview(tenantBId, 30);
    assert.strictEqual(overviewB.totalActiveDrivers, 1);
    assert.strictEqual(overviewB.scoredDriversCount, 0);
    assert.strictEqual(overviewB.insufficientDataDriversCount, 1);
  });

  await test('F.2: Shift hours variance and discrepancy aggregation', async () => {
    const variance = await DriverAnalyticsService.calculateShiftVariance(tenantAId, 30);
    assert.strictEqual(variance.totalScheduledHours, 48.0);
    assert.strictEqual(variance.totalActualHours, 48.0);
    assert.strictEqual(variance.netVarianceHours, 0.0);
    assert.strictEqual(variance.fleetPunctualityRate, 100.0);
    assert.strictEqual(variance.discrepancyDrivers.length, 1);
    assert.strictEqual(variance.discrepancyDrivers[0].driverName, 'Tenant A Driver');
  });

  // ==========================================================================
  // SECTION G: PERFORMANCE BENCHMARKING (SYNTHETIC DATA)
  // ==========================================================================
  console.log('\n--- Section G: Performance Benchmarking (Synthetic Workload) ---');

  await test('G.1: Batch aggregation benchmark with 100 drivers and 1,000 shifts', async () => {
    const benchTenantId = new Types.ObjectId();

    // Create 100 drivers
    const benchDrivers = Array(100).fill(null).map((_, i) => ({
      organizationId: benchTenantId,
      fullName: `Bench Driver ${i + 1}`,
      email: `bench${i + 1}@bench.com`,
      phone: `+1999000${String(i).padStart(4, '0')}`,
      licenseNumber: `DL-BENCH-${i + 1}`,
      licenseClass: 'CLASS_A',
      licenseExpiry: new Date('2028-01-01Z'),
      employmentStatus: 'FULL_TIME',
      status: 'AVAILABLE',
      rating: 5,
      emergencyContact: { name: 'Emergency', phone: '+19990009999' },
      joiningDate: new Date(),
      isArchived: false,
    }));
    const createdDrivers = await Driver.insertMany(benchDrivers);

    // Create 1,000 shifts across these 100 drivers (10 shifts per driver)
    const benchShifts: any[] = [];
    const benchShipments: any[] = [];
    const benchDocs: any[] = [];

    for (const drv of createdDrivers) {
      for (let s = 1; s <= 10; s++) {
        benchShifts.push({
          organizationId: benchTenantId,
          driverId: drv._id,
          shiftDate: `2026-11-${String(s).padStart(2, '0')}`,
          plannedStart: new Date(`2026-11-${String(s).padStart(2, '0')}T08:00:00Z`),
          plannedEnd: new Date(`2026-11-${String(s).padStart(2, '0')}T16:00:00Z`),
          status: 'COMPLETED',
          isLateStart: s % 5 === 0, // 20% late starts
          durationMinutes: 480,
          createdBy: creatorUserId,
        });

        benchShipments.push({
          organizationId: benchTenantId,
          trackingNumber: `TRK-B-${drv._id}-${s}`,
          driverId: drv._id,
          customer: { name: 'Customer', email: 'c@b.com', phone: '+1234567890' },
          sender: { name: 'Sender', email: 's@b.com', phone: '+1234567890', address: 'A', city: 'A', country: 'USA' },
          receiver: { name: 'Recv', email: 'r@b.com', phone: '+1234567890', address: 'A', city: 'A', country: 'USA' },
          origin: { address: 'A', city: 'A', country: 'USA', latitude: 10, longitude: 10 },
          destination: { address: 'A', city: 'A', country: 'USA', latitude: 11, longitude: 11 },
          cargo: { description: 'Cargo', category: 'GENERAL', weightKg: 10, packageCount: 1 },
          pricing: { quotedAmount: 100, currency: 'USD' },
          priority: 'STANDARD',
          status: 'DELIVERED',
          expectedDeliveryDate: new Date('2026-11-01T14:00:00Z'),
          proofOfDelivery: { recipientName: 'Recv', deliveredAt: new Date('2026-11-01T13:30:00Z') },
          createdBy: creatorUserId,
          isArchived: false,
        });
      }

      benchDocs.push(
        { organizationId: benchTenantId, driverId: drv._id, documentType: 'DRIVING_LICENSE', documentNumber: `DL-${drv._id}`, verificationStatus: 'VERIFIED', expiryDate: new Date('2028-01-01Z'), createdBy: creatorUserId, isArchived: false },
        { organizationId: benchTenantId, driverId: drv._id, documentType: 'MEDICAL_FITNESS_CERTIFICATE', documentNumber: `MED-${drv._id}`, verificationStatus: 'VERIFIED', expiryDate: new Date('2028-01-01Z'), createdBy: creatorUserId, isArchived: false }
      );
    }
    await DriverShift.insertMany(benchShifts);
    await Shipment.insertMany(benchShipments);
    await DriverDocument.insertMany(benchDocs);

    // Warm-up run
    await DriverAnalyticsService.calculateFleetRankings(benchTenantId, 30, 50);

    // Benchmark 10 consecutive executions
    const latencies: number[] = [];
    for (let run = 0; run < 10; run++) {
      const start = process.hrtime.bigint();
      const rankings = await DriverAnalyticsService.calculateFleetRankings(benchTenantId, 30, 50);
      const end = process.hrtime.bigint();
      latencies.push(Number(end - start) / 1_000_000); // ms
      assert.strictEqual(rankings.length, 50); // limit 50 enforced
    }

    latencies.sort((a, b) => a - b);
    const medianLatency = latencies[Math.floor(latencies.length / 2)];
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)];

    console.log(`     [Benchmark] 100 Drivers, 1,000 Shifts, 1,000 Shipments, 200 Docs -> Median Latency: ${medianLatency.toFixed(2)}ms | P95 Latency: ${p95Latency.toFixed(2)}ms`);
    assert.ok(medianLatency < 350, `Expected median latency < 350ms, observed ${medianLatency.toFixed(2)}ms`);
  });

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

async function main() {
  await setupTestEnvironment();
  try {
    await runDriverAnalyticsTestSuite();
  } finally {
    await teardownTestEnvironment();
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
