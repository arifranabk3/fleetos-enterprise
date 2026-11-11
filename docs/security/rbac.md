# FleetOS Role-Based Access Control (RBAC) Specification

## 1. Domain Permission Matrix

| Role | Organization Scope | FLEET | SHIPMENTS | DISPATCH | TRACKING | BILLING | AUDIT_LOGS |
|---|---|---|---|---|---|---|---|
| **SUPER_ADMIN** | Cross-Tenant Global | `*` | `*` | `*` | `*` | `*` | `*` |
| **ORGANIZATION_OWNER** | Tenant Scoped | `MANAGE` | `MANAGE` | `MANAGE` | `MANAGE` | `MANAGE` | `READ` |
| **ADMIN** | Tenant Scoped | `MANAGE` | `MANAGE` | `MANAGE` | `READ` | `READ` | `READ` |
| **FLEET_MANAGER** | Tenant Scoped | `MANAGE` | None | None | `READ` | None | None |
| **DISPATCHER** | Tenant Scoped | `READ` | `MANAGE` | `MANAGE` | `MANAGE` | None | None |
| **DRIVER** | Assigned Assets | `READ` | `UPDATE` | None | `CREATE` | None | None |
| **ACCOUNTANT** | Tenant Scoped | None | `READ` | None | None | `MANAGE` | None |
| **VIEWER** | Tenant Scoped | `READ` | `READ` | None | `READ` | None | None |

## 2. Server-Side Enforcement Middleware
- `authenticate`: Validates JWT signature and expiration.
- `requireTenantMembership`: Verifies active record in `organization_members`.
- `requirePermission('DOMAIN:ACTION')`: Evaluates RBAC permissions server-side.

