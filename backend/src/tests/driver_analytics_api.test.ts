import assert from 'assert';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import http from 'http';

import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { OrganizationMember } from '../models/OrganizationMember';
import { Driver } from '../models/Driver';
import { DriverShift } from '../models/DriverShift';
import { DriverIncident } from '../models/DriverIncident';
import { DriverDocument } from '../models/DriverDocument';
import { Shipment } from '../models/Shipment';
import { createApp } from '../app';
import { generateAccessToken } from '../utils/token';
import { testHttpRequest } from './testHttpHelper';

let mongod: MongoMemoryServer;
let serverInstance: http.Server;

async function setupTestEnvironment() {
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

async function teardownTestEnvironment() {
  if (serverInstance) {
    await new Promise<void>((resolve) => serverInstance.close(() => resolve()));
  }
  await mongoose.disconnect();
  await mongod.stop();
}

async function runDriverAnalyticsApiTestSuite() {
  console.log('================================================================================');
  console.log('     FLEETOS PHASE 11.2.2-A DRIVER ANALYTICS API SECURITY & REST TEST SUITE     ');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

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

  // Provision Tenants & Users
  const orgA = await Organization.create({
    name: 'Tenant Alpha Logistics',
    slug: 'tenant-alpha',
    status: 'ACTIVE',
  });
  const orgB = await Organization.create({
    name: 'Tenant Beta Haulage',
    slug: 'tenant-beta',
    status: 'ACTIVE',
  });

  const managerUser = await User.create({
    firstName: 'Fleet',
    lastName: 'Manager',
    email: 'manager@alpha.com',
    passwordHash: 'hash',
  });
  await OrganizationMember.create({
    organizationId: orgA._id,
    userId: managerUser._id,
    role: 'FLEET_MANAGER',
    status: 'ACTIVE',
  });

  const dispatcherUser = await User.create({
    firstName: 'Dispatcher',
    lastName: 'Alpha',
    email: 'dispatcher@alpha.com',
    passwordHash: 'hash',
  });
  await OrganizationMember.create({
    organizationId: orgA._id,
    userId: dispatcherUser._id,
    role: 'DISPATCHER',
    status: 'ACTIVE',
  });

  const driverUserA = await User.create({
    firstName: 'Driver',
    lastName: 'One',
    email: 'driver1@alpha.com',
    passwordHash: 'hash',
  });
  await OrganizationMember.create({
    organizationId: orgA._id,
    userId: driverUserA._id,
    role: 'DRIVER',
    status: 'ACTIVE',
  });

  const driverUserB = await User.create({
    firstName: 'Driver',
    lastName: 'Two',
    email: 'driver2@alpha.com',
    passwordHash: 'hash',
  });
  await OrganizationMember.create({
    organizationId: orgA._id,
    userId: driverUserB._id,
    role: 'DRIVER',
    status: 'ACTIVE',
  });

  const unlinkedDriverUser = await User.create({
    firstName: 'Unlinked',
    lastName: 'Driver',
    email: 'unlinked@alpha.com',
    passwordHash: 'hash',
  });
  await OrganizationMember.create({
    organizationId: orgA._id,
    userId: unlinkedDriverUser._id,
    role: 'DRIVER',
    status: 'ACTIVE',
  });

  const accountantUser = await User.create({
    firstName: 'Accountant',
    lastName: 'Alpha',
    email: 'accountant@alpha.com',
    passwordHash: 'hash',
  });
  await OrganizationMember.create({
    organizationId: orgA._id,
    userId: accountantUser._id,
    role: 'ACCOUNTANT',
    status: 'ACTIVE',
  });

  // Create Driver Records in Tenant Alpha
  const driverProfileA = await Driver.create({
    organizationId: orgA._id,
    userId: driverUserA._id,
    fullName: 'Driver One Alpha',
    email: driverUserA.email,
    phone: '+15550001',
    licenseNumber: 'CDL-ALPHA-01',
    licenseClass: 'CLASS_A',
    licenseExpiry: new Date('2028-01-01Z'),
    employmentStatus: 'FULL_TIME',
    status: 'AVAILABLE',
    rating: 5,
    emergencyContact: { name: 'Emergency', phone: '+15559999' },
    joiningDate: new Date(),
    isArchived: false,
  });

  const driverProfileB = await Driver.create({
    organizationId: orgA._id,
    userId: driverUserB._id,
    fullName: 'Driver Two Alpha',
    email: driverUserB.email,
    phone: '+15550002',
    licenseNumber: 'CDL-ALPHA-02',
    licenseClass: 'CLASS_A',
    licenseExpiry: new Date('2028-01-01Z'),
    employmentStatus: 'FULL_TIME',
    status: 'AVAILABLE',
    rating: 5,
    emergencyContact: { name: 'Emergency', phone: '+15559999' },
    joiningDate: new Date(),
    isArchived: false,
  });

  // Create Driver in Tenant Beta
  const driverBeta = await Driver.create({
    organizationId: orgB._id,
    fullName: 'Driver Beta',
    email: 'driver@beta.com',
    phone: '+15550099',
    licenseNumber: 'CDL-BETA-01',
    licenseClass: 'CLASS_A',
    licenseExpiry: new Date('2028-01-01Z'),
    employmentStatus: 'FULL_TIME',
    status: 'AVAILABLE',
    rating: 5,
    emergencyContact: { name: 'Emergency', phone: '+15559999' },
    joiningDate: new Date(),
    isArchived: false,
  });

  // Create Operational Evidence for Driver A (6 shifts, 6 deliveries, 2 docs)
  const shiftsA = Array(6).fill(null).map((_, i) => ({
    organizationId: orgA._id,
    driverId: driverProfileA._id,
    shiftDate: `2026-11-0${i + 1}`,
    plannedStart: new Date(`2026-11-0${i + 1}T08:00:00Z`),
    plannedEnd: new Date(`2026-11-0${i + 1}T16:00:00Z`),
    status: 'COMPLETED',
    isLateStart: false,
    durationMinutes: 480,
    createdBy: managerUser._id,
  }));
  await DriverShift.insertMany(shiftsA);

  const shipmentsA = Array(6).fill(null).map((_, i) => ({
    organizationId: orgA._id,
    trackingNumber: `TRK-API-${i + 1}`,
    driverId: driverProfileA._id,
    customer: { name: 'Cust', email: 'c@a.com', phone: '+1' },
    sender: { name: 'S', email: 's@a.com', phone: '+1', address: 'A', city: 'A', country: 'USA' },
    receiver: { name: 'R', email: 'r@a.com', phone: '+1', address: 'A', city: 'A', country: 'USA' },
    origin: { address: 'A', city: 'A', country: 'USA', latitude: 10, longitude: 10 },
    destination: { address: 'A', city: 'A', country: 'USA', latitude: 11, longitude: 11 },
    cargo: { description: 'Cargo', category: 'GENERAL', weightKg: 10, packageCount: 1 },
    pricing: { quotedAmount: 100, currency: 'USD' },
    priority: 'STANDARD',
    status: 'DELIVERED',
    expectedDeliveryDate: new Date('2026-11-01T14:00:00Z'),
    proofOfDelivery: { recipientName: 'Recv', deliveredAt: new Date('2026-11-01T13:30:00Z') },
    createdBy: managerUser._id,
    isArchived: false,
  }));
  await Shipment.insertMany(shipmentsA);

  await DriverDocument.insertMany([
    { organizationId: orgA._id, driverId: driverProfileA._id, documentType: 'DRIVING_LICENSE', documentNumber: 'DL-A', verificationStatus: 'VERIFIED', expiryDate: new Date('2028-01-01Z'), createdBy: managerUser._id, isArchived: false },
    { organizationId: orgA._id, driverId: driverProfileA._id, documentType: 'MEDICAL_FITNESS_CERTIFICATE', documentNumber: 'MED-A', verificationStatus: 'VERIFIED', expiryDate: new Date('2028-01-01Z'), createdBy: managerUser._id, isArchived: false },
  ]);

  // Auth tokens
  const managerToken = generateAccessToken({ userId: managerUser._id.toString(), email: managerUser.email, role: 'FLEET_MANAGER', activeOrganizationId: orgA._id.toString() });
  const dispatcherToken = generateAccessToken({ userId: dispatcherUser._id.toString(), email: dispatcherUser.email, role: 'DISPATCHER', activeOrganizationId: orgA._id.toString() });
  const driverAToken = generateAccessToken({ userId: driverUserA._id.toString(), email: driverUserA.email, role: 'DRIVER', activeOrganizationId: orgA._id.toString() });
  const driverBToken = generateAccessToken({ userId: driverUserB._id.toString(), email: driverUserB.email, role: 'DRIVER', activeOrganizationId: orgA._id.toString() });
  const unlinkedDriverToken = generateAccessToken({ userId: unlinkedDriverUser._id.toString(), email: unlinkedDriverUser.email, role: 'DRIVER', activeOrganizationId: orgA._id.toString() });
  const accountantToken = generateAccessToken({ userId: accountantUser._id.toString(), email: accountantUser.email, role: 'ACCOUNTANT', activeOrganizationId: orgA._id.toString() });

  // ==========================================================================
  // SECTION 1: AUTHENTICATION & SESSION SECURITY (401)
  // ==========================================================================
  console.log('\n--- Section 1: Authentication & Session Security (401) ---');

  await test('1.1: Request without Authorization header returns 401 Unauthorized', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', '/api/v1/analytics/drivers/fleet-overview');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  await test('1.2: Request with malformed JWT token returns 401 Invalid Token', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', '/api/v1/analytics/drivers/fleet-overview', {
      Authorization: 'Bearer invalid.token.payload',
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error.code, 'INVALID_TOKEN');
  });

  // ==========================================================================
  // SECTION 2: ROLE-BASED ACCESS CONTROL (RBAC) (403)
  // ==========================================================================
  console.log('\n--- Section 2: Role-Based Access Control (RBAC) (403) ---');

  await test('2.1: Fleet Manager successfully accesses fleet-overview with 200 OK', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', '/api/v1/analytics/drivers/fleet-overview', {
      Authorization: `Bearer ${managerToken}`,
      'x-organization-id': orgA._id.toString(),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.totalActiveDrivers, 2);
  });

  await test('2.2: Dispatcher is DENIED fleet rankings (Least Privilege enforcement)', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', '/api/v1/analytics/drivers/rankings', {
      Authorization: `Bearer ${dispatcherToken}`,
      'x-organization-id': orgA._id.toString(),
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error.code, 'INSUFFICIENT_PERMISSIONS');
  });

  await test('2.3: Dispatcher is DENIED shift-variance payroll audit', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', '/api/v1/analytics/drivers/shift-variance', {
      Authorization: `Bearer ${dispatcherToken}`,
      'x-organization-id': orgA._id.toString(),
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error.code, 'INSUFFICIENT_PERMISSIONS');
  });

  await test('2.4: Driver role is DENIED fleet-overview', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', '/api/v1/analytics/drivers/fleet-overview', {
      Authorization: `Bearer ${driverAToken}`,
      'x-organization-id': orgA._id.toString(),
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error.code, 'INSUFFICIENT_PERMISSIONS');
  });

  await test('2.5: Accountant role is DENIED workforce analytics', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', '/api/v1/analytics/drivers/fleet-overview', {
      Authorization: `Bearer ${accountantToken}`,
      'x-organization-id': orgA._id.toString(),
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error.code, 'INSUFFICIENT_PERMISSIONS');
  });

  // ==========================================================================
  // SECTION 3: DRIVER SELF-SERVICE & IDOR MITIGATION
  // ==========================================================================
  console.log('\n--- Section 3: Driver Self-Service & IDOR Mitigation ---');

  await test('3.1: Driver successfully queries self scorecard via /me', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', '/api/v1/analytics/drivers/me', {
      Authorization: `Bearer ${driverAToken}`,
      'x-organization-id': orgA._id.toString(),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.driverId, driverProfileA._id.toString());
    assert.strictEqual(res.body.data.driverName, 'Driver One Alpha');
  });

  await test('3.2: Unlinked driver calling /me returns 404 (Fail-closed)', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', '/api/v1/analytics/drivers/me', {
      Authorization: `Bearer ${unlinkedDriverToken}`,
      'x-organization-id': orgA._id.toString(),
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error.code, 'DRIVER_PROFILE_NOT_FOUND');
  });

  await test('3.3: Driver A calling Driver B ID directly returns 403 Forbidden (IDOR blocked)', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', `/api/v1/analytics/drivers/${driverProfileB._id}`, {
      Authorization: `Bearer ${driverAToken}`,
      'x-organization-id': orgA._id.toString(),
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN_RESOURCE_ACCESS');
  });

  await test('3.4: Driver A accessing own ID directly returns 200 OK', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', `/api/v1/analytics/drivers/${driverProfileA._id}`, {
      Authorization: `Bearer ${driverAToken}`,
      'x-organization-id': orgA._id.toString(),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.driverId, driverProfileA._id.toString());
  });

  await test('3.5: Manager requesting cross-tenant driver ID returns 404 (prevents tenant enumeration)', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', `/api/v1/analytics/drivers/${driverBeta._id}`, {
      Authorization: `Bearer ${managerToken}`,
      'x-organization-id': orgA._id.toString(),
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error.code, 'NOT_FOUND');
  });

  // ==========================================================================
  // SECTION 4: ROUTE ORDER & PARAMETER VALIDATION
  // ==========================================================================
  console.log('\n--- Section 4: Route Order & Input Validation ---');

  await test('4.1: Static route /rankings is not intercepted by dynamic /:driverId', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', '/api/v1/analytics/drivers/rankings', {
      Authorization: `Bearer ${managerToken}`,
      'x-organization-id': orgA._id.toString(),
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  await test('4.2: Malformed ObjectId parameter returns 400 Bad Request', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', '/api/v1/analytics/drivers/not-a-valid-object-id', {
      Authorization: `Bearer ${managerToken}`,
      'x-organization-id': orgA._id.toString(),
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'INVALID_ID_FORMAT');
  });

  await test('4.3: Excessive days query parameter (>365) returns 400 Bad Request', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', '/api/v1/analytics/drivers/fleet-overview?days=500', {
      Authorization: `Bearer ${managerToken}`,
      'x-organization-id': orgA._id.toString(),
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  await test('4.4: Negative days parameter returns 400 Bad Request', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', '/api/v1/analytics/drivers/fleet-overview?days=-10', {
      Authorization: `Bearer ${managerToken}`,
      'x-organization-id': orgA._id.toString(),
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  await test('4.5: Driver trend endpoint functions correctly for authorized manager', async () => {
    const res = await testHttpRequest(serverInstance, 'GET', `/api/v1/analytics/drivers/${driverProfileA._id}/trend?months=6`, {
      Authorization: `Bearer ${managerToken}`,
      'x-organization-id': orgA._id.toString(),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.length, 6);
  });

  console.log('\n================================================================================');
  console.log(`TEST SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

async function main() {
  await setupTestEnvironment();
  try {
    await runDriverAnalyticsApiTestSuite();
  } finally {
    await teardownTestEnvironment();
  }
}

main().catch((err) => {
  console.error('Fatal API test error:', err);
  process.exit(1);
});
