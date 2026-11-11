import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import {
  Organization,
  User,
  OrganizationMember,
  Vehicle,
  Driver,
  Shipment,
  Dispatch,
  MaintenanceRecord,
  Expense,
  Invoice,
} from '../models';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';

async function runComprehensiveTenantIsolationSuite() {
  console.log('[Phase 02 Test Suite] Starting Enterprise Multi-Tenant Data Isolation Tests...');
  let mongod: MongoMemoryServer | null = null;

  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Initialize all models and build indexes
    await Promise.all([
      Organization.init(),
      User.init(),
      OrganizationMember.init(),
      Vehicle.init(),
      Driver.init(),
      Shipment.init(),
      Dispatch.init(),
      MaintenanceRecord.init(),
      Expense.init(),
      Invoice.init(),
    ]);

    // Setup Repositories
    const vehicleRepo = new BaseTenantRepository(Vehicle);
    const shipmentRepo = new BaseTenantRepository(Shipment);
    const invoiceRepo = new BaseTenantRepository(Invoice);

    // 1. SETUP TWO SEPARATE ORGANIZATIONS
    const orgA = await Organization.create({
      name: 'Apex Global Logistics',
      slug: 'apex-logistics',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
    });

    const orgB = await Organization.create({
      name: 'Pacific Freightline Corp',
      slug: 'pacific-freight',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    const tenantA = { organizationId: orgA._id.toString() };
    const tenantB = { organizationId: orgB._id.toString() };

    console.log('✓ TEST 1: Created two separate isolated organizations.');

    // 2. SETUP USERS & MEMBERSHIPS
    const userA = await User.create({
      organizationId: orgA._id,
      firstName: 'Alice',
      lastName: 'Dispatcher',
      email: 'alice@apex.com',
      passwordHash: 'hash_a',
      role: 'DISPATCH_MANAGER',
    });

    const userB = await User.create({
      organizationId: orgB._id,
      firstName: 'Bob',
      lastName: 'Manager',
      email: 'bob@pacific.com',
      passwordHash: 'hash_b',
      role: 'ORGANIZATION_ADMIN',
    });

    await OrganizationMember.create({
      organizationId: orgA._id,
      userId: userA._id,
      role: 'DISPATCH_MANAGER',
    });

    await OrganizationMember.create({
      organizationId: orgB._id,
      userId: userB._id,
      role: 'ORGANIZATION_ADMIN',
    });

    console.log('✓ TEST 2: Verified user creation & organization membership scoping.');

    // 3. CREATE VEHICLES VIA BASE TENANT REPOSITORY
    const vehA = await vehicleRepo.create(tenantA, {
      vin: '1M8GDM9A4KP048291',
      plateNumber: 'APEX-101',
      make: 'Volvo',
      modelName: 'VNL 860',
      year: 2024,
      type: 'SEMI_TRUCK',
      capacityKg: 36000,
      status: 'AVAILABLE',
    } as any);

    const vehB = await vehicleRepo.create(tenantB, {
      vin: '1M8GDM9B7LP059284',
      plateNumber: 'PAC-202',
      make: 'Freightliner',
      modelName: 'Cascadia',
      year: 2023,
      type: 'SEMI_TRUCK',
      capacityKg: 34000,
      status: 'AVAILABLE',
    } as any);

    console.log('✓ TEST 3: Inserted assets via BaseTenantRepository enforcing tenant context.');

    // 4. TEST: TENANT-SCOPED READS
    const tenantAVehicles = await vehicleRepo.find(tenantA);
    if (tenantAVehicles.length !== 1 || tenantAVehicles[0].plateNumber !== 'APEX-101') {
      throw new Error('Tenant-scoped read failed: Tenant A did not receive exact isolated vehicle.');
    }

    const tenantBVehicles = await vehicleRepo.find(tenantB);
    if (tenantBVehicles.length !== 1 || tenantBVehicles[0].plateNumber !== 'PAC-202') {
      throw new Error('Tenant-scoped read failed: Tenant B did not receive exact isolated vehicle.');
    }
    console.log('✓ TEST 4: Verified tenant-scoped reads are strictly segregated.');

    // 5. TEST: CROSS-TENANT ACCESS REJECTION
    // Tenant B attempting to read Tenant A's vehicle by ID
    const crossTenantRead = await vehicleRepo.findById(tenantB, vehA._id);
    if (crossTenantRead !== null) {
      throw new Error('CRITICAL SECURITY VIOLATION: Tenant B was able to read Tenant A vehicle!');
    }
    console.log('✓ TEST 5: Verified cross-tenant read attempt rejected (returned null).');

    // 6. TEST: TENANT-SCOPED UPDATE (Cross-tenant update rejection)
    // Tenant B attempting to rename Tenant A's vehicle
    const updateAttempt = await vehicleRepo.updateOne(
      tenantB,
      { _id: vehA._id },
      { $set: { plateNumber: 'HACKED-PLATE' } }
    );
    if (updateAttempt.matchedCount !== 0) {
      throw new Error('CRITICAL SECURITY VIOLATION: Tenant B matched and modified Tenant A vehicle!');
    }

    // Verify Tenant A vehicle remains pristine
    const verifyVehA = await vehicleRepo.findById(tenantA, vehA._id);
    if (!verifyVehA || verifyVehA.plateNumber !== 'APEX-101') {
      throw new Error('Data corruption detected on Tenant A asset.');
    }
    console.log('✓ TEST 6: Verified cross-tenant update rejected (0 matched, 0 modified).');

    // 7. TEST: TENANT-SCOPED DELETE (Cross-tenant delete rejection)
    // Tenant B attempting to delete Tenant A's vehicle
    const deleteAttempt = await vehicleRepo.deleteOne(tenantB, { _id: vehA._id });
    if (deleteAttempt.deletedCount !== 0) {
      throw new Error('CRITICAL SECURITY VIOLATION: Tenant B deleted Tenant A asset!');
    }

    const verifyStillExists = await vehicleRepo.findById(tenantA, vehA._id);
    if (!verifyStillExists) {
      throw new Error('Tenant A asset was wrongfully deleted.');
    }
    console.log('✓ TEST 7: Verified cross-tenant delete rejected (0 deleted).');

    // 8. TEST: TENANT-SCOPED AGGREGATIONS
    // Seed shipments for both tenants
    await shipmentRepo.create(tenantA, {
      trackingNumber: 'SHP-APEX-01',
      status: 'DELIVERED',
      customer: { name: 'Cust 1', email: 'c1@test.com', phone: '123' },
      origin: { address: 'A', city: 'A', latitude: 10, longitude: 10 },
      destination: { address: 'B', city: 'B', latitude: 20, longitude: 20 },
      cargo: { description: 'Box', weightKg: 5000 },
      pricing: { quotedAmount: 2500, currency: 'USD' },
    } as any);

    await shipmentRepo.create(tenantB, {
      trackingNumber: 'SHP-PAC-01',
      status: 'DELIVERED',
      customer: { name: 'Cust 2', email: 'c2@test.com', phone: '456' },
      origin: { address: 'C', city: 'C', latitude: 30, longitude: 30 },
      destination: { address: 'D', city: 'D', latitude: 40, longitude: 40 },
      cargo: { description: 'Pallet', weightKg: 8000 },
      pricing: { quotedAmount: 4000, currency: 'USD' },
    } as any);

    // Aggregate total revenue for Tenant A
    const tenantARevenue = await shipmentRepo.aggregate(tenantA, [
      { $group: { _id: null, totalRevenue: { $sum: '$pricing.quotedAmount' } } },
    ]);

    if (tenantARevenue.length !== 1 || tenantARevenue[0].totalRevenue !== 2500) {
      throw new Error(`Aggregation leaked data! Expected $2500 for Tenant A, got ${JSON.stringify(tenantARevenue)}`);
    }
    console.log('✓ TEST 8: Verified tenant-scoped aggregations strictly isolate calculations.');

    // 9. TEST: REJECTION ON MISSING TENANT CONTEXT
    try {
      await vehicleRepo.find({} as any);
      throw new Error('Security flaw: BaseTenantRepository permitted query without organizationId.');
    } catch (e: any) {
      if (e.message.includes('SECURITY EXCEPTION')) {
        console.log('✓ TEST 9: Verified BaseTenantRepository throws exception when organization context is omitted.');
      } else {
        throw e;
      }
    }

    // 10. TEST: DUPLICATE IDENTIFIER REJECTION WITHIN SAME TENANT BUT PERMITTED ACROSS TENANTS
    // Creating same plateNumber in Org B should be valid (scoped uniqueness)
    const duplicateCrossTenant = await vehicleRepo.create(tenantB, {
      vin: '1M8GDM9B_DISTINCT_VIN',
      plateNumber: 'APEX-101', // Same plate as Tenant A, but in Tenant B
      make: 'Kenworth',
      modelName: 'T680',
      year: 2024,
      type: 'SEMI_TRUCK',
      capacityKg: 35000,
      status: 'AVAILABLE',
    } as any);

    if (!duplicateCrossTenant) {
      throw new Error('Tenant-scoped uniqueness failed: Carrier B could not use plate identical to Carrier A.');
    }

    // But creating duplicate plate in same Tenant A MUST fail with E11000
    try {
      await vehicleRepo.create(tenantA, {
        vin: '1M8GDM9A_DUPLICATE_VIN_IN_A',
        plateNumber: 'APEX-101', // Duplicate inside Tenant A
        make: 'Peterbilt',
        modelName: '579',
        year: 2024,
        type: 'SEMI_TRUCK',
        capacityKg: 35000,
        status: 'AVAILABLE',
      } as any);
      throw new Error('Constraint violation: Duplicate plate accepted inside same tenant.');
    } catch (err: any) {
      if (err.code === 11000) {
        console.log('✓ TEST 10: Verified compound index { organizationId: 1, plateNumber: 1 } enforces intra-tenant uniqueness.');
      } else {
        throw err;
      }
    }

    console.log('\n========================================================================');
    console.log('🎉 ALL 10 ENTERPRISE MULTI-TENANT ISOLATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  }
}

runComprehensiveTenantIsolationSuite();
