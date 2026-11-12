# FLEETOS — PHASE 11 SECURITY AND PERFORMANCE PLAN
**Date:** November 12, 2026
**Auditor:** Principal Software Architect, Application Security Lead & Performance Engineer
**Repository:** `d:\portfolio-projects\fleetos-enterprise-saas` (`arifranabk3/fleetos-enterprise`)
**Target Milestone:** Phase 11 — Enterprise Intelligence & Analytics

---

## 1. MULTI-TENANT ISOLATION ARCHITECTURE FOR ANALYTICS

Analytics endpoints aggregate large sets of data across multiple collections. Without ironclad security controls, analytical pipelines risk leaking cross-tenant data.

### Mandatory Tenant Invariant:
1. **Server-Side Tenant Resolution:**
   Every analytics endpoint MUST authenticate the request via `authenticate` and `requireTenantMembership`.
   `organizationId` is NEVER accepted from client request bodies or query parameters. It is strictly resolved from `req.tenant.organizationId` (validated against `OrganizationMember` in the database).

2. **Pipeline Stage 0 Guard:**
   The very first stage of EVERY MongoDB aggregation pipeline MUST be:
   ```typescript
   { $match: { organizationId: new Types.ObjectId(req.tenant.organizationId), ... } }
   ```
   Aggregations will NEVER begin with `$lookup` or `$facet` before filtering by `organizationId`.

3. **Cross-Tenant IDOR Prevention:**
   When an analytics endpoint queries a specific entity (e.g., `/analytics/fleet/vehicles/:id/performance`), the query MUST assert both `_id: vehicleId` AND `organizationId: req.tenant.organizationId`. If the entity belongs to another organization, return HTTP 404 (or 403) without leaking entity metadata.

4. **Multi-Currency Separation:**
   Analytics queries must not perform silent cross-tenant or cross-currency mathematical sums. Financial metrics must either be filtered by currency or grouped by currency (`$group: { _id: "$currency", total: { $sum: "$totalAmountCents" } }`).

---

## 2. RBAC PERMISSIONS FOR ANALYTICS & INTELLIGENCE

Phase 11 introduces granular, auditable RBAC permissions across its intelligence modules:

| Permission Code | Name | Domain | Authorized Roles | Prohibited Roles |
| :--- | :--- | :--- | :--- | :--- |
| `ANALYTICS:VIEW_FLEET` | View Fleet & Asset Analytics | `REPORTS` | `OWNER`, `DISPATCHER`, `OPERATIONS_MANAGER` | `DRIVER`, `CUSTOMER`, `VIEWER` |
| `ANALYTICS:VIEW_DRIVERS` | View Driver Performance Analytics | `REPORTS` | `OWNER`, `DISPATCHER`, `SAFETY_OFFICER` | `DRIVER` (can only view self), `CUSTOMER` |
| `ANALYTICS:VIEW_SHIPMENTS` | View Delivery & SLA Analytics | `REPORTS` | `OWNER`, `DISPATCHER`, `OPERATIONS_MANAGER` | `DRIVER` |
| `ANALYTICS:VIEW_FINANCIAL` | View Profitability & Margin Analytics | `REPORTS` | `OWNER`, `ACCOUNTANT`, `FINANCIAL_AUDITOR` | `DISPATCHER`, `DRIVER`, `OPERATIONS_MANAGER` |
| `ANALYTICS:VIEW_EXECUTIVE` | View Executive C-Suite Dashboard | `REPORTS` | `OWNER`, `EXECUTIVE`, `ACCOUNTANT` | `DISPATCHER`, `DRIVER` |
| `ANALYTICS:EXPORT_REPORTS` | Export Intelligence Reports (PDF/CSV) | `REPORTS` | `OWNER`, `ACCOUNTANT`, `OPERATIONS_MANAGER` | `DRIVER`, `VIEWER` |

---

## 3. CWE-1236 CSV SPREADSHEET FORMULA INJECTION DEFENSE

Exporting analytical data (e.g., customer names, driver names, vehicle plates, error notes) to CSV poses a critical CSV Formula Injection risk (CWE-1236).

### Sanitization Standard:
Every CSV export in Phase 11 must pass all string fields through the proven FLEETOS sanitization routine:
```typescript
function sanitizeCsvField(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (/^[=\+\-\@\t\r]/.test(str)) {
    return `'${str}`; // Prefix with single-quote to force spreadsheet text evaluation
  }
  return str;
}
```
All CSV exports must be logged to `AuditLog` with `action: 'EXPORT_ANALYTICS_CSV'` capturing user ID, timestamp, and query parameters.

---

## 4. PERFORMANCE & SCALABILITY AT ENTERPRISE LOAD

FLEETOS must maintain snappy sub-second dashboard load times even for enterprise carriers operating at scale:
- **10,000+ Vehicles**
- **100,000+ Shipments**
- **1,000,000+ Telemetry Tracking Events**

### Performance Targets:
| Request Type | Target P95 Response Time | SLA Upper Bound |
| :--- | :--- | :--- |
| Executive Overview KPI Strip | < 250ms | 500ms |
| Fleet Utilization Analytics (30D) | < 350ms | 750ms |
| Driver Leaderboard & Rankings | < 300ms | 600ms |
| Shipment SLA & Lane Performance | < 400ms | 800ms |
| Vehicle Profitability Breakdown | < 500ms | 1000ms |
| Large Date-Range CSV Export (365D) | < 1500ms | 3000ms |

### Scalability Architectural Measures:
1. **Compound Tenant Indexing:**
   Every query pattern is backed by an index with `{ organizationId: 1, ... }` as the prefix. All `$sort` operations are covered by indexed fields to prevent in-memory sorting spills.
2. **Pipeline `$project` Pruning:**
   Large nested documents (e.g. `Shipment.timeline`, `Vehicle.documents`) are stripped out in early projection stages if only counts or totals are needed.
3. **Cursor-Based Streaming for Exports:**
   CSV and PDF report generations stream data via MongoDB cursors instead of loading 100,000 documents into Node.js heap memory at once.
4. **Read-Only Projections (`lean()`):**
   Mongoose hydration is bypassed on analytical queries using `.lean()` or raw aggregation outputs, cutting CPU memory overhead by up to 70%.
5. **Dashboard Response Caching (Lightweight In-Memory):**
   For computationally intensive executive summaries with 30-day windows, a simple 60-second Node.js in-memory LRU cache keyed by `tenantId:startDate:endDate` prevents database thundering herds when multiple managers refresh simultaneously.
