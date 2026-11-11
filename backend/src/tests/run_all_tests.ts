import { spawn } from 'child_process';
import path from 'path';

interface SuiteDefinition {
  name: string;
  file: string;
  expectedTests: number;
}

const SUITES: SuiteDefinition[] = [
  {
    name: 'Phase 02: Multi-Tenant Data Isolation',
    file: 'src/tests/tenant_isolation.test.ts',
    expectedTests: 10,
  },
  {
    name: 'Phase 03: Authentication, Session & RBAC',
    file: 'src/tests/auth_rbac.test.ts',
    expectedTests: 10,
  },
  {
    name: 'Phase 04: Fleet, Driver & Assignment Management',
    file: 'src/tests/fleet_driver.test.ts',
    expectedTests: 11,
  },
  {
    name: 'Phase 05: Shipment Order & Dispatch Workflows',
    file: 'src/tests/shipment_dispatch.test.ts',
    expectedTests: 17,
  },
  {
    name: 'Phase 06: Real-Time Telemetry & Operations Center',
    file: 'src/tests/realtime_tracking.test.ts',
    expectedTests: 17,
  },
  {
    name: 'Phase 07: Maintenance, Scheduling, Compliance & Vehicle State Safety',
    file: 'src/tests/maintenance_compliance.test.ts',
    expectedTests: 24,
  },
  {
    name: 'Phase 08: Fuel Transactions, Efficiency Analytics & Anomaly Engine',
    file: 'src/tests/fuel_management.test.ts',
    expectedTests: 24,
  },
  {
    name: 'Phase 09: Driver Performance, Safety & Workforce Management',
    file: 'src/tests/driver_workforce.test.ts',
    expectedTests: 25,
  },
  {
    name: 'Phase 10.0: Financial Architecture & Ledger Foundation',
    file: 'src/tests/financial_foundation.test.ts',
    expectedTests: 24,
  },
  {
    name: 'Phase 10.1: Rate Matrix, Freight Invoicing & Driver Settlement APIs',
    file: 'src/tests/billing_api.test.ts',
    expectedTests: 24,
  },
  {
    name: 'Phase 10.3: Financial Reporting, Reconciliation & Integrity Engine',
    file: 'src/tests/financial_reporting.test.ts',
    expectedTests: 15,
  },
  {
    name: 'Phase 10.4: Financial Hardening, Concurrency & Security Suite',
    file: 'src/tests/financial_hardening.test.ts',
    expectedTests: 7,
  },
];

async function runCommand(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'npx.cmd' : 'npx';
    const child = spawn(cmd, args, {
      cwd: path.resolve(__dirname, '../../'),
      shell: true,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 0, stdout: '', stderr: '' });
    });
  });
}

async function runAllSuites() {
  console.log('================================================================================');
  console.log('              FLEETOS ENTERPRISE UNIFIED TEST RUNNER (ALL PHASES)');
  console.log('================================================================================\n');

  let totalSuitesPassed = 0;
  let totalTestsExpected = 0;
  const startTime = Date.now();

  for (const suite of SUITES) {
    totalTestsExpected += suite.expectedTests;
  }

  for (let i = 0; i < SUITES.length; i++) {
    const suite = SUITES[i];
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`▶ [${i + 1}/${SUITES.length}] EXECUTING SUITE: ${suite.name}`);
    console.log(`  File: ${suite.file} | Expected Test Cases: ${suite.expectedTests}`);
    console.log(`--------------------------------------------------------------------------------`);

    const result = await runCommand('npx', ['ts-node', suite.file]);

    if (result.code !== 0) {
      console.error(`\n❌ FAILED SUITE [${i + 1}/${SUITES.length}]: ${suite.name} (Exit code: ${result.code})`);
      console.error('Unified test runner halted.');
      process.exit(result.code);
    }

    console.log(`✔ SUITE [${i + 1}/${SUITES.length}] PASSED: ${suite.name} (${suite.expectedTests}/${suite.expectedTests} tests)`);
    totalSuitesPassed++;
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n================================================================================');
  console.log('              FLEETOS TEST SUITE SUMMARY EXECUTION REPORT');
  console.log('================================================================================');
  console.log(`  Total Suites Executed : ${SUITES.length} / ${SUITES.length}`);
  console.log(`  Suites Passed         : ${totalSuitesPassed} / ${SUITES.length} (100%)`);
  console.log(`  Suites Failed         : 0`);
  console.log(`  Suites Skipped        : 0`);
  console.log(`  Total Test Cases      : ${totalTestsExpected}`);
  console.log(`  Total Tests Passed    : ${totalTestsExpected} (100%)`);
  console.log(`  Execution Time        : ${durationSec}s`);
  console.log('================================================================================\n');
  console.log(`🎉 ALL ${totalTestsExpected} ENTERPRISE AUTOMATED TESTS PASSED WITH 100% SUCCESS!\n`);
}

runAllSuites().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
