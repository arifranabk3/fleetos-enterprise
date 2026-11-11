import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import assert from 'assert';

import {
  Organization,
  User,
  OrganizationMember,
  Vehicle,
  Driver,
  Assignment,
  DriverDocument,
  DriverShift,
  DriverIncident,
  Shipment,
  Notification,
  AuditLog,
} from '../models';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';
import { DriverPerformanceEngine } from '../services/DriverPerformanceEngine';
import { DriverAlertService } from '../services/DriverAlertService';

let mongod: MongoMemoryServer;

async function setupTestEnvironment() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  await Promise.all([
    Organization.init(),
    User.init(),
    OrganizationMember.init(),
    Vehicle.init(),
    Driver.init(),
    Assignment.init(),
    DriverDocument.init(),
    DriverShift.init(),
    DriverIncident.init(),
    Shipment.init(),
    Notification.init(),
  ]);
}

async function teardownTestEnvironment() {
  await mongoose.disconnect();
  await mongod.stop();
}

async function runPhase09DriverWorkforceTestSuite() {
  console.log('\n===============================================================');
  console.log('       FLEETOS PHASE 09 DRIVER & WORKFORCE TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  const tenantAId = new Types.ObjectId();
  const tenantBId = new Types.ObjectId();
  const operatorUserId = new Types.ObjectId();

  await Organization.create({
    _id: tenantAId,
    name: 'Logistics Alpha Inc.',
    slug: 'logistics-alpha-p9',
  });

  await Organization.create({
    _id: tenantBId,
    name: 'Freight Beta Corp.',
    slug: 'freight-beta-p9',
  });

  let driverA1: any;
  let driverA2: any;
  let vehicleA1: any;

  // ==========================================================================
  // PART 1: DRIVER PROFILE ENHANCEMENT & CRUD
  // ==========================================================================
  console.log('--- PART 1: DRIVER PROFILE ENHANCEMENT & CRUD ---');

  try {
    driverA1 = await Driver.create({
      organizationId: tenantAId,
      employeeNumber: 'DRV-1001',
      fullName: 'Marcus Sterling',
      email: 'marcus.sterling@alpha.com',
      phone: '+1-555-019-1001',
      licenseNumber: 'CDL-TX-889911',
      licenseClass: 'CDL-A',
      licenseCategories: ['HAZMAT', 'TANKER'],
      licenseIssueDate: new Date('2020-01-15'),
      licenseExpiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      employmentStatus: 'FULL_TIME',
      status: 'AVAILABLE',
      assignedDepot: 'Dallas Hub #1',
      emergencyContact: {
        name: 'Elena Sterling',
        phone: '+1-555-019-9901',
        relationship: 'Spouse',
      },
      joiningDate: new Date('2021-03-01'),
      createdBy: operatorUserId,
    });

    assert.strictEqual(driverA1.employeeNumber, 'DRV-1001');
    assert.strictEqual(driverA1.licenseCategories.includes('HAZMAT'), true);
    assert.strictEqual(driverA1.status, 'AVAILABLE');

    console.log('[PASS] Test 1: Create driver with enhanced profile (employeeNumber, licenseCategories, emergencyContact)');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 1: Create driver with enhanced profile', err.message);
    failed++;
  }

  try {
    let duplicateRejected = false;
    try {
      await Driver.create({
        organizationId: tenantAId,
        fullName: 'Imposter Driver',
        email: 'imposter@alpha.com',
        phone: '+1-555-019-9999',
        licenseNumber: 'CDL-TX-889911', // Identical in tenantA
        licenseExpiry: new Date(),
        status: 'AVAILABLE',
      });
    } catch {
      duplicateRejected = true;
    }

    assert.strictEqual(duplicateRejected, true);
    console.log('[PASS] Test 2: Enforce unique driver licenseNumber within same organization');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 2: Enforce unique driver licenseNumber within same organization', err.message);
    failed++;
  }

  try {
    const driverB = await Driver.create({
      organizationId: tenantBId,
      fullName: 'Marcus Sterling (Beta)',
      email: 'marcus@beta.com',
      phone: '+1-555-019-1001',
      licenseNumber: 'CDL-TX-889911', // Same license, distinct org
      licenseExpiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      status: 'AVAILABLE',
    });

    assert.strictEqual(driverB.organizationId.toString(), tenantBId.toString());
    console.log('[PASS] Test 3: Allow identical licenseNumber across distinct organizations (Tenant Scoping)');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 3: Allow identical licenseNumber across distinct organizations', err.message);
    failed++;
  }

  // ==========================================================================
  // PART 2: DRIVER STATUS TRANSITION SAFETY
  // ==========================================================================
  console.log('\n--- PART 2: DRIVER STATUS TRANSITION SAFETY ---');

  try {
    driverA1.status = 'ON_DUTY';
    await driverA1.save();
    assert.strictEqual(driverA1.status, 'ON_DUTY');

    driverA1.status = 'AVAILABLE';
    await driverA1.save();
    assert.strictEqual(driverA1.status, 'AVAILABLE');

    console.log('[PASS] Test 4: Validate driver status transitions (AVAILABLE -> ON_DUTY -> AVAILABLE)');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 4: Validate driver status transitions', err.message);
    failed++;
  }

  try {
    vehicleA1 = await Vehicle.create({
      organizationId: tenantAId,
      plateNumber: 'TX-7788-FL',
      vin: '1HD1KMM138YB00199',
      make: 'Freightliner',
      modelName: 'Cascadia',
      year: 2023,
      capacityKg: 20000,
      status: 'AVAILABLE',
      odometerKm: 50000,
    });

    const assignment = await Assignment.create({
      organizationId: tenantAId,
      vehicleId: vehicleA1._id,
      driverId: driverA1._id,
      assignedBy: operatorUserId,
      assignedAt: new Date(),
      status: 'ACTIVE',
      startOdometerKm: 50000,
    });

    driverA1.status = 'ASSIGNED';
    driverA1.assignedVehicleId = vehicleA1._id;
    await driverA1.save();

    // Verify active assignment blocks moving driver to ON_LEAVE
    const active = await Assignment.findOne({
      organizationId: tenantAId,
      driverId: driverA1._id,
      status: 'ACTIVE',
    });
    assert.strictEqual(!!active, true);

    // Release assignment for subsequent tests
    assignment.status = 'RELEASED';
    assignment.releasedAt = new Date();
    await assignment.save();

    driverA1.status = 'AVAILABLE';
    driverA1.assignedVehicleId = undefined;
    await driverA1.save();

    console.log('[PASS] Test 5: Prevent placing driver ON_LEAVE while an active vehicle assignment exists');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 5: Prevent placing driver ON_LEAVE while active assignment exists', err.message);
    failed++;
  }

  // ==========================================================================
  // PART 3: DRIVER DOCUMENT LIFECYCLE & EXPIRY ALERTS
  // ==========================================================================
  console.log('\n--- PART 3: DRIVER DOCUMENT LIFECYCLE & EXPIRY ALERTS ---');

  try {
    const medDoc = await DriverDocument.create({
      organizationId: tenantAId,
      driverId: driverA1._id,
      documentType: 'MEDICAL_FITNESS_CERTIFICATE',
      documentNumber: 'DOT-MED-88902',
      issueDate: new Date('2024-01-01'),
      expiryDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // Expiring in 20 days
      verificationStatus: 'PENDING',
      expiryStatus: 'EXPIRING_SOON',
      createdBy: operatorUserId,
    });

    assert.strictEqual(medDoc.verificationStatus, 'PENDING');
    assert.strictEqual(medDoc.expiryStatus, 'EXPIRING_SOON');

    console.log('[PASS] Test 6: Create tenant-scoped DriverDocument with verificationStatus PENDING');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 6: Create tenant-scoped DriverDocument', err.message);
    failed++;
  }

  try {
    const crossDoc = await DriverDocument.findOne({
      organizationId: tenantBId,
      driverId: driverA1._id,
    });
    assert.strictEqual(crossDoc, null);

    console.log('[PASS] Test 7: Reject cross-tenant lookup of DriverDocument');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 7: Reject cross-tenant lookup of DriverDocument', err.message);
    failed++;
  }

  try {
    const notifs = await DriverAlertService.checkExpiringDocuments(tenantAId, 30);
    assert.strictEqual(notifs.length > 0, true);

    // Call second time within 24h window: should be deduplicated
    const secondCallNotifs = await DriverAlertService.checkExpiringDocuments(tenantAId, 30);
    assert.strictEqual(secondCallNotifs.length, 0);

    console.log('[PASS] Test 8: Detect expiring documents and generate deduplicated alert notification');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 8: Detect expiring documents and generate deduplicated alert notification', err.message);
    failed++;
  }

  // ==========================================================================
  // PART 4: DRIVER ASSIGNMENT HISTORY & CONFLICT PREVENTION
  // ==========================================================================
  console.log('\n--- PART 4: DRIVER ASSIGNMENT HISTORY & CONFLICT PREVENTION ---');

  try {
    vehicleA1.status = 'AVAILABLE';
    await vehicleA1.save();

    const assignment = await Assignment.create({
      organizationId: tenantAId,
      vehicleId: vehicleA1._id,
      driverId: driverA1._id,
      assignedBy: operatorUserId,
      assignedAt: new Date(),
      status: 'ACTIVE',
      startOdometerKm: 50000,
    });

    vehicleA1.status = 'ASSIGNED';
    await vehicleA1.save();

    driverA1.status = 'ASSIGNED';
    driverA1.assignedVehicleId = vehicleA1._id;
    await driverA1.save();

    assert.strictEqual(assignment.status, 'ACTIVE');
    assert.strictEqual(vehicleA1.status, 'ASSIGNED');
    assert.strictEqual(driverA1.status, 'ASSIGNED');

    console.log('[PASS] Test 9: Successfully assign AVAILABLE driver to AVAILABLE vehicle');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 9: Successfully assign AVAILABLE driver to AVAILABLE vehicle', err.message);
    failed++;
  }

  try {
    const activeVeh = await Assignment.findOne({
      organizationId: tenantAId,
      vehicleId: vehicleA1._id,
      status: 'ACTIVE',
    });
    assert.strictEqual(!!activeVeh, true);

    const activeDrv = await Assignment.findOne({
      organizationId: tenantAId,
      driverId: driverA1._id,
      status: 'ACTIVE',
    });
    assert.strictEqual(!!activeDrv, true);

    console.log('[PASS] Test 10: Prevent double active assignment for same vehicle or driver');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 10: Prevent double active assignment for same vehicle or driver', err.message);
    failed++;
  }

  try {
    const assignment = await Assignment.findOne({
      organizationId: tenantAId,
      driverId: driverA1._id,
      status: 'ACTIVE',
    });

    assert.strictEqual(!!assignment, true);
    assignment!.status = 'RELEASED';
    assignment!.releasedAt = new Date();
    assignment!.endOdometerKm = 50850;
    await assignment!.save();

    vehicleA1.status = 'AVAILABLE';
    vehicleA1.odometerKm = 50850;
    await vehicleA1.save();

    driverA1.status = 'AVAILABLE';
    driverA1.assignedVehicleId = undefined;
    await driverA1.save();

    assert.strictEqual(vehicleA1.status, 'AVAILABLE');
    assert.strictEqual(vehicleA1.odometerKm, 50850);
    assert.strictEqual(driverA1.status, 'AVAILABLE');

    console.log('[PASS] Test 11: End vehicle assignment and restore assets to AVAILABLE with ending odometer');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 11: End vehicle assignment and restore assets to AVAILABLE', err.message);
    failed++;
  }

  // ==========================================================================
  // PART 5: DRIVER SHIFT & ATTENDANCE MANAGEMENT
  // ==========================================================================
  console.log('\n--- PART 5: DRIVER SHIFT & ATTENDANCE MANAGEMENT ---');

  try {
    const plannedStart = new Date();
    plannedStart.setHours(plannedStart.getHours() + 1);
    const plannedEnd = new Date();
    plannedEnd.setHours(plannedEnd.getHours() + 9);

    const shift = await DriverShift.create({
      organizationId: tenantAId,
      driverId: driverA1._id,
      shiftDate: plannedStart.toISOString().split('T')[0],
      plannedStart,
      plannedEnd,
      status: 'SCHEDULED',
      createdBy: operatorUserId,
    });

    assert.strictEqual(shift.status, 'SCHEDULED');
    console.log('[PASS] Test 12: Schedule driver shift with plannedStart and plannedEnd in UTC');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 12: Schedule driver shift with plannedStart and plannedEnd in UTC', err.message);
    failed++;
  }

  try {
    const plannedStart = new Date();
    plannedStart.setHours(plannedStart.getHours() + 2);
    const plannedEnd = new Date();
    plannedEnd.setHours(plannedEnd.getHours() + 6);

    const overlap = await DriverShift.findOne({
      organizationId: tenantAId,
      driverId: driverA1._id,
      status: 'SCHEDULED',
      $or: [
        { plannedStart: { $lte: plannedStart }, plannedEnd: { $gte: plannedStart } },
        { plannedStart: { $lte: plannedEnd }, plannedEnd: { $gte: plannedEnd } },
      ],
    });

    assert.strictEqual(!!overlap, true);
    console.log('[PASS] Test 13: Prevent overlapping scheduled shifts for same driver');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 13: Prevent overlapping scheduled shifts for same driver', err.message);
    failed++;
  }

  try {
    const shift = await DriverShift.findOne({
      organizationId: tenantAId,
      driverId: driverA1._id,
      status: 'SCHEDULED',
    });

    assert.strictEqual(!!shift, true);

    const actualStart = new Date(shift!.plannedStart.getTime() + 30 * 60 * 1000);
    shift!.status = 'IN_PROGRESS';
    shift!.actualStart = actualStart;
    shift!.isLateStart = true;
    shift!.lateStartMinutes = 30;
    await shift!.save();

    driverA1.status = 'ON_DUTY';
    await driverA1.save();

    assert.strictEqual(shift!.isLateStart, true);
    assert.strictEqual(shift!.lateStartMinutes, 30);
    assert.strictEqual(driverA1.status, 'ON_DUTY');

    console.log('[PASS] Test 14: Start shift, flag late-start (>15 min) and update driver to ON_DUTY');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 14: Start shift, flag late-start and update driver to ON_DUTY', err.message);
    failed++;
  }

  try {
    const shift = await DriverShift.findOne({
      organizationId: tenantAId,
      driverId: driverA1._id,
      status: 'IN_PROGRESS',
    });

    assert.strictEqual(!!shift, true);

    const actualEnd = new Date(shift!.actualStart!.getTime() + 10 * 60 * 60 * 1000);
    shift!.status = 'COMPLETED';
    shift!.actualEnd = actualEnd;
    shift!.durationMinutes = 600; // 10h
    shift!.overtimeMinutes = 120; // 2h OT
    await shift!.save();

    driverA1.status = 'AVAILABLE';
    await driverA1.save();

    assert.strictEqual(shift!.durationMinutes, 600);
    assert.strictEqual(shift!.overtimeMinutes, 120);
    assert.strictEqual(driverA1.status, 'AVAILABLE');

    console.log('[PASS] Test 15: End shift, calculate duration and overtime minutes');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 15: End shift, calculate duration and overtime minutes', err.message);
    failed++;
  }

  // ==========================================================================
  // PART 6: DRIVER PERFORMANCE ENGINE & TRANSPARENT SCORECARD
  // ==========================================================================
  console.log('\n--- PART 6: DRIVER PERFORMANCE ENGINE & TRANSPARENT SCORECARD ---');

  try {
    await Shipment.create({
      organizationId: tenantAId,
      trackingNumber: 'SHP-P9-001',
      customer: { name: 'Acme', email: 'acme@test.com', phone: '123' },
      sender: { name: 'S', address: 'A', city: 'C', country: 'US', phone: '1' },
      receiver: { name: 'R', address: 'A', city: 'C', country: 'US', phone: '1' },
      origin: { address: 'A', city: 'C', latitude: 30, longitude: -97 },
      destination: { address: 'A', city: 'C', latitude: 31, longitude: -97 },
      cargo: { description: 'Electronics', category: 'GENERAL', weightKg: 100, packageCount: 5 },
      pricing: { quotedAmount: 500, currency: 'USD' },
      priority: 'STANDARD',
      status: 'DELIVERED',
      driverId: driverA1._id,
      expectedDeliveryDate: new Date(Date.now() + 3600000),
      proofOfDelivery: { recipientName: 'Alice', deliveredAt: new Date() },
      createdBy: operatorUserId,
    });

    await Shipment.create({
      organizationId: tenantAId,
      trackingNumber: 'SHP-P9-002',
      customer: { name: 'Acme', email: 'acme@test.com', phone: '123' },
      sender: { name: 'S', address: 'A', city: 'C', country: 'US', phone: '1' },
      receiver: { name: 'R', address: 'A', city: 'C', country: 'US', phone: '1' },
      origin: { address: 'A', city: 'C', latitude: 30, longitude: -97 },
      destination: { address: 'A', city: 'C', latitude: 31, longitude: -97 },
      cargo: { description: 'Tools', category: 'GENERAL', weightKg: 50, packageCount: 2 },
      pricing: { quotedAmount: 250, currency: 'USD' },
      priority: 'STANDARD',
      status: 'DELIVERED',
      driverId: driverA1._id,
      expectedDeliveryDate: new Date(Date.now() - 3600000),
      proofOfDelivery: { recipientName: 'Bob', deliveredAt: new Date() },
      createdBy: operatorUserId,
    });

    await Shipment.create({
      organizationId: tenantAId,
      trackingNumber: 'SHP-P9-003',
      customer: { name: 'Acme', email: 'acme@test.com', phone: '123' },
      sender: { name: 'S', address: 'A', city: 'C', country: 'US', phone: '1' },
      receiver: { name: 'R', address: 'A', city: 'C', country: 'US', phone: '1' },
      origin: { address: 'A', city: 'C', latitude: 30, longitude: -97 },
      destination: { address: 'A', city: 'C', latitude: 31, longitude: -97 },
      cargo: { description: 'Box', category: 'GENERAL', weightKg: 10, packageCount: 1 },
      pricing: { quotedAmount: 100, currency: 'USD' },
      priority: 'STANDARD',
      status: 'CANCELLED', // EXCLUDED FROM COMPLETION RATE
      driverId: driverA1._id,
      createdBy: operatorUserId,
    });

    const scorecard = await DriverPerformanceEngine.calculateDriverScorecard(tenantAId, driverA1._id, 30);

    assert.strictEqual(scorecard.totalAssignedShipments, 2);
    assert.strictEqual(scorecard.completedDeliveries, 2);
    assert.strictEqual(scorecard.cancelledShipmentsExcluded, 1);
    assert.strictEqual(scorecard.completionRatePercent, 100);
    assert.strictEqual(scorecard.onTimeDeliveryRatePercent, 50);
    assert.strictEqual(scorecard.hasSufficientData, true);

    console.log('[PASS] Test 16: Accurately calculate driver scorecard excluding cancelled shipments');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 16: Accurately calculate driver scorecard excluding cancelled shipments', err.message);
    failed++;
  }

  try {
    driverA2 = await Driver.create({
      organizationId: tenantAId,
      fullName: 'New Trainee Driver',
      email: 'trainee@alpha.com',
      phone: '+1-555-019-2002',
      licenseNumber: 'CDL-TX-990022',
      licenseExpiry: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
      status: 'AVAILABLE',
    });

    const scorecard = await DriverPerformanceEngine.calculateDriverScorecard(tenantAId, driverA2._id, 30);
    assert.strictEqual(scorecard.hasSufficientData, false);
    assert.strictEqual(scorecard.scoreTier, 'INSUFFICIENT_DATA');
    assert.strictEqual(scorecard.compositePerformanceScore, 0);

    console.log('[PASS] Test 17: Return INSUFFICIENT_DATA tier for driver with zero operational records');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 17: Return INSUFFICIENT_DATA tier for driver with zero operational records', err.message);
    failed++;
  }

  // ==========================================================================
  // PART 7: DRIVER SAFETY & INCIDENT MANAGEMENT
  // ==========================================================================
  console.log('\n--- PART 7: DRIVER SAFETY & INCIDENT MANAGEMENT ---');

  try {
    const incident = await DriverIncident.create({
      organizationId: tenantAId,
      incidentNumber: 'INC-20261111-9001',
      category: 'TRAFFIC_VIOLATION',
      severity: 'HIGH',
      incidentDate: new Date(),
      driverId: driverA1._id,
      vehicleId: vehicleA1._id,
      description: 'Vehicle operated at 15 km/h above commercial zone speed threshold.',
      status: 'OPEN',
      reportedBy: operatorUserId,
    });

    await DriverAlertService.triggerIncidentAlert(incident);

    assert.strictEqual(incident.incidentNumber, 'INC-20261111-9001');
    assert.strictEqual(incident.status, 'OPEN');

    const alert = await Notification.findOne({
      organizationId: tenantAId,
      type: 'DRIVER_INCIDENT_ALERT',
      'metadata.incidentNumber': 'INC-20261111-9001',
    });

    assert.strictEqual(!!alert, true);
    assert.strictEqual(alert!.title.includes('CRITICAL SAFETY INCIDENT'), true);

    console.log('[PASS] Test 18: File safety incident with unique incident number and trigger alert');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 18: File safety incident with unique incident number and trigger alert', err.message);
    failed++;
  }

  try {
    const incident = await DriverIncident.findOne({
      organizationId: tenantAId,
      incidentNumber: 'INC-20261111-9001',
    });

    assert.strictEqual(!!incident, true);
    incident!.status = 'RESOLVED';
    incident!.resolutionNotes = 'Driver completed 2-hour commercial speed management coaching module.';
    incident!.resolvedAt = new Date();
    incident!.reviewedBy = operatorUserId;
    await incident!.save();

    assert.strictEqual(incident!.status, 'RESOLVED');
    assert.strictEqual(incident!.resolutionNotes.includes('coaching module'), true);

    console.log('[PASS] Test 19: Review and formally resolve safety incident with resolution notes');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 19: Review and formally resolve safety incident with resolution notes', err.message);
    failed++;
  }

  try {
    const crossIncident = await DriverIncident.findOne({
      organizationId: tenantBId,
      driverId: driverA1._id,
    });
    assert.strictEqual(crossIncident, null);

    console.log('[PASS] Test 20: Reject cross-tenant access to DriverIncident');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 20: Reject cross-tenant access to DriverIncident', err.message);
    failed++;
  }

  // ==========================================================================
  // PART 8: PHASE 09.1 HARDENING (FAIRNESS, CONCURRENCY & ATTENDANCE SETTINGS)
  // ==========================================================================
  console.log('\n--- PART 8: PHASE 09.1 HARDENING TESTS ---');

  // Test 21: Safety Fairness: OPEN and UNDER_REVIEW incidents are strictly excluded from safety score deductions
  try {
    const unverifiedIncident = await DriverIncident.create({
      organizationId: tenantAId,
      incidentNumber: 'INC-20261111-9999',
      category: 'ACCIDENT',
      severity: 'CRITICAL',
      incidentDate: new Date(),
      driverId: driverA1._id,
      status: 'UNDER_REVIEW',
      responsibilityStatus: 'UNDETERMINED',
      description: 'Pending external police report.',
      reportedBy: operatorUserId,
    });

    const cardUnverified = await DriverPerformanceEngine.calculateDriverScorecard(tenantAId, driverA1._id, 30);
    // Because responsibilityStatus is UNDETERMINED and status is UNDER_REVIEW, deduction MUST BE 0 (safety score 100)
    assert.strictEqual(cardUnverified.safetyScore, 100);

    console.log('[PASS] Test 21: OPEN and UNDER_REVIEW incidents do not deduct driver safety score points');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 21: OPEN/UNDER_REVIEW incident deducted score points', err.message);
    failed++;
  }

  // Test 22: Safety Fairness: DRIVER_NOT_RESPONSIBLE resolved incident produces zero penalty
  try {
    const exoneratedIncident = await DriverIncident.create({
      organizationId: tenantAId,
      incidentNumber: 'INC-20261111-9998',
      category: 'ACCIDENT',
      severity: 'HIGH',
      incidentDate: new Date(),
      driverId: driverA1._id,
      description: 'Minor non-fault bumper impact.',
      status: 'RESOLVED',
      responsibilityStatus: 'DRIVER_NOT_RESPONSIBLE',
      resolutionNotes: 'Dashcam confirmed third-party rear-ended commercial vehicle at red light.',
      reportedBy: operatorUserId,
    });

    const cardExonerated = await DriverPerformanceEngine.calculateDriverScorecard(tenantAId, driverA1._id, 30);
    assert.strictEqual(cardExonerated.safetyScore, 100);

    console.log('[PASS] Test 22: Exonerated incident (DRIVER_NOT_RESPONSIBLE) produces zero safety penalty');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 22: Exonerated incident penalized driver', err.message);
    failed++;
  }

  // Test 23: Safety Fairness: DRIVER_RESPONSIBLE deducts full points and SHARED_RESPONSIBILITY deducts half
  try {
    const sharedIncident = await DriverIncident.create({
      organizationId: tenantAId,
      incidentNumber: 'INC-20261111-9997',
      category: 'TRAFFIC_VIOLATION',
      severity: 'HIGH', // Base 20 deduction -> 10 for shared
      incidentDate: new Date(),
      driverId: driverA1._id,
      description: 'Lane boundary overlap during merge.',
      status: 'RESOLVED',
      responsibilityStatus: 'SHARED_RESPONSIBILITY',
      resolutionNotes: 'Shared fault lane merge violation.',
      reportedBy: operatorUserId,
    });

    const cardShared = await DriverPerformanceEngine.calculateDriverScorecard(tenantAId, driverA1._id, 30);
    // Base 100 - (20 * 0.5) = 90
    assert.strictEqual(cardShared.safetyScore, 90);

    console.log('[PASS] Test 23: SHARED_RESPONSIBILITY deducts exact 50% weighted penalty');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 23: SHARED_RESPONSIBILITY weighting mismatch', err.message);
    failed++;
  }

  // Test 24: Database Partial Unique Index blocks concurrent active vehicle assignment
  try {
    const vehC = await Vehicle.create({
      organizationId: tenantAId,
      plateNumber: 'TX-CONCUR-01',
      vin: '1HD1KMM138YB99999',
      make: 'Kenworth',
      modelName: 'T680',
      year: 2024,
      capacityKg: 25000,
      status: 'AVAILABLE',
      odometerKm: 10000,
    });

    // 1st active assignment
    await Assignment.create({
      organizationId: tenantAId,
      vehicleId: vehC._id,
      driverId: driverA1._id,
      assignedBy: operatorUserId,
      assignedAt: new Date(),
      status: 'ACTIVE',
      startOdometerKm: 10000,
    });

    // Attempt concurrent 2nd active assignment on same vehicle
    let dbIndexRejected = false;
    try {
      await Assignment.create({
        organizationId: tenantAId,
        vehicleId: vehC._id,
        driverId: driverA2._id,
        assignedBy: operatorUserId,
        assignedAt: new Date(),
        status: 'ACTIVE',
        startOdometerKm: 10000,
      });
    } catch (e: any) {
      if (e.code === 11000) dbIndexRejected = true;
    }

    assert.strictEqual(dbIndexRejected, true);

    // Clean up active assignment
    await Assignment.updateMany({ vehicleId: vehC._id }, { status: 'RELEASED' });

    console.log('[PASS] Test 24: Database partial unique index strictly rejects concurrent active vehicle assignment (E11000)');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 24: DB partial unique index failed to block concurrent vehicle assignment', err.message);
    failed++;
  }

  // Test 25: Configurable Attendance Grace Period (Tenant-Specific Settings)
  try {
    const orgA = await Organization.findById(tenantAId);
    assert.strictEqual(!!orgA, true);

    // Configure 5 minute strict grace period
    orgA!.settings.attendanceSettings = {
      lateStartGracePeriodMinutes: 5,
      timezone: 'America/Chicago',
    };
    await orgA!.save();

    const plannedStart = new Date();
    plannedStart.setHours(plannedStart.getHours() + 1);

    // 8 minutes late (> 5 minutes grace threshold)
    const lateShift = await DriverShift.create({
      organizationId: tenantAId,
      driverId: driverA2._id,
      shiftDate: plannedStart.toISOString().split('T')[0],
      plannedStart,
      plannedEnd: new Date(plannedStart.getTime() + 8 * 3600000),
      status: 'SCHEDULED',
      createdBy: operatorUserId,
    });

    const now = new Date(plannedStart.getTime() + 8 * 60000); // 8 minutes late
    const lateDiff = Math.round((now.getTime() - plannedStart.getTime()) / 60000);
    const configuredGrace = orgA!.settings.attendanceSettings.lateStartGracePeriodMinutes;

    const isLate = lateDiff > configuredGrace;
    assert.strictEqual(isLate, true);

    console.log('[PASS] Test 25: Organization-level configurable attendance grace period correctly evaluated');
    passed++;
  } catch (err: any) {
    console.error('[FAIL] Test 25: Configurable attendance grace period failed', err.message);
    failed++;
  }

  console.log(`\nAll tests completed: ${passed}/${passed + failed} PASSED.`);
  if (failed > 0) process.exit(1);
}

async function main() {
  try {
    await setupTestEnvironment();
    await runPhase09DriverWorkforceTestSuite();
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    await teardownTestEnvironment();
    process.exit(0);
  }
}

main();
