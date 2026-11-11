# FleetOS — Fuel Testing Strategy & Verification Guide

## 1. Overview
The Phase 08 test suite (`src/tests/fuel_management.test.ts`) verifies end-to-end fuel operations against in-memory MongoDB replicas.

## 2. Test Execution
Execute the entire test suite via the unified test runner:

```bash
cd backend
npm test
```

## 3. Test Coverage (16 Tests)
- **Part 1: Fuel Vendors & Tenant Isolation (Tests 1-2)**:
  - Vendor registration with multi-fuel support.
  - Cross-tenant vendor isolation.
- **Part 2: Fuel Transaction Logging & Scoping (Tests 3-5)**:
  - Positive quantity, price, and total cost validation.
  - Prevention of duplicate transaction references within tenant.
  - Cross-tenant identical reference allowance.
- **Part 3: Fuel Efficiency Engine (Tests 6-8)**:
  - Commercial diesel km/L computation.
  - Decreasing odometer detection.
  - Electric Vehicle kWh consumption and km/kWh computation.
- **Part 4: Financial Expense Integration (Tests 9-11)**:
  - Automatic Expense record creation with `category = 'FUEL'`.
  - Idempotent resyncing without duplicate expenses.
  - Void synchronization between FuelTransaction and Expense.
- **Part 5: Anomaly Detection Engine (Tests 12-14)**:
  - Excessive quantity detection (>1200L tank capacity).
  - Out-of-service / retired vehicle refuelling flags.
  - Idempotent alert deduplication with 24h cooldown.
- **Part 6: Multi-Tenant Cross-Organization Scoping (Tests 15-16)**:
  - Cross-tenant lookup rejection.
  - Multi-transaction vehicle rolling efficiency metrics.
