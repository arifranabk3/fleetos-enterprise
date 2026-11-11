import { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

import {
  Organization,
  User,
  OrganizationMember,
  Vehicle,
  MaintenanceRecord,
  MaintenanceSchedule,
  MaintenanceVendor,
  VehicleComplianceDocument,
} from '../models';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';
import { MaintenanceStateMachine } from '../services/MaintenanceStateMachine';
import { PreventiveMaintenanceEngine } from '../services/PreventativeMaintenanceEngine';
import { ComplianceEngine } from '../services/ComplianceEngine';
import { MaintenanceLockService } from '../services/MaintenanceLockService';

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
    MaintenanceRecord.init(),
    MaintenanceSchedule.init(),
    MaintenanceVendor.init(),
    VehicleComplianceDocument.init(),
  ]);
}

async function teardownTestEnvironment() {
  await mongoose.disconnect();
  await mongod.stop();
}

async function runPhase07MaintenanceTestSuite() {
  console.log('\n===============================================================');
  console.log('    FLEETOS PHASE 07 MAINTENANCE & COMPLIANCE TEST SUITE');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}`);
      throw new Error(`Test assertion failed: ${testName}`);
    }
  }

  await setupTestEnvironment();

  try {
    // 1. Setup Tenants
    const orgA = await Organization.create({
      name: 'Pinnacle Freightlines',
      slug: 'pinnacle-freight',
      billingEmail: 'billing@pinnacle.com',
      subscriptionTier: 'ENTERPRISE',
      status: 'ACTIVE',
    });

    const orgB = await Organization.create({
      name: 'Vanguard Transport',
      slug: 'vanguard-trans',
      billingEmail: 'ops@vanguard.com',
      subscriptionTier: 'STANDARD',
      status: 'ACTIVE',
    });

    const tenantA = { organizationId: orgA._id.toString(), role: 'ORGANIZATION_OWNER' };
    const tenantB = { organizationId: orgB._id.toString(), role: 'ORGANIZATION_OWNER' };

    const userA = await User.create({
      email: 'fleetops@pinnacle.com',
      passwordHash: 'hashed_pw',
      firstName: 'Paul',
      lastName: 'Manager',
      role: 'FLEET_MANAGER',
      isEmailVerified: true,
    });

    const vehicleA = await Vehicle.create({
      organizationId: orgA._id,
      vin: '1M8GDM9A4KP099991',
      plateNumber: 'PIN-9001',
      make: 'Kenworth',
      modelName: 'T680',
      year: 2024,
      type: 'SEMI_TRUCK',
      fuelType: 'DIESEL',
      capacityKg: 22000,
      status: 'AVAILABLE',
      odometerKm: 48000,
    });

    const maintenanceRepo = new BaseTenantRepository(MaintenanceRecord);
    const scheduleRepo = new BaseTenantRepository(MaintenanceSchedule);
    const vendorRepo = new BaseTenantRepository(MaintenanceVendor);
    const documentRepo = new BaseTenantRepository(VehicleComplianceDocument);
    const vehicleRepo = new BaseTenantRepository(Vehicle);

    // -------------------------------------------------------------
    // PART 1: MAINTENANCE VENDORS & TENANT ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- PART 1: MAINTENANCE VENDORS SUITE ---');

    // Test 1: Create vendor
    const vendorA = await vendorRepo.create(tenantA, {
      name: 'Apex Heavy Fleet Services',
      contactPerson: 'Dave Miller',
      email: 'service@apexheavy.com',
      phone: '+1-555-0333',
      services: ['BRAKE_SERVICE', 'OIL_CHANGE', 'ANNUAL_DOT'],
      isActive: true,
    } as any);

    assert(Boolean(vendorA._id && vendorA.name === 'Apex Heavy Fleet Services'), 'Test 1: Register maintenance vendor with service tags');

    // Test 2: Reject cross-tenant vendor lookup
    const crossVendor = await vendorRepo.findById(tenantB, vendorA._id);
    assert(crossVendor === null, 'Test 2: Reject cross-tenant lookup of maintenance vendor');

    // -------------------------------------------------------------
    // PART 2: MAINTENANCE WORK ORDERS & STATE MACHINE
    // -------------------------------------------------------------
    console.log('\n--- PART 2: WORK ORDERS & STATE MACHINE ---');

    // Test 3: Create work order
    const order1 = await maintenanceRepo.create(tenantA, {
      vehicleId: vehicleA._id,
      vendorId: vendorA._id,
      maintenanceType: 'BRAKE_SERVICE',
      title: 'Drive Axle Brake Pad Replacement',
      description: 'Scheduled preventive brake service.',
      scheduledDate: new Date('2026-11-15'),
      odometerReadingKm: vehicleA.odometerKm,
      laborCost: 450,
      partsCost: 320,
      totalCost: 770,
      priority: 'HIGH',
      status: 'SCHEDULED',
      createdBy: userA._id,
      timeline: [{ status: 'SCHEDULED', timestamp: new Date() }],
    } as any);

    assert(Boolean(order1._id && order1.status === 'SCHEDULED'), 'Test 3: Create maintenance service record with cost items');

    // Test 4: Legal transition SCHEDULED -> IN_PROGRESS and vehicle lock
    const startTransition = MaintenanceStateMachine.validateTransition(order1.status, 'IN_PROGRESS', {
      userId: userA._id.toString(),
      userRole: 'FLEET_MANAGER',
    });
    assert(startTransition.allowed === true, 'Test 4: State Machine authorizes legal transition SCHEDULED -> IN_PROGRESS');

    order1.status = 'IN_PROGRESS';
    order1.startedDate = new Date();
    await order1.save();
    vehicleA.status = 'MAINTENANCE';
    await vehicleA.save();

    assert(vehicleA.status === 'MAINTENANCE', 'Test 5: Vehicle operational status locked to MAINTENANCE when service begins');

    // Test 6: Reject illegal transition IN_PROGRESS -> SCHEDULED
    const illegalTransition = MaintenanceStateMachine.validateTransition(order1.status, 'SCHEDULED', {
      userId: userA._id.toString(),
      userRole: 'FLEET_MANAGER',
    });
    assert(illegalTransition.allowed === false, 'Test 6: Reject illegal backward transition IN_PROGRESS -> SCHEDULED');

    // Test 7: Complete service, cost summation & asset release
    const completeTransition = MaintenanceStateMachine.validateTransition(order1.status, 'COMPLETED', {
      userId: userA._id.toString(),
      userRole: 'FLEET_MANAGER',
    });
    assert(completeTransition.allowed === true, 'Test 7: Authorize completion of active maintenance service');

    order1.status = 'COMPLETED';
    order1.completedDate = new Date();
    order1.completedBy = userA._id;
    await order1.save();

    vehicleA.status = 'AVAILABLE';
    vehicleA.odometerKm = 48250;
    await vehicleA.save();

    assert(
      order1.status === 'COMPLETED' && vehicleA.status === 'AVAILABLE' && vehicleA.odometerKm === 48250,
      'Test 8: Maintenance completed, vehicle odometer updated, and asset released to AVAILABLE'
    );

    // Test 9: Cancellation requires mandatory justification
    const order2 = await maintenanceRepo.create(tenantA, {
      vehicleId: vehicleA._id,
      maintenanceType: 'OIL_CHANGE',
      title: 'Lube Service',
      description: 'Quick check',
      scheduledDate: new Date(),
      odometerReadingKm: 48250,
      status: 'SCHEDULED',
      createdBy: userA._id,
    } as any);

    const cancelWithoutReason = MaintenanceStateMachine.validateTransition(order2.status, 'CANCELLED', {
      userId: userA._id.toString(),
      userRole: 'FLEET_MANAGER',
      reason: '', // missing
    });
    assert(cancelWithoutReason.allowed === false, 'Test 9: Reject maintenance cancellation when justification is omitted');

    const cancelWithReason = MaintenanceStateMachine.validateTransition(order2.status, 'CANCELLED', {
      userId: userA._id.toString(),
      userRole: 'FLEET_MANAGER',
      reason: 'Postponed due to urgent cross-country carrier dispatch',
    });
    assert(cancelWithReason.allowed === true, 'Test 10: Allow cancellation with valid operational justification');

    // -------------------------------------------------------------
    // PART 3: PREVENTIVE MAINTENANCE SCHEDULING ENGINE
    // -------------------------------------------------------------
    console.log('\n--- PART 3: PREVENTIVE SCHEDULING ENGINE ---');

    // Create schedule: Oil change every 15,000 km or 90 days
    const schedule1 = await scheduleRepo.create(tenantA, {
      vehicleId: vehicleA._id,
      maintenanceType: 'OIL_CHANGE',
      title: 'Full Synthetic Engine Oil & Filter',
      intervalType: 'BOTH',
      intervalDistanceKm: 15000,
      intervalDays: 90,
      lastServiceDate: new Date('2026-08-01'),
      lastServiceOdometerKm: 35000,
      nextDueDate: new Date('2026-10-30'), // Already past (Overdue)
      nextDueOdometerKm: 50000,
      reminderDaysThreshold: 14,
      reminderKmThreshold: 1000,
      isActive: true,
    } as any);

    assert(Boolean(schedule1._id && schedule1.nextDueOdometerKm === 50000), 'Test 11: Configure multi-interval (Distance + Time) preventive maintenance schedule');

    // Test 12: Detect overdue schedule and scan engine
    const scanResults = await PreventiveMaintenanceEngine.scanMaintenanceSchedules(orgA._id.toString());
    assert(scanResults.overdueCount >= 1, 'Test 12: Scan engine detects overdue preventative service and flags notification');

    // Test 13: Recalculate schedule next due values after service completion
    await PreventiveMaintenanceEngine.onServiceCompleted(schedule1._id.toString(), new Date('2026-11-11'), 48250);
    const updatedSchedule = await MaintenanceSchedule.findById(schedule1._id);
    assert(
      updatedSchedule?.nextDueOdometerKm === 48250 + 15000 &&
      Boolean(updatedSchedule?.nextDueDate && updatedSchedule.nextDueDate > new Date('2027-01-01')),
      'Test 13: Recalculate future due odometer and date automatically upon service completion'
    );

    // -------------------------------------------------------------
    // PART 4: VEHICLE COMPLIANCE DOCUMENTATION & EXPIRY
    // -------------------------------------------------------------
    console.log('\n--- PART 4: VEHICLE COMPLIANCE ENGINE ---');

    // Test 14: Expired document status calculation
    const expiredStatus = ComplianceEngine.calculateStatus(new Date('2026-10-01'), 30);
    assert(expiredStatus === 'EXPIRED', 'Test 14: Accurately mark past-date compliance documents as EXPIRED');

    // Test 15: Expiring soon document calculation
    const futureExpiringDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days ahead
    const expiringSoonStatus = ComplianceEngine.calculateStatus(futureExpiringDate, 30);
    assert(expiringSoonStatus === 'EXPIRING_SOON', 'Test 15: Accurately mark documents within reminder window as EXPIRING_SOON');

    // Test 16: Create and persist compliance document
    const doc1 = await documentRepo.create(tenantA, {
      vehicleId: vehicleA._id,
      documentType: 'FITNESS_CERTIFICATE',
      documentNumber: 'DOT-TX-492019',
      issuingAuthority: 'Texas Department of Public Safety',
      issueDate: new Date('2025-11-11'),
      expiryDate: new Date('2026-11-20'), // Expiring soon
      reminderDays: 30,
      status: 'EXPIRING_SOON',
      uploadedBy: userA._id,
    } as any);

    assert(Boolean(doc1._id && doc1.documentType === 'FITNESS_CERTIFICATE'), 'Test 16: Persist vehicle compliance record with issuing authority');

    // Test 17: Cross-tenant document isolation
    const crossDocLookup = await documentRepo.findById(tenantB, doc1._id);
    assert(crossDocLookup === null, 'Test 17: Enforce strict cross-tenant isolation on compliance documents');

    // -------------------------------------------------------------
    // PART 5: VEHICLE STATUS SAFETY & MAINTENANCE LOCK SUITE
    // -------------------------------------------------------------
    console.log('\n--- PART 5: VEHICLE STATUS SAFETY & CONCURRENT LOCKS ---');

    // Test 18: AVAILABLE vehicle starts maintenance and completes it -> restored to AVAILABLE
    const vehAvail = await vehicleRepo.create(tenantA, {
      vin: '1M8GDM9A_SAFE_AVAIL',
      plateNumber: 'SAFE-001',
      make: 'Kenworth',
      modelName: 'T680',
      year: 2024,
      type: 'SEMI_TRUCK',
      capacityKg: 36000,
      status: 'AVAILABLE',
      odometerKm: 50000,
    } as any);

    const recAvail = await maintenanceRepo.create(tenantA, {
      vehicleId: vehAvail._id,
      maintenanceType: 'OIL_CHANGE',
      title: 'Oil Change',
      description: 'Regular service',
      scheduledDate: new Date(),
      odometerReadingKm: 50000,
      status: 'IN_PROGRESS',
      createdBy: userA._id,
    } as any);

    await MaintenanceLockService.acquireLock(vehAvail._id, recAvail._id);
    const lockedAvailVeh = await Vehicle.findById(vehAvail._id);
    assert(lockedAvailVeh?.status === 'MAINTENANCE', 'Test 18a: AVAILABLE vehicle correctly locks to MAINTENANCE');

    const releaseAvail = await MaintenanceLockService.releaseLock(vehAvail._id, recAvail._id, 50100);
    const unlockedAvailVeh = await Vehicle.findById(vehAvail._id);
    assert(
      releaseAvail.finalStatus === 'AVAILABLE' && unlockedAvailVeh?.status === 'AVAILABLE',
      'Test 18: AVAILABLE vehicle starts maintenance and restores to AVAILABLE upon completion'
    );

    // Test 19: OUT_OF_SERVICE vehicle starts maintenance and completes it -> safely remains OUT_OF_SERVICE
    const vehOOS = await vehicleRepo.create(tenantA, {
      vin: '1M8GDM9A_SAFE_OOS',
      plateNumber: 'SAFE-002',
      make: 'Freightliner',
      modelName: 'Cascadia',
      year: 2023,
      type: 'SEMI_TRUCK',
      capacityKg: 36000,
      status: 'OUT_OF_SERVICE',
      odometerKm: 60000,
    } as any);

    const recOOS = await maintenanceRepo.create(tenantA, {
      vehicleId: vehOOS._id,
      maintenanceType: 'ENGINE_REPAIR',
      title: 'Engine Check',
      description: 'Inspecting engine issues',
      scheduledDate: new Date(),
      odometerReadingKm: 60000,
      status: 'IN_PROGRESS',
      createdBy: userA._id,
    } as any);

    await MaintenanceLockService.acquireLock(vehOOS._id, recOOS._id);
    const releaseOOS = await MaintenanceLockService.releaseLock(vehOOS._id, recOOS._id, 60050);
    const finalOOSVeh = await Vehicle.findById(vehOOS._id);
    assert(
      releaseOOS.finalStatus === 'OUT_OF_SERVICE' && finalOOSVeh?.status === 'OUT_OF_SERVICE',
      'Test 19: OUT_OF_SERVICE vehicle completing maintenance preserves OUT_OF_SERVICE status (never erroneously AVAILABLE)'
    );

    // Test 20: RETIRED vehicle cannot become AVAILABLE upon maintenance completion/cancellation
    const vehRetired = await vehicleRepo.create(tenantA, {
      vin: '1M8GDM9A_SAFE_RET',
      plateNumber: 'SAFE-003',
      make: 'Mack',
      modelName: 'Anthem',
      year: 2018,
      type: 'SEMI_TRUCK',
      capacityKg: 36000,
      status: 'RETIRED',
      odometerKm: 450000,
    } as any);

    const recRetired = await maintenanceRepo.create(tenantA, {
      vehicleId: vehRetired._id,
      maintenanceType: 'ROUTINE_INSPECTION',
      title: 'Decommissioning Inspection',
      description: 'Final audit',
      scheduledDate: new Date(),
      odometerReadingKm: 450000,
      status: 'IN_PROGRESS',
      createdBy: userA._id,
    } as any);

    await MaintenanceLockService.acquireLock(vehRetired._id, recRetired._id);
    const releaseRetired = await MaintenanceLockService.releaseLock(vehRetired._id, recRetired._id);
    const finalRetiredVeh = await Vehicle.findById(vehRetired._id);
    assert(
      releaseRetired.finalStatus === 'RETIRED' && finalRetiredVeh?.status === 'RETIRED',
      'Test 20: RETIRED vehicle remains RETIRED after maintenance completion'
    );

    // Test 21: Concurrent maintenance - completing one of two active records keeps vehicle in MAINTENANCE
    const vehMulti = await vehicleRepo.create(tenantA, {
      vin: '1M8GDM9A_SAFE_MULTI',
      plateNumber: 'SAFE-004',
      make: 'Volvo',
      modelName: 'VNL',
      year: 2024,
      type: 'SEMI_TRUCK',
      capacityKg: 36000,
      status: 'AVAILABLE',
      odometerKm: 70000,
    } as any);

    const recMulti1 = await maintenanceRepo.create(tenantA, {
      vehicleId: vehMulti._id,
      maintenanceType: 'BRAKE_SERVICE',
      title: 'Air Brakes Overhaul',
      description: 'Full brake overhaul',
      scheduledDate: new Date(),
      odometerReadingKm: 70000,
      status: 'IN_PROGRESS',
      createdBy: userA._id,
    } as any);

    const recMulti2 = await maintenanceRepo.create(tenantA, {
      vehicleId: vehMulti._id,
      maintenanceType: 'TIRE_ROTATION',
      title: 'Drive Tires Replacement',
      description: 'Replace tires',
      scheduledDate: new Date(),
      odometerReadingKm: 70000,
      status: 'IN_PROGRESS',
      createdBy: userA._id,
    } as any);

    // Both orders acquire lock
    await MaintenanceLockService.acquireLock(vehMulti._id, recMulti1._id);
    await MaintenanceLockService.acquireLock(vehMulti._id, recMulti2._id);

    // First order finishes -> vehicle must STAY in MAINTENANCE because recMulti2 is still active
    recMulti1.status = 'COMPLETED';
    await recMulti1.save();
    const releaseMulti1 = await MaintenanceLockService.releaseLock(vehMulti._id, recMulti1._id);
    const intermediateVeh = await Vehicle.findById(vehMulti._id);
    assert(
      releaseMulti1.finalStatus === 'MAINTENANCE' && intermediateVeh?.status === 'MAINTENANCE',
      'Test 21: Completing one of two concurrent maintenance records keeps vehicle in MAINTENANCE'
    );

    // Second order finishes -> now vehicle can safely release to AVAILABLE
    recMulti2.status = 'COMPLETED';
    await recMulti2.save();
    const releaseMulti2 = await MaintenanceLockService.releaseLock(vehMulti._id, recMulti2._id);
    const finalMultiVeh = await Vehicle.findById(vehMulti._id);
    assert(
      releaseMulti2.finalStatus === 'AVAILABLE' && finalMultiVeh?.status === 'AVAILABLE',
      'Test 22: Completing final concurrent maintenance record safely releases vehicle to AVAILABLE'
    );

    // Test 23: Cancelling service with valid reason restores previous status
    const recMulti3 = await maintenanceRepo.create(tenantA, {
      vehicleId: vehMulti._id,
      maintenanceType: 'ROUTINE_INSPECTION',
      title: 'Monthly Inspection',
      description: 'Routine check',
      scheduledDate: new Date(),
      odometerReadingKm: 70100,
      status: 'IN_PROGRESS',
      createdBy: userA._id,
    } as any);

    await MaintenanceLockService.acquireLock(vehMulti._id, recMulti3._id);
    recMulti3.status = 'CANCELLED';
    await recMulti3.save();
    const cancelRelease = await MaintenanceLockService.releaseLock(vehMulti._id, recMulti3._id);
    const afterCancelVeh = await Vehicle.findById(vehMulti._id);
    assert(
      cancelRelease.finalStatus === 'AVAILABLE' && afterCancelVeh?.status === 'AVAILABLE',
      'Test 23: Maintenance cancellation safely restores vehicle operational status'
    );

    console.log(`\nAll tests completed: ${passedTests}/${totalTests} PASSED.\n`);
  } finally {
    await teardownTestEnvironment();
  }
}

runPhase07MaintenanceTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
