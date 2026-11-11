# FleetOS Database Testing Guide

## 1. Automated Test Suite
- Test runner: `backend/src/tests/tenant_isolation.test.ts`
- Engine: `mongodb-memory-server` (Zero network reliance, runs offline in CI/CD)

## 2. Test Verification Matrix (10/10 Tests Passed)
1. `TEST 1`: Distinct Organization creation.
2. `TEST 2`: User membership organization isolation.
3. `TEST 3`: BaseTenantRepository creation enforcement.
4. `TEST 4`: Tenant-scoped reads.
5. `TEST 5`: Cross-tenant read rejection (returns `null`).
6. `TEST 6`: Cross-tenant update rejection (`matchedCount === 0`).
7. `TEST 7`: Cross-tenant delete rejection (`deletedCount === 0`).
8. `TEST 8`: Tenant-scoped aggregations (isolated `$match` stage).
9. `TEST 9`: Automatic rejection when organizationId context is missing.
10. `TEST 10`: Compound index uniqueness enforced per organization.

## 3. How to Execute
```bash
node fleetos-enterprise-saas/backend/dist/tests/tenant_isolation.test.js
```

