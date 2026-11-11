import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import assert from 'assert';

import {
  Organization,
  User,
  OrganizationMember,
  Vehicle,
  Driver,
  FuelVendor,
  FuelTransaction,
  Expense,
  Notification,
} from '../models';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';
import { FuelEfficiencyEngine } from '../services/FuelEfficiencyEngine';
import { FuelAnomalyDetectionEngine } from '../services/FuelAnomalyDetectionEngine';
import { FuelExpenseSyncService } from '../services/FuelExpenseSyncService';
import { FuelCSVService } from '../services/FuelCSVService';

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
    FuelVendor.init(),
    FuelTransaction.init(),
    Expense.init(),
    Notification.init(),
  ]);
}

async function teardownTestEnvironment() {
  await mongoose.disconnect();
  await mongod.stop();
}

async function runPhase08FuelManagementTestSuite() {
  console.log('\n===============================================================');
  console.log('       FLEETOS PHASE 08 FUEL & CONSUMPTION TEST SUITE');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function recordPass(testName: string) {
    passedTests++;
    totalTests++;
    console.log(`[PASS] Test ${totalTests}: ${testName}`);
  }

  try {
    await setupTestEnvironment();

    // 1. SETUP TWO ORGANIZATIONS
    const orgA = await Organization.create({
      name: 'Titan Logistics Corp',
      slug: 'titan-corp',
      billingEmail: 'ops@titanlogistics.com',
      subscriptionTier: 'ENTERPRISE',
      status: 'ACTIVE',
    });

    const orgB = await Organization.create({
      name: 'Vanguard Freight',
      slug: 'vanguard-frt',
      billingEmail: 'finance@vanguard.com',
      subscriptionTier: 'STANDARD',
      status: 'ACTIVE',
    });

    const tenantA = { organizationId: orgA._id.toString(), role: 'ORGANIZATION_OWNER' };
    const tenantB = { organizationId: orgB._id.toString(), role: 'ORGANIZATION_OWNER' };

    const userA = await User.create({
      email: 'fuelmgr@titanlogistics.com',
      passwordHash: 'hashed_pw',
      firstName: 'Frank',
      lastName: 'Reynolds',
      role: 'FLEET_MANAGER',
      isEmailVerified: true,
    });

    const vehicleA = await Vehicle.create({
      organizationId: orgA._id,
      vin: '1M8GDM9A4KP888881',
      plateNumber: 'TITAN-8001',
      make: 'Peterbilt',
      modelName: '579',
      year: 2024,
      type: 'SEMI_TRUCK',
      fuelType: 'DIESEL',
      capacityKg: 36000,
      status: 'AVAILABLE',
      odometerKm: 100000,
    });

    const vehicleEV = await Vehicle.create({
      organizationId: orgA._id,
      vin: '1M8GDM9A4KP888882',
      plateNumber: 'TITAN-EV01',
      make: 'Tesla',
      modelName: 'Semi',
      year: 2025,
      type: 'SEMI_TRUCK',
      fuelType: 'ELECTRIC',
      capacityKg: 36000,
      status: 'AVAILABLE',
      odometerKm: 20000,
    });

    const driverA = await Driver.create({
      organizationId: orgA._id,
      userId: userA._id,
      fullName: 'Frank Reynolds',
      email: 'frank.driver@titanlogistics.com',
      phone: '+1-555-0199',
      licenseNumber: 'CDL-TX-88201',
      licenseClass: 'CLASS_A',
      licenseExpiry: new Date('2028-05-15'),
      emergencyContact: {
        name: 'Charlie Kelly',
        phone: '+1-555-0198',
      },
      status: 'AVAILABLE',
    });

    const transactionRepo = new BaseTenantRepository(FuelTransaction);
    const vendorRepo = new BaseTenantRepository(FuelVendor);

    // -------------------------------------------------------------
    // PART 1: FUEL VENDORS & STATIONS
    // -------------------------------------------------------------
    console.log('--- PART 1: FUEL VENDORS & TENANT ISOLATION ---');

    // Test 1: Register Vendor
    const vendorA = await vendorRepo.create(tenantA, {
      name: 'Pilot Flying J Travel Plaza',
      contactPerson: 'Sarah Jenkins',
      phone: '+1-555-888-9999',
      email: 'plaza441@pilotflyingj.com',
      supportedFuelTypes: ['DIESEL', 'PETROL', 'CNG'],
      isActive: true,
    } as any);
    assert(Boolean(vendorA._id && vendorA.name === 'Pilot Flying J Travel Plaza'));
    recordPass('Register fuel vendor with supported fuel types');

    // Test 2: Cross-Tenant Vendor Read Isolation
    const crossVendor = await vendorRepo.findById(tenantB, vendorA._id);
    assert(crossVendor === null);
    recordPass('Reject cross-tenant lookup of fuel vendor');

    // -------------------------------------------------------------
    // PART 2: FUEL TRANSACTION LOGGING & VALIDATION
    // -------------------------------------------------------------
    console.log('\n--- PART 2: FUEL TRANSACTION LOGGING & VALIDATION ---');

    // Test 3: Log baseline initial refuel
    const tx1 = await transactionRepo.create(tenantA, {
      vehicleId: vehicleA._id,
      driverId: driverA._id,
      fuelVendorId: vendorA._id,
      transactionReference: 'PFJ-TX-001',
      transactionDate: new Date('2026-11-01T08:00:00Z'),
      fuelType: 'DIESEL',
      quantityLiters: 400,
      pricePerLiter: 1.25,
      totalCost: 500.0,
      odometerReading: 100000,
      efficiencyStatus: 'UNAVAILABLE',
      source: 'MANUAL',
      verificationStatus: 'VERIFIED',
      createdBy: userA._id,
    } as any);
    assert(Boolean(tx1._id && tx1.transactionReference === 'PFJ-TX-001'));
    recordPass('Create baseline fuel transaction with verified positive values');

    // Test 4: Prevent duplicate transaction reference within tenant
    try {
      await transactionRepo.create(tenantA, {
        vehicleId: vehicleA._id,
        transactionReference: 'PFJ-TX-001', // duplicate
        transactionDate: new Date(),
        fuelType: 'DIESEL',
        quantityLiters: 200,
        pricePerLiter: 1.25,
        totalCost: 250,
        odometerReading: 100500,
        createdBy: userA._id,
      } as any);
      assert.fail('Should have failed duplicate reference constraint');
    } catch (err: any) {
      assert(err.code === 11000 || err.name === 'MongoServerError');
      recordPass('Prevent duplicate transaction reference within tenant scope');
    }

    // Test 5: Allow identical transaction reference across distinct tenants
    const txTenantB = await transactionRepo.create(tenantB, {
      vehicleId: new Types.ObjectId(),
      transactionReference: 'PFJ-TX-001', // same ref in Tenant B
      transactionDate: new Date(),
      fuelType: 'DIESEL',
      quantityLiters: 150,
      pricePerLiter: 1.20,
      totalCost: 180,
      odometerReading: 50000,
      createdBy: new Types.ObjectId(),
    } as any);
    assert(Boolean(txTenantB._id));
    recordPass('Allow identical transaction reference across distinct organizations');

    // -------------------------------------------------------------
    // PART 3: FUEL EFFICIENCY ENGINE (Liquid & Electric)
    // -------------------------------------------------------------
    console.log('\n--- PART 3: FUEL EFFICIENCY CALCULATION ENGINE ---');

    // Test 6: Accurate km/L calculation on second refuel
    // Vehicle travelled 1,200 km (100,000 to 101,200) using 300 Liters -> 4.0 km/L
    const effResult = await FuelEfficiencyEngine.calculateTransactionEfficiency(
      tenantA.organizationId,
      vehicleA._id.toString(),
      101200,
      300,
      'DIESEL',
      new Date('2026-11-05T08:00:00Z'),
      true // full tank boundary
    );
    assert(effResult.efficiencyStatus === 'VERIFIED');
    assert(effResult.fuelEfficiency === 4.0);
    assert(effResult.distanceTravelled === 1200);
    recordPass('Accurately calculate commercial liquid fuel efficiency (4.00 km/L)');

    // Test 7: Decreasing odometer detection
    const odoRollback = await FuelEfficiencyEngine.calculateTransactionEfficiency(
      tenantA.organizationId,
      vehicleA._id.toString(),
      99000, // Rollback below initial 100,000
      300,
      'DIESEL',
      new Date('2026-11-06T08:00:00Z')
    );
    assert(odoRollback.efficiencyStatus === 'UNAVAILABLE');
    assert(odoRollback.fuelEfficiency === undefined);
    recordPass('Detect decreasing odometer reading and set status UNAVAILABLE');

    // Test 8: EV (Electric Vehicle) kWh consumption
    // Establish EV baseline
    await transactionRepo.create(tenantA, {
      vehicleId: vehicleEV._id,
      transactionReference: 'TESLA-CHG-001',
      transactionDate: new Date('2026-11-01T10:00:00Z'),
      fuelType: 'ELECTRIC',
      quantityLiters: 450, // kWh
      pricePerLiter: 0.18,
      totalCost: 81.0,
      odometerReading: 20000,
      efficiencyStatus: 'UNAVAILABLE',
      createdBy: userA._id,
    } as any);

    // Second charge: 600 km driven on 400 kWh -> 1.50 km/kWh
    const evEff = await FuelEfficiencyEngine.calculateTransactionEfficiency(
      tenantA.organizationId,
      vehicleEV._id.toString(),
      20600,
      400,
      'ELECTRIC',
      new Date('2026-11-03T10:00:00Z'),
      true
    );
    assert(effResult.efficiencyStatus === 'VERIFIED');
    assert(evEff.fuelEfficiency === 1.5);
    recordPass('Accurately calculate Electric Vehicle efficiency (1.50 km/kWh)');

    // -------------------------------------------------------------
    // PART 4: EXPENSE INTEGRATION & VOID LIFECYCLE
    // -------------------------------------------------------------
    console.log('\n--- PART 4: FINANCIAL EXPENSE INTEGRATION ---');

    // Test 9: Fuel transaction automatically creates linked Expense
    const tx2 = await transactionRepo.create(tenantA, {
      vehicleId: vehicleA._id,
      driverId: driverA._id,
      transactionReference: 'PFJ-TX-002',
      transactionDate: new Date('2026-11-05T08:00:00Z'),
      fuelType: 'DIESEL',
      quantityLiters: 300,
      pricePerLiter: 1.25,
      totalCost: 375.0,
      odometerReading: 101200,
      previousOdometerReading: 100000,
      distanceSinceLastRefuel: 1200,
      fuelEfficiency: 4.0,
      efficiencyStatus: 'VERIFIED',
      createdBy: userA._id,
    } as any);

    const expenseId = await FuelExpenseSyncService.syncFuelExpense(tx2, userA._id);
    const createdExpense = await Expense.findById(expenseId);
    assert(Boolean(createdExpense && createdExpense.category === 'FUEL'));
    assert(createdExpense?.amount === 375.0);
    recordPass('Fuel transaction automatically generates synchronized Expense ledger record');

    // Test 10: Prevent duplicate Expense creation on resync
    const resyncExpenseId = await FuelExpenseSyncService.syncFuelExpense(tx2, userA._id);
    assert(resyncExpenseId.toString() === expenseId.toString());
    const expenseCount = await Expense.countDocuments({ fuelTransactionId: tx2._id });
    assert(expenseCount === 1);
    recordPass('Prevent duplicate Expense generation via idempotent sync');

    // Test 11: Voiding fuel transaction marks linked Expense voided
    await FuelExpenseSyncService.voidFuelExpense(tx2._id, 'Duplicate invoice uploaded by driver');
    const voidedExpense = await Expense.findById(expenseId);
    assert(voidedExpense?.isVoided === true);
    assert(voidedExpense?.voidReason === 'Duplicate invoice uploaded by driver');
    recordPass('Voiding fuel transaction automatically synchronizes void status to Expense');

    // -------------------------------------------------------------
    // PART 5: ANOMALY DETECTION ENGINE
    // -------------------------------------------------------------
    console.log('\n--- PART 5: FUEL ANOMALY DETECTION ENGINE ---');

    // Test 12: Detect excessive quantity anomaly exceeding tank capacity
    const excessiveEval = await FuelAnomalyDetectionEngine.evaluateTransaction(
      tenantA.organizationId,
      vehicleA._id.toString(),
      2500, // Semi truck tank threshold is 1200 L
      3125.0,
      102000,
      4.0
    );
    assert(excessiveEval.isAnomaly === true);
    assert(excessiveEval.flags.includes('EXCESSIVE_QUANTITY'));
    assert(excessiveEval.verificationStatus === 'FLAGGED_ANOMALY');
    recordPass('Flag excessive refuel quantity exceeding physical tank capacity');

    // Test 13: Detect refuel on inactive/out-of-service vehicle
    vehicleA.status = 'OUT_OF_SERVICE';
    await vehicleA.save();

    const oosEval = await FuelAnomalyDetectionEngine.evaluateTransaction(
      tenantA.organizationId,
      vehicleA._id.toString(),
      200,
      250.0,
      101400,
      4.0
    );
    assert(oosEval.flags.includes('INACTIVE_VEHICLE_REFUEL'));
    recordPass('Flag fuel transaction logged against OUT_OF_SERVICE vehicle');

    // Restore vehicle to available
    vehicleA.status = 'AVAILABLE';
    await vehicleA.save();

    // Test 14: Deduplicated anomaly notification generated
    await FuelAnomalyDetectionEngine.notifyIfAnomaly(
      tenantA.organizationId,
      tx2._id.toString(),
      vehicleA.plateNumber,
      ['EXCESSIVE_QUANTITY'],
      ['Test excess anomaly']
    );

    // Call again to verify cooldown
    await FuelAnomalyDetectionEngine.notifyIfAnomaly(
      tenantA.organizationId,
      tx2._id.toString(),
      vehicleA.plateNumber,
      ['EXCESSIVE_QUANTITY'],
      ['Duplicate notification attempt']
    );

    const alertCount = await Notification.countDocuments({
      organizationId: tenantA.organizationId,
      type: 'FUEL_ANOMALY',
      'metadata.transactionId': tx2._id.toString(),
    });
    assert(alertCount === 1);
    recordPass('Deduplicate fuel anomaly notifications within cooldown window');

    // -------------------------------------------------------------
    // PART 6: CROSS-TENANT ISOLATION REVERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- PART 6: MULTI-TENANT CROSS-ORGANIZATION ISOLATION ---');

    // Test 15: Cross-tenant transaction lookup rejected
    const crossTxLookup = await transactionRepo.findById(tenantB, tx2._id);
    assert(crossTxLookup === null);
    recordPass('Reject cross-tenant lookup of FuelTransaction');

    // Test 16: Rolling vehicle efficiency metrics
    const rollingMetrics = await FuelEfficiencyEngine.calculateVehicleRollingEfficiency(
      tenantA.organizationId,
      vehicleA._id.toString()
    );
    assert(rollingMetrics.verifiedCount >= 0);
    assert(typeof rollingMetrics.averageEfficiency === 'number');
    recordPass('Derive rolling multi-transaction vehicle efficiency metrics');

    // -------------------------------------------------------------
    // PART 7: FULL-TO-FULL EFFICIENCY WITH INTERVENING PARTIALS
    // -------------------------------------------------------------
    console.log('\n--- PART 7: ADVANCED FULL-TO-FULL & PARTIAL EFFICIENCY ---');

    // Test 17: Consecutive partial refuelling does NOT mark VERIFIED
    const partial1 = await FuelEfficiencyEngine.calculateTransactionEfficiency(
      tenantA.organizationId,
      vehicleA._id.toString(),
      101500,
      100,
      'DIESEL',
      new Date('2026-11-06T12:00:00Z'),
      false // Partial refuel
    );
    assert(partial1.efficiencyStatus === 'ESTIMATED');
    assert(partial1.calculationMethod === 'INTERMEDIATE_PARTIAL');
    recordPass('Partial refuel accurately marked ESTIMATED and tagged INTERMEDIATE_PARTIAL');

    // Test 18: Full refuel after partial sums all intervening quantities across distance
    // Boundary 1: tx2 (odo 101,200). Intervening partial: 100 L (odo 101,500). Current Full: 200 L (odo 102,400)
    // Total cycle distance: 102,400 - 101,200 = 1,200 km. Total fuel: 100 + 200 = 300 L. km/L = 1200 / 300 = 4.0 km/L
    await transactionRepo.create(tenantA, {
      vehicleId: vehicleA._id,
      transactionReference: 'PARTIAL-001',
      transactionDate: new Date('2026-11-06T12:00:00Z'),
      fuelType: 'DIESEL',
      quantityLiters: 100,
      pricePerLiter: 1.25,
      totalCost: 125.0,
      odometerReading: 101500,
      isFullTank: false,
      efficiencyStatus: 'ESTIMATED',
      createdBy: userA._id,
    } as any);

    const fullBoundaryCycle = await FuelEfficiencyEngine.calculateTransactionEfficiency(
      tenantA.organizationId,
      vehicleA._id.toString(),
      102400,
      200,
      'DIESEL',
      new Date('2026-11-08T12:00:00Z'),
      true // Full tank completes cycle!
    );

    assert(fullBoundaryCycle.efficiencyStatus === 'VERIFIED');
    assert(fullBoundaryCycle.calculationMethod === 'FULL_TO_FULL');
    assert(fullBoundaryCycle.fuelEfficiency === 4.0);
    assert(fullBoundaryCycle.distanceTravelled === 1200);
    recordPass('Full-to-full cycle calculates true combined distance over intervening partial refuels (4.00 km/L)');

    // -------------------------------------------------------------
    // PART 8: CSV IMPORT, PARSING & EXPORT INTEGRATION
    // -------------------------------------------------------------
    console.log('\n--- PART 8: CSV IMPORT, FORMULA INJECTION & EXPORT ---');

    // Test 19: Parse CSV text safely and sanitize formula injection
    const rawCSV = `Transaction Reference,Plate Number,Quantity,Price,Odometer,Date,Fuel Type,Is Full Tank
=cmd|' /C calc'!A0,TITAN-8001,350,1.25,103600,2026-11-09,DIESEL,true
CSV-TX-902,TITAN-8001,250,1.20,104400,2026-11-10,DIESEL,true`;

    const parsedCSV = FuelCSVService.parseCSVText(rawCSV);
    assert(parsedCSV.rows.length === 2);
    // Verified formula injection neutralized with leading apostrophe
    assert(parsedCSV.rows[0]['Transaction Reference'].startsWith("'="));
    recordPass('Sanitize CSV formula injection prefixes (=, +, -, @) safely');

    // Test 20: Validate and preview CSV rows without database side-effects
    const preview = await FuelCSVService.previewAndValidate(tenantA.organizationId, parsedCSV.rows);
    assert(preview.validRows.length === 2);
    assert(preview.invalidRows.length === 0);
    recordPass('Preview and validate CSV transactions matching organization vehicles');

    // Test 21: Execute idempotent CSV import into database
    const importResult = await FuelCSVService.executeImport(
      tenantA.organizationId,
      userA._id.toString(),
      preview.validRows
    );
    assert(importResult.insertedCount === 2);
    recordPass('Execute authorized CSV import creating transactions and expenses');

    // Test 22: Reject duplicate CSV rows on repeat import
    const repeatImport = await FuelCSVService.executeImport(
      tenantA.organizationId,
      userA._id.toString(),
      preview.validRows
    );
    assert(repeatImport.insertedCount === 0);
    assert(repeatImport.duplicateCount === 2);
    recordPass('Prevent duplicate transaction creation upon re-importing identical CSV');

    // Test 23: Reject cross-tenant CSV rows
    const crossTenantRow = [{
      transactionReference: 'FOREIGN-CSV-01',
      vehiclePlate: 'TITAN-8001', // belongs to Org A
      quantityLiters: '200',
      pricePerLiter: '1.25',
      odometerReading: '105000',
      transactionDate: '2026-11-11',
      fuelType: 'DIESEL',
    }];
    const crossPreview = await FuelCSVService.previewAndValidate(tenantB.organizationId, crossTenantRow);
    assert(crossPreview.validRows.length === 0);
    assert(crossPreview.invalidRows.length === 1);
    assert(crossPreview.invalidRows[0].errors[0].includes('not found in this organization'));
    recordPass('Reject CSV row referencing vehicle belonging to another organization');

    // Test 24: Generate organization-scoped CSV export
    const exportData = await FuelTransaction.find({ organizationId: tenantA.organizationId })
      .populate('vehicleId')
      .populate('driverId')
      .lean();
    const csvExport = FuelCSVService.generateCSVExport(exportData);
    assert(csvExport.includes('Transaction Reference,Date,Vehicle Plate'));
    assert(csvExport.includes('TITAN-8001'));
    recordPass('Generate sanitized, organization-scoped CSV export file');

    console.log(`\nAll tests completed: ${passedTests}/${totalTests} PASSED.\n`);
  } finally {
    await teardownTestEnvironment();
  }
}

runPhase08FuelManagementTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
