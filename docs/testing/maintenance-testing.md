# FleetOS — Maintenance & Compliance Test Strategy

## 1. Overview
The FleetOS test architecture verifies deterministic state progression, multi-tenant isolation, preventive threshold evaluation, compliance alerts, and vehicle maintenance lock safety.

## 2. Test Execution
All tests are executed against an in-memory MongoDB replica via the unified runner:

```bash
cd backend
npm test
```

## 3. Suite Coverage
The Phase 07 suite (`src/tests/maintenance_compliance.test.ts`) verifies 24 distinct business cases:
1. **Vendor Suite (Tests 1-2)**: Registration, service tagging, and cross-tenant access rejection.
2. **Work Orders & State Machine (Tests 3-10)**: Lifecycle progression, vehicle lock, terminal state immutability, and cancellation reason requirements.
3. **Preventive Engine (Tests 11-13)**: Interval configuration, threshold detection, and automatic future due calculations.
4. **Compliance Vault (Tests 14-17)**: Document validity rules, expiry detection, and cross-tenant isolation.
5. **Vehicle State Safety & Concurrent Locks (Tests 18-24)**:
   - AVAILABLE vehicle lock and restoration.
   - OUT_OF_SERVICE preservation (never made AVAILABLE).
   - RETIRED vehicle preservation.
   - Concurrent order lock retention (first order completion maintains lock).
   - Final order completion releases asset.
   - Cancellation restores previous operational state.
