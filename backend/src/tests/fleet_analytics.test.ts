import assert from 'assert';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { TelemetryIntervalService, RawTelemetryPoint } from '../services/TelemetryIntervalService';
import { MaintenanceDowntimeCalculator, RawMaintenanceSpan } from '../services/MaintenanceDowntimeCalculator';
import { FleetAnalyticsService } from '../services/FleetAnalyticsService';
import { Vehicle } from '../models/Vehicle';
import { TelemetryEvent } from '../models/TelemetryEvent';
import { MaintenanceRecord } from '../models/MaintenanceRecord';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { OrganizationMember } from '../models/OrganizationMember';
import { createApp } from '../app';
import { generateAccessToken } from '../utils/token';
import { testHttpRequest } from './testHttpHelper';
import http from 'http';

let mongod: MongoMemoryServer;
let serverInstance: http.Server;

async function setupDatabase() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  const { server } = createApp();
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      serverInstance = server;
      resolve();
    });
  });
}

async function teardownDatabase() {
  if (serverInstance) {
    await new Promise<void>((resolve) => serverInstance.close(() => resolve()));
  }
  await mongoose.disconnect();
  await mongod.stop();
}

async function runFleetAnalyticsTests() {
  console.log('================================================================================');
  console.log('       FLEETOS PHASE 11.1 FLEET & TELEMETRY INTELLIGENCE TEST SUITE       ');
  console.log('================================================================================\n');

  await setupDatabase();

  let testCount = 0;

  try {
    // --------------------------------------------------------------------------
    // PART 1: UNIT TESTS — TELEMETRY INTERVAL ENGINE
    // --------------------------------------------------------------------------
    console.log('--- PART 1: TELEMETRY INTERVAL ENGINE (PURE CALCULATION) ---');

    // Test 1: Complete moving telemetry
    {
      const start = new Date('2026-11-01T08:00:00Z');
      const end = new Date('2026-11-01T10:00:00Z'); // 2 hours = 7200 seconds
      const events: RawTelemetryPoint[] = [
        { recordedAt: new Date('2026-11-01T08:00:00Z'), motionStatus: 'MOVING' },
        { recordedAt: new Date('2026-11-01T08:04:00Z'), motionStatus: 'MOVING' },
        { recordedAt: new Date('2026-11-01T08:08:00Z'), motionStatus: 'MOVING' },
      ];
      // 3 events 4 minutes apart. Final event extends up to 5 mins (300s).
      // Total span: 240 + 240 + 300 = 780s moving. Remaining to 7200 is unknown.
      const res = TelemetryIntervalService.calculateMotionIntervals(events, start, end, 300);
      assert.strictEqual(res.movingSeconds, 780);
      assert.strictEqual(res.idleSeconds, 0);
      assert.strictEqual(res.stoppedSeconds, 0);
      assert.strictEqual(res.unknownSeconds, 7200 - 780);
      testCount++;
      console.log(`[PASS] Test ${testCount}: TelemetryIntervalService calculates moving intervals without assumptions.`);
    }

    // Test 2: Out of order and duplicate events
    {
      const start = new Date('2026-11-01T00:00:00Z');
      const end = new Date('2026-11-01T01:00:00Z'); // 3600s
      const events: RawTelemetryPoint[] = [
        { recordedAt: new Date('2026-11-01T00:10:00Z'), motionStatus: 'MOVING' },
        { recordedAt: new Date('2026-11-01T00:00:00Z'), motionStatus: 'IDLE' }, // Out of order!
        { recordedAt: new Date('2026-11-01T00:10:00Z'), motionStatus: 'MOVING' }, // Duplicate!
      ];
      const res = TelemetryIntervalService.calculateMotionIntervals(events, start, end, 300);
      // Sorted: 00:00 (IDLE) -> 00:10 (MOVING, delta 600s, max freshness 300s).
      // So IDLE gets 300s. MOVING at 00:10 gets 300s. Total observed = 600s.
      assert.strictEqual(res.idleSeconds, 300);
      assert.strictEqual(res.movingSeconds, 300);
      assert.strictEqual(res.eventCount, 2); // Deduped to 2 points
      testCount++;
      console.log(`[PASS] Test ${testCount}: Out-of-order and duplicate timestamps deterministically sanitized.`);
    }

    // Test 3: Coverage classification tiers
    {
      assert.strictEqual(TelemetryIntervalService.classifyCoverage(95), 'HIGH_COVERAGE');
      assert.strictEqual(TelemetryIntervalService.classifyCoverage(80), 'PARTIAL_COVERAGE');
      assert.strictEqual(TelemetryIntervalService.classifyCoverage(45), 'LOW_COVERAGE');
      assert.strictEqual(TelemetryIntervalService.classifyCoverage(0), 'NO_DATA');
      testCount++;
      console.log(`[PASS] Test ${testCount}: Telemetry coverage classification thresholds verified.`);
    }

    // --------------------------------------------------------------------------
    // PART 2: UNIT TESTS — MAINTENANCE DOWNTIME CALCULATOR
    // --------------------------------------------------------------------------
    console.log('\n--- PART 2: MAINTENANCE DOWNTIME MERGE & OVERLAP ---');

    // Test 4: Overlapping maintenance records
    {
      const windowStart = new Date('2026-11-01T00:00:00Z');
      const windowEnd = new Date('2026-11-01T12:00:00Z'); // 12 hours
      const records: RawMaintenanceSpan[] = [
        {
          startedDate: new Date('2026-11-01T01:00:00Z'),
          completedDate: new Date('2026-11-01T05:00:00Z'), // 4 hours
          scheduledDate: new Date('2026-11-01T01:00:00Z'),
          status: 'COMPLETED',
        },
        {
          startedDate: new Date('2026-11-01T03:00:00Z'), // Overlaps!
          completedDate: new Date('2026-11-01T07:00:00Z'), // Extends to 07:00
          scheduledDate: new Date('2026-11-01T03:00:00Z'),
          status: 'COMPLETED',
        },
      ];
      const res = MaintenanceDowntimeCalculator.calculateDowntime(records, windowStart, windowEnd);
      // Merged interval: 01:00 to 07:00 = 6 hours (21600 seconds), NOT 4+4=8 hours!
      assert.strictEqual(res.downtimeHours, 6);
      assert.strictEqual(res.downtimeSeconds, 21600);
      assert.strictEqual(res.eventCount, 2);
      testCount++;
      console.log(`[PASS] Test ${testCount}: Overlapping maintenance intervals merged without double-counting.`);
    }

    // Test 5: Period clipping (records outside or crossing window boundary)
    {
      const windowStart = new Date('2026-11-01T06:00:00Z');
      const windowEnd = new Date('2026-11-01T18:00:00Z');
      const records: RawMaintenanceSpan[] = [
        {
          startedDate: new Date('2026-11-01T04:00:00Z'), // Starts 2 hours before window
          completedDate: new Date('2026-11-01T10:00:00Z'), // Ends at 10:00 inside window
          scheduledDate: new Date('2026-11-01T04:00:00Z'),
          status: 'COMPLETED',
        },
      ];
      const res = MaintenanceDowntimeCalculator.calculateDowntime(records, windowStart, windowEnd);
      // Clipped from 06:00 to 10:00 = 4 hours, ignoring prior 2 hours
      assert.strictEqual(res.downtimeHours, 4);
      testCount++;
      console.log(`[PASS] Test ${testCount}: Maintenance downtime strictly clipped to reporting window boundaries.`);
    }

    // --------------------------------------------------------------------------
    // PART 3: INTEGRATION & FLEET ANALYTICS SERVICE
    // --------------------------------------------------------------------------
    console.log('\n--- PART 3: FLEET ANALYTICS SERVICE & MULTI-TENANCY ---');

    // Create Tenant Alpha
    const orgAlpha = await Organization.create({
      name: 'Alpha Freight Carriers',
      slug: 'alpha-freight',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
    });

    const userAlpha = await User.create({
      email: 'manager@alphafreight.com',
      passwordHash: 'hashed_pw',
      firstName: 'Alpha',
      lastName: 'Manager',
      status: 'ACTIVE',
    });

    await OrganizationMember.create({
      organizationId: orgAlpha._id,
      userId: userAlpha._id,
      role: 'DISPATCHER',
      status: 'ACTIVE',
    });

    // Create Tenant Beta
    const orgBeta = await Organization.create({
      name: 'Beta Global Logistics',
      slug: 'beta-logistics',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    const userBeta = await User.create({
      email: 'director@betalogistics.com',
      passwordHash: 'hashed_pw',
      firstName: 'Beta',
      lastName: 'Director',
      status: 'ACTIVE',
    });

    await OrganizationMember.create({
      organizationId: orgBeta._id,
      userId: userBeta._id,
      role: 'DISPATCHER',
      status: 'ACTIVE',
    });

    // Provision Vehicles for Alpha
    const vehicleA1 = await Vehicle.create({
      organizationId: orgAlpha._id,
      vin: '1M8GDM9A_ALPHA_001',
      plateNumber: 'ALP-101',
      make: 'Freightliner',
      modelName: 'Cascadia',
      year: 2024,
      type: 'SEMI_TRUCK',
      capacityKg: 20000,
      status: 'AVAILABLE',
      odometerKm: 50000,
    });

    const vehicleA2 = await Vehicle.create({
      organizationId: orgAlpha._id,
      vin: '1M8GDM9A_ALPHA_002',
      plateNumber: 'ALP-102',
      make: 'Kenworth',
      modelName: 'T680',
      year: 2023,
      type: 'SEMI_TRUCK',
      capacityKg: 22000,
      status: 'MAINTENANCE',
      odometerKm: 75000,
    });

    // Provision Vehicle for Beta
    const vehicleB1 = await Vehicle.create({
      organizationId: orgBeta._id,
      vin: '1M8GDM9A_BETA_001',
      plateNumber: 'BET-201',
      make: 'Volvo',
      modelName: 'VNL 860',
      year: 2025,
      type: 'SEMI_TRUCK',
      capacityKg: 24000,
      status: 'IN_TRANSIT',
      odometerKm: 30000,
    });

    // Seed Telemetry for Alpha A1
    const testStart = new Date('2026-11-10T00:00:00Z');
    const testEnd = new Date('2026-11-10T23:59:59Z');

    await TelemetryEvent.create([
      {
        organizationId: orgAlpha._id,
        vehicleId: vehicleA1._id,
        recordedAt: new Date('2026-11-10T08:00:00Z'),
        motionStatus: 'MOVING',
        speedKmh: 85,
        latitude: 41.8781,
        longitude: -87.6298,
        source: 'HARDWARE_GPS',
        isSimulated: false,
      },
      {
        organizationId: orgAlpha._id,
        vehicleId: vehicleA1._id,
        recordedAt: new Date('2026-11-10T08:04:00Z'),
        motionStatus: 'MOVING',
        speedKmh: 90,
        latitude: 41.88,
        longitude: -87.63,
        source: 'HARDWARE_GPS',
        isSimulated: false,
      },
      {
        organizationId: orgAlpha._id,
        vehicleId: vehicleA1._id,
        recordedAt: new Date('2026-11-10T08:08:00Z'),
        motionStatus: 'IDLE',
        speedKmh: 0,
        latitude: 41.885,
        longitude: -87.635,
        source: 'HARDWARE_GPS',
        isSimulated: false,
      },
    ]);

    // Seed Telemetry for Beta B1
    await TelemetryEvent.create({
      organizationId: orgBeta._id,
      vehicleId: vehicleB1._id,
      recordedAt: new Date('2026-11-10T12:00:00Z'),
      motionStatus: 'MOVING',
      speedKmh: 100,
      latitude: 34.0522,
      longitude: -118.2437,
      source: 'SIMULATED',
      isSimulated: true,
    });

    // Seed Maintenance for Alpha A2
    await MaintenanceRecord.create({
      organizationId: orgAlpha._id,
      vehicleId: vehicleA2._id,
      maintenanceType: 'ROUTINE_INSPECTION',
      title: 'DOT 90-Day Inspection',
      description: 'Standard carrier compliance check',
      scheduledDate: new Date('2026-11-10T09:00:00Z'),
      startedDate: new Date('2026-11-10T09:00:00Z'),
      completedDate: new Date('2026-11-10T13:00:00Z'), // 4 hours
      odometerReadingKm: 75000,
      totalCost: 450,
      status: 'COMPLETED',
      createdBy: userAlpha._id,
    });

    // Test 6: FleetAnalyticsService overview for Alpha
    {
      const overview = await FleetAnalyticsService.getFleetOverview(orgAlpha._id, {
        startDate: testStart,
        endDate: testEnd,
      });

      assert.strictEqual(overview.availabilitySnapshot.totalFleetVehicles, 2);
      assert.strictEqual(overview.availabilitySnapshot.availableCount, 1);
      assert.strictEqual(overview.availabilitySnapshot.maintenanceCount, 1);
      assert.strictEqual(overview.maintenance.totalDowntimeHours, 4);
      assert.strictEqual(overview.vehicles.length, 2);
      testCount++;
      console.log(`[PASS] Test ${testCount}: FleetAnalyticsService aggregates Alpha fleet utilization and maintenance.`);
    }

    // --------------------------------------------------------------------------
    // PART 4: REST API & TENANT ISOLATION GATES
    // --------------------------------------------------------------------------
    console.log('\n--- PART 4: REST API, RBAC & TENANT ISOLATION ---');

    const tokenAlpha = generateAccessToken({
      userId: userAlpha._id.toString(),
      email: userAlpha.email,
      activeOrganizationId: orgAlpha._id.toString(),
      role: 'DISPATCHER',
    });

    const tokenBeta = generateAccessToken({
      userId: userBeta._id.toString(),
      email: userBeta.email,
      activeOrganizationId: orgBeta._id.toString(),
      role: 'DISPATCHER',
    });

    // Test 7: Alpha requests fleet overview via API
    {
      const res = await testHttpRequest(
        serverInstance,
        'GET',
        '/api/v1/analytics/fleet/overview?days=7',
        {
          Authorization: `Bearer ${tokenAlpha}`,
          'x-organization-id': orgAlpha._id.toString(),
        }
      );

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.availabilitySnapshot.totalFleetVehicles, 2);
      testCount++;
      console.log(`[PASS] Test ${testCount}: Authorized tenant successfully retrieves fleet overview via REST API.`);
    }

    // Test 8: Alpha cannot access Beta's vehicle via IDOR
    {
      const res = await testHttpRequest(
        serverInstance,
        'GET',
        `/api/v1/analytics/fleet/vehicles/${vehicleB1._id}`,
        {
          Authorization: `Bearer ${tokenAlpha}`,
          'x-organization-id': orgAlpha._id.toString(),
        }
      );

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      testCount++;
      console.log(`[PASS] Test ${testCount}: Cross-tenant vehicle IDOR access strictly blocked with HTTP 404.`);
    }

    // Test 9: Alpha cannot spoof x-organization-id header to access Beta's fleet
    {
      const res = await testHttpRequest(
        serverInstance,
        'GET',
        '/api/v1/analytics/fleet/overview',
        {
          Authorization: `Bearer ${tokenAlpha}`,
          'x-organization-id': orgBeta._id.toString(), // Header spoof!
        }
      );

      // requireTenantMembership detects userAlpha is NOT a member of orgBeta -> 403
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN_TENANT_ACCESS');
      testCount++;
      console.log(`[PASS] Test ${testCount}: Header spoofing blocked: membership verified on server side.`);
    }

    // Test 10: Date validation & max reporting range rejection
    {
      const res = await testHttpRequest(
        serverInstance,
        'GET',
        '/api/v1/analytics/fleet/overview?startDate=2024-01-01&endDate=2026-01-01', // > 365 days
        {
          Authorization: `Bearer ${tokenAlpha}`,
          'x-organization-id': orgAlpha._id.toString(),
        }
      );

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'MAX_RANGE_EXCEEDED');
      testCount++;
      console.log(`[PASS] Test ${testCount}: Queries exceeding 365 days rejected to protect server performance.`);
    }

    // Test 11: Hardware-only telemetry source filter
    {
      const res = await testHttpRequest(
        serverInstance,
        'GET',
        '/api/v1/analytics/fleet/overview?sourcePolicy=HARDWARE_ONLY',
        {
          Authorization: `Bearer ${tokenAlpha}`,
          'x-organization-id': orgAlpha._id.toString(),
        }
      );

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.simulationPolicy, 'HARDWARE_ONLY');
      testCount++;
      console.log(`[PASS] Test ${testCount}: Telemetry source filtering policy verified.`);
    }

    // --------------------------------------------------------------------------
    // SUMMARY
    // --------------------------------------------------------------------------
    console.log('\n================================================================================');
    console.log(`🎉 ALL ${testCount} PHASE 11.1 FLEET INTELLIGENCE TESTS PASSED WITH 100% SUCCESS!`);
    console.log('================================================================================\n');
  } finally {
    await teardownDatabase();
  }
}

runFleetAnalyticsTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
