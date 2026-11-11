import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Organization, User, Vehicle, Shipment } from '../models';

async function runTenantIsolationTests() {
  console.log('[Test Suite] Starting FleetOS Database Multi-Tenant Isolation Tests...');
  let mongod: MongoMemoryServer | null = null;

  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('[Test Suite] Connected to in-memory test database: fleetos_test');

    // 1. Create Two Distinct Organizations
    // Wait for indexes to finish building
    await Promise.all([
      Organization.init(),
      User.init(),
      Vehicle.init(),
      Shipment.init(),
    ]);

    const orgA = await Organization.create({
      name: 'Apex Global Logistics',
      slug: 'apex-logistics',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
    });

    const orgB = await Organization.create({
      name: 'Pacific Freight Express',
      slug: 'pacific-freight',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    console.log('✓ Successfully created 2 isolated tenant organizations.');

    // 2. Insert Records for Org A
    const vehicleA = await Vehicle.create({
      organizationId: orgA._id,
      vin: '1M8GDM9A_APEX_01',
      plateNumber: 'APEX-889',
      make: 'Volvo',
      modelName: 'VNL 860',
      year: 2024,
      type: 'SEMI_TRUCK',
      capacityKg: 36000,
      status: 'AVAILABLE',
    });

    const shipmentA = await Shipment.create({
      organizationId: orgA._id,
      trackingNumber: 'FLT-APEX-1001',
      status: 'PENDING_DISPATCH',
      customer: {
        name: 'Nexus Retail Corp',
        email: 'logistics@nexus.com',
        phone: '+1-555-0199',
      },
      origin: {
        address: '400 Industrial Pkwy',
        city: 'Chicago, IL',
        latitude: 41.8781,
        longitude: -87.6298,
      },
      destination: {
        address: '750 Logistics Blvd',
        city: 'Dallas, TX',
        latitude: 32.7767,
        longitude: -96.797,
      },
      cargo: {
        description: 'Consumer Electronics & Displays',
        weightKg: 14500,
      },
      pricing: {
        quotedAmount: 4250,
        currency: 'USD',
      },
    });

    // 3. Insert Records for Org B
    const vehicleB = await Vehicle.create({
      organizationId: orgB._id,
      vin: '1M8GDM9B_PACIFIC_01',
      plateNumber: 'PAC-402',
      make: 'Freightliner',
      modelName: 'Cascadia',
      year: 2023,
      type: 'SEMI_TRUCK',
      capacityKg: 34000,
      status: 'AVAILABLE',
    });

    console.log('✓ Successfully created tenant-scoped vehicles and shipments.');

    // 4. TEST: Query Org A Data with Tenant Filter
    const orgAVehicles = await Vehicle.find({ organizationId: orgA._id });
    if (orgAVehicles.length !== 1 || orgAVehicles[0].plateNumber !== 'APEX-889') {
      throw new Error('Tenant isolation failed: Org A query returned invalid vehicle.');
    }

    // 5. TEST: Org B MUST NOT see Org A's Vehicles
    const orgBVehicles = await Vehicle.find({ organizationId: orgB._id });
    if (orgBVehicles.length !== 1 || orgBVehicles[0].plateNumber !== 'PAC-402') {
      throw new Error('Tenant isolation failed: Org B query leaked other tenant data.');
    }

    // 6. TEST: Org B Querying Org A Shipment MUST Return Null/Empty
    const crossTenantShipment = await Shipment.findOne({
      _id: shipmentA._id,
      organizationId: orgB._id, // Tenant B attempting to access Tenant A's shipment
    });

    if (crossTenantShipment !== null) {
      throw new Error('CRITICAL SECURITY VIOLATION: Org B accessed Org A shipment data!');
    }
    console.log('✓ Security Verified: Cross-tenant data leak prevented.');

    // 7. TEST: Compound Index Uniqueness per Tenant
    // Same plateNumber in Org B should succeed (scoped to tenant), but duplicate in Org A should fail.
    try {
      await Vehicle.create({
        organizationId: orgA._id,
        vin: 'DUPLICATE_VIN_APEX',
        plateNumber: 'APEX-889', // Duplicate plate in same tenant Org A
        make: 'Volvo',
        modelName: 'VNL 760',
        year: 2023,
        type: 'SEMI_TRUCK',
        capacityKg: 30000,
        status: 'AVAILABLE',
      });
      throw new Error('Unique constraint failed: Duplicate plate accepted in same tenant.');
    } catch (err: any) {
      if (err.code === 11000) {
        console.log('✓ Verified: Tenant-scoped unique index enforces uniqueness per organization.');
      } else {
        throw err;
      }
    }

    console.log('\n======================================================');
    console.log('🎉 ALL MULTI-TENANT DATABASE ISOLATION TESTS PASSED!');
    console.log('======================================================\n');
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

runTenantIsolationTests();

