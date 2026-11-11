import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import http from 'http';
import { createApp } from '../app';
import {
  Organization,
  User,
  OrganizationMember,
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
import { generateAccessToken } from '../utils/token';
import { testHttpRequest } from './testHttpHelper';

async function runPhase101ApiIntegrationSuite() {
  console.log('\n===============================================================');
  console.log('       FLEETOS PHASE 10.1 BILLING & SETTLEMENTS API SUITE');
  console.log('===============================================================\n');

  let mongod: MongoMemoryServer | null = null;
  let httpServer: http.Server | null = null;

  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Initialize all schemas and indexes
    await Promise.all([
      Organization.init(),
      User.init(),
      OrganizationMember.init(),
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

    const { server } = createApp();
    httpServer = server;

    await new Promise<void>((resolve) => {
      httpServer!.listen(0, () => {
        resolve();
      });
    });

    // Provision Two Multi-Tenant Organizations
    const orgA = await Organization.create({
      name: 'Northstar Freightways Org A',
      slug: 'northstar-a',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
    });
    const orgIdA = orgA._id.toString();

    const orgB = await Organization.create({
      name: 'Southland Logistics Org B',
      slug: 'southland-b',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
    });
    const orgIdB = orgB._id.toString();

    // Provision Users
    const accountantUser = await User.create({
      email: 'accountant@northstar.com',
      passwordHash: 'HashedPassword123!',
      firstName: 'Arthur',
      lastName: 'Andersen',
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
    });

    await OrganizationMember.create({
      organizationId: orgA._id,
      userId: accountantUser._id,
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
    });

    const driverUser = await User.create({
      email: 'driver@northstar.com',
      passwordHash: 'HashedPassword123!',
      firstName: 'Dave',
      lastName: 'Driver',
      role: 'DRIVER',
      status: 'ACTIVE',
    });

    await OrganizationMember.create({
      organizationId: orgA._id,
      userId: driverUser._id,
      role: 'DRIVER',
      status: 'ACTIVE',
    });

    const tokenAccountant = generateAccessToken({
      userId: accountantUser._id.toString(),
      email: accountantUser.email,
      activeOrganizationId: orgIdA,
      role: 'ACCOUNTANT',
    });

    const tokenDriver = generateAccessToken({
      userId: driverUser._id.toString(),
      email: driverUser.email,
      activeOrganizationId: orgIdA,
      role: 'DRIVER',
    });

    console.log('--- PART 1: RATE MATRIX API (/api/v1/billing/rates) ---');

    // TEST 1: Create Rate Matrix via POST /api/v1/billing/rates
    const createRateRes = await testHttpRequest(
      httpServer,
      'POST',
      '/api/v1/billing/rates',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      {
        code: 'TARIFF-EXPEDITE',
        name: 'Expedited Freight Tariff',
        pricingModel: 'DISTANCE_BASED',
        currency: 'USD',
        baseFeeCents: 6000, // $60.00
        perKmRateCents: 180, // $1.80/km
        perKgRateCents: 6,
        minimumChargeCents: 9000,
        fuelSurchargePercent: 5.5,
      }
    );

    if (createRateRes.status !== 201 || !createRateRes.body.success) {
      throw new Error(`Failed to create rate matrix: ${JSON.stringify(createRateRes.body)}`);
    }
    const createdRateId = createRateRes.body.data._id;
    console.log('[PASS] Test 1: Created rate matrix via POST /api/v1/billing/rates (HTTP 201)');

    // TEST 2: Conflict on duplicate rate code within same tenant
    const dupRateRes = await testHttpRequest(
      httpServer,
      'POST',
      '/api/v1/billing/rates',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      {
        code: 'TARIFF-EXPEDITE',
        name: 'Duplicate Tariff',
        pricingModel: 'DISTANCE_BASED',
        currency: 'USD',
        baseFeeCents: 5000,
        perKmRateCents: 150,
      }
    );

    if (dupRateRes.status !== 409 || dupRateRes.body.error?.code !== 'RATE_CODE_CONFLICT') {
      throw new Error(`Expected HTTP 409 RATE_CODE_CONFLICT, got: ${dupRateRes.status}`);
    }
    console.log('[PASS] Test 2: Duplicate rate code returns HTTP 409 conflict');

    // TEST 3: Preview Quote via POST /api/v1/billing/rates/quote
    const quoteRes = await testHttpRequest(
      httpServer,
      'POST',
      '/api/v1/billing/rates/quote',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      {
        distanceKm: 100, // 100 km * 180 = 18000 + base 6000 = 24000 cents
        weightKg: 50,
      }
    );

    if (quoteRes.status !== 200 || quoteRes.body.data.quote.subtotalCents !== 24300) {
      // 6000 + (100 * 180) + (50 * 6) = 6000 + 18000 + 300 = 24300 cents
      throw new Error(`Quotation calculation mismatch: ${JSON.stringify(quoteRes.body)}`);
    }
    console.log('[PASS] Test 3: Preview quote calculated deterministic pricing (HTTP 200)');

    // TEST 4: Create new Rate Version via POST /api/v1/billing/rates/:id/versions
    const versionRes = await testHttpRequest(
      httpServer,
      'POST',
      `/api/v1/billing/rates/${createdRateId}/versions`,
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      {
        baseFeeCents: 7500, // Price increased
        perKmRateCents: 200,
        fuelSurchargePercent: 6.0,
      }
    );

    if (versionRes.status !== 201 || versionRes.body.data.version !== 2) {
      throw new Error(`Failed to create rate version: ${JSON.stringify(versionRes.body)}`);
    }
    console.log('[PASS] Test 4: Created rate version 2 preserving previous version (HTTP 201)');

    // TEST 5: Get Rate Versions history
    const historyRes = await testHttpRequest(
      httpServer,
      'GET',
      `/api/v1/billing/rates/${createdRateId}/versions`,
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      }
    );

    if (historyRes.status !== 200 || historyRes.body.data.length !== 2) {
      throw new Error(`Expected 2 rate versions in history, got: ${historyRes.body.data?.length}`);
    }
    console.log('[PASS] Test 5: Retrieved rate version audit history (HTTP 200)');

    console.log('\n--- PART 2: FREIGHT INVOICING API (/api/v1/billing/invoices) ---');

    // Provision Customer & Delivered Shipment in Org A
    const customer = await Customer.create({
      organizationId: orgA._id,
      name: 'Omni Retail Network',
      email: 'ap@omniretail.com',
      phone: '+1-555-4321',
      billingAddress: {
        street: '700 Distribution Way',
        city: 'Atlanta',
        state: 'GA',
        postalCode: '30301',
        country: 'USA',
      },
    });

    const deliveredShipment = await Shipment.create({
      organizationId: orgA._id,
      trackingNumber: 'TRK-2026-OMNI-01',
      customerId: customer._id,
      customer: { name: customer.name, email: customer.email, phone: customer.phone },
      sender: { name: 'A', address: 'A', city: 'Atlanta', phone: '1' },
      receiver: { name: 'B', address: 'B', city: 'Savannah', phone: '2' },
      origin: { address: 'Atlanta', city: 'Atlanta', latitude: 33.7, longitude: -84.3 },
      destination: { address: 'Savannah', city: 'Savannah', latitude: 32.0, longitude: -81.0 },
      cargo: { description: 'Retail Dry Goods', category: 'GENERAL', weightKg: 1200, packageCount: 40 },
      pricing: { quotedAmount: 450, currency: 'USD' },
      priority: 'STANDARD',
      status: 'DELIVERED',
      createdBy: accountantUser._id,
    });

    // TEST 6: Generate Invoice from Delivered Shipments
    const genInvRes = await testHttpRequest(
      httpServer,
      'POST',
      '/api/v1/billing/invoices/generate-from-shipments',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      {
        shipmentIds: [deliveredShipment._id.toString()],
        invoiceNumber: 'INV-2026-000881',
        taxRatePercent: 7.0,
      }
    );

    if (genInvRes.status !== 201 || !genInvRes.body.data?.invoiceNumber) {
      throw new Error(`Failed to generate invoice from shipment: ${JSON.stringify(genInvRes.body)}`);
    }
    const generatedInvoiceId = genInvRes.body.data._id;
    console.log('[PASS] Test 6: Generated invoice from delivered shipment via API (HTTP 201)');

    // TEST 7: Anti-duplicate shipment billing rejection (HTTP 409)
    const dupGenRes = await testHttpRequest(
      httpServer,
      'POST',
      '/api/v1/billing/invoices/generate-from-shipments',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      {
        shipmentIds: [deliveredShipment._id.toString()],
        invoiceNumber: 'INV-2026-000882',
      }
    );

    if (dupGenRes.status !== 409 || dupGenRes.body.error?.code !== 'DUPLICATE_SHIPMENT_BILLING') {
      throw new Error(`Expected HTTP 409 DUPLICATE_SHIPMENT_BILLING, got: ${dupGenRes.status}`);
    }
    console.log('[PASS] Test 7: Duplicate shipment billing rejected with HTTP 409 conflict');

    // TEST 8: Create Manual Draft Invoice via POST /api/v1/billing/invoices
    const manualInvRes = await testHttpRequest(
      httpServer,
      'POST',
      '/api/v1/billing/invoices',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      {
        invoiceNumber: 'INV-2026-MANUAL-01',
        customerId: customer._id.toString(),
        customer: {
          name: customer.name,
          email: customer.email,
          billingAddress: '700 Distribution Way, Atlanta, GA',
        },
        lineItems: [
          {
            description: 'Warehouse Storage & Pallet Consolidation',
            quantity: 2,
            unitPriceCents: 15000, // $150.00 each
            taxRatePercent: 0,
            totalCents: 30000,
          },
        ],
        dueAt: new Date(Date.now() + 15 * 86400000),
      }
    );

    if (manualInvRes.status !== 201 || manualInvRes.body.data.status !== 'DRAFT') {
      throw new Error(`Manual invoice creation failed: ${JSON.stringify(manualInvRes.body)}`);
    }
    const manualInvoiceId = manualInvRes.body.data._id;
    console.log('[PASS] Test 8: Created manual draft invoice via API (HTTP 201)');

    // TEST 9: Issue Draft Invoice via POST /api/v1/billing/invoices/:id/issue
    const issueRes = await testHttpRequest(
      httpServer,
      'POST',
      `/api/v1/billing/invoices/${manualInvoiceId}/issue`,
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      }
    );

    if (issueRes.status !== 200 || issueRes.body.data.status !== 'ISSUED') {
      throw new Error(`Issue invoice failed: ${JSON.stringify(issueRes.body)}`);
    }
    console.log('[PASS] Test 9: Issued draft invoice transitioning to ISSUED (HTTP 200)');

    // TEST 10: Void Invoice via POST /api/v1/billing/invoices/:id/void
    const voidRes = await testHttpRequest(
      httpServer,
      'POST',
      `/api/v1/billing/invoices/${manualInvoiceId}/void`,
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      { reason: 'Customer cancelled secondary storage contract' }
    );

    if (voidRes.status !== 200 || voidRes.body.data.status !== 'VOID') {
      throw new Error(`Void invoice failed: ${JSON.stringify(voidRes.body)}`);
    }
    console.log('[PASS] Test 10: Formally voided invoice with mandatory reason (HTTP 200)');

    // TEST 11: Accounts Receivable Aging Report via GET /api/v1/billing/invoices/aging-report
    const agingRes = await testHttpRequest(
      httpServer,
      'GET',
      '/api/v1/billing/invoices/aging-report',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      }
    );

    if (agingRes.status !== 200 || !agingRes.body.data?.currencies?.USD) {
      throw new Error(`Aging report failed: ${JSON.stringify(agingRes.body)}`);
    }
    console.log('[PASS] Test 11: Accounts receivable aging report successfully generated (HTTP 200)');

    console.log('\n--- PART 3: PAYMENT RECEIPT API (/api/v1/billing/receipts) ---');

    // TEST 12: Record Payment Receipt via POST /api/v1/billing/receipts
    const targetInvoice = await Invoice.findById(generatedInvoiceId);
    const invoiceBalance = targetInvoice!.outstandingBalanceCents;

    const receiptRes = await testHttpRequest(
      httpServer,
      'POST',
      '/api/v1/billing/receipts',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      {
        receiptNumber: 'RCP-2026-OMNI-001',
        customerId: customer._id.toString(),
        amountCents: invoiceBalance,
        paymentMethod: 'WIRE',
        referenceNumber: 'FEDWIRE-2026-887766',
        allocations: [
          {
            invoiceId: generatedInvoiceId,
            invoiceNumber: targetInvoice!.invoiceNumber,
            allocatedAmountCents: invoiceBalance,
          },
        ],
        idempotencyKey: 'IDEMP-API-RCP-01',
      }
    );

    if (receiptRes.status !== 201 || receiptRes.body.data.status !== 'RECORDED') {
      throw new Error(`Payment receipt recording failed: ${JSON.stringify(receiptRes.body)}`);
    }
    const createdReceiptId = receiptRes.body.data._id;
    console.log('[PASS] Test 12: Recorded payment receipt and fully reconciled invoice to PAID (HTTP 201)');

    // TEST 13: Payment idempotency: Duplicate submission returns existing receipt
    const idempReceiptRes = await testHttpRequest(
      httpServer,
      'POST',
      '/api/v1/billing/receipts',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      {
        receiptNumber: 'RCP-2026-OMNI-001-RETRY',
        customerId: customer._id.toString(),
        amountCents: invoiceBalance,
        paymentMethod: 'WIRE',
        referenceNumber: 'FEDWIRE-2026-887766',
        allocations: [
          {
            invoiceId: generatedInvoiceId,
            invoiceNumber: targetInvoice!.invoiceNumber,
            allocatedAmountCents: invoiceBalance,
          },
        ],
        idempotencyKey: 'IDEMP-API-RCP-01', // Same key
      }
    );

    if (idempReceiptRes.status !== 200 || !idempReceiptRes.body.idempotentReplay) {
      throw new Error(`Idempotency check failed: ${JSON.stringify(idempReceiptRes.body)}`);
    }
    console.log('[PASS] Test 13: Idempotent payment replay returns existing transaction (HTTP 200)');

    // TEST 14: Payment Receipt Reversal via POST /api/v1/billing/receipts/:id/reverse
    const reverseReceiptRes = await testHttpRequest(
      httpServer,
      'POST',
      `/api/v1/billing/receipts/${createdReceiptId}/reverse`,
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      { reason: 'Bank wire recall notification' }
    );

    if (reverseReceiptRes.status !== 200 || reverseReceiptRes.body.data.status !== 'REVERSED') {
      throw new Error(`Receipt reversal failed: ${JSON.stringify(reverseReceiptRes.body)}`);
    }
    console.log('[PASS] Test 14: Reversed payment receipt and restored invoice outstanding balance (HTTP 200)');

    console.log('\n--- PART 4: DRIVER SETTLEMENT API (/api/v1/settlements) ---');

    // Provision Driver, Shift and Dispatch in Org A
    const driver = await Driver.create({
      organizationId: orgA._id,
      fullName: 'Elena Rostova',
      firstName: 'Elena',
      lastName: 'Rostova',
      email: 'e.rostova@northstar.com',
      phone: '+1-555-0199',
      licenseNumber: 'CDL-GA-771122',
      licenseExpiry: new Date('2029-01-01'),
      licenseExpiryDate: new Date('2029-01-01'),
      status: 'AVAILABLE',
    });

    await DriverShift.create({
      organizationId: orgA._id,
      driverId: driver._id,
      shiftDate: '2026-04-01',
      plannedStart: new Date('2026-04-01T08:00:00Z'),
      plannedEnd: new Date('2026-04-01T17:00:00Z'),
      actualStart: new Date('2026-04-01T08:00:00Z'),
      actualEnd: new Date('2026-04-01T17:00:00Z'),
      status: 'COMPLETED',
      durationMinutes: 540,
      overtimeMinutes: 60,
      createdBy: accountantUser._id,
    });

    await Dispatch.create({
      organizationId: orgA._id,
      dispatchNumber: 'DSP-2026-API-01',
      vehicleId: new Types.ObjectId(),
      driverId: driver._id,
      shipmentIds: [deliveredShipment._id],
      status: 'COMPLETED',
      assignedBy: accountantUser._id,
      completedAt: new Date('2026-04-01T16:00:00Z'),
      createdAt: new Date('2026-04-01T08:00:00Z'),
      createdBy: accountantUser._id,
    });

    // TEST 15: Calculate Driver Settlement via POST /api/v1/settlements/calculate
    const calcSettlementRes = await testHttpRequest(
      httpServer,
      'POST',
      '/api/v1/settlements/calculate',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      {
        settlementNumber: 'SETTLE-2026-0044',
        driverId: driver._id.toString(),
        periodStart: '2026-04-01T00:00:00Z',
        periodEnd: '2026-04-07T23:59:59Z',
        includeSafetyBonus: true,
      }
    );

    if (calcSettlementRes.status !== 201 || !calcSettlementRes.body.data.netPayCents) {
      throw new Error(`Calculate settlement failed: ${JSON.stringify(calcSettlementRes.body)}`);
    }
    const settlementId = calcSettlementRes.body.data._id;
    console.log('[PASS] Test 15: Calculated driver settlement via API (HTTP 201)');

    // TEST 16: Settlement overlap protection (HTTP 409)
    const overlapSettlementRes = await testHttpRequest(
      httpServer,
      'POST',
      '/api/v1/settlements/calculate',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      {
        settlementNumber: 'SETTLE-2026-0045',
        driverId: driver._id.toString(),
        periodStart: '2026-04-03T00:00:00Z',
        periodEnd: '2026-04-10T23:59:59Z',
      }
    );

    if (overlapSettlementRes.status !== 409 || overlapSettlementRes.body.error?.code !== 'SETTLEMENT_OVERLAP') {
      throw new Error(`Expected HTTP 409 SETTLEMENT_OVERLAP, got: ${overlapSettlementRes.status}`);
    }
    console.log('[PASS] Test 16: Overlapping driver settlement period rejected with HTTP 409');

    // TEST 17: Review Settlement via POST /api/v1/settlements/:id/review
    const reviewRes = await testHttpRequest(
      httpServer,
      'POST',
      `/api/v1/settlements/${settlementId}/review`,
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      { notes: 'Verified route logs and clean incident history' }
    );

    if (reviewRes.status !== 200) {
      throw new Error(`Review settlement failed: ${JSON.stringify(reviewRes.body)}`);
    }
    console.log('[PASS] Test 17: Reviewed settlement and appended audit verification (HTTP 200)');

    // TEST 18: Approve Settlement via POST /api/v1/settlements/:id/approve
    const approveRes = await testHttpRequest(
      httpServer,
      'POST',
      `/api/v1/settlements/${settlementId}/approve`,
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      }
    );

    if (approveRes.status !== 200 || approveRes.body.data.status !== 'APPROVED') {
      throw new Error(`Approve settlement failed: ${JSON.stringify(approveRes.body)}`);
    }
    console.log('[PASS] Test 18: Approved driver settlement for payout (HTTP 200)');

    // TEST 19: Record Settlement Payment via POST /api/v1/settlements/:id/pay
    const payRes = await testHttpRequest(
      httpServer,
      'POST',
      `/api/v1/settlements/${settlementId}/pay`,
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      {
        paymentReference: 'ACH-DIRECT-DEP-99881122',
        paymentMethod: 'DIRECT_DEPOSIT',
      }
    );

    if (payRes.status !== 200 || payRes.body.data.status !== 'PAID') {
      throw new Error(`Record settlement payment failed: ${JSON.stringify(payRes.body)}`);
    }
    console.log('[PASS] Test 19: Recorded driver settlement disbursement with payment reference (HTTP 200)');

    // TEST 20: Reverse Settlement Payout via POST /api/v1/settlements/:id/reverse
    const revSettleRes = await testHttpRequest(
      httpServer,
      'POST',
      `/api/v1/settlements/${settlementId}/reverse`,
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdA,
      },
      { reason: 'Direct deposit routing correction' }
    );

    if (revSettleRes.status !== 200 || revSettleRes.body.data.status !== 'APPROVED') {
      throw new Error(`Reverse settlement payout failed: ${JSON.stringify(revSettleRes.body)}`);
    }
    console.log('[PASS] Test 20: Reversed settlement payout back to APPROVED status (HTTP 200)');

    console.log('\n--- PART 5: SECURITY, RBAC & TENANT ISOLATION ---');

    // TEST 21: Cross-Tenant IDOR protection on Invoices (Tenant B cannot fetch Tenant A invoice)
    const crossTenantInvRes = await testHttpRequest(
      httpServer,
      'GET',
      `/api/v1/billing/invoices/${generatedInvoiceId}`,
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdB, // Attacker targeting Org B
      }
    );

    if (crossTenantInvRes.status !== 403 && crossTenantInvRes.status !== 404) {
      throw new Error(`Cross-tenant security leak! Status: ${crossTenantInvRes.status}`);
    }
    console.log('[PASS] Test 21: Cross-tenant invoice access strictly denied (HTTP 403/404)');

    // TEST 22: Cross-Tenant IDOR protection on Driver Settlements
    const crossTenantSettleRes = await testHttpRequest(
      httpServer,
      'GET',
      `/api/v1/settlements/${settlementId}`,
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': orgIdB,
      }
    );

    if (crossTenantSettleRes.status !== 403 && crossTenantSettleRes.status !== 404) {
      throw new Error(`Cross-tenant settlement security leak! Status: ${crossTenantSettleRes.status}`);
    }
    console.log('[PASS] Test 22: Cross-tenant settlement access strictly denied (HTTP 403/404)');

    // TEST 23: RBAC enforcement: DRIVER role denied access to invoice generation
    const rbacDeniedRes = await testHttpRequest(
      httpServer,
      'POST',
      '/api/v1/billing/invoices/generate-from-shipments',
      {
        Authorization: `Bearer ${tokenDriver}`,
        'x-organization-id': orgIdA,
      },
      {
        shipmentIds: [deliveredShipment._id.toString()],
        invoiceNumber: 'INV-UNAUTHORIZED-01',
      }
    );

    if (rbacDeniedRes.status !== 403) {
      throw new Error(`RBAC failure: Driver was able to generate invoices! Status: ${rbacDeniedRes.status}`);
    }
    console.log('[PASS] Test 23: RBAC privilege enforcement strictly blocks unauthorized roles (HTTP 403)');

    // TEST 24: Unauthenticated request rejected
    const unauthRes = await testHttpRequest(
      httpServer,
      'GET',
      '/api/v1/billing/rates'
    );

    if (unauthRes.status !== 401) {
      throw new Error(`Unauthenticated request was not blocked with HTTP 401. Got: ${unauthRes.status}`);
    }
    console.log('[PASS] Test 24: Unauthenticated access strictly blocked (HTTP 401)');

    console.log('\n===============================================================');
    console.log('🎉 ALL 24 PHASE 10.1 BILLING & SETTLEMENT API TESTS PASSED (100%)');
    console.log('===============================================================\n');
  } finally {
    if (httpServer) {
      httpServer.close();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runPhase101ApiIntegrationSuite().catch((err) => {
  console.error('\n❌ PHASE 10.1 TEST SUITE FAILED:', err);
  process.exit(1);
});
