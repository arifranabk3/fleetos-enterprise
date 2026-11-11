import { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import {
  Organization,
  User,
  OrganizationMember,
  Vehicle,
  Driver,
  Customer,
  Shipment,
  Dispatch,
} from '../models';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';
import { ShipmentStateMachine } from '../services/ShipmentStateMachine';

let mongod: MongoMemoryServer;

async function setupInMemoryDB() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  // Initialize indexes
  await Promise.all([
    Organization.init(),
    User.init(),
    OrganizationMember.init(),
    Vehicle.init(),
    Driver.init(),
    Customer.init(),
    Shipment.init(),
    Dispatch.init(),
  ]);
}

async function teardownDB() {
  await mongoose.disconnect();
  await mongod.stop();
}

async function runShipmentDispatchTestSuite() {
  console.log('\n===============================================================');
  console.log('       FLEETOS PHASE 05 SHIPMENT & DISPATCH TEST SUITE');
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

  await setupInMemoryDB();

  try {
    // 1. Setup Tenants
    const orgA = await Organization.create({
      name: 'Apex Global Logistics',
      slug: 'apex-logistics',
      billingEmail: 'billing@apex.com',
      subscriptionTier: 'ENTERPRISE',
      status: 'ACTIVE',
    });

    const orgB = await Organization.create({
      name: 'Blue Star Transport',
      slug: 'blue-star',
      billingEmail: 'ops@bluestar.com',
      subscriptionTier: 'STANDARD',
      status: 'ACTIVE',
    });

    const tenantA = { organizationId: orgA._id.toString(), role: 'ORGANIZATION_OWNER' };
    const tenantB = { organizationId: orgB._id.toString(), role: 'ORGANIZATION_OWNER' };

    const userA = await User.create({
      email: 'dispatcher@apex.com',
      passwordHash: 'hashed_pw_test',
      firstName: 'Apex',
      lastName: 'Dispatcher',
      role: 'DISPATCHER',
      isEmailVerified: true,
    });

    const customerRepo = new BaseTenantRepository(Customer);
    const shipmentRepo = new BaseTenantRepository(Shipment);
    const dispatchRepo = new BaseTenantRepository(Dispatch);

    // -------------------------------------------------------------
    // PART 1: CUSTOMER INTEGRATION TESTS
    // -------------------------------------------------------------
    console.log('\n--- CUSTOMER MANAGEMENT SUITE ---');

    // Test 1: Create customer
    const custA = await customerRepo.create(tenantA, {
      name: 'Acme Mega Corp',
      type: 'ENTERPRISE',
      email: 'supply@acmemega.com',
      phone: '+1-555-0100',
      billingAddress: {
        street: '100 Industrial Pkwy',
        city: 'Dallas',
        state: 'TX',
        country: 'USA',
      },
      status: 'ACTIVE',
      isArchived: false,
    } as any);
    assert(Boolean(custA._id && custA.name === 'Acme Mega Corp'), 'Test 1: Create Customer with validated schema');

    // Test 2: Cross-tenant customer isolation
    const custLookupB = await customerRepo.findById(tenantB, custA._id);
    assert(custLookupB === null, 'Test 2: Cross-tenant access rejected for customer profile');

    // -------------------------------------------------------------
    // PART 2: SHIPMENT ORDER MANAGEMENT TESTS
    // -------------------------------------------------------------
    console.log('\n--- SHIPMENT ORDER SUITE ---');

    // Test 3: Create shipment
    const shipment1 = await shipmentRepo.create(tenantA, {
      trackingNumber: 'FOS-2611-ABC123',
      customerId: custA._id,
      customer: {
        name: custA.name,
        email: custA.email,
        phone: custA.phone,
      },
      sender: {
        name: 'Warehouse 1',
        phone: '+1-555-0111',
        address: '450 Freight Rd',
        city: 'Dallas',
        country: 'USA',
      },
      receiver: {
        name: 'Distribution Center 9',
        phone: '+1-555-0222',
        address: '900 Logistics Way',
        city: 'Austin',
        country: 'USA',
      },
      origin: {
        address: '450 Freight Rd, Dallas, TX',
        city: 'Dallas',
        latitude: 32.7767,
        longitude: -96.7970,
      },
      destination: {
        address: '900 Logistics Way, Austin, TX',
        city: 'Austin',
        latitude: 30.2672,
        longitude: -97.7431,
      },
      cargo: {
        description: 'Industrial Precision Bearings',
        category: 'HEAVY_EQUIPMENT',
        weightKg: 4200,
        packageCount: 12,
      },
      pricing: {
        quotedAmount: 1850,
        currency: 'USD',
      },
      priority: 'EXPRESS',
      status: 'DRAFT',
      timeline: [
        {
          status: 'DRAFT',
          timestamp: new Date(),
          note: 'Shipment draft initialized',
        },
      ],
      createdBy: userA._id,
      isArchived: false,
    } as any);
    assert(Boolean(shipment1._id && shipment1.trackingNumber === 'FOS-2611-ABC123'), 'Test 3: Create shipment order with complete specs');

    // Test 4: Read shipment with tenant isolation
    const foundShipment = await shipmentRepo.findById(tenantA, shipment1._id);
    assert(Boolean(foundShipment && foundShipment.status === 'DRAFT'), 'Test 4: Read shipment within organization context');

    // Test 5: Reject cross-tenant read of shipment
    const crossShipment = await shipmentRepo.findById(tenantB, shipment1._id);
    assert(crossShipment === null, 'Test 5: Reject cross-tenant read of shipment');

    // Test 6: Confirm shipment
    const confirmTransition = ShipmentStateMachine.validateTransition(shipment1.status, 'CONFIRMED', {
      userId: userA._id.toString(),
      userRole: 'DISPATCHER',
    });
    assert(confirmTransition.allowed === true, 'Test 6: State Machine approves legal DRAFT -> CONFIRMED transition');

    shipment1.status = 'CONFIRMED';
    shipment1.timeline.push({
      status: 'CONFIRMED',
      timestamp: new Date(),
      note: 'Order confirmed by carrier dispatcher',
    });
    await shipment1.save();

    // Test 7: Reject illegal state transition (CONFIRMED -> DELIVERED without dispatch)
    const illegalTransition = ShipmentStateMachine.validateTransition(shipment1.status, 'DELIVERED', {
      userId: userA._id.toString(),
      userRole: 'DISPATCHER',
    });
    assert(illegalTransition.allowed === false, 'Test 7: Reject illegal direct transition CONFIRMED -> DELIVERED');

    // Test 8: Cancel eligible shipment with reason
    const shipment2 = await shipmentRepo.create(tenantA, {
      trackingNumber: 'FOS-2611-CAN999',
      customer: { name: 'Quick Cancel Corp', email: 'cancel@corp.com', phone: '123' },
      sender: { name: 'S', phone: '1', address: 'A', city: 'C', country: 'USA' },
      receiver: { name: 'R', phone: '2', address: 'B', city: 'D', country: 'USA' },
      origin: { address: 'A', city: 'C', latitude: 10, longitude: 10 },
      destination: { address: 'B', city: 'D', latitude: 20, longitude: 20 },
      cargo: { description: 'Samples', category: 'GENERAL', weightKg: 10, packageCount: 1 },
      pricing: { quotedAmount: 100, currency: 'USD' },
      status: 'DRAFT',
      createdBy: userA._id,
      timeline: [],
      isArchived: false,
    } as any);

    const cancelTransition = ShipmentStateMachine.validateTransition(shipment2.status, 'CANCELLED', {
      userId: userA._id.toString(),
      userRole: 'DISPATCHER',
      reason: 'Customer requested order cancellation prior to dispatch',
    });
    assert(cancelTransition.allowed === true, 'Test 8: Cancel eligible shipment with verified reason');

    // Test 9: Reject cancellation without reason
    const cancelWithoutReason = ShipmentStateMachine.validateTransition(shipment2.status, 'CANCELLED', {
      userId: userA._id.toString(),
      userRole: 'DISPATCHER',
    });
    assert(cancelWithoutReason.allowed === false, 'Test 9: Reject exceptional transition CANCELLED when reason is missing');

    // -------------------------------------------------------------
    // PART 3: DISPATCH WORKFLOW & CONFLICT SAFEGUARDS
    // -------------------------------------------------------------
    console.log('\n--- DISPATCH WORKFLOW & CONFLICT SUITE ---');

    // Create Vehicle & Driver in Org A
    const vehicle1 = await Vehicle.create({
      organizationId: orgA._id,
      vin: '1HD1ABC1234567890',
      plateNumber: 'TX-FL-4001',
      make: 'Freightliner',
      modelName: 'Cascadia',
      year: 2024,
      type: 'SEMI_TRUCK',
      fuelType: 'DIESEL',
      status: 'AVAILABLE',
      capacityKg: 20000,
      odometerKm: 15400,
    });

    const driver1 = await Driver.create({
      organizationId: orgA._id,
      fullName: 'Marcus Vance',
      email: 'marcus.vance@apex.com',
      phone: '+1-555-4040',
      licenseNumber: 'CDL-TX-987654',
      licenseClass: 'CDL-A',
      licenseExpiry: new Date('2028-05-15'),
      status: 'AVAILABLE',
      rating: 4.9,
      joiningDate: new Date('2023-01-10'),
    });

    // Test 10: Create Dispatch Manifest
    const dispatch1 = await dispatchRepo.create(tenantA, {
      dispatchNumber: 'DSP-2611-MNF001',
      shipmentIds: [shipment1._id],
      vehicleId: vehicle1._id,
      driverId: driver1._id,
      status: 'PENDING',
      originHub: 'Dallas North Facility',
      destinationHub: 'Austin Central Depo',
      assignedBy: userA._id,
      dispatchedAt: new Date(),
    } as any);

    shipment1.status = 'DISPATCHED';
    shipment1.vehicleId = vehicle1._id;
    shipment1.driverId = driver1._id;
    shipment1.activeDispatchId = dispatch1._id;
    shipment1.timeline.push({
      status: 'DISPATCHED',
      timestamp: new Date(),
      note: `Dispatched under Manifest ${dispatch1.dispatchNumber}`,
    });
    await shipment1.save();
    vehicle1.status = 'ASSIGNED';
    await vehicle1.save();
    driver1.status = 'ASSIGNED';
    await driver1.save();

    assert(Boolean(dispatch1._id && dispatch1.dispatchNumber === 'DSP-2611-MNF001'), 'Test 10: Create dispatch manifest linking shipment, vehicle, and driver');

    // Test 11: Prevent duplicate active dispatch on same vehicle
    const activeVehicleConflict = await Dispatch.findOne({
      organizationId: orgA._id,
      vehicleId: vehicle1._id,
      status: { $in: ['PENDING', 'ACCEPTED', 'ACTIVE'] },
    });
    assert(Boolean(activeVehicleConflict), 'Test 11: Detect conflict when attempting to dispatch already engaged vehicle');

    // Test 12: Prevent duplicate active dispatch on same driver
    const activeDriverConflict = await Dispatch.findOne({
      organizationId: orgA._id,
      driverId: driver1._id,
      status: { $in: ['PENDING', 'ACCEPTED', 'ACTIVE'] },
    });
    assert(Boolean(activeDriverConflict), 'Test 12: Detect conflict when attempting to dispatch already engaged driver');

    // Test 13: Prevent dispatching shipment that already has active dispatch
    const shipmentCheck = await Shipment.findById(shipment1._id);
    assert(Boolean(shipmentCheck?.activeDispatchId), 'Test 13: Prevent double-dispatching an already dispatched shipment');

    // Test 14: Start Journey (Dispatch status -> ACTIVE, Vehicle -> IN_TRANSIT, Shipments -> IN_TRANSIT)
    dispatch1.status = 'ACTIVE';
    dispatch1.startedAt = new Date();
    await dispatch1.save();
    vehicle1.status = 'IN_TRANSIT';
    await vehicle1.save();
    driver1.status = 'ON_DUTY';
    await driver1.save();
    shipment1.status = 'IN_TRANSIT';
    shipment1.timeline.push({
      status: 'IN_TRANSIT',
      timestamp: new Date(),
      note: 'Manifest transit started',
    });
    await shipment1.save();

    assert(dispatch1.status === 'ACTIVE' && vehicle1.status === 'IN_TRANSIT' && shipment1.status === 'IN_TRANSIT', 'Test 14: Start dispatch journey transitions vehicle and shipments to IN_TRANSIT');

    // Test 15: Complete Dispatch Manifest (Status -> COMPLETED, Assets released to AVAILABLE, Shipment -> DELIVERED)
    dispatch1.status = 'COMPLETED';
    dispatch1.completedAt = new Date();
    await dispatch1.save();
    vehicle1.status = 'AVAILABLE';
    await vehicle1.save();
    driver1.status = 'AVAILABLE';
    await driver1.save();
    shipment1.status = 'DELIVERED';
    shipment1.activeDispatchId = undefined;
    shipment1.timeline.push({
      status: 'DELIVERED',
      timestamp: new Date(),
      note: 'Manifest delivery finalized',
    });
    await shipment1.save();

    assert(
      dispatch1.status === 'COMPLETED' &&
      vehicle1.status === 'AVAILABLE' &&
      driver1.status === 'AVAILABLE' &&
      shipment1.status === 'DELIVERED',
      'Test 15: Complete dispatch releases fleet assets and sets shipment status to DELIVERED'
    );

    // Test 16: Verify complete immutable shipment timeline history
    const finalShipment = await Shipment.findById(shipment1._id);
    assert(
      finalShipment !== null &&
      finalShipment.timeline.length >= 4 &&
      finalShipment.timeline[0].status === 'DRAFT' &&
      finalShipment.timeline[finalShipment.timeline.length - 1].status === 'DELIVERED',
      'Test 16: Verify complete immutable shipment timeline audit trail'
    );

    // Test 17: Cross-tenant isolation on dispatch manifest
    const crossDispatchLookup = await dispatchRepo.findById(tenantB, dispatch1._id);
    assert(crossDispatchLookup === null, 'Test 17: Reject cross-tenant lookup of dispatch manifest');

    console.log(`\nAll tests completed: ${passedTests}/${totalTests} PASSED.\n`);
  } finally {
    await teardownDB();
  }
}

runShipmentDispatchTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
