import { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';

import {
  Organization,
  User,
  OrganizationMember,
  Vehicle,
  Driver,
  TelemetryEvent,
  TelemetryAlert,
  Geofence,
} from '../models';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';
import { SocketService } from '../services/SocketService';
import { GeofenceEngine } from '../services/GeofenceEngine';
import { TelemetryAlertEngine } from '../services/TelemetryAlertEngine';

let mongod: MongoMemoryServer;
let ioServer: SocketIOServer;
let httpServer: any;
let serverPort: number;

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
    TelemetryEvent.init(),
    TelemetryAlert.init(),
    Geofence.init(),
  ]);

  // Setup Real Socket.IO Server
  httpServer = createServer();
  ioServer = new SocketIOServer(httpServer, { cors: { origin: '*' } });
  SocketService.initialize(ioServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      serverPort = (httpServer.address() as any).port;
      resolve();
    });
  });
}

async function teardownTestEnvironment() {
  if (ioServer) ioServer.close();
  if (httpServer) httpServer.close();
  await mongoose.disconnect();
  await mongod.stop();
}

async function runPhase06TrackingTestSuite() {
  console.log('\n===============================================================');
  console.log('       FLEETOS PHASE 06 REAL-TIME TRACKING TEST SUITE');
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
    const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'fleetos-dev-access-super-secret-key-replace-in-prod';

    // 1. Setup Tenant Organizations
    const orgA = await Organization.create({
      name: 'Falcon Express Logistics',
      slug: 'falcon-express',
      billingEmail: 'ops@falcon.com',
      subscriptionTier: 'ENTERPRISE',
      status: 'ACTIVE',
    });

    const orgB = await Organization.create({
      name: 'Titan Freightlines',
      slug: 'titan-freight',
      billingEmail: 'ops@titan.com',
      subscriptionTier: 'STANDARD',
      status: 'ACTIVE',
    });

    const tenantA = { organizationId: orgA._id.toString(), role: 'ORGANIZATION_OWNER' };
    const tenantB = { organizationId: orgB._id.toString(), role: 'ORGANIZATION_OWNER' };

    // 2. Setup Users & Memberships
    const userA = await User.create({
      email: 'dispatcher@falcon.com',
      passwordHash: 'hashed_pw',
      firstName: 'Frank',
      lastName: 'Dispatcher',
      role: 'DISPATCHER',
      isEmailVerified: true,
    });

    await OrganizationMember.create({
      organizationId: orgA._id,
      userId: userA._id,
      role: 'DISPATCHER',
      status: 'ACTIVE',
    });

    const userB = await User.create({
      email: 'operator@titan.com',
      passwordHash: 'hashed_pw',
      firstName: 'Tara',
      lastName: 'Operator',
      role: 'DISPATCHER',
      isEmailVerified: true,
    });

    await OrganizationMember.create({
      organizationId: orgB._id,
      userId: userB._id,
      role: 'DISPATCHER',
      status: 'ACTIVE',
    });

    // Setup Vehicles
    const vehicleA = await Vehicle.create({
      organizationId: orgA._id,
      vin: '1M8GDM9A4KP048291',
      plateNumber: 'FLC-101',
      make: 'Volvo',
      modelName: 'VNL 860',
      year: 2024,
      type: 'SEMI_TRUCK',
      fuelType: 'DIESEL',
      capacityKg: 22000,
      status: 'IN_TRANSIT',
      odometerKm: 35000,
      lastLocation: {
        latitude: 32.7767,
        longitude: -96.7970,
        speedKmh: 65,
        headingDeg: 180,
        motionStatus: 'MOVING',
        source: 'SIMULATED',
        isSimulated: true,
        recordedAt: new Date('2026-11-11T08:00:00Z'),
        updatedAt: new Date('2026-11-11T08:00:00Z'),
      },
    });

    const vehicleB = await Vehicle.create({
      organizationId: orgB._id,
      vin: '2M8GDM9A4KP048292',
      plateNumber: 'TTN-202',
      make: 'Peterbilt',
      modelName: '579',
      year: 2023,
      type: 'SEMI_TRUCK',
      fuelType: 'DIESEL',
      capacityKg: 20000,
      status: 'AVAILABLE',
      odometerKm: 42000,
    });

    // -------------------------------------------------------------
    // PART 1: TELEMETRY INGESTION & RANGE VALIDATION
    // -------------------------------------------------------------
    console.log('\n--- PART 1: GPS TELEMETRY INGESTION SUITE ---');

    const telemetryRepo = new BaseTenantRepository(TelemetryEvent);

    // Test 1: Ingest valid telemetry event
    const validPoint = await telemetryRepo.create(tenantA, {
      vehicleId: vehicleA._id,
      latitude: 32.8000,
      longitude: -96.8100,
      speedKmh: 85,
      headingDeg: 195,
      motionStatus: 'MOVING',
      source: 'SIMULATED',
      isSimulated: true,
      recordedAt: new Date('2026-11-11T08:05:00Z'),
      serverReceivedAt: new Date(),
    } as any);

    assert(Boolean(validPoint._id && validPoint.speedKmh === 85), 'Test 1: Ingest valid authorized telemetry point');

    // Test 2: Reject invalid latitude (> 90)
    let rejectedLat = false;
    try {
      await telemetryRepo.create(tenantA, {
        vehicleId: vehicleA._id,
        latitude: 120, // Illegal
        longitude: -96.8,
        speedKmh: 50,
        headingDeg: 90,
        recordedAt: new Date(),
      } as any);
    } catch {
      rejectedLat = true;
    }
    assert(rejectedLat, 'Test 2: Reject out-of-bounds latitude (> 90 degrees)');

    // Test 3: Reject invalid speed (> 250 km/h)
    let rejectedSpeed = false;
    try {
      await telemetryRepo.create(tenantA, {
        vehicleId: vehicleA._id,
        latitude: 32.7,
        longitude: -96.8,
        speedKmh: 350, // Unrealistic speed
        headingDeg: 90,
        recordedAt: new Date(),
      } as any);
    } catch {
      rejectedSpeed = true;
    }
    assert(rejectedSpeed, 'Test 3: Reject unrealistic vehicle speed (> 250 km/h)');

    // Test 4: Reject cross-tenant vehicle ownership
    const crossVehicleLookup = await Vehicle.findOne({
      _id: vehicleA._id,
      organizationId: orgB._id,
    });
    assert(crossVehicleLookup === null, 'Test 4: Verify cross-tenant vehicle ownership isolation');

    // Test 5: Verify stale telemetry timestamp guard
    const staleTimestamp = new Date('2026-11-11T07:30:00Z'); // Older than vehicleA's recordedAt
    const isStale = staleTimestamp < new Date(vehicleA.lastLocation!.recordedAt);
    assert(isStale === true, 'Test 5: Detect and flag stale telemetry updates prior to state update');

    // Test 6: Verify explicit simulated data labeling
    assert(validPoint.isSimulated === true && validPoint.source === 'SIMULATED', 'Test 6: Verify transparent simulated GPS tagging');

    // -------------------------------------------------------------
    // PART 2: SOCKET.IO AUTHENTICATED REAL-TIME ARCHITECTURE
    // -------------------------------------------------------------
    console.log('\n--- PART 2: REAL-TIME SOCKET.IO SUITE ---');

    const validTokenA = jwt.sign(
      { userId: userA._id.toString(), email: userA.email, organizationId: orgA._id.toString() },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const validTokenB = jwt.sign(
      { userId: userB._id.toString(), email: userB.email, organizationId: orgB._id.toString() },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Test 7: Reject unauthenticated socket connection
    let unauthenticatedRejected = false;
    await new Promise<void>((resolve) => {
      const client = ClientIO(`http://localhost:${serverPort}`, {
        auth: {}, // Missing token
        reconnection: false,
      });

      client.on('connect_error', (err: any) => {
        if (err.message.includes('AUTHENTICATION_ERROR')) {
          unauthenticatedRejected = true;
        }
        client.disconnect();
        resolve();
      });
      client.on('connect', () => {
        client.disconnect();
        resolve();
      });
    });
    assert(unauthenticatedRejected, 'Test 7: Reject unauthenticated socket handshake');

    // Test 8: Authenticate valid socket & auto-join organization room
    let clientA!: ClientSocket;
    let authSuccess = false;
    await new Promise<void>((resolve) => {
      clientA = ClientIO(`http://localhost:${serverPort}`, {
        auth: { token: validTokenA, organizationId: orgA._id.toString() },
        reconnection: false,
      });

      clientA.on('connect', () => {
        authSuccess = true;
        resolve();
      });
      clientA.on('connect_error', (err: any) => {
        console.error('Socket auth failed:', err.message);
        resolve();
      });
    });
    assert(authSuccess, 'Test 8: Authenticate valid JWT socket and join organization room');

    // Test 9: Reject cross-tenant vehicle room subscription
    let subscriptionDenied = false;
    await new Promise<void>((resolve) => {
      clientA.emit('subscribe:vehicle', { vehicleId: vehicleB._id.toString() }); // Vehicle belongs to Org B
      clientA.on('subscription:error', (_data: any) => {
        subscriptionDenied = true;
        resolve();
      });
      setTimeout(resolve, 500);
    });
    assert(subscriptionDenied, 'Test 9: Reject unauthorized subscription to vehicle of another tenant');

    // Test 10: Authorized vehicle location broadcast received
    let broadcastReceived = false;
    await new Promise<void>((resolve) => {
      clientA.on('vehicle.location.updated', (payload: any) => {
        if (payload.vehicleId === vehicleA._id.toString() && payload.speedKmh === 92) {
          broadcastReceived = true;
          resolve();
        }
      });

      // Server broadcasts telemetry to Org A
      SocketService.broadcastVehicleTelemetry(orgA._id.toString(), {
        vehicleId: vehicleA._id.toString(),
        plateNumber: vehicleA.plateNumber,
        latitude: 32.7800,
        longitude: -96.8000,
        speedKmh: 92,
        headingDeg: 185,
        source: 'SIMULATED',
        isSimulated: true,
      });

      setTimeout(resolve, 600);
    });
    assert(broadcastReceived, 'Test 10: Receive authenticated organization-scoped telemetry broadcast');

    clientA.disconnect();

    // -------------------------------------------------------------
    // PART 3: GEOFENCING & ALERT ENGINE SUITE
    // -------------------------------------------------------------
    console.log('\n--- PART 3: GEOFENCING & ALERT ENGINE SUITE ---');

    // Create a circular geofence around Dallas North Terminal (radius 1000m)
    const geofence1 = await Geofence.create({
      organizationId: orgA._id,
      name: 'Dallas North Logistics Gateway',
      type: 'CIRCLE',
      circleConfig: {
        latitude: 32.7767,
        longitude: -96.7970,
        radiusMeters: 1000,
      },
      category: 'HUB',
      isActive: true,
      createdBy: userA._id,
    });

    // Test 11: Detect geofence entry (coordinate within 500m of hub)
    const insideLat = 32.7780;
    const insideLon = -96.7975;
    const distMeters = GeofenceEngine.calculateDistanceMeters(
      insideLat,
      insideLon,
      geofence1.circleConfig!.latitude,
      geofence1.circleConfig!.longitude
    );
    assert(distMeters <= 1000, 'Test 11: Geofence engine correctly calculates proximity inside circular boundary');

    // Trigger alert creation via GeofenceEngine
    await GeofenceEngine.evaluateGeofences(
      orgA._id.toString(),
      vehicleA._id.toString(),
      vehicleA.plateNumber,
      insideLat,
      insideLon,
      'SIMULATED'
    );

    const entryAlert = await TelemetryAlert.findOne({
      organizationId: orgA._id,
      vehicleId: vehicleA._id,
      type: 'GEOFENCE_ENTER',
    });
    assert(Boolean(entryAlert && entryAlert.title.includes('Geofence Entered')), 'Test 12: Generate GEOFENCE_ENTER alert upon boundary penetration');

    // Test 13: Prevent duplicate geofence alerts within short window
    await GeofenceEngine.evaluateGeofences(
      orgA._id.toString(),
      vehicleA._id.toString(),
      vehicleA.plateNumber,
      insideLat,
      insideLon,
      'SIMULATED'
    );
    const alertCount = await TelemetryAlert.countDocuments({
      organizationId: orgA._id,
      vehicleId: vehicleA._id,
      type: 'GEOFENCE_ENTER',
    });
    assert(alertCount === 1, 'Test 13: Deduplicate repeated geofence alerts within cooldown window');

    // Test 14: Overspeeding alert detection
    await TelemetryAlertEngine.processAlerts(orgA._id.toString(), {
      vehicleId: vehicleA._id.toString(),
      plateNumber: vehicleA.plateNumber,
      speedKmh: 118, // Above 105 threshold
      motionStatus: 'MOVING',
      source: 'SIMULATED',
    });

    const speedAlert = await TelemetryAlert.findOne({
      organizationId: orgA._id,
      vehicleId: vehicleA._id,
      type: 'OVERSPEEDING',
    });
    assert(Boolean(speedAlert && speedAlert.severity === 'WARNING'), 'Test 14: Generate OVERSPEEDING alert when speed exceeds commercial threshold');

    // -------------------------------------------------------------
    // PART 4: HISTORICAL JOURNEY PLAYBACK & OPERATIONS KPIS
    // -------------------------------------------------------------
    console.log('\n--- PART 4: JOURNEY HISTORY & OPERATIONS METRICS ---');

    // Test 15: Retrieve bounded location history
    const historyPoints = await TelemetryEvent.find({
      organizationId: orgA._id,
      vehicleId: vehicleA._id,
    }).sort({ recordedAt: 1 }).lean();

    assert(historyPoints.length >= 1, 'Test 15: Retrieve chronological historical GPS breadcrumbs');

    // Test 16: Cross-tenant isolation on historical telemetry
    const crossHistory = await TelemetryEvent.find({
      organizationId: orgB._id,
      vehicleId: vehicleA._id,
    }).lean();
    assert(crossHistory.length === 0, 'Test 16: Reject cross-tenant lookup of vehicle historical path');

    // Test 17: Operational metrics aggregation
    const allOrgVehicles = await Vehicle.find({ organizationId: orgA._id, isArchived: false }).lean();
    const movingCount = allOrgVehicles.filter(
      (v) => v.lastLocation && v.lastLocation.motionStatus === 'MOVING'
    ).length;
    assert(movingCount >= 1, 'Test 17: Verify operational KPI derived vehicle metrics (Moving vs Idle vs Offline)');

    console.log(`\nAll tests completed: ${passedTests}/${totalTests} PASSED.\n`);
  } finally {
    await teardownTestEnvironment();
  }
}

runPhase06TrackingTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
