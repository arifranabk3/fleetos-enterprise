# PHASE 11.2 — MASTER ARCHITECTURE SPECIFICATION
## ADVANCED DRIVER PERFORMANCE & SAFETY INTELLIGENCE

**Document Version:** 1.0.0
**Status:** ARCHITECTURE DESIGN COMPLETE
**Architecture Pattern:** Modular Monolith (Express / MongoDB / Next.js)
**Author:** Principal Software Architect & CTO

---

## 1. System Overview & Architectural Placement

Phase 11.2 expands the FleetOS analytics domain by providing deep, multi-dimensional workforce intelligence. It complements Phase 11.1 (Vehicle Utilization & Telemetry Intelligence) by focusing on human asset efficiency, shift reliability, safety risk distribution, and historical performance trends.

```
+-----------------------------------------------------------------------------------+
|                            FLEETOS WEB APP (Next.js 14)                           |
|  /driver-analytics  /drivers/[id]/performance  /driver-shifts  /driver-incidents  |
+-----------------------------------------------------------------------------------+
                                        | (REST / HTTPS)
                                        v
+-----------------------------------------------------------------------------------+
|                        API GATEWAY / AUTH & TENANT FENCE                          |
|  authenticate -> requireTenantMembership -> requirePermission                     |
+-----------------------------------------------------------------------------------+
                                        |
       +--------------------------------+-------------------------------+
       |                                                                |
       v                                                                v
+---------------------------------------+    +--------------------------------------+
|       driverWorkforceRoutes.ts        |    |       driverAnalyticsRoutes.ts       |
|  - CRUD Driver, Shifts, Incidents     |    |  - /analytics/drivers/fleet-overview |
|  - Payout Settlement Links            |    |  - /analytics/drivers/rankings       |
+---------------------------------------+    |  - /analytics/drivers/shift-variance |
                   |                         |  - /analytics/drivers/:id/trend      |
                   v                         +--------------------------------------+
+---------------------------------------+                               |
|        DriverWorkforceService         |                               v
+---------------------------------------+            +--------------------------------------+
                   |                                 |        DriverAnalyticsService        |
                   |                                 |  - High-performance aggregations     |
                   |                                 |  - Multi-driver ranking pipelines    |
                   |                                 |  - Rolling historical trends         |
                   |                                 +--------------------------------------+
                   |                                                    |
                   +--------------------+-------------------------------+
                                        |
                                        v
                   +-----------------------------------------+
                   |             MONGODB MODELS              |
                   | Driver | DriverShift | DriverIncident   |
                   | Shipment | FuelTransaction              |
                   +-----------------------------------------+
```

---

## 2. Service Separation & Responsibilities

To avoid code bloat and protect transactional workforce workflows:
1. **`DriverWorkforceService` / `DriverWorkforceController`:** Retains operational CRUD, shift clock-in/out, incident reporting, and settlement linking.
2. **`DriverAnalyticsService` / `DriverAnalyticsController`:** Dedicated to analytical aggregations, fleet-wide ranking, shift variance analysis, and multi-period trend reporting.
3. **`DriverPerformanceEngine`:** Pure calculation engine containing deterministic formulas for scorecard synthesis.

---

## 3. API Contract Specifications

All endpoints are scoped to the authenticated tenant (`req.tenant.organizationId`).

### 3.1 `GET /api/v1/analytics/drivers/fleet-overview`
- **Permission:** `driver.analytics.read`
- **Query Parameters:** `days` (integer, default 30, max 365)
- **Response Structure:**
  ```json
  {
    "success": true,
    "data": {
      "reportingPeriodDays": 30,
      "totalActiveDrivers": 42,
      "fleetAverageCompositeScore": 84.6,
      "fleetOnTimeDeliveryRate": 92.4,
      "fleetAttendanceReliability": 96.1,
      "totalIncidents": 3,
      "criticalIncidents": 0,
      "tierDistribution": {
        "EXCELLENT": 18,
        "GOOD": 16,
        "SATISFACTORY": 6,
        "NEEDS_IMPROVEMENT": 2,
        "INSUFFICIENT_DATA": 0
      }
    }
  }
  ```

### 3.2 `GET /api/v1/analytics/drivers/rankings`
- **Permission:** `driver.performance.read`
- **Query Parameters:** `days` (default 30), `limit` (default 50), `sortBy` (`composite` | `attendance` | `safety` | `deliveries`), `order` (`asc` | `desc`)
- **Response Structure:** Array of `DriverScorecardMetrics` sorted by the requested criterion.

### 3.3 `GET /api/v1/analytics/drivers/shift-variance`
- **Permission:** `driver.shift.read`
- **Query Parameters:** `startDate` (ISO YYYY-MM-DD), `endDate` (ISO YYYY-MM-DD)
- **Response Structure:**
  ```json
  {
    "success": true,
    "data": {
      "totalScheduledHours": 3200.0,
      "totalActualHours": 3248.5,
      "netVarianceHours": 48.5,
      "totalOvertimeHours": 64.2,
      "lateStartsCount": 8,
      "punctualityRatePercent": 94.2,
      "discrepancyDrivers": [
        {
          "driverId": "...",
          "driverName": "Jane Doe",
          "plannedHours": 160.0,
          "actualHours": 178.5,
          "varianceHours": 18.5,
          "lateStarts": 0
        }
      ]
    }
  }
  ```

### 3.4 `GET /api/v1/analytics/drivers/:id/trend`
- **Permission:** `driver.performance.read`
- **Query Parameters:** `months` (integer, default 6, max 12)
- **Response Structure:** Monthly time-series array containing historical composite scores, deliveries, incidents, and attendance reliability.

---

## 4. Frontend Component Hierarchy

The frontend (`/driver-analytics`) will be updated to display executive workforce intelligence:
1. **Workforce KPI Bar:** Total Drivers, Fleet Average Score, OTD Rate, Fleet Attendance Reliability, Total Incidents.
2. **Tier Distribution Widget:** Interactive breakdown of workforce across `EXCELLENT`, `GOOD`, `SATISFACTORY`, and `NEEDS_IMPROVEMENT`.
3. **Driver Leaderboard Table:** Sortable by composite score, deliveries completed, safety score, and punctuality.
4. **Shift Variance & Hours Reconciliation Card:** Summary of scheduled vs actual hours, highlighting overtime and chronic late starts.

---

## 5. Zero-Cost Architecture Guarantee

- **Database:** Standard MongoDB aggregations leveraging indexed fields (`organizationId`, `driverId`, `shiftDate`).
- **Caching/Compute:** In-process calculation within the Express modular monolith; no Redis or paid external caching layers required.
- **Charts:** Built with existing lightweight SVG/Tailwind components and open-source charting libraries already installed.
