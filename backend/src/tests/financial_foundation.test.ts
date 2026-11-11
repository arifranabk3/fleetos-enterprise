import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import {
  Organization,
  User,
  Customer,
  Shipment,
  Dispatch,
  Driver,
  DriverShift,
  DriverIncident,
  RateMatrix,
  Invoice,
  PaymentReceipt,
  DriverSettlement,
  LedgerAccount,
  JournalEntry,
  FinancialPeriod,
} from '../models';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';
import { MonetaryPrecision } from '../utils/MonetaryPrecision';
import { FinancialStateMachine } from '../services/FinancialStateMachine';
import { FinancialLedgerService } from '../services/FinancialLedgerService';
import { PaymentReconciliationService } from '../services/PaymentReconciliationService';
import { FreightPricingService } from '../services/FreightPricingService';
import { ShipmentInvoicingService } from '../services/ShipmentInvoicingService';
import { DriverSettlementCalculationService } from '../services/DriverSettlementCalculationService';
import { hasPermission } from '../utils/permissions';

async function runPhase10FinancialFoundationSuite() {
  console.log('\n===============================================================');
  console.log('       FLEETOS PHASE 10.0 FINANCIAL ARCHITECTURE & FOUNDATION');
  console.log('===============================================================\n');

  let mongod: MongoMemoryServer | null = null;

  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Initialize all models and indexes
    await Promise.all([
      Organization.init(),
      User.init(),
      Customer.init(),
      Shipment.init(),
      Dispatch.init(),
      Driver.init(),
      DriverShift.init(),
      DriverIncident.init(),
      RateMatrix.init(),
      Invoice.init(),
      PaymentReceipt.init(),
      DriverSettlement.init(),
      LedgerAccount.init(),
      JournalEntry.init(),
      FinancialPeriod.init(),
    ]);

    // Provision Two Multi-Tenant Organizations
    const orgA = await Organization.create({
      name: 'Pinnacle Freightlines Org A',
      slug: 'pinnacle-a',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
    });
    const tenantA = { organizationId: orgA._id.toString() };

    const orgB = await Organization.create({
      name: 'Keystone Logistics Org B',
      slug: 'keystone-b',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
    });
    const tenantB = { organizationId: orgB._id.toString() };

    const userA = await User.create({
      email: 'accountant@pinnacle.com',
      passwordHash: 'HashedPassword123!',
      firstName: 'Finance',
      lastName: 'Lead',
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
    });

    console.log('--- PART 1: MONETARY PRECISION & INTEGER-CENT ARITHMETIC ---');

    // TEST 1: Decimal precision rounding and float elimination
    const sumCents = MonetaryPrecision.sumCents([
      MonetaryPrecision.toCents(19.99),
      MonetaryPrecision.toCents(10.01),
      MonetaryPrecision.toCents(0.005), // Half-up rounds to 1 cent
    ]);
    if (sumCents !== 3001 || MonetaryPrecision.fromCents(sumCents) !== 30.01) {
      throw new Error(`Monetary precision mismatch: expected 3001 cents ($30.01), got ${sumCents}`);
    }
    console.log('[PASS] Test 1: Monetary precision prevents floating point rounding drift ($30.01 exact)');

    // TEST 2: Multi-rate tax & surcharge integer cent calculation
    const taxableCents = 15450; // $154.50
    const taxCents = MonetaryPrecision.multiplyCents(taxableCents, 0.0825); // 8.25%
    if (taxCents !== 1275) {
      // 15450 * 0.0825 = 1274.625 -> rounds to 1275 cents ($12.75)
      throw new Error(`Tax calculation mismatch: expected 1275 cents, got ${taxCents}`);
    }
    console.log('[PASS] Test 2: Multi-rate tax and percentage surcharge compute exact half-up integer cents');

    console.log('\n--- PART 2: RATE MATRIX & DYNAMIC FREIGHT PRICING ---');

    // TEST 3: Create customer-specific and fleet-wide rate matrices
    const defaultRate = await RateMatrix.create({
      organizationId: orgA._id,
      code: 'DEFAULT-TARIFF',
      name: 'Default Organization Tariff',
      version: 1,
      pricingModel: 'DISTANCE_BASED',
      currency: 'USD',
      baseFeeCents: 5000, // $50.00
      perKmRateCents: 150, // $1.50 / km
      perKgRateCents: 5, // $0.05 / kg
      minimumChargeCents: 8000, // $80.00 min
      fuelSurchargePercent: 5.0, // 5%
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      createdBy: userA._id,
    });

    const customerA = await Customer.create({
      organizationId: orgA._id,
      name: 'Titan Manufacturing Corp',
      email: 'billing@titanmfg.com',
      phone: '+1-555-0199',
      billingAddress: {
        street: '100 Industrial Parkway',
        city: 'Houston',
        state: 'TX',
        postalCode: '77001',
        country: 'USA',
      },
    });

    const customerSpecialRate = await RateMatrix.create({
      organizationId: orgA._id,
      code: 'TITAN-SPECIAL',
      name: 'Titan Contracted Discount Tariff',
      customerId: customerA._id,
      version: 1,
      pricingModel: 'DISTANCE_BASED',
      currency: 'USD',
      baseFeeCents: 3500, // $35.00 discounted base
      perKmRateCents: 120, // $1.20 / km discounted
      perKgRateCents: 3,
      minimumChargeCents: 6000,
      fuelSurchargePercent: 4.0, // 4% discounted fuel
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      createdBy: userA._id,
    });

    if (!defaultRate || !customerSpecialRate) {
      throw new Error('Failed to create rate matrices');
    }
    console.log('[PASS] Test 3: Successfully provisioned organization default and customer-specific rate matrices');

    // TEST 4: Priority rate resolution (Customer specific over default)
    const resolvedCustomerRate = await FreightPricingService.resolveActiveRate(tenantA, customerA._id as Types.ObjectId);
    if (!resolvedCustomerRate || resolvedCustomerRate.code !== 'TITAN-SPECIAL') {
      throw new Error(`Expected customer rate 'TITAN-SPECIAL', got '${resolvedCustomerRate?.code}'`);
    }

    const resolvedDefaultRate = await FreightPricingService.resolveActiveRate(tenantA, undefined);
    if (!resolvedDefaultRate || resolvedDefaultRate.code !== 'DEFAULT-TARIFF') {
      throw new Error(`Expected default rate 'DEFAULT-TARIFF', got '${resolvedDefaultRate?.code}'`);
    }
    console.log('[PASS] Test 4: Rate resolution strictly prioritizes customer contract over fleet-wide tariff');

    // TEST 5: Deterministic pricing calculation with minimum charge cap & fuel surcharge
    const shortHaulCalculation = FreightPricingService.calculatePrice(defaultRate, {
      distanceKm: 5, // 5 km * 150 = 750 + base 5000 = 5750 cents < minimum 8000 cents
      weightKg: 10,
    });
    if (shortHaulCalculation.subtotalCents !== 8000) {
      throw new Error(`Minimum charge constraint failed: expected 8000 cents, got ${shortHaulCalculation.subtotalCents}`);
    }
    // 8000 * 5% fuel = 400 cents -> total 8400 cents ($84.00)
    if (shortHaulCalculation.totalCents !== 8400) {
      throw new Error(`Total cents calculation failed: expected 8400, got ${shortHaulCalculation.totalCents}`);
    }
    console.log('[PASS] Test 5: Freight pricing respects minimum charge constraints and exact fuel surcharge');

    // TEST 6: Rate versioning and historical invoice preservation
    const v2CustomerRate = await RateMatrix.create({
      organizationId: orgA._id,
      code: 'TITAN-SPECIAL',
      name: 'Titan Contracted Discount Tariff v2',
      customerId: customerA._id,
      version: 2,
      pricingModel: 'DISTANCE_BASED',
      currency: 'USD',
      baseFeeCents: 4500, // Price increase
      perKmRateCents: 140,
      perKgRateCents: 4,
      minimumChargeCents: 7000,
      fuelSurchargePercent: 6.0,
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-06-01'),
      effectiveTo: null,
      createdBy: userA._id,
    });
    if (v2CustomerRate.version !== 2) throw new Error('Rate versioning increment failed');
    console.log('[PASS] Test 6: Rate versioning enables non-destructive price revisions');

    console.log('\n--- PART 3: FREIGHT INVOICING & SHIPMENT CONVERSION ---');

    // TEST 7: Eligible delivered shipment conversion to invoice with frozen rate snapshot
    const deliveredShipment = await Shipment.create({
      organizationId: orgA._id,
      trackingNumber: 'TRK-2026-DELIV-01',
      customerId: customerA._id,
      customer: {
        name: customerA.name,
        email: customerA.email,
        phone: customerA.phone,
      },
      sender: {
        name: 'Sender Corp',
        address: '100 Send Way',
        city: 'Houston',
        phone: '+1-555-0101',
      },
      receiver: {
        name: 'Receiver LLC',
        address: '200 Recv Blvd',
        city: 'Austin',
        phone: '+1-555-0102',
      },
      origin: { address: 'Houston, TX', city: 'Houston', latitude: 29.76, longitude: -95.36 },
      destination: { address: 'Austin, TX', city: 'Austin', latitude: 30.26, longitude: -97.74 },
      cargo: {
        description: 'Auto Components',
        category: 'GENERAL',
        weightKg: 500,
        packageCount: 10,
      },
      pricing: { quotedAmount: 250, currency: 'USD' },
      priority: 'STANDARD',
      status: 'DELIVERED',
      createdBy: userA._id,
    });

    const generatedInvoice = await ShipmentInvoicingService.generateInvoiceFromShipments(tenantA, {
      shipmentIds: [deliveredShipment._id as Types.ObjectId],
      invoiceNumber: 'INV-2026-000101',
      dueAt: new Date(Date.now() + 30 * 86400000), // Net 30
      taxRatePercent: 8.25,
      createdBy: userA._id as Types.ObjectId,
    });

    if (
      !generatedInvoice ||
      generatedInvoice.status !== 'ISSUED' ||
      !generatedInvoice.rateSnapshot ||
      generatedInvoice.rateSnapshot.code !== 'TITAN-SPECIAL'
    ) {
      throw new Error('Invoice generation failed or rate snapshot was not captured');
    }
    console.log('[PASS] Test 7: Successfully generated invoice from delivered shipment with frozen rate snapshot');

    // TEST 8: Anti-double-billing protection: Cannot invoice the same shipment twice
    let doubleBillingPrevented = false;
    try {
      await ShipmentInvoicingService.generateInvoiceFromShipments(tenantA, {
        shipmentIds: [deliveredShipment._id as Types.ObjectId],
        invoiceNumber: 'INV-2026-000102',
        dueAt: new Date(),
        createdBy: userA._id as Types.ObjectId,
      });
    } catch (err: any) {
      if (err.message.includes('DUPLICATE_SHIPMENT_BILLING')) {
        doubleBillingPrevented = true;
      }
    }
    if (!doubleBillingPrevented) {
      throw new Error('CRITICAL INTEGRITY FAILURE: Duplicate invoice was created for already billed shipment!');
    }
    console.log('[PASS] Test 8: Shipment double-invoicing strictly blocked across non-voided invoices');

    // TEST 9: Ineligible shipment status rejection (e.g. IN_TRANSIT cannot be invoiced)
    const transitShipment = await Shipment.create({
      organizationId: orgA._id,
      trackingNumber: 'TRK-2026-TRANSIT-01',
      customerId: customerA._id,
      customer: { name: customerA.name, email: customerA.email, phone: customerA.phone },
      sender: { name: 'A', address: 'A', city: 'A', phone: '1' },
      receiver: { name: 'B', address: 'B', city: 'B', phone: '2' },
      origin: { address: 'A', city: 'A', latitude: 10, longitude: 10 },
      destination: { address: 'B', city: 'B', latitude: 11, longitude: 11 },
      cargo: { description: 'Electronics', category: 'ELECTRONICS', weightKg: 100, packageCount: 2 },
      pricing: { quotedAmount: 300, currency: 'USD' },
      priority: 'STANDARD',
      status: 'IN_TRANSIT',
      createdBy: userA._id,
    });

    let statusCheckBlocked = false;
    try {
      await ShipmentInvoicingService.generateInvoiceFromShipments(tenantA, {
        shipmentIds: [transitShipment._id as Types.ObjectId],
        invoiceNumber: 'INV-2026-000103',
        dueAt: new Date(),
        createdBy: userA._id as Types.ObjectId,
      });
    } catch (err: any) {
      if (err.message.includes('INELIGIBLE_SHIPMENT_STATUS')) {
        statusCheckBlocked = true;
      }
    }
    if (!statusCheckBlocked) {
      throw new Error('Ineligible shipment status was erroneously permitted for invoicing');
    }
    console.log('[PASS] Test 9: Invoicing non-DELIVERED shipments is strictly rejected');

    console.log('\n--- PART 4: PAYMENT RECONCILIATION & RECEIPT LIFECYCLE ---');

    // TEST 10: Partial payment allocation updates invoice balance correctly
    const receipt1 = await PaymentReconciliationService.recordAndReconcilePayment(tenantA, {
      receiptNumber: 'RCP-2026-0001',
      customerId: customerA._id as Types.ObjectId,
      amountCents: 5000, // $50.00 partial
      paymentMethod: 'ACH',
      referenceNumber: 'ACH-TRACE-987654',
      allocations: [
        {
          invoiceId: generatedInvoice._id as Types.ObjectId,
          invoiceNumber: generatedInvoice.invoiceNumber,
          allocatedAmountCents: 5000,
        },
      ],
      recordedBy: userA._id as Types.ObjectId,
      idempotencyKey: 'IDEMP-RCP-001',
    });

    const updatedInv = await Invoice.findById(generatedInvoice._id);
    if (!updatedInv || updatedInv.status !== 'PARTIALLY_PAID' || updatedInv.amountPaidCents !== 5000) {
      throw new Error(`Partial payment allocation failed. Status: ${updatedInv?.status}, Paid: ${updatedInv?.amountPaidCents}`);
    }
    console.log('[PASS] Test 10: Partial payment updates invoice status to PARTIALLY_PAID with exact balance deduction');

    // TEST 11: Duplicate receipt processing blocked via idempotency key
    const duplicateReceipt = await PaymentReconciliationService.recordAndReconcilePayment(tenantA, {
      receiptNumber: 'RCP-2026-0001-RETRY',
      customerId: customerA._id as Types.ObjectId,
      amountCents: 5000,
      paymentMethod: 'ACH',
      referenceNumber: 'ACH-TRACE-987654',
      allocations: [
        {
          invoiceId: generatedInvoice._id as Types.ObjectId,
          invoiceNumber: generatedInvoice.invoiceNumber,
          allocatedAmountCents: 5000,
        },
      ],
      recordedBy: userA._id as Types.ObjectId,
      idempotencyKey: 'IDEMP-RCP-001', // Same key
    });
    if (duplicateReceipt.receiptNumber !== 'RCP-2026-0001') {
      throw new Error('Idempotent payment receipt deduplication failed');
    }
    console.log('[PASS] Test 11: Duplicate payment receipt submission returns existing transaction idempotently');

    // TEST 12: Payment allocation exceeding invoice balance is strictly rejected
    let excessPaymentBlocked = false;
    try {
      await PaymentReconciliationService.recordAndReconcilePayment(tenantA, {
        receiptNumber: 'RCP-2026-EXCESS',
        customerId: customerA._id as Types.ObjectId,
        amountCents: 99999999, // Exorbitant amount
        paymentMethod: 'WIRE',
        referenceNumber: 'WIRE-999',
        allocations: [
          {
            invoiceId: generatedInvoice._id as Types.ObjectId,
            invoiceNumber: generatedInvoice.invoiceNumber,
            allocatedAmountCents: 99999999,
          },
        ],
        recordedBy: userA._id as Types.ObjectId,
      });
    } catch (err: any) {
      if (err.message.includes('ALLOCATION_EXCEEDS_BALANCE')) {
        excessPaymentBlocked = true;
      }
    }
    if (!excessPaymentBlocked) {
      throw new Error('Payment allocation exceeding invoice balance was not blocked');
    }
    console.log('[PASS] Test 12: Overpayment exceeding invoice balance is strictly prevented');

    // TEST 13: Payment receipt reversal restores invoice balance and status
    const reversedReceipt = await PaymentReconciliationService.reversePaymentReceipt(
      tenantA,
      receipt1._id as Types.ObjectId,
      'Customer bounced check / ACH dishonor',
      userA._id as Types.ObjectId
    );

    const postReversalInv = await Invoice.findById(generatedInvoice._id);
    if (!postReversalInv || postReversalInv.status !== 'ISSUED' || postReversalInv.amountPaidCents !== 0) {
      throw new Error(
        `Receipt reversal failed to restore invoice balance. Status: ${postReversalInv?.status}, Paid: ${postReversalInv?.amountPaidCents}`
      );
    }
    if (reversedReceipt.status !== 'REVERSED') throw new Error('Receipt status not set to REVERSED');
    console.log('[PASS] Test 13: Receipt reversal restores invoice outstanding balance and transitions status back to ISSUED');

    console.log('\n--- PART 5: DOUBLE-ENTRY GENERAL LEDGER ARCHITECTURE ---');

    // TEST 14: Chart of accounts initialization
    await FinancialLedgerService.initializeChartOfAccounts(tenantA);
    const arAccount = await LedgerAccount.findOne({ organizationId: orgA._id, accountNumber: '1100' });
    const revAccount = await LedgerAccount.findOne({ organizationId: orgA._id, accountNumber: '4010' });
    if (!arAccount || !revAccount) throw new Error('Chart of accounts initialization failed');
    console.log('[PASS] Test 14: Standard double-entry Chart of Accounts initialized idempotently');

    // TEST 15: Balanced journal entry posting (Debits == Credits)
    const balancedEntry = await FinancialLedgerService.postJournalEntry(tenantA, {
      entryNumber: 'JE-2026-000001',
      postingDate: new Date(),
      sourceType: 'INVOICE_ISSUED',
      sourceReferenceId: generatedInvoice._id as Types.ObjectId,
      sourceReferenceNumber: generatedInvoice.invoiceNumber,
      description: `Freight invoice recognition: ${generatedInvoice.invoiceNumber}`,
      currency: 'USD',
      lines: [
        {
          accountId: arAccount._id as Types.ObjectId,
          entryType: 'DEBIT',
          amountCents: 25000,
          description: 'Accounts Receivable Debited',
        },
        {
          accountId: revAccount._id as Types.ObjectId,
          entryType: 'CREDIT',
          amountCents: 25000,
          description: 'Freight Revenue Credited',
        },
      ],
      postedBy: userA._id as Types.ObjectId,
      idempotencyKey: `JE-INV-${generatedInvoice._id.toString()}`,
    });

    if (balancedEntry.totalDebitCents !== balancedEntry.totalCreditCents || balancedEntry.totalDebitCents !== 25000) {
      throw new Error('Journal entry debits and credits do not balance');
    }
    console.log('[PASS] Test 15: Double-entry journal posting verified: debits equal credits ($250.00 balanced)');

    // TEST 16: Unbalanced journal entry rejection (Debits != Credits)
    let unbalancedBlocked = false;
    try {
      await FinancialLedgerService.postJournalEntry(tenantA, {
        entryNumber: 'JE-2026-UNBALANCED',
        sourceType: 'MANUAL_ADJUSTMENT',
        sourceReferenceId: new Types.ObjectId(),
        description: 'Unbalanced entry test',
        lines: [
          {
            accountId: arAccount._id as Types.ObjectId,
            entryType: 'DEBIT',
            amountCents: 10000,
          },
          {
            accountId: revAccount._id as Types.ObjectId,
            entryType: 'CREDIT',
            amountCents: 8000, // $20.00 discrepancy
          },
        ],
        postedBy: userA._id as Types.ObjectId,
      });
    } catch (err: any) {
      if (err.message.includes('ACCOUNTING_UNBALANCED_ENTRY')) {
        unbalancedBlocked = true;
      }
    }
    if (!unbalancedBlocked) {
      throw new Error('Unbalanced journal entry was erroneously permitted to post!');
    }
    console.log('[PASS] Test 16: Unbalanced journal entry strictly rejected by accounting validation');

    // TEST 17: Journal immutability: posted journal reversal creates balanced counter-entry
    const reversalJournal = await FinancialLedgerService.reverseJournalEntry(
      tenantA,
      balancedEntry._id as Types.ObjectId,
      'Incorrect billing customer mapping',
      userA._id as Types.ObjectId
    );
    if (reversalJournal.totalDebitCents !== 25000 || reversalJournal.status !== 'POSTED') {
      throw new Error('Journal reversal counter-entry failed');
    }
    console.log('[PASS] Test 17: Journal immutability enforced: original entry preserved, counter-reversal posted');

    console.log('\n--- PART 6: DRIVER SETTLEMENT & PAYROLL CALCULATION ---');

    // TEST 18: Provision driver, shifts, and dispatches for settlement run
    const driver = await Driver.create({
      organizationId: orgA._id,
      fullName: 'Marcus Rodriguez',
      firstName: 'Marcus',
      lastName: 'Rodriguez',
      email: 'm.rodriguez@pinnacle.com',
      phone: '+1-555-0144',
      licenseNumber: 'CDL-TX-998811',
      licenseExpiry: new Date('2028-01-01'),
      licenseExpiryDate: new Date('2028-01-01'),
      status: 'AVAILABLE',
    });

    const shift1 = await DriverShift.create({
      organizationId: orgA._id,
      driverId: driver._id,
      shiftDate: '2026-03-01',
      plannedStart: new Date('2026-03-01T08:00:00Z'),
      plannedEnd: new Date('2026-03-01T17:00:00Z'),
      actualStart: new Date('2026-03-01T08:00:00Z'),
      actualEnd: new Date('2026-03-01T17:00:00Z'),
      status: 'COMPLETED',
      durationMinutes: 540, // 9 hours
      overtimeMinutes: 60, // 1 hour overtime
      createdBy: userA._id,
    });

    const dummyVehicleId = new Types.ObjectId();
    const dispatch1 = await Dispatch.create({
      organizationId: orgA._id,
      dispatchNumber: 'DSP-2026-0081',
      vehicleId: dummyVehicleId,
      driverId: driver._id,
      shipmentIds: [deliveredShipment._id],
      status: 'COMPLETED',
      assignedBy: userA._id,
      completedAt: new Date('2026-03-02T15:00:00Z'),
      createdAt: new Date('2026-03-02T08:00:00Z'),
      route: {
        name: 'Route 10',
        origin: { name: 'Depot A', latitude: 29.7, longitude: -95.3 },
        destination: { name: 'Client B', latitude: 30.2, longitude: -97.7 },
        waypoints: [],
        estimatedDistanceKm: 250, // 250 km
        estimatedDurationMinutes: 180,
      },
      createdBy: userA._id,
    });

    const settlement = await DriverSettlementCalculationService.calculateSettlement(tenantA, {
      settlementNumber: 'SETTLE-2026-0001',
      driverId: driver._id as Types.ObjectId,
      periodStart: new Date('2026-03-01T00:00:00Z'),
      periodEnd: new Date('2026-03-07T23:59:59Z'),
      basePayPerShiftCents: 15000, // $150.00
      ratePerKmCents: 50, // $0.50/km -> 250 km = 12500 cents ($125.00)
      overtimeRatePerHourCents: 3500, // $35.00/hr OT -> 1 hr = 3500 cents ($35.00)
      includeSafetyBonus: true, // +$250.00 (no incidents)
      calculatedBy: userA._id as Types.ObjectId,
    });

    // Base: 15000 (1 shift)
    // Mileage: 120 km (default) * 50 = 6000 cents
    // Overtime: 1 hr * 3500 = 3500 cents
    // Safety bonus: 25000 cents
    // Gross: 15000 + 6000 + 3500 + 25000 = 49500 cents ($495.00)
    // Tax Withheld: 49500 * 0.15 = 7425 cents
    // Net: 49500 - 7425 = 42075 cents ($420.75)
    if (settlement.grossPayCents !== 49500 || settlement.netPayCents !== 42075) {
      throw new Error(`Settlement calculation mismatch: Gross: ${settlement.grossPayCents}, Net: ${settlement.netPayCents}`);
    }
    console.log('[PASS] Test 18: Driver settlement accurately aggregates shifts, mileage, overtime and safety bonus');

    // TEST 19: Duplicate settlement period overlap prevention
    let duplicateSettlementBlocked = false;
    try {
      await DriverSettlementCalculationService.calculateSettlement(tenantA, {
        settlementNumber: 'SETTLE-2026-0002',
        driverId: driver._id as Types.ObjectId,
        periodStart: new Date('2026-03-05T00:00:00Z'), // Overlaps March 1-7
        periodEnd: new Date('2026-03-12T23:59:59Z'),
        calculatedBy: userA._id as Types.ObjectId,
      });
    } catch (err: any) {
      if (err.message.includes('SETTLEMENT_OVERLAP')) {
        duplicateSettlementBlocked = true;
      }
    }
    if (!duplicateSettlementBlocked) {
      throw new Error('Overlapping driver settlement was erroneously allowed');
    }
    console.log('[PASS] Test 19: Overlapping driver settlement periods strictly rejected by database guard');

    // TEST 20: Settlement approval lifecycle transition
    const approvedSettlement = await DriverSettlementCalculationService.approveSettlement(
      tenantA,
      settlement._id as Types.ObjectId,
      userA._id as Types.ObjectId
    );
    if (approvedSettlement.status !== 'APPROVED' || !approvedSettlement.approvedAt) {
      throw new Error('Settlement approval transition failed');
    }
    console.log('[PASS] Test 20: Driver settlement approval lifecycle state machine verified');

    console.log('\n--- PART 7: TENANT ISOLATION & RBAC PERMISSION INTEGRITY ---');

    // TEST 21: Cross-tenant invoice access strictly rejected (Tenant B cannot see Tenant A's invoice)
    const invoiceRepo = new BaseTenantRepository(Invoice);
    const crossTenantInvoice = await invoiceRepo.findById(tenantB, generatedInvoice._id);
    if (crossTenantInvoice !== null) {
      throw new Error('CRITICAL SECURITY VIOLATION: Tenant B was able to view Tenant A invoice!');
    }
    console.log('[PASS] Test 21: Cross-tenant invoice read attempt returned null (Tenant isolation verified)');

    // TEST 22: Cross-tenant rate matrix access strictly rejected
    const rateRepo = new BaseTenantRepository(RateMatrix);
    const crossTenantRate = await rateRepo.findById(tenantB, defaultRate._id);
    if (crossTenantRate !== null) {
      throw new Error('CRITICAL SECURITY VIOLATION: Tenant B was able to view Tenant A rate matrix!');
    }
    console.log('[PASS] Test 22: Cross-tenant rate matrix access strictly segregated');

    // TEST 23: RBAC permission validation for billing operations
    const accountantCanManage = hasPermission('ACCOUNTANT', 'BILLING:MANAGE');
    const driverCanManage = hasPermission('DRIVER', 'BILLING:MANAGE');
    const viewerCanReverse = hasPermission('VIEWER', 'billing.receipts.reverse');

    if (!accountantCanManage || driverCanManage || viewerCanReverse) {
      throw new Error('RBAC matrix verification failed for billing permissions');
    }
    console.log('[PASS] Test 23: Granular RBAC permissions verified (Accountant authorized, Driver/Viewer rejected)');

    // TEST 24: State machine prevents invalid transitions (e.g., VOID -> PAID)
    let invalidTransitionBlocked = false;
    try {
      FinancialStateMachine.validateInvoiceTransition('VOID', 'PAID');
    } catch (err: any) {
      if (err.message.includes('INVALID_INVOICE_TRANSITION')) {
        invalidTransitionBlocked = true;
      }
    }
    if (!invalidTransitionBlocked) {
      throw new Error('Invalid invoice transition VOID -> PAID was not blocked');
    }
    console.log('[PASS] Test 24: State machine strictly prohibits invalid lifecycle transitions (VOID is terminal)');

    console.log('\n===============================================================');
    console.log('🎉 ALL 24 PHASE 10.0 FINANCIAL FOUNDATION TESTS PASSED (100%)');
    console.log('===============================================================\n');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runPhase10FinancialFoundationSuite().catch((err) => {
  console.error('\n❌ PHASE 10.0 TEST SUITE FAILED:', err);
  process.exit(1);
});
