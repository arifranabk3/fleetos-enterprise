# FLEETOS — PHASE 11.2.2 AUTHORIZATION MATRIX & ACCESS SPECIFICATION

**Document Version:** 1.1.0
**Status:** ARCHITECTURE AUDIT & CORRECTION COMPLETE
**Target:** Driver Analytics API Security & Authorization (`/api/v1/analytics/drivers`)
**Author:** Principal Backend Security Architect & Senior Software Engineer

---

## 1. Verified Repository Permissions Registry

An inspection of `backend/src/utils/permissions.ts` and `backend/src/middleware/auth.ts` confirms the exact permissions present in FleetOS:

| Permission String | Exists in Repo? | Roles Receiving Permission | Enforced by Middleware? | New Permission Needed? |
| :--- | :---: | :--- | :---: | :---: |
| **`driver.analytics.read`** | **YES** | `ORGANIZATION_OWNER`, `ADMIN`, `FLEET_MANAGER`, `VIEWER` | **YES** (`requirePermission('driver.analytics.read')`) | **NO** (Reuse existing) |
| **`driver.performance.read`**| **YES** | `ORGANIZATION_OWNER`, `ADMIN`, `FLEET_MANAGER`, `DISPATCHER`, `VIEWER` | **YES** (`requirePermission('driver.performance.read')`) | **NO** (Reuse existing) |
| **`driver.shift.read`** | **YES** | `ORGANIZATION_OWNER`, `ADMIN`, `FLEET_MANAGER`, `DISPATCHER`, `DRIVER`, `VIEWER` | **YES** (`requirePermission('driver.shift.read')`) | **NO** (Reuse existing) |
| **`driver.read`** | **YES** | `ORGANIZATION_OWNER`, `ADMIN`, `FLEET_MANAGER`, `DISPATCHER`, `DRIVER`, `VIEWER` | **YES** (`requirePermission('driver.read')`) | **NO** (Reuse existing) |

> **Audit Finding:** Zero new permission strings are required. The existing granular permission matrix fully satisfies the security requirements of Phase 11.2.2.

---

## 2. Reassessment of Dispatcher Access (Least-Privilege Policy)

### 2.1 The Principle of Least Privilege
Dispatchers are responsible for immediate operational dispatch, route assignment, and real-time shipment fulfillment. They do not manage payroll, human resource reviews, employee compensation tiers, or sensitive legal liability records.

### 2.2 Domain Separation: Operational vs. Performance/Safety
1. **Fleet Rankings & Tier Distribution (`/rankings`, `/fleet-overview`):**
   - **Access:** **DENIED** for Dispatchers.
   - **Justification:** Comparative employee ranking and composite scoring tiers (`NEEDS_IMPROVEMENT`, `SATISFACTORY`, etc.) are HR/Managerial performance instruments. Exposing peer rankings to dispatchers creates algorithmic bias and workplace friction during route allocation.
2. **Shift Variance & Overtime Audit (`/shift-variance`):**
   - **Access:** **DENIED** for Dispatchers (Requires managerial role: `FLEET_MANAGER`, `ADMIN`, `OWNER`).
   - **Justification:** Shift variance and overtime reconciliation are financial audit metrics used for payroll settlement verification (Phase 10.1). Dispatchers manage active shifts, not payroll discrepancy audits.
3. **Individual Driver Operational History (`/me` or operational driver view):**
   - **Access:** Allowed only through standard operational endpoints (e.g. `driver.read` for active availability and assigned vehicle). Dispatchers cannot query deep 6-month historical performance trends or safety penalty deductions.

---

## 3. Strict Route Registration Order & Matching

To prevent Express routing collisions where dynamic `:driverId` intercepts static routes:

```
Registered First (Static Routes):
  1. GET /api/v1/analytics/drivers/fleet-overview      (Static)
  2. GET /api/v1/analytics/drivers/rankings            (Static)
  3. GET /api/v1/analytics/drivers/shift-variance      (Static)
  4. GET /api/v1/analytics/drivers/me                  (Static)

Registered Last (Parameterized Dynamic Routes):
  5. GET /api/v1/analytics/drivers/:driverId/trend     (Dynamic child)
  6. GET /api/v1/analytics/drivers/:driverId           (Dynamic parameter)
```

> **Critical Route Guard:** If `GET /api/v1/analytics/drivers/:driverId` were registered before `/me` or `/fleet-overview`, Express would match `'me'` or `'fleet-overview'` as a `:driverId`, fail ObjectId validation, and return `400 Bad Request`. The order above guarantees collision-free routing.

---

## 4. Final Security Authorization Matrix

| Role | `GET .../fleet-overview` | `GET .../rankings` | `GET .../shift-variance` | `GET .../me` | `GET .../:driverId` | `GET .../:driverId/trend` | Scope / Failure Code |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **ORGANIZATION_OWNER** | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | Organization scope. |
| **ADMIN** | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | Organization scope. |
| **FLEET_MANAGER** | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | Organization scope. |
| **DISPATCHER** | **DENY** (`403`) | **DENY** (`403`) | **DENY** (`403`) | **DENY** (`403`) | **DENY** (`403`) | **DENY** (`403`) | Least-privilege: operational dispatch only. |
| **DRIVER (Self)** | **DENY** (`403`) | **DENY** (`403`) | **DENY** (`403`) | **ALLOW** (`200`) | **ALLOW** (Self ID only) | **ALLOW** (Self ID only) | Bounded to linked `Driver` record. |
| **DRIVER (Cross-Driver)** | **DENY** (`403`) | **DENY** (`403`) | **DENY** (`403`) | N/A | **DENY** (`403`) | **DENY** (`403`) | IDOR blocked: `FORBIDDEN_RESOURCE_ACCESS`. |
| **VIEWER** | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | Read-only organization analytics. |
| **ACCOUNTANT** | **DENY** (`403`) | **DENY** (`403`) | **DENY** (`403`) | **DENY** (`403`) | **DENY** (`403`) | **DENY** (`403`) | Denied: financial billing routes only. |
| **Cross-Tenant User** | **DENY** (`403`) | **DENY** (`403`) | **DENY** (`403`) | **DENY** (`403`) | **DENY** (`404`) | **DENY** (`404`) | `FORBIDDEN_TENANT_ACCESS` / `NOT_FOUND`. |
| **Unauthenticated** | **DENY** (`401`) | **DENY** (`401`) | **DENY** (`401`) | **DENY** (`401`) | **DENY** (`401`) | **DENY** (`401`) | `UNAUTHORIZED` / `INVALID_TOKEN`. |
