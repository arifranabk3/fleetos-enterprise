# FLEETOS — PHASE 11.1 PRE-IMPLEMENTATION AUDIT
**Date:** November 12, 2026
**Auditor:** Principal Software Architect, Senior Backend Engineer & CTO
**Repository:** `d:\portfolio-projects\fleetos-enterprise-saas` (`arifranabk3/fleetos-enterprise`)
**Baseline Git Commit:** `57d004326293f52740af62716fc61d1100344d2c`

---

## 1. EXECUTIVE AUDIT SUMMARY

This audit inspects all relevant existing models, repositories, services, controllers, routes, frontend pages, and database indexes in preparation for **Phase 11.1: Fleet Utilization, Asset & Telemetry Intelligence**.

### Key Audit Findings:
1. **Existing Models & Schema Semantics:**
   - `Vehicle`: Manages current operational status (`AVAILABLE`, `ASSIGNED`, `IN_TRANSIT`, `MAINTENANCE`, `OUT_OF_SERVICE`, `RETIRED`), `odometerKm`, `lastLocation` snapshot, `activeMaintenanceRecordCount`, and `preMaintenanceStatus`. Status is point-in-time; historical intervals must be derived from event timelines (`Dispatch` and `TelemetryEvent`) rather than assuming `Vehicle.status` held true historically.
   - `TelemetryEvent`: Contains high-resolution telemetry records with `organizationId`, `vehicleId`, `recordedAt`, `motionStatus` (`MOVING`, `IDLE`, `STOPPED`, `OFFLINE`), `speedKmh`, `odometerKm`, `source` (`SIMULATED` vs `HARDWARE_GPS`), and `isSimulated: boolean`.
   - `MaintenanceRecord`: Contains `organizationId`, `vehicleId`, `scheduledDate`, `startedDate`, `completedDate`, `status` (`SCHEDULED`, `DUE`, `IN_PROGRESS`, `COMPLETED`, `OVERDUE`, `CANCELLED`), and `totalCost`.
   - `Dispatch`: Contains `startedAt`, `completedAt`, `status` (`ACTIVE`, `COMPLETED`, `CANCELLED`), `vehicleId`, and `driverId`.
2. **Missing Analytics Data / Historical Data Reality:**
   - Vehicle status changes in `Vehicle` do not maintain an immutable history log in the `Vehicle` document itself.
   - However, **`TelemetryEvent` records contain exact timestamped `motionStatus` intervals (`MOVING`, `IDLE`, `STOPPED`)**.
   - `MaintenanceRecord` provides exact `startedDate` and `completedDate` boundaries.
   - Therefore, **time-based utilization, idle time, moving hours, and maintenance downtime can be derived with mathematical certainty** from `TelemetryEvent` and `MaintenanceRecord`.
3. **Telemetry Freshness & Interval Windowing:**
   - Raw telemetry events represent instantaneous points in time.
   - Fleet telemetry reporting requires an **Interval Processing Engine** (`TelemetryIntervalService`):
     - An event is considered valid for the duration until the next event, up to a configurable maximum freshness window (default: 5 minutes / 300 seconds).
     - Gaps beyond 5 minutes without telemetry must be classified as `UNKNOWN_COVERAGE`, not assumed to be idle or stopped.
     - Out-of-order and duplicate timestamp events must be sanitized and deduplicated chronologically.
4. **Data Quality & Coverage Classifications:**
   - Metric outputs must explicitly state `coveragePercentage`:
     - `HIGH_COVERAGE`: >= 90%
     - `PARTIAL_COVERAGE`: 70% – 89.9%
     - `LOW_COVERAGE`: > 0% – 69.9%
     - `NO_DATA`: 0%
   - Never substitute `0%` utilization when telemetry is absent; return `null` with `INSUFFICIENT_DATA`.
