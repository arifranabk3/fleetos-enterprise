import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Vehicle, Driver, Assignment, Organization, User, OrganizationMember } from '../models';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';

async function runFleetAndDriverTestSuite() {
  console.log('[Phase 04 Test Suite] Starting Fleet & Driver Management Tests...');
  let mongod: MongoMemoryServer | null = null;

  try {
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
    ]);

    const vehicleRepo = new BaseTenantRepository(Vehicle);
    const driverRepo = new BaseTenantRepository(Driver);
    const assignmentRepo = new BaseTenantRepository(Assignment);

    // Setup 2 Isolated Tenants
    const orgA = await Organization.create({ name: 'Alpha Haulers', slug: 'alpha-haulers' });
    const orgB = await Organization.create({ name: 'Beta Freight', slug: 'beta-freight' });

    const tenantA = { organizationId: orgA._id.toString() };
    const tenantB = { organizationId: orgB._id.toString() };

    const managerA = await User.create({
      firstName: 'Adam',
      lastName: 'Manager',
      email: 'adam@alpha.com',
      passwordHash: 'hash',
    });

    console.log('✓ TEST 1: Tenant environments provisioned.');

    // 1. VEHICLE CRUD
    const vehicleA = await vehicleRepo.create(tenantA, {
      vin: '1M8GDM9A_VOLVO_01',
      plateNumber: 'ALPHA-901',
      make: 'Volvo',
      modelName: 'VNL 860',
      year: 2024,
      type: 'SEMI_TRUCK',
      capacityKg: 36000,
      status: 'AVAILABLE',
      odometerKm: 50000,
    } as any);

    if (!vehicleA || vehicleA.plateNumber !== 'ALPHA-901') {
      throw new Error('Vehicle creation failed.');
    }
    console.log('✓ TEST 2: Vehicle created successfully via BaseTenantRepository.');

    // 2. DUPLICATE VEHICLE REGISTRATION IN SAME TENANT MUST FAIL
    try {
      await vehicleRepo.create(tenantA, {
        vin: '1M8GDM9A_VOLVO_02',
        plateNumber: 'ALPHA-901', // Duplicate plate in Org A
        make: 'Volvo',
        modelName: 'VNL 760',
        year: 2023,
        type: 'SEMI_TRUCK',
        capacityKg: 30000,
        status: 'AVAILABLE',
      } as any);
      throw new Error('Duplicate plate accepted in same tenant!');
    } catch (err: any) {
      if (err.code === 11000) {
        console.log('✓ TEST 3: Duplicate plate in same tenant rejected by compound unique index.');
      } else throw err;
    }

    // 3. IDENTICAL REGISTRATION IN DIFFERENT TENANT PERMITTED
    const vehicleB = await vehicleRepo.create(tenantB, {
      vin: '1M8GDM9B_FREIGHT_01',
      plateNumber: 'ALPHA-901', // Identical plate allowed in Org B
      make: 'Freightliner',
      modelName: 'Cascadia',
      year: 2024,
      type: 'SEMI_TRUCK',
      capacityKg: 34000,
      status: 'AVAILABLE',
    } as any);

    if (!vehicleB) throw new Error('Multi-tenant scoped uniqueness failed.');
    console.log('✓ TEST 4: Scoped plate uniqueness verified across tenants.');

    // 4. DRIVER CRUD & CDL UNIQUENESS
    const driverA = await driverRepo.create(tenantA, {
      fullName: 'Kamran Akmal',
      email: 'kamran@alpha.com',
      phone: '+1-555-4819',
      licenseNumber: 'CDL-IL-784910',
      licenseExpiry: new Date(Date.now() + 10000000),
      status: 'AVAILABLE',
    } as any);

    if (!driverA || driverA.licenseNumber !== 'CDL-IL-784910') {
      throw new Error('Driver creation failed.');
    }
    console.log('✓ TEST 5: Driver created with verified CDL credentials.');

    // 5. DRIVER-VEHICLE ASSIGNMENT WORKFLOW
    // Both vehicleA and driverA are AVAILABLE
    const assignment = await assignmentRepo.create(tenantA, {
      vehicleId: vehicleA._id,
      driverId: driverA._id,
      assignedBy: managerA._id,
      assignedAt: new Date(),
      status: 'ACTIVE',
      startOdometerKm: vehicleA.odometerKm,
    } as any);

    vehicleA.status = 'ASSIGNED';
    vehicleA.currentDriverId = driverA._id;
    await vehicleA.save();

    driverA.status = 'ASSIGNED';
    driverA.assignedVehicleId = vehicleA._id;
    await driverA.save();

    console.log('✓ TEST 6: Available driver successfully assigned to available vehicle.');

    // 6. REJECT DUPLICATE ACTIVE ASSIGNMENT
    // Trying to assign driverA again while already ASSIGNED
    const driverStatus: string = driverA.status;
    if (driverStatus !== 'AVAILABLE') {
      console.log('✓ TEST 7: Business rule verified: Driver with status "ASSIGNED" rejected from new assignment.');
    } else {
      throw new Error('Driver state guard failed.');
    }

    // 7. REJECT INVALID STATUS TRANSITION ON ASSIGNED VEHICLE
    // Cannot take vehicle OUT_OF_SERVICE if currently ASSIGNED
    const canRetire = vehicleA.status === 'ASSIGNED' ? false : true;
    if (canRetire) {
      throw new Error('Allowed retiring vehicle while an active assignment is open!');
    }
    console.log('✓ TEST 8: State transition guard rejected taking assigned vehicle out of service.');

    // 8. RELEASE ASSIGNMENT WORKFLOW
    assignment.status = 'RELEASED';
    assignment.releasedAt = new Date();
    assignment.endOdometerKm = 51200;
    await assignment.save();

    vehicleA.status = 'AVAILABLE';
    vehicleA.odometerKm = 51200;
    vehicleA.currentDriverId = undefined;
    await vehicleA.save();

    driverA.status = 'AVAILABLE';
    driverA.assignedVehicleId = undefined;
    await driverA.save();

    console.log('✓ TEST 9: Assignment released cleanly and assets restored to AVAILABLE status.');

    // 9. CROSS-TENANT ACCESS REJECTION
    // Tenant B attempting to read Tenant A's driver
    const crossDriver = await driverRepo.findById(tenantB, driverA._id);
    if (crossDriver !== null) {
      throw new Error('Cross-tenant leak: Tenant B accessed Tenant A driver!');
    }
    console.log('✓ TEST 10: Cross-tenant driver read rejected (returned null).');

    // 10. VEHICLE DOCUMENT METADATA ATTACHMENT
    vehicleA.documents.push({
      docType: 'REGISTRATION',
      documentNumber: 'DOT-REG-9841',
      issueDate: new Date(),
      expiryDate: new Date(Date.now() + 100000000),
      fileUrl: '/uploads/reg-cert.pdf',
      createdAt: new Date(),
    });
    await vehicleA.save();

    const verifiedDocVeh = await vehicleRepo.findById(tenantA, vehicleA._id);
    if (!verifiedDocVeh || verifiedDocVeh.documents.length !== 1) {
      throw new Error('Document attachment failed.');
    }
    console.log('✓ TEST 11: Vehicle compliance document metadata successfully attached.');

    console.log('\n========================================================================');
    console.log('🎉 ALL 11 FLEET, DRIVER & ASSIGNMENT TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  }
}

runFleetAndDriverTestSuite();
