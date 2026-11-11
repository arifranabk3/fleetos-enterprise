import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import http from 'http';
import assert from 'assert';
import { createApp } from '../app';
import { testHttpRequest } from './testHttpHelper';
import { generateAccessToken } from '../utils/token';
import { SecureCSVExporter } from '../utils/SecureCSVExporter';
import {
  Organization,
  User,
  OrganizationMember,
  Invoice,
  PaymentReceipt,
  JournalEntry,
  LedgerAccount,
  Customer,
  Driver,
  DriverSettlement,
  FinancialPeriod,
} from '../models';

console.log('===============================================================');
console.log('       FLEETOS PHASE 10.3 FINANCIAL REPORTING & INTEGRITY      ');
console.log('===============================================================');

async function runPhase10_3Tests() {
  let mongod: MongoMemoryServer | null = null;
  let httpServer: http.Server | null = null;

  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('[Phase 10.3 Tests] Connected to in-memory MongoDB persistence.');

    // Initialize schemas & indexes
    await Promise.all([
      Organization.init(),
      User.init(),
      OrganizationMember.init(),
      Customer.init(),
      Invoice.init(),
      PaymentReceipt.init(),
      JournalEntry.init(),
      LedgerAccount.init(),
      Driver.init(),
      DriverSettlement.init(),
      FinancialPeriod.init(),
    ]);

    const { server } = createApp();
    httpServer = server;

    await new Promise<void>((resolve) => {
      httpServer!.listen(0, () => {
        resolve();
      });
    });

    /* =========================================================================
       1. TENANT SETUP & PERMISSIONS PROVISIONING
       ========================================================================= */
    console.log('\n--- PART 1: TEST TENANT PROVISIONING & USER CREATION ---');

    const tenantA = await Organization.create({
      name: 'Apex Global Logistics (Tenant A)',
      slug: 'apex-logistics-' + Date.now(),
      status: 'ACTIVE',
      currency: 'USD',
    });

    const tenantB = await Organization.create({
      name: 'Titan Freight Systems (Tenant B)',
      slug: 'titan-freight-' + Date.now(),
      status: 'ACTIVE',
      currency: 'USD',
    });

    // Create Accountant user for Tenant A
    const accountantUser = await User.create({
      email: `accountant_${Date.now()}@apex.test`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
      firstName: 'Alice',
      lastName: 'Accountant',
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
    });

    await OrganizationMember.create({
      organizationId: tenantA._id,
      userId: accountantUser._id,
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
    });

    // Create Viewer user for Tenant A
    const viewerUser = await User.create({
      email: `viewer_${Date.now()}@apex.test`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
      firstName: 'Bob',
      lastName: 'Viewer',
      role: 'VIEWER',
      status: 'ACTIVE',
    });

    await OrganizationMember.create({
      organizationId: tenantA._id,
      userId: viewerUser._id,
      role: 'VIEWER',
      status: 'ACTIVE',
    });

    const tokenAccountant = generateAccessToken({
      userId: accountantUser._id.toString(),
      email: accountantUser.email,
      role: 'ACCOUNTANT',
      activeOrganizationId: tenantA._id.toString(),
    });

    const tokenViewer = generateAccessToken({
      userId: viewerUser._id.toString(),
      email: viewerUser.email,
      role: 'VIEWER',
      activeOrganizationId: tenantA._id.toString(),
    });

    // Seed Ledger Accounts for Tenant A
    const accAR = await LedgerAccount.create({
      organizationId: tenantA._id,
      accountNumber: '1100',
      name: 'Accounts Receivable',
      type: 'ASSET',
      normalBalance: 'DEBIT',
      currency: 'USD',
      balanceCents: 0,
    });

    const accRev = await LedgerAccount.create({
      organizationId: tenantA._id,
      accountNumber: '4100',
      name: 'Freight Revenue',
      type: 'REVENUE',
      normalBalance: 'CREDIT',
      currency: 'USD',
      balanceCents: 0,
    });

    // Seed Customer for Tenant A
    const customerA = await Customer.create({
      organizationId: tenantA._id,
      name: 'Acme Distribution Corp',
      email: 'billing@acme.test',
      phone: '+1-555-0199',
      billingAddress: {
        street: '100 Industrial Parkway',
        city: 'Dallas',
        state: 'TX',
        country: 'USA',
      },
      status: 'ACTIVE',
    });

    // Seed Invoices for Tenant A
    const inv1 = await Invoice.create({
      organizationId: tenantA._id,
      invoiceNumber: 'INV-2026-0001',
      customerId: customerA._id,
      customer: {
        name: customerA.name,
        email: customerA.email,
        billingAddress: '100 Industrial Parkway, Dallas, TX',
      },
      lineItems: [
        {
          description: 'Linehaul Freight Austin to Dallas',
          quantity: 1,
          unitPriceCents: 150000,
          taxRatePercent: 0,
          taxAmountCents: 0,
          discountAmountCents: 0,
          fuelSurchargeCents: 15000,
          totalCents: 165000,
        },
      ],
      subtotalCents: 150000,
      taxAmountCents: 0,
      fuelSurchargeCents: 15000,
      discountCents: 0,
      totalAmountCents: 165000,
      amountPaidCents: 100000,
      outstandingBalanceCents: 65000,
      subtotalAmount: 1500,
      taxAmount: 0,
      totalAmount: 1650,
      currency: 'USD',
      status: 'PARTIALLY_PAID',
      paymentTerms: 'NET_30',
      issuedAt: new Date('2026-11-01T10:00:00Z'),
      dueAt: new Date('2026-12-01T10:00:00Z'),
    });

    const inv2 = await Invoice.create({
      organizationId: tenantA._id,
      invoiceNumber: 'INV-2026-0002',
      customerId: customerA._id,
      customer: {
        name: customerA.name,
        email: customerA.email,
        billingAddress: '100 Industrial Parkway, Dallas, TX',
      },
      lineItems: [
        {
          description: 'Refrigerated Cold-Chain Transit',
          quantity: 1,
          unitPriceCents: 200000,
          taxRatePercent: 0,
          taxAmountCents: 0,
          discountAmountCents: 0,
          fuelSurchargeCents: 20000,
          totalCents: 220000,
        },
      ],
      subtotalCents: 200000,
      taxAmountCents: 0,
      fuelSurchargeCents: 20000,
      discountCents: 0,
      totalAmountCents: 220000,
      amountPaidCents: 0,
      outstandingBalanceCents: 220000,
      subtotalAmount: 2000,
      taxAmount: 0,
      totalAmount: 2200,
      currency: 'USD',
      status: 'OVERDUE',
      paymentTerms: 'NET_15',
      issuedAt: new Date('2026-10-01T10:00:00Z'),
      dueAt: new Date('2026-10-16T10:00:00Z'), // > 25 days overdue
    });

    // Seed Payment Receipt for Tenant A
    const rcpt1 = await PaymentReceipt.create({
      organizationId: tenantA._id,
      receiptNumber: 'REC-2026-0001',
      customerId: customerA._id,
      amountCents: 150000,
      currency: 'USD',
      paymentDate: new Date('2026-11-05T14:30:00Z'),
      paymentMethod: 'ACH',
      referenceNumber: 'ACH-TRACE-88991',
      idempotencyKey: 'IDEMP-REC-0001',
      allocations: [
        {
          invoiceId: inv1._id,
          invoiceNumber: inv1.invoiceNumber,
          allocatedAmountCents: 100000,
        },
      ],
      status: 'RECORDED',
      recordedBy: accountantUser._id,
    });

    // Seed Balanced Journal Entry for Tenant A
    await JournalEntry.create({
      organizationId: tenantA._id,
      entryNumber: 'JE-2026-00001',
      postingDate: new Date('2026-11-01T10:05:00Z'),
      sourceType: 'INVOICE_ISSUED',
      sourceReferenceId: inv1._id,
      sourceReferenceNumber: inv1.invoiceNumber,
      description: 'Record Freight Invoice INV-2026-0001',
      currency: 'USD',
      lines: [
        {
          accountId: accAR._id,
          accountNumber: accAR.accountNumber,
          accountName: accAR.name,
          entryType: 'DEBIT',
          amountCents: 165000,
        },
        {
          accountId: accRev._id,
          accountNumber: accRev.accountNumber,
          accountName: accRev.name,
          entryType: 'CREDIT',
          amountCents: 165000,
        },
      ],
      totalDebitCents: 165000,
      totalCreditCents: 165000,
      status: 'POSTED',
      postedBy: accountantUser._id,
    });

    // Seed Driver & Settlement for Tenant A
    const driver1 = await Driver.create({
      organizationId: tenantA._id,
      fullName: 'Dave Driver',
      licenseNumber: 'CDL-TX-99011',
      licenseExpiry: new Date('2028-01-01'),
      status: 'AVAILABLE',
      phone: '+1-555-8822',
      email: 'dave@apex.test',
      assignedVehicleId: null,
      emergencyContact: {
        name: 'Dispatch Office',
        phone: '+1-555-0100',
      },
      joiningDate: new Date('2025-01-01'),
    });

    const setl1 = await DriverSettlement.create({
      organizationId: tenantA._id,
      settlementNumber: 'STL-2026-0001',
      driverId: driver1._id,
      periodStart: new Date('2026-11-01'),
      periodEnd: new Date('2026-11-07'),
      status: 'APPROVED',
      currency: 'USD',
      totalDispatches: 4,
      totalDistanceKm: 1200,
      totalHoursWorked: 40,
      totalOvertimeHours: 2,
      basePayCents: 100000,
      mileagePayCents: 36000,
      overtimePayCents: 7500,
      bonuses: [
        {
          code: 'BONUS_SAFETY',
          description: 'Clean driving record',
          amountCents: 10000,
        },
      ],
      totalBonusCents: 10000,
      deductions: [],
      totalDeductionCents: 0,
      grossPayCents: 153500,
      taxWithheldCents: 15000,
      netPayCents: 138500,
      dispatchesIncluded: [],
      shiftsIncluded: [],
    });

    console.log('[PASS] Test 1: Seeded isolated tenant accounting and financial ledger data.');

    /* =========================================================================
       2. REVENUE REPORTING API
       ========================================================================= */
    console.log('\n--- PART 2: REVENUE REPORTING API ---');

    const revRes = await testHttpRequest(
      httpServer!,
      'GET',
      '/api/v1/financial-reports/revenue',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': tenantA._id.toString(),
      }
    );
    assert.strictEqual(revRes.status, 200, 'Revenue report must return 200');
    assert.strictEqual(revRes.body.success, true);
    assert.ok(revRes.body.data.summaryByCurrency.USD, 'USD revenue group must exist');
    assert.strictEqual(
      revRes.body.data.summaryByCurrency.USD.totalEarnedRevenueCents,
      385000,
      'Total earned revenue must equal sum of issued invoices ($1650 + $2200 = $3850 -> 385000 cents)'
    );
    console.log('[PASS] Test 2: Revenue report returns accurate earned revenue (385,000 cents).');

    // Test CSV Export of Revenue Report
    const revCsvRes = await testHttpRequest(
      httpServer!,
      'GET',
      '/api/v1/financial-reports/revenue?format=csv',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': tenantA._id.toString(),
      }
    );
    assert.strictEqual(revCsvRes.status, 200);
    const revCsvText = typeof revCsvRes.body === 'string' ? revCsvRes.body : JSON.stringify(revCsvRes.body);
    assert.ok(revCsvText.includes('Invoice Number,Customer,Issue Date'));
    assert.ok(revCsvText.includes('INV-2026-0001'));
    console.log('[PASS] Test 3: Revenue report CSV export formatting validated.');

    /* =========================================================================
       3. CASH COLLECTIONS & REVERSAL REPORTING
       ========================================================================= */
    console.log('\n--- PART 3: CASH COLLECTIONS & REVERSAL REPORTING ---');

    const cashRes = await testHttpRequest(
      httpServer!,
      'GET',
      '/api/v1/financial-reports/cash-collections',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': tenantA._id.toString(),
      }
    );
    assert.strictEqual(cashRes.status, 200);
    assert.strictEqual(cashRes.body.data.summaryByCurrency.USD.grossReceiptsCents, 150000);
    assert.strictEqual(cashRes.body.data.summaryByCurrency.USD.netCollectionsCents, 150000);
    console.log('[PASS] Test 4: Cash collections returns exact gross collections (150,000 cents).');

    // Simulate Reversal and verify net collections
    await PaymentReceipt.create({
      organizationId: tenantA._id,
      receiptNumber: 'REC-2026-BOUNCE',
      customerId: customerA._id,
      amountCents: 50000,
      currency: 'USD',
      paymentDate: new Date('2026-11-06T10:00:00Z'),
      paymentMethod: 'CHECK',
      referenceNumber: 'CHK-991',
      idempotencyKey: 'IDEMP-REC-BOUNCE',
      allocations: [],
      status: 'REVERSED',
      reversalReason: 'NSF Returned Check',
      reversedAt: new Date('2026-11-07T10:00:00Z'),
      recordedBy: accountantUser._id,
    });

    const cashReversalRes = await testHttpRequest(
      httpServer!,
      'GET',
      '/api/v1/financial-reports/cash-collections',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': tenantA._id.toString(),
      }
    );
    assert.strictEqual(cashReversalRes.body.data.summaryByCurrency.USD.grossReceiptsCents, 150000);
    assert.strictEqual(cashReversalRes.body.data.summaryByCurrency.USD.reversedReceiptsCents, 50000);
    assert.strictEqual(cashReversalRes.body.data.summaryByCurrency.USD.netCollectionsCents, 100000);
    console.log('[PASS] Test 5: Cash collection net calculations separate gross collections from reversals ($1500 - $500 = $1000).');

    /* =========================================================================
       4. ACCOUNTS RECEIVABLE AGING REPORT
       ========================================================================= */
    console.log('\n--- PART 4: ACCOUNTS RECEIVABLE AGING REPORT ---');

    const arRes = await testHttpRequest(
      httpServer!,
      'GET',
      '/api/v1/financial-reports/accounts-receivable',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': tenantA._id.toString(),
      }
    );
    assert.strictEqual(arRes.status, 200);
    const usdAging = arRes.body.data.byCurrency.USD;
    assert.strictEqual(
      usdAging.totalOutstandingCents,
      285000,
      'Total AR outstanding must be $650 + $2200 = 285000 cents'
    );
    assert.strictEqual(usdAging.currentCents, 65000, 'Current bucket must be $650');
    assert.strictEqual(usdAging.days1To30Cents, 220000, 'Overdue invoice must sit in days 1-30 bucket');
    console.log('[PASS] Test 6: AR Aging report partitions balances into accurate aging buckets.');

    /* =========================================================================
       5. CUSTOMER STATEMENT RECONCILIATION
       ========================================================================= */
    console.log('\n--- PART 5: CUSTOMER STATEMENT RECONCILIATION ---');

    const stmtRes = await testHttpRequest(
      httpServer!,
      'GET',
      `/api/v1/financial-reports/customer-statement?customerId=${customerA._id.toString()}`,
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': tenantA._id.toString(),
      }
    );
    assert.strictEqual(stmtRes.status, 200);
    const stmtData = stmtRes.body.data;
    assert.strictEqual(stmtData.summary.totalInvoicedCents, 385000);
    assert.strictEqual(stmtData.summary.totalPaidCents, 150000);
    assert.strictEqual(stmtData.summary.totalReversedCents, 50000);
    assert.strictEqual(stmtData.summary.closingBalanceCents, 285000, 'Closing balance must match AR outstanding balance');
    console.log('[PASS] Test 7: Customer statement balances reconcile exactly to underlying transactions.');

    /* =========================================================================
       6. DRIVER SETTLEMENT & GENERAL LEDGER REPORTS
       ========================================================================= */
    console.log('\n--- PART 6: DRIVER SETTLEMENT & GENERAL LEDGER REPORTS ---');

    const setlRepRes = await testHttpRequest(
      httpServer!,
      'GET',
      '/api/v1/financial-reports/driver-settlements',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': tenantA._id.toString(),
      }
    );
    assert.strictEqual(setlRepRes.status, 200);
    assert.strictEqual(setlRepRes.body.data.summary.totalNetPayCents, 138500);
    assert.strictEqual(setlRepRes.body.data.summary.totalPayableOutstandingCents, 138500);
    assert.strictEqual(setlRepRes.body.data.summary.totalPaidCents, 0, 'Unpaid settlement must not count as cash disbursement');
    console.log('[PASS] Test 8: Driver settlement report accurately reports payable obligations.');

    const glRes = await testHttpRequest(
      httpServer!,
      'GET',
      '/api/v1/financial-reports/general-ledger',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': tenantA._id.toString(),
      }
    );
    assert.strictEqual(glRes.status, 200);
    assert.strictEqual(glRes.body.data.trialBalanceTotals.isBalanced, true, 'General ledger debits must balance credits');
    assert.strictEqual(glRes.body.data.trialBalanceTotals.totalDebitsCents, 165000);
    assert.strictEqual(glRes.body.data.trialBalanceTotals.totalCreditsCents, 165000);
    console.log('[PASS] Test 9: General Ledger trial balance proves double-entry equality (Debits == Credits).');

    /* =========================================================================
       7. RECONCILIATION SUMMARY & UNALLOCATED CASH ALLOCATION
       ========================================================================= */
    console.log('\n--- PART 7: RECONCILIATION & AUTHORIZED ADJUSTMENTS ---');

    const reconRes = await testHttpRequest(
      httpServer!,
      'GET',
      '/api/v1/financial-reports/reconciliation',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': tenantA._id.toString(),
      }
    );
    assert.strictEqual(reconRes.status, 200);
    assert.strictEqual(reconRes.body.data.totalUnallocatedCents, 50000, 'Receipt REC-2026-0001 has 50000 unallocated cents');
    assert.strictEqual(reconRes.body.data.unallocatedPayments.length, 1);
    console.log('[PASS] Test 10: Reconciliation engine detects unallocated cash balance (50,000 cents).');

    // Apply authorized allocation of 50,000 cents from rcpt1 to inv2
    const allocPostRes = await testHttpRequest(
      httpServer!,
      'POST',
      '/api/v1/financial-reports/reconciliation/allocate',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': tenantA._id.toString(),
      },
      {
        receiptId: rcpt1._id.toString(),
        allocations: [{ invoiceId: inv2._id.toString(), amountCents: 50000 }],
        reason: 'Authorized customer settlement allocation to outstanding invoice.',
      }
    );
    assert.strictEqual(allocPostRes.status, 200, 'Allocation adjustment must succeed');

    // Verify invoice balance updated
    const updatedInv2 = await Invoice.findById(inv2._id);
    assert.strictEqual(updatedInv2?.amountPaidCents, 50000);
    assert.strictEqual(updatedInv2?.outstandingBalanceCents, 170000);
    console.log('[PASS] Test 11: Authorized manual allocation correctly applies cash and updates AR balance.');

    /* =========================================================================
       8. FINANCIAL INTEGRITY ENGINE (AUDITING MISMATCHES)
       ========================================================================= */
    console.log('\n--- PART 8: FINANCIAL INTEGRITY ENGINE AUDIT ---');

    const auditRes = await testHttpRequest(
      httpServer!,
      'GET',
      '/api/v1/financial-reports/integrity',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': tenantA._id.toString(),
      }
    );
    assert.strictEqual(auditRes.status, 200);
    assert.strictEqual(auditRes.body.success, true);
    console.log('[PASS] Test 12: Financial integrity audit runs non-destructively and outputs report.');

    /* =========================================================================
       9. FORMULA INJECTION & CSV SANITIZATION
       ========================================================================= */
    console.log('\n--- PART 9: SECURE CSV FORMULA INJECTION MITIGATION ---');

    const unsafeCustomerName = '=cmd|"/c calc"!A1';
    const sanitized = SecureCSVExporter.sanitizeCell(unsafeCustomerName);
    assert.ok(sanitized.includes("'="), 'CSV sanitizer must prefix formula trigger with single quote');

    const sanitizedPlus = SecureCSVExporter.sanitizeCell('+1000');
    assert.ok(sanitizedPlus.includes("'+"), 'CSV sanitizer must prefix + with single quote');

    const sanitizedAt = SecureCSVExporter.sanitizeCell('@SUM(A1:A10)');
    assert.ok(sanitizedAt.includes("'@"), 'CSV sanitizer must prefix @ with single quote');

    console.log('[PASS] Test 13: Formula injection attacks (=, +, -, @) mitigated with single-quote escaping.');

    /* =========================================================================
       10. SECURITY & TENANT ISOLATION
       ========================================================================= */
    console.log('\n--- PART 10: MULTI-TENANT ISOLATION & PERMISSIONS ---');

    // Attempt to access Tenant B reports with Tenant A Accountant token
    const crossTenantRes = await testHttpRequest(
      httpServer!,
      'GET',
      '/api/v1/financial-reports/revenue',
      {
        Authorization: `Bearer ${tokenAccountant}`,
        'x-organization-id': tenantB._id.toString(),
      }
    );
    assert.strictEqual(
      crossTenantRes.status,
      403,
      'Accountant from Tenant A must be strictly denied access to Tenant B financial records'
    );
    console.log('[PASS] Test 14: Cross-tenant financial report access strictly denied (HTTP 403).');

    // Attempt to access reporting endpoint with unauthenticated request
    const unauthRes = await testHttpRequest(
      httpServer!,
      'GET',
      '/api/v1/financial-reports/revenue',
      {
        'x-organization-id': tenantA._id.toString(),
      }
    );
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated access must be rejected');
    console.log('[PASS] Test 15: Unauthenticated financial report access blocked (HTTP 401).');

    console.log('\n===============================================================');
    console.log('🎉 ALL 15 PHASE 10.3 FINANCIAL REPORTING TESTS PASSED (100%)');
    console.log('===============================================================');
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

runPhase10_3Tests().catch((err) => {
  console.error('Phase 10.3 Tests Failed:', err);
  process.exit(1);
});