5. **Database Indexing Gaps:**
   - `TelemetryEvent` currently has `{ organizationId: 1, vehicleId: 1, recordedAt: -1 }` and `{ organizationId: 1, recordedAt: -1 }`.
   - To accelerate motion status aggregations across large fleets, add compound index:
     `{ organizationId: 1, vehicleId: 1, motionStatus: 1, recordedAt: -1 }`.
   - `MaintenanceRecord` currently has `{ organizationId: 1, vehicleId: 1, status: 1 }`.
   - Add index for downtime window lookups: `{ organizationId: 1, startedDate: 1, completedDate: 1, status: 1 }`.

---

## 2. REUSABLE CODE ASSETS

| Asset | Location | Reusability in Phase 11.1 |
| :--- | :--- | :--- |
| `Vehicle` model | `backend/src/models/Vehicle.ts` | Complete. |
| `TelemetryEvent` model | `backend/src/models/TelemetryEvent.ts` | Complete. |
| `MaintenanceRecord` model | `backend/src/models/MaintenanceRecord.ts` | Complete. |
| `authenticate` & `requireTenantMembership` | `backend/src/middleware/auth.ts` | Critical for strict tenant scoping. |
| `hasPermission` & RBAC | `backend/src/utils/permissions.ts` | Will enforce `ANALYTICS:VIEW_FLEET`. |
| `BaseTenantRepository` | `backend/src/repositories/BaseTenantRepository.ts` | Standard for tenant isolation. |
| Next.js App Router Layout | `frontend/src/components/layout` | Seamless navigation integration. |

---

## 3. PROPOSED ARCHITECTURE FOR PHASE 11.1

### Backend Services & Controllers:
1. `backend/src/services/TelemetryIntervalService.ts`:
   - Pure, deterministic calculation functions for chronologically sorting events, deduplicating, clipping to reporting boundaries, and calculating `movingHours`, `idleHours`, `stoppedHours`, and `unknownHours`.
2. `backend/src/services/MaintenanceDowntimeCalculator.ts`:
   - Handles overlapping maintenance windows, open records, and period clipping.
3. `backend/src/services/FleetAnalyticsService.ts`:
   - Orchestrates fleet-wide and per-vehicle utilization, availability distribution snapshot, telemetry coverage, and downtime impact.
4. `backend/src/controllers/FleetAnalyticsController.ts`:
   - Validates query params (`from`, `to`, `timezone`, `vehicleId`, `sourcePolicy`).
   - Tenant isolation via `req.tenant.organizationId`.
5. `backend/src/routes/fleetAnalyticsRoutes.ts`:
   - Mounts `/api/v1/analytics/fleet/...`.

### Frontend Analytics Dashboard:
1. New route: `frontend/src/app/(dashboard)/analytics/fleet/page.tsx`:
   - Interactive KPI metric cards (Fleet Utilization %, Moving Hours, Idle Waste Hours, Maintenance Downtime, Telemetry Coverage).
   - Date range selector (`7D`, `30D`, `90D`, `Custom`).
   - SVG-based Fleet Utilization and Motion Breakdown visualizers.
   - Vehicle Performance Grid with sortable columns, pagination, and data quality badges (`HIGH_COVERAGE`, `PARTIAL_COVERAGE`, etc.).
   - Transparent simulated telemetry badge.
2. Refactor `frontend/src/app/(dashboard)/fleet/page.tsx`:
   - Add quick navigation button to Fleet Analytics.

---

## 4. SECURITY & TENANT ISOLATION CONTROLS

- Request parameter `organizationId` is strictly ignored; `req.tenant.organizationId` resolved by `requireTenantMembership` is the single source of truth.
- Every aggregation pipeline starts with:
  ```typescript
  { $match: { organizationId: new Types.ObjectId(req.tenant.organizationId) } }
  ```
- All per-vehicle queries assert both `_id: vehicleId` and `organizationId: req.tenant.organizationId`.
- Automated test suite will verify that Organization A cannot inspect Organization B's fleet metrics or vehicles.
