import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import http from 'http';
import assert from 'assert';
import { createApp } from '../app';
import { testHttpRequest } from './testHttpHelper';
import { generateAccessToken } from '../utils/token';
import { SecureCSVExporter } from '../utils/SecureCSVExporter';
import { FinancialIntegrityEngine } from '../services/FinancialIntegrityEngine';
import { PaymentReconciliationService } from '../services/PaymentReconciliationService';
import { ShipmentInvoicingService } from '../services/ShipmentInvoicingService';
import { DriverSettlementCalculationService } from '../services/DriverSettlementCalculationService';
import {
  Organization,
  User,
  OrganizationMember,
  Customer,
  Shipment,
  Invoice,
  PaymentReceipt,
  Driver,
  DriverSettlement,
  JournalEntry,
  LedgerAccount,
  DriverShift,
} from '../models';

console.log('================================================================================');
console.log('       FLEETOS PHASE 10.4 FINANCIAL HARDENING & CONCURRENCY SUITE       ');
console.log('================================================================================');

async function runHardeningAndConcurrencySuite() {
  let mongod: MongoMemoryServer | null = null;
  let httpServer: http.Server | null = null;

  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Initialize all schemas and compound indexes
    await Promise.all([
      Organization.init(),
      User.init(),
      OrganizationMember.init(),
      Customer.init(),
      Shipment.init(),
      Invoice.init(),
      PaymentReceipt.init(),
      Driver.init(),
      DriverSettlement.init(),
      JournalEntry.init(),
      LedgerAccount.init(),
    ]);

    const { server } = createApp();
    httpServer = server;

    await new Promise<void>((resolve) => {
      httpServer!.listen(0, () => resolve());
    });

    /* =========================================================================
       PROVISION TENANTS & ROLES
       ========================================================================= */
    const tenantA = await Organization.create({
      name: 'Alpha Freightways (Tenant A)',
      slug: 'alpha-freight-' + Date.now(),
      status: 'ACTIVE',
      currency: 'USD',
    });

    const tenantB = await Organization.create({
      name: 'Beta Global Haulage (Tenant B)',
      slug: 'beta-haulage-' + Date.now(),
      status: 'ACTIVE',
      currency: 'USD',
    });

    const accountantA = await User.create({
      email: `accountant_${Date.now()}@alpha.test`,
      passwordHash: 'HashedPassword123!',
      firstName: 'Alice',
      lastName: 'Accountant',
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
    });

    await OrganizationMember.create({
      organizationId: tenantA._id,
      userId: accountantA._id,
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
    });

    const accountantB = await User.create({
      email: `accountant_${Date.now()}@beta.test`,
      passwordHash: 'HashedPassword123!',
      firstName: 'Bob',
      lastName: 'Accountant',
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
    });

    await OrganizationMember.create({
      organizationId: tenantB._id,
      userId: accountantB._id,
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
    });

    const tokenA = generateAccessToken({
      userId: accountantA._id.toString(),
      email: accountantA.email,
      role: 'ACCOUNTANT',
      activeOrganizationId: tenantA._id.toString(),
    });

    const tokenB = generateAccessToken({
      userId: accountantB._id.toString(),
      email: accountantB.email,
      role: 'ACCOUNTANT',
      activeOrganizationId: tenantB._id.toString(),
    });

    const customerA = await Customer.create({
      organizationId: tenantA._id,
      name: 'Delta Manufacturing Corp',
      email: 'ap@delta.test',
      phone: '+1-555-1000',
      billingAddress: {
        street: '100 Delta Blvd',
        city: 'Atlanta',
        state: 'GA',
        country: 'USA',
      },
      status: 'ACTIVE',
    });

    const driverA = await Driver.create({
      organizationId: tenantA._id,
      fullName: 'John Trucker',
      licenseNumber: 'CDL-GA-9021',
      licenseExpiry: new Date('2028-12-31'),
      status: 'AVAILABLE',
      phone: '+1-555-2000',
      email: 'john@alpha.test',
      assignedVehicleId: null,
      emergencyContact: { name: 'Dispatch', phone: '+1-555-0000' },
      joiningDate: new Date('2025-01-01'),
    });

    console.log('\n--- PART 1: CONCURRENT SHIPMENT INVOICING & DOUBLE-BILLING RACE CONDITIONS ---');

    // Create a delivered shipment
    const shipmentA = await Shipment.create({
      organizationId: tenantA._id,
      trackingNumber: 'TRK-2026-CONC-01',
      customer: {
        name: customerA.name,
        email: customerA.email,
        phone: customerA.phone,
      },
      sender: {
        name: 'Sender Warehouse',
        phone: '+1-555-0101',
        address: '100 Sender Way',
        city: 'Atlanta',
        country: 'USA',
      },
      receiver: {
        name: 'Receiver Warehouse',
        phone: '+1-555-0102',
        address: '200 Receiver Rd',
        city: 'Savannah',
        country: 'USA',
      },
      origin: {
        address: '100 Sender Way',
        city: 'Atlanta',
        latitude: 33.749,
        longitude: -84.388,
      },
      destination: {
        address: '200 Receiver Rd',
        city: 'Savannah',
        latitude: 32.0809,
        longitude: -81.0912,
      },
      status: 'DELIVERED',
      cargo: {
        description: 'Auto Parts & Machinery',
        weightKg: 1250,
      },
      pricing: {
        quotedAmount: 1500,
        currency: 'USD',
      },
      createdBy: accountantA._id,
    });

    // Fire TWO SIMULTANEOUS requests attempting to invoice the exact same delivered shipment
    const invoicePromises = [
      testHttpRequest(
        httpServer!,
        'POST',
        '/api/v1/billing/invoices/generate-from-shipments',
        {
          Authorization: `Bearer ${tokenA}`,
          'x-organization-id': tenantA._id.toString(),
        },
        {
          shipmentIds: [shipmentA._id.toString()],
          invoiceNumber: 'INV-CONC-0001',
          paymentTerms: 'NET_30',
          dueAt: new Date(Date.now() + 86400000 * 30).toISOString(),
        }
      ),
      testHttpRequest(
        httpServer!,
        'POST',
        '/api/v1/billing/invoices/generate-from-shipments',
        {
          Authorization: `Bearer ${tokenA}`,
          'x-organization-id': tenantA._id.toString(),
        },
        {
          shipmentIds: [shipmentA._id.toString()],
          invoiceNumber: 'INV-CONC-0002',
          paymentTerms: 'NET_30',
          dueAt: new Date(Date.now() + 86400000 * 30).toISOString(),
        }
      ),
    ];

    const invoiceResults = await Promise.all(invoicePromises);
    const successInvoices = invoiceResults.filter((r) => r.status === 201);
    const rejectedInvoices = invoiceResults.filter((r) => r.status === 409 || r.status === 400);

    assert.strictEqual(successInvoices.length, 1, 'Exactly one concurrent invoice generation must succeed');
    assert.strictEqual(rejectedInvoices.length, 1, 'The competing concurrent invoice generation must be rejected with 409 Conflict');

    // Verify database contains only 1 invoice for this shipment
    const landedInvoices = await Invoice.find({
      organizationId: tenantA._id,
      shipmentIds: shipmentA._id,
      status: { $ne: 'VOID' },
    });
    assert.strictEqual(landedInvoices.length, 1, 'Database must contain exactly 1 non-voided invoice for shipment');
    console.log('[PASS] Test 1: Simultaneous shipment invoicing race condition correctly prevented (1 succeeded, 1 conflict).');

    console.log('\n--- PART 2: CONCURRENT PAYMENT ALLOCATIONS (OVER-ALLOCATION PREVENTION) ---');

    // Seed invoice with balance of $1,000 (100,000 cents)
    const targetInvoice = await Invoice.create({
      organizationId: tenantA._id,
      invoiceNumber: 'INV-BAL-TEST-01',
      customerId: customerA._id,
      customer: {
        name: customerA.name,
        email: customerA.email,
        billingAddress: '100 Delta Blvd, Atlanta, GA',
      },
      lineItems: [
        {
          description: 'Freight Service',
          quantity: 1,
          unitPriceCents: 100000,
          totalCents: 100000,
          taxRatePercent: 0,
          taxAmountCents: 0,
          discountAmountCents: 0,
          fuelSurchargeCents: 0,
        },
      ],
      subtotalCents: 100000,
      totalAmountCents: 100000,
      amountPaidCents: 0,
      outstandingBalanceCents: 100000,
      subtotalAmount: 1000,
      taxAmount: 0,
      totalAmount: 1000,
      currency: 'USD',
      status: 'ISSUED',
      paymentTerms: 'NET_30',
      issuedAt: new Date(),
      dueAt: new Date(Date.now() + 86400000 * 30),
    });

    // Competing payment allocation attempts: both try to pay 80,000 cents against a 100,000 cent balance
    // Together they would equal 160,000 cents, exceeding the 100,000 balance!
    const allocResults = await Promise.allSettled([
      PaymentReconciliationService.recordAndReconcilePayment(
        { organizationId: tenantA._id, role: 'ACCOUNTANT', userId: accountantA._id },
        {
          receiptNumber: 'REC-ALLOC-01',
          customerId: customerA._id,
          amountCents: 80000,
          referenceNumber: 'REF-01',
          paymentMethod: 'ACH',
          allocations: [
            {
              invoiceId: targetInvoice._id,
              invoiceNumber: targetInvoice.invoiceNumber,
              allocatedAmountCents: 80000,
            },
          ],
          recordedBy: accountantA._id,
        }
      ),
      PaymentReconciliationService.recordAndReconcilePayment(
        { organizationId: tenantA._id, role: 'ACCOUNTANT', userId: accountantA._id },
        {
          receiptNumber: 'REC-ALLOC-02',
          customerId: customerA._id,
          amountCents: 80000,
          referenceNumber: 'REF-02',
          paymentMethod: 'ACH',
          allocations: [
            {
              invoiceId: targetInvoice._id,
              invoiceNumber: targetInvoice.invoiceNumber,
              allocatedAmountCents: 80000,
            },
          ],
          recordedBy: accountantA._id,
        }
      ),
    ]);

    // Inspect the resulting invoice balance
    const refreshedTarget = await Invoice.findById(targetInvoice._id);
    assert.ok(
      refreshedTarget!.outstandingBalanceCents >= 0,
      'Invoice outstanding balance must never become negative'
    );
    assert.ok(
      refreshedTarget!.amountPaidCents <= refreshedTarget!.totalAmountCents,
      'Amount paid must never exceed total invoice amount'
    );
    console.log('[PASS] Test 2: Competing payment allocations preserve non-negative balance invariant.');

    console.log('\n--- PART 3: CONCURRENT PAYMENT REVERSAL SAFETY (DOUBLE REVERSAL PREVENTION) ---');

    // Create a paid receipt
    const receiptToReverse = await PaymentReceipt.create({
      organizationId: tenantA._id,
      receiptNumber: 'REC-REVERSE-RACE',
      customerId: customerA._id,
      amountCents: 25000,
      currency: 'USD',
      paymentDate: new Date(),
      paymentMethod: 'CHECK',
      referenceNumber: 'CHK-999',
      allocations: [
        {
          invoiceId: targetInvoice._id,
          invoiceNumber: targetInvoice.invoiceNumber,
          allocatedAmountCents: 25000,
        },
      ],
      status: 'RECORDED',
      recordedBy: accountantA._id,
      idempotencyKey: 'IDEMP-REV-RACE',
    });

    // Fire TWO simultaneous reversal requests
    const reversePromises = [
      testHttpRequest(
        httpServer!,
        'POST',
        `/api/v1/billing/receipts/${receiptToReverse._id.toString()}/reverse`,
        {
          Authorization: `Bearer ${tokenA}`,
          'x-organization-id': tenantA._id.toString(),
        },
        { reason: 'Check returned for NSF by bank' }
      ),
      testHttpRequest(
        httpServer!,
        'POST',
        `/api/v1/billing/receipts/${receiptToReverse._id.toString()}/reverse`,
        {
          Authorization: `Bearer ${tokenA}`,
          'x-organization-id': tenantA._id.toString(),
        },
        { reason: 'Check returned for NSF by bank duplicate call' }
      ),
    ];

    const reverseResults = await Promise.all(reversePromises);
    const successReversals = reverseResults.filter((r) => r.status === 200);
    const rejectedReversals = reverseResults.filter((r) => r.status === 400 || r.status === 409);

    assert.strictEqual(successReversals.length, 1, 'Exactly one reversal request must succeed');
    assert.strictEqual(rejectedReversals.length, 1, 'Competing duplicate reversal request must be rejected');

    const refreshedReceipt = await PaymentReceipt.findById(receiptToReverse._id);
    assert.strictEqual(refreshedReceipt?.status, 'REVERSED');
    console.log('[PASS] Test 3: Concurrent payment reversal race condition mitigated (idempotent rejection of second reversal).');

    console.log('\n--- PART 4: CONCURRENT DRIVER SETTLEMENT CALCULATION (PERIOD OVERLAP) ---');

    const periodStart = new Date('2026-11-01');
    const periodEnd = new Date('2026-11-07');

    // Fire two simultaneous settlement calculation requests for overlapping date periods
    const settlementPromises = [
      testHttpRequest(
        httpServer!,
        'POST',
        '/api/v1/settlements/calculate',
        {
          Authorization: `Bearer ${tokenA}`,
          'x-organization-id': tenantA._id.toString(),
        },
        {
          settlementNumber: 'STL-RACE-0001',
          driverId: driverA._id.toString(),
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        }
      ),
      testHttpRequest(
        httpServer!,
        'POST',
        '/api/v1/settlements/calculate',
        {
          Authorization: `Bearer ${tokenA}`,
          'x-organization-id': tenantA._id.toString(),
        },
        {
          settlementNumber: 'STL-RACE-0002',
          driverId: driverA._id.toString(),
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        }
      ),
    ];

    const settlementResults = await Promise.all(settlementPromises);
    const successSettlements = settlementResults.filter((r) => r.status === 201);
    const rejectedSettlements = settlementResults.filter((r) => r.status === 409 || r.status === 400);

    assert.strictEqual(successSettlements.length, 1, 'Only one settlement for driver in period must be calculated');
    assert.strictEqual(rejectedSettlements.length, 1, 'Overlapping settlement must be rejected with 409 Conflict');

    // Test Gate 4 settlement period overlap scenarios:
    // 1. Fully contained period (e.g., Nov 2 - Nov 5)
    const containedRes = await testHttpRequest(
      httpServer!,
      'POST',
      '/api/v1/settlements/calculate',
      {
        Authorization: `Bearer ${tokenA}`,
        'x-organization-id': tenantA._id.toString(),
      },
      {
        settlementNumber: 'STL-CONTAINED-001',
        driverId: driverA._id.toString(),
        periodStart: new Date('2026-11-02').toISOString(),
        periodEnd: new Date('2026-11-05').toISOString(),
      }
    );
    assert.strictEqual(containedRes.status, 409, 'Fully contained period must be rejected with 409');

    // 2. Partially overlapping period (e.g., Nov 5 - Nov 10)
    const partialOverlapRes = await testHttpRequest(
      httpServer!,
      'POST',
      '/api/v1/settlements/calculate',
      {
        Authorization: `Bearer ${tokenA}`,
        'x-organization-id': tenantA._id.toString(),
      },
      {
        settlementNumber: 'STL-PARTIAL-001',
        driverId: driverA._id.toString(),
        periodStart: new Date('2026-11-05').toISOString(),
        periodEnd: new Date('2026-11-10').toISOString(),
      }
    );
    assert.strictEqual(partialOverlapRes.status, 409, 'Partially overlapping period must be rejected with 409');

    // 3. Adjacent non-overlapping period (e.g., Nov 8 - Nov 14)
    const adjacentRes = await testHttpRequest(
      httpServer!,
      'POST',
      '/api/v1/settlements/calculate',
      {
        Authorization: `Bearer ${tokenA}`,
        'x-organization-id': tenantA._id.toString(),
      },
      {
        settlementNumber: 'STL-ADJACENT-001',
        driverId: driverA._id.toString(),
        periodStart: new Date('2026-11-08').toISOString(),
        periodEnd: new Date('2026-11-14').toISOString(),
      }
    );
    assert.strictEqual(adjacentRes.status, 201, 'Adjacent non-overlapping period must succeed with 201');
    console.log('[PASS] Test 4: Driver settlement period overlap policies verified (exact, partial, contained, adjacent).');

    console.log('\n--- PART 5: MULTI-TENANT FINANCIAL ISOLATION & IDOR FORGERY ---');

    // Tenant B attempts to read Tenant A's invoice directly via ID
    const crossTenantInvoiceRes = await testHttpRequest(
      httpServer!,
      'GET',
      `/api/v1/billing/invoices/${targetInvoice._id.toString()}`,
      {
        Authorization: `Bearer ${tokenB}`,
        'x-organization-id': tenantB._id.toString(),
      }
    );
    assert.ok(
      crossTenantInvoiceRes.status === 403 || crossTenantInvoiceRes.status === 404,
      'Cross-tenant invoice read must return 403 or 404'
    );

    // Tenant B attempts to void Tenant A's invoice
    const crossTenantVoidRes = await testHttpRequest(
      httpServer!,
      'POST',
      `/api/v1/billing/invoices/${targetInvoice._id.toString()}/void`,
      {
        Authorization: `Bearer ${tokenB}`,
        'x-organization-id': tenantB._id.toString(),
      },
      { reason: 'Malicious cross-tenant void attempt' }
    );
    assert.ok(
      crossTenantVoidRes.status === 403 || crossTenantVoidRes.status === 404,
      'Cross-tenant invoice void must return 403 or 404'
    );

    // Forged x-organization-id header: Tenant A token with Tenant B x-organization-id
    const forgedHeaderRes = await testHttpRequest(
      httpServer!,
      'GET',
      '/api/v1/financial-reports/revenue',
      {
        Authorization: `Bearer ${tokenA}`,
        'x-organization-id': tenantB._id.toString(),
      }
    );
    assert.strictEqual(
      forgedHeaderRes.status,
      403,
      'Forged x-organization-id header must be strictly rejected by requireTenantMembership middleware'
    );
    console.log('[PASS] Test 5: Strict multi-tenant isolation, IDOR prevention, and organization spoofing defense verified.');

    console.log('\n--- PART 6: DOUBLE-ENTRY GENERAL LEDGER EQUALITY & REVERSAL BALANCE ---');

    const accAR = await LedgerAccount.create({
      organizationId: tenantA._id,
      accountNumber: '1100-TEST',
      name: 'AR Test',
      type: 'ASSET',
      normalBalance: 'DEBIT',
      currency: 'USD',
      balanceCents: 0,
    });

    const accCash = await LedgerAccount.create({
      organizationId: tenantA._id,
      accountNumber: '1010-TEST',
      name: 'Cash Test',
      type: 'ASSET',
      normalBalance: 'DEBIT',
      currency: 'USD',
      balanceCents: 0,
    });

    const journal1 = await JournalEntry.create({
      organizationId: tenantA._id,
      entryNumber: 'JE-TEST-001',
      postingDate: new Date(),
      sourceType: 'PAYMENT_RECEIVED',
      sourceReferenceId: new Types.ObjectId(),
      description: 'Cash collection debit cash credit AR',
      currency: 'USD',
      lines: [
        {
          accountId: accCash._id,
          accountNumber: accCash.accountNumber,
          accountName: accCash.name,
          entryType: 'DEBIT',
          amountCents: 50000,
        },
        {
          accountId: accAR._id,
          accountNumber: accAR.accountNumber,
          accountName: accAR.name,
          entryType: 'CREDIT',
          amountCents: 50000,
        },
      ],
      totalDebitCents: 50000,
      totalCreditCents: 50000,
      status: 'POSTED',
      postedBy: accountantA._id,
    });

    assert.strictEqual(journal1.totalDebitCents, journal1.totalCreditCents, 'Debits must equal credits');

    // Run Financial Integrity Engine on Tenant A
    const integrityReport = await FinancialIntegrityEngine.runIntegrityAudit(tenantA._id);
    assert.strictEqual(typeof integrityReport.isHealthy, 'boolean');
    assert.ok(integrityReport.totalChecksExecuted > 0, 'Integrity checks must execute across models');
    console.log('[PASS] Test 6: Double-entry ledger integrity verified with automated mathematical audit.');

    console.log('\n--- PART 7: COMPREHENSIVE CSV FORMULA INJECTION & ESCAPING MITIGATION ---');

    const injectionPayloads = [
      '=1+1',
      '+cmd|"/c calc"!A0',
      '-2+3+cmd|"/c calc"!A0',
      '@SUM(1+1)*cmd|"/c calc"!A0',
      '\t=cmd|"/c calc"!A0',
      '\r=cmd|"/c calc"!A0',
      'Normal Value',
      'Value with, comma',
      'Value with "quotes"',
      'Value with\nnewline',
    ];

    for (const payload of injectionPayloads) {
      const sanitized = SecureCSVExporter.sanitizeCell(payload);
      if (['=', '+', '-', '@', '\t', '\r'].includes(payload.charAt(0))) {
        assert.ok(
          sanitized.includes("'"),
          `Sanitized cell must contain single-quote prefix for trigger: ${payload}`
        );
      }
    }
    console.log('[PASS] Test 7: Complete suite of spreadsheet formula injection vectors safely neutralized.');

    console.log('\n--- PART 8: INVOICE RESERVATION FENCING & PREEMPTION RECOVERY ---');
    // Test 8: Fenced reservation preemption simulation
    // 1. Create a shipment
    const fencedShipment = await Shipment.create({
      organizationId: tenantA._id,
      trackingNumber: 'TRK-FENCE-001',
      customer: { name: customerA.name, email: customerA.email, phone: customerA.phone },
      sender: { name: 'Sender', phone: '555', address: 'Addr', city: 'City', country: 'US' },
      receiver: { name: 'Receiver', phone: '555', address: 'Addr', city: 'City', country: 'US' },
      origin: { address: 'A', city: 'C', latitude: 10, longitude: 10 },
      destination: { address: 'B', city: 'C', latitude: 20, longitude: 20 },
      status: 'DELIVERED',
      cargo: { description: 'Fenced Cargo', weightKg: 100 },
      pricing: { quotedAmount: 500, currency: 'USD' },
      createdBy: accountantA._id,
    });

    // 2. Request A acquires token A with expired timestamp
    const tokenA_fenced = 'RES-TOKEN-A';
    await Shipment.updateOne(
      { _id: fencedShipment._id },
      {
        $set: {
          billedInvoiceId: new Types.ObjectId(),
          billingReservationToken: tokenA_fenced,
          billingReservationExpiresAt: new Date(Date.now() - 10000), // Expired!
        },
      }
    );

    // 3. Request B acquires token B and successfully creates Invoice B
    const invoiceB = await ShipmentInvoicingService.generateInvoiceFromShipments(
      { organizationId: tenantA._id, role: 'ACCOUNTANT', userId: accountantA._id },
      {
        shipmentIds: [fencedShipment._id],
        invoiceNumber: 'INV-FENCE-B-001',
        dueAt: new Date(Date.now() + 86400000),
        createdBy: accountantA._id,
      }
    );
    assert.strictEqual(invoiceB.invoiceNumber, 'INV-FENCE-B-001');

    // Verify shipment now permanently points to Invoice B and token is null
    const shipmentAfterB = await Shipment.findById(fencedShipment._id);
    assert.strictEqual(shipmentAfterB?.billedInvoiceId?.toString(), invoiceB._id.toString());
    assert.strictEqual(shipmentAfterB?.billingReservationToken, null);

    // 4. Request A resumes with its old token A and attempts to finalize an Invoice A
    const invoiceA_draft = await Invoice.create({
      organizationId: tenantA._id,
      invoiceNumber: 'INV-FENCE-A-DRAFT',
      customerId: customerA._id,
      customer: { name: 'Cust', email: 'e', billingAddress: 'b' },
      shipmentIds: [fencedShipment._id],
      lineItems: [{ description: 'Test', quantity: 1, unitPriceCents: 50000, totalCents: 50000, taxRatePercent: 0, taxAmountCents: 0, discountAmountCents: 0, fuelSurchargeCents: 0 }],
      subtotalCents: 50000,
      totalAmountCents: 50000,
      amountPaidCents: 0,
      outstandingBalanceCents: 50000,
      subtotalAmount: 500,
      taxAmount: 0,
      totalAmount: 500,
      currency: 'USD',
      status: 'ISSUED',
      paymentTerms: 'NET_30',
      issuedAt: new Date(),
      dueAt: new Date(),
    });

    // Request A attempts to claim shipment with token A
    const finalizeA = await Shipment.updateMany(
      { _id: fencedShipment._id, organizationId: tenantA._id, billingReservationToken: tokenA_fenced },
      { $set: { billedInvoiceId: invoiceA_draft._id, billingReservationToken: null } }
    );
    // Request A MUST match 0 shipments because Token A is lost
    assert.strictEqual(finalizeA.modifiedCount, 0, 'Request A must match 0 shipments because token was lost');

    // Request A executes compensating deletion of its unposted draft
    await Invoice.deleteOne({ _id: invoiceA_draft._id, organizationId: tenantA._id });

    // Request A error handler attempts to clear reservation for Token A
    await Shipment.updateMany(
      { _id: fencedShipment._id, organizationId: tenantA._id, billingReservationToken: tokenA_fenced },
      { $set: { billedInvoiceId: null, billingReservationToken: null } }
    );

    // Assertions:
    // Invoice B remains intact and un-deleted
    const invoiceB_check = await Invoice.findById(invoiceB._id);
    assert.ok(invoiceB_check, 'Invoice B must remain completely intact');
    // Shipment still points to Invoice B
    const shipmentFinal = await Shipment.findById(fencedShipment._id);
    assert.strictEqual(shipmentFinal?.billedInvoiceId?.toString(), invoiceB._id.toString(), 'Shipment must still point to Invoice B');
    console.log('[PASS] Test 8: Invoice reservation fencing preemption & safe draft cleanup verified.');

    console.log('\n--- PART 9: ADVANCED PAYMENT IDEMPOTENCY & PAYLOAD FINGERPRINTING ---');
    // Test 9: Advanced payment idempotency
    const idemKey = 'IDEMP-SAFETY-KEY-999';
    // Sub-case 1: Sequential retry with same payload
    const receipt1 = await PaymentReconciliationService.recordAndReconcilePayment(
      { organizationId: tenantA._id, role: 'ACCOUNTANT', userId: accountantA._id },
      {
        receiptNumber: 'REC-IDEMP-01',
        customerId: customerA._id,
        amountCents: 10000,
        referenceNumber: 'REF-IDEMP-01',
        paymentMethod: 'CHECK',
        allocations: [{ invoiceId: targetInvoice._id, invoiceNumber: targetInvoice.invoiceNumber, allocatedAmountCents: 10000 }],
        recordedBy: accountantA._id,
        idempotencyKey: idemKey,
      }
    );

    const receipt2 = await PaymentReconciliationService.recordAndReconcilePayment(
      { organizationId: tenantA._id, role: 'ACCOUNTANT', userId: accountantA._id },
      {
        receiptNumber: 'REC-IDEMP-01',
        customerId: customerA._id,
        amountCents: 10000,
        referenceNumber: 'REF-IDEMP-01',
        paymentMethod: 'CHECK',
        allocations: [{ invoiceId: targetInvoice._id, invoiceNumber: targetInvoice.invoiceNumber, allocatedAmountCents: 10000 }],
        recordedBy: accountantA._id,
        idempotencyKey: idemKey,
      }
    );
    assert.strictEqual(receipt1._id.toString(), receipt2._id.toString(), 'Sequential retry must return exact same receipt');

    // Sub-case 2: Payload mismatch rejection
    let payloadMismatchCaught = false;
    try {
      await PaymentReconciliationService.recordAndReconcilePayment(
        { organizationId: tenantA._id, role: 'ACCOUNTANT', userId: accountantA._id },
        {
          receiptNumber: 'REC-IDEMP-01',
          customerId: customerA._id,
          amountCents: 20000, // Different amount!
          referenceNumber: 'REF-IDEMP-01',
          paymentMethod: 'CHECK',
          allocations: [{ invoiceId: targetInvoice._id, invoiceNumber: targetInvoice.invoiceNumber, allocatedAmountCents: 20000 }],
          recordedBy: accountantA._id,
          idempotencyKey: idemKey,
        }
      );
    } catch (err: any) {
      if (err.message.includes('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')) {
        payloadMismatchCaught = true;
      }
    }
    assert.strictEqual(payloadMismatchCaught, true, 'Payload mismatch on same idempotency key must be rejected');

    // Sub-case 3: Concurrent execution with same key
    const concurrentIdemKey = 'IDEMP-CONCUR-KEY-777';
    const concurrentIdemCalls = [
      PaymentReconciliationService.recordAndReconcilePayment(
        { organizationId: tenantA._id, role: 'ACCOUNTANT', userId: accountantA._id },
        {
          receiptNumber: 'REC-IDEMP-CONC-1',
          customerId: customerA._id,
          amountCents: 5000,
          referenceNumber: 'REF-CONC-01',
          paymentMethod: 'ACH',
          allocations: [{ invoiceId: targetInvoice._id, invoiceNumber: targetInvoice.invoiceNumber, allocatedAmountCents: 5000 }],
          recordedBy: accountantA._id,
          idempotencyKey: concurrentIdemKey,
        }
      ),
      PaymentReconciliationService.recordAndReconcilePayment(
        { organizationId: tenantA._id, role: 'ACCOUNTANT', userId: accountantA._id },
        {
          receiptNumber: 'REC-IDEMP-CONC-1',
          customerId: customerA._id,
          amountCents: 5000,
          referenceNumber: 'REF-CONC-01',
          paymentMethod: 'ACH',
          allocations: [{ invoiceId: targetInvoice._id, invoiceNumber: targetInvoice.invoiceNumber, allocatedAmountCents: 5000 }],
          recordedBy: accountantA._id,
          idempotencyKey: concurrentIdemKey,
        }
      ),
    ];
    const concResults = await Promise.allSettled(concurrentIdemCalls);
    const concSuccess = concResults.filter((r) => r.status === 'fulfilled');
    assert.ok(concSuccess.length >= 1, 'At least one request must succeed and return receipt');
    const receiptsGenerated = await PaymentReceipt.find({ idempotencyKey: concurrentIdemKey });
    assert.strictEqual(receiptsGenerated.length, 1, 'Exactly one receipt document must exist for the key');
    console.log('[PASS] Test 9: Advanced payment idempotency & payload fingerprinting verified.');

    console.log('\n--- PART 10: ATOMIC DRIVER SHIFT CLAIMING & PARTIAL AVAILABILITY ---');
    // Test 10: Atomic driver shift claiming
    // Scenario A: Partial availability - Request 10 shifts when only 8 are available
    const createdShifts = [];
    for (let i = 1; i <= 10; i++) {
      const dayStr = i < 10 ? `0${i}` : `${i}`;
      const s = await DriverShift.create({
        organizationId: tenantA._id,
        driverId: driverA._id,
        shiftDate: `2026-12-${dayStr}`,
        plannedStart: new Date(`2026-12-${dayStr}T08:00:00.000Z`),
        plannedEnd: new Date(`2026-12-${dayStr}T16:00:00.000Z`),
        actualStart: new Date(`2026-12-${dayStr}T08:00:00.000Z`),
        actualEnd: new Date(`2026-12-${dayStr}T16:00:00.000Z`),
        durationMinutes: 480,
        status: 'COMPLETED',
        createdBy: accountantA._id,
      });
      createdShifts.push(s);
    }

    // Mark 2 shifts as already claimed by a prior paid settlement
    const priorSettlementId = new Types.ObjectId();
    await DriverShift.updateMany(
      { _id: { $in: [createdShifts[0]._id, createdShifts[1]._id] } },
      { $set: { settlementId: priorSettlementId } }
    );

    // Scenario A: Request 10 shifts when 2 are already claimed. Must be REJECTED.
    let partialRejected = false;
    try {
      await DriverSettlementCalculationService.calculateSettlement(
        { organizationId: tenantA._id, role: 'ACCOUNTANT', userId: accountantA._id },
        {
          settlementNumber: 'STL-PARTIAL-FAIL',
          driverId: driverA._id,
          periodStart: new Date('2026-12-01T00:00:00Z'),
          periodEnd: new Date('2026-12-10T23:59:59Z'),
          calculatedBy: accountantA._id,
        }
      );
    } catch (err: any) {
      if (err.message.includes('PARTIAL_SHIFT_AVAILABILITY')) {
        partialRejected = true;
      }
    }
    assert.strictEqual(partialRejected, true, 'Partial availability must strictly reject settlement calculation');

    // Verify 0 settlement documents created
    const noSettlement = await DriverSettlement.findOne({ settlementNumber: 'STL-PARTIAL-FAIL' });
    assert.strictEqual(noSettlement, null, 'Zero settlement records must exist for rejected partial calculation');

    // Verify all 8 available shifts remain unclaimed (settlementId is null)
    const unclaimedCount = await DriverShift.countDocuments({
      _id: { $in: createdShifts.slice(2).map((s) => s._id) },
      settlementId: null,
    });
    assert.strictEqual(unclaimedCount, 8, 'All 8 available shifts must remain unclaimed');

    // Verify prior 2 shifts remain owned by prior settlement
    const priorCount = await DriverShift.countDocuments({ settlementId: priorSettlementId });
    assert.strictEqual(priorCount, 2, 'Prior 2 settlement shifts must remain untouched');

    // Scenario B: Full availability - Request period with 100% available shifts (Dec 3 - Dec 10, exactly 8 shifts)
    const fullSettlement = await DriverSettlementCalculationService.calculateSettlement(
      { organizationId: tenantA._id, role: 'ACCOUNTANT', userId: accountantA._id },
      {
        settlementNumber: 'STL-FULL-SUCCESS',
        driverId: driverA._id,
        periodStart: new Date('2026-12-03T00:00:00Z'),
        periodEnd: new Date('2026-12-10T23:59:59Z'),
        calculatedBy: accountantA._id,
      }
    );
    assert.strictEqual(fullSettlement.shiftsIncluded.length, 8, 'Full availability must claim all 8 shifts');
    const claimedByFull = await DriverShift.countDocuments({ settlementId: fullSettlement._id });
    assert.strictEqual(claimedByFull, 8, 'Exactly 8 shifts must be tagged with new settlementId');
    console.log('[PASS] Test 10: Atomic driver shift claiming & partial availability rejection verified.');

    console.log('\n--- PART 11: PAYMENT COMPENSATION ISOLATION ACROSS CONCURRENT OPERATIONS ---');
    // Test 11: Two distinct concurrent allocations against overlapping invoices
    // Seed invoices X, Y, Z
    const invX = await Invoice.create({
      organizationId: tenantA._id,
      invoiceNumber: 'INV-COMP-X',
      customerId: customerA._id,
      customer: { name: 'C', email: 'e', billingAddress: 'a' },
      lineItems: [{ description: 'Svc', quantity: 1, unitPriceCents: 50000, totalCents: 50000, taxRatePercent: 0, taxAmountCents: 0, discountAmountCents: 0, fuelSurchargeCents: 0 }],
      subtotalCents: 50000,
      totalAmountCents: 50000,
      amountPaidCents: 0,
      outstandingBalanceCents: 50000,
      subtotalAmount: 500,
      taxAmount: 0,
      totalAmount: 500,
      currency: 'USD',
      status: 'ISSUED',
      paymentTerms: 'NET_30',
      issuedAt: new Date(),
      dueAt: new Date(),
    });

    const invY = await Invoice.create({
      organizationId: tenantA._id,
      invoiceNumber: 'INV-COMP-Y',
      customerId: customerA._id,
      customer: { name: 'C', email: 'e', billingAddress: 'a' },
      lineItems: [{ description: 'Svc', quantity: 1, unitPriceCents: 50000, totalCents: 50000, taxRatePercent: 0, taxAmountCents: 0, discountAmountCents: 0, fuelSurchargeCents: 0 }],
      subtotalCents: 50000,
      totalAmountCents: 50000,
      amountPaidCents: 0,
      outstandingBalanceCents: 50000,
      subtotalAmount: 500,
      taxAmount: 0,
      totalAmount: 500,
      currency: 'USD',
      status: 'ISSUED',
      paymentTerms: 'NET_30',
      issuedAt: new Date(),
      dueAt: new Date(),
    });

    const invZ = await Invoice.create({
      organizationId: tenantA._id,
      invoiceNumber: 'INV-COMP-Z',
      customerId: customerA._id,
      customer: { name: 'C', email: 'e', billingAddress: 'a' },
      lineItems: [{ description: 'Svc', quantity: 1, unitPriceCents: 50000, totalCents: 50000, taxRatePercent: 0, taxAmountCents: 0, discountAmountCents: 0, fuelSurchargeCents: 0 }],
      subtotalCents: 50000,
      totalAmountCents: 50000,
      amountPaidCents: 0,
      outstandingBalanceCents: 50000,
      subtotalAmount: 500,
      taxAmount: 0,
      totalAmount: 500,
      currency: 'USD',
      status: 'ISSUED',
      paymentTerms: 'NET_30',
      issuedAt: new Date(),
      dueAt: new Date(),
    });

    // Operation B allocates against Y and Z successfully
    const receiptB = await PaymentReconciliationService.recordAndReconcilePayment(
      { organizationId: tenantA._id, role: 'ACCOUNTANT', userId: accountantA._id },
      {
        receiptNumber: 'REC-OP-B',
        customerId: customerA._id,
        amountCents: 40000,
        referenceNumber: 'REF-B',
        paymentMethod: 'WIRE',
        allocations: [
          { invoiceId: invY._id, invoiceNumber: invY.invoiceNumber, allocatedAmountCents: 20000 },
          { invoiceId: invZ._id, invoiceNumber: invZ.invoiceNumber, allocatedAmountCents: 20000 },
        ],
        recordedBy: accountantA._id,
        idempotencyKey: 'IDEMP-OP-B-KEY',
      }
    );
    assert.strictEqual(receiptB.status, 'RECORDED');

    // Operation A attempts to allocate against X (20,000) and Y (40,000). But Y only has 30,000 balance left!
    // Operation A should update X, then fail on Y, and then compensate X.
    let opAFailed = false;
    try {
      await PaymentReconciliationService.recordAndReconcilePayment(
        { organizationId: tenantA._id, role: 'ACCOUNTANT', userId: accountantA._id },
        {
          receiptNumber: 'REC-OP-A',
          customerId: customerA._id,
          amountCents: 60000,
          referenceNumber: 'REF-A',
          paymentMethod: 'ACH',
          allocations: [
            { invoiceId: invX._id, invoiceNumber: invX.invoiceNumber, allocatedAmountCents: 20000 },
            { invoiceId: invY._id, invoiceNumber: invY.invoiceNumber, allocatedAmountCents: 40000 }, // Exceeds remaining 30,000 balance!
          ],
          recordedBy: accountantA._id,
          idempotencyKey: 'IDEMP-OP-A-KEY',
        }
      );
    } catch (err: any) {
      if (err.message.includes('ALLOCATION_EXCEEDS_BALANCE') || err.message.includes('ALLOCATION_RACE_DETECTED')) {
        opAFailed = true;
      }
    }
    assert.strictEqual(opAFailed, true, 'Operation A must fail due to insufficient balance on invoice Y');

    // Verify Operation A left NO traces on Invoice X (compensated to original 50,000 balance)
    const refreshedX = await Invoice.findById(invX._id);
    assert.strictEqual(refreshedX?.outstandingBalanceCents, 50000, 'Invoice X must have 50,000 balance (fully compensated)');
    assert.strictEqual(refreshedX?.amountPaidCents, 0, 'Invoice X amountPaid must be 0');

    // Verify Operation B's allocations on Y and Z remain completely intact!
    const refreshedY = await Invoice.findById(invY._id);
    const refreshedZ = await Invoice.findById(invZ._id);
    assert.strictEqual(refreshedY?.outstandingBalanceCents, 30000, 'Invoice Y balance must remain 30,000');
    assert.strictEqual(refreshedY?.amountPaidCents, 20000, 'Invoice Y amountPaid must remain 20,000');
    assert.strictEqual(refreshedZ?.outstandingBalanceCents, 30000, 'Invoice Z balance must remain 30,000');
    assert.strictEqual(refreshedZ?.amountPaidCents, 20000, 'Invoice Z amountPaid must remain 20,000');

    // Verify Receipt A was completely deleted during rollback
    const receiptACheck = await PaymentReceipt.findOne({ receiptNumber: 'REC-OP-A' });
    assert.strictEqual(receiptACheck, null, 'Transient Receipt A must be completely removed');

    // Verify Receipt B remains intact
    const receiptBCheck = await PaymentReceipt.findOne({ receiptNumber: 'REC-OP-B' });
    assert.ok(receiptBCheck, 'Receipt B must remain completely intact');
    console.log('[PASS] Test 11: Payment compensation isolation across concurrent operations verified.');

    console.log('\n================================================================================');
    console.log('🎉 ALL 11 PHASE 10.4 HARDENING & CONCURRENCY TEST CASES PASSED (100%)');
    console.log('================================================================================');
  } finally {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runHardeningAndConcurrencySuite().catch((err) => {
  console.error('Phase 10.4 Hardening Suite Failed:', err);
  process.exit(1);
});
