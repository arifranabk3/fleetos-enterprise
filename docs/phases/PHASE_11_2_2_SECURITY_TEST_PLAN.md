# FLEETOS — PHASE 11.2.2 SECURITY TEST PLAN

**Document Version:** 1.1.0
**Status:** ARCHITECTURE & READINESS APPROVED
**Target Suite:** `backend/src/tests/driver_analytics_api.test.ts`
**Author:** Principal Backend Security Architect & QA Automation Lead

---

## 1. Test Architecture & Security Test Scenarios

The integration test suite will simulate realistic multi-tenant and multi-role operations using `supertest` against an Express server instance backed by `mongodb-memory-server`.

### 1.1 Unauthenticated & Session Rejections (401)
- **TEST-API-01:** Request without `Authorization` header returns `401 Unauthorized` (`code: 'UNAUTHORIZED'`).
- **TEST-API-02:** Request with expired or cryptographically malformed JWT returns `401 Unauthorized` (`code: 'INVALID_TOKEN'`).

### 1.2 Tenant Membership & Header Spoofing (400 / 403)
- **TEST-API-03:** Request without organization context (`x-organization-id` omitted and no active org) returns `400 Bad Request` (`code: 'ORG_CONTEXT_MISSING'`).
- **TEST-API-04:** Header spoofing attempt: User A provides `x-organization-id: TenantB` where User A is not an active member. Server rejects with `403 Forbidden` (`code: 'FORBIDDEN_TENANT_ACCESS'`).
- **TEST-API-05:** Stale/revoked membership: User with status `SUSPENDED` in `OrganizationMember` is rejected with `403 Forbidden`.

### 1.3 Role-Based Access Control (RBAC) Enforcement (403)
- **TEST-API-06:** User with role `ACCOUNTANT` attempts to access `GET /api/v1/analytics/drivers/fleet-overview`. Rejection with `403 Forbidden` (`code: 'INSUFFICIENT_PERMISSIONS'`).
- **TEST-API-07:** User with role `DISPATCHER` attempts to call `GET /api/v1/analytics/drivers/rankings`. Rejection with `403 Forbidden` (`code: 'INSUFFICIENT_PERMISSIONS'`).
- **TEST-API-08:** User with role `DRIVER` attempts to call `GET /api/v1/analytics/drivers/rankings`. Rejection with `403 Forbidden` (`code: 'INSUFFICIENT_PERMISSIONS'`).
- **TEST-API-09:** User with role `FLEET_MANAGER` successfully accesses `GET /api/v1/analytics/drivers/fleet-overview` with `200 OK`.

### 1.4 Insecure Direct Object Reference (IDOR) & Driver Self-Access (403 / 404)
- **TEST-API-10:** Driver self-service: Driver calls `GET /api/v1/analytics/drivers/me` without supplying IDs. Server resolves linked profile and returns `200 OK` with their scorecard.
- **TEST-API-11:** Driver IDOR attempt: Driver A calls `GET /api/v1/analytics/drivers/:driverBId`. Server detects identity mismatch and returns `403 Forbidden` (`code: 'FORBIDDEN_RESOURCE_ACCESS'`).
- **TEST-API-12:** Cross-tenant IDOR: Manager from Tenant A requests `:driverId` belonging to Tenant B. Query in Tenant A returns null $\rightarrow$ Server responds with `404 Not Found` (`code: 'NOT_FOUND'`), preventing existence leakage.

### 1.5 Parameter Validation & Attack Mitigation (400)
- **TEST-API-13:** Malformed `driverId`: Non-hex string passed to `:driverId` returns `400 Bad Request` (`code: 'INVALID_ID_FORMAT'`).
- **TEST-API-14:** Excessive reporting window: Query with `?days=500` (> 365 days) is rejected with `400 Bad Request`.
- **TEST-API-15:** Negative or zero days: Query with `?days=-5` or `?days=0` returns `400 Bad Request`.
- **TEST-API-16:** Excessive pagination limit: Query with `?limit=250` (> 100) returns `400 Bad Request` or is strictly clamped to 100.

### 1.6 Data Exposure Minimization
- **TEST-API-17:** Verify that driver scorecard payloads do **not** expose internal investigation notes (`reviewNotes`), resolution notes, or confidential incident attachments.
