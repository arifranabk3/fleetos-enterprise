# PHASE 11.2 — IMPLEMENTATION ROADMAP & TEST STRATEGY

**Document Version:** 1.1.0
**Status:** READY FOR CODING AUTHORIZATION
**Estimated Complexity:** Medium-High
**Author:** Principal Software Architect, QA Lead & CTO

---

## 1. Implementation Subphases & Dependencies

```
+---------------------------------------------------------------------------------------+
| SUBPHASE 11.2.1: ANALYTICS AGGREGATION ENGINES & INDEXES                              |
| - Add missing compound indexes to Shipment, DriverShift, DriverIncident.              |
| - Implement DriverAnalyticsService with batch MongoDB aggregation pipelines.          |
| - Implement calculateFleetOverview, calculateFleetRankings, calculateShiftVariance,    |
|   and calculateDriverTrend with strict minimum data sufficiency guards.               |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| SUBPHASE 11.2.2: CONTROLLER & REST API ENDPOINTS                                      |
| - Implement DriverAnalyticsController with tenant isolation and IDOR validation.      |
| - Author driverAnalyticsRoutes.ts and mount under /api/v1/analytics/drivers.          |
| - Register granular permissions (driver.analytics.read, driver.performance.read).    |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| SUBPHASE 11.2.3: FRONTEND DASHBOARD & REPORTING UI                                    |
| - Enhance /driver-analytics with fleet KPI cards, tier breakdown, and leaderboards.   |
| - Implement driver shift hours variance table and punctuality alerts.                 |
| - Ensure graceful handling of INSUFFICIENT_DATA states without chart crashes.         |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| SUBPHASE 11.2.4: COMPREHENSIVE AUTOMATED VERIFICATION                                 |
| - Implement backend/src/tests/driver_analytics.test.ts (Formula correctness, IDOR,    |
|   multi-tenancy, zero-division, and minimum evidence rules).                          |
| - Run full regression suite across all 14 test suites.                                |
| - Run TypeScript verification and Next.js production builds.                          |
+---------------------------------------------------------------------------------------+
```

---

## 2. Test Verification Matrix & Edge Case Coverage

The dedicated automated test suite `backend/src/tests/driver_analytics.test.ts` will rigorously assert:

| Test ID | Test Scenario | Expected Outcome |
| :--- | :--- | :--- |
| **TEST-11.2-01** | Multi-tenant isolation: Tenant B requests Tenant A's driver rankings. | Returns empty set or 404; zero cross-tenant record leakage. |
| **TEST-11.2-02** | IDOR protection: Non-manager Driver User X requests Driver Y's trend. | Returns `403 Forbidden` (`FORBIDDEN_RESOURCE_ACCESS`). |
| **TEST-11.2-03** | Insufficient data handling: Driver with < 5 shifts and < 5 deliveries. | `hasSufficientData === false`, `scoreTier === 'INSUFFICIENT_DATA'`, `CPS === null`. Excluded from rankings. |
| **TEST-11.2-04** | Presumption of innocence in safety scoring: Open/Pending incidents. | 0 safety score deduction. |
| **TEST-11.2-05** | Safety exoneration: Concluded incident with `DRIVER_NOT_RESPONSIBLE`. | 0 safety score deduction. |
| **TEST-11.2-06** | Confirmed safety liability: `CRITICAL` incident + `DRIVER_RESPONSIBLE`. | Exact 35-point deduction ($100 - 35 = 65$). |
| **TEST-11.2-07** | Shared safety liability: `HIGH` incident + `SHARED_RESPONSIBILITY`. | Exact 10-point deduction ($20 \times 0.5 = 10$). |
| **TEST-11.2-08** | Attendance reliability with canceled/excused shifts. | Canceled shifts excluded from denominator; no attendance penalty. |
| **TEST-11.2-09** | On-time delivery vs. late delivery evaluation. | Delivered after `expectedDeliveryDate` + grace period is flagged as late, lowering OTD rate. |
| **TEST-11.2-10** | Deterministic leaderboard tie-breaking. | Exact secondary and tertiary sorting: $S_{\text{safety}} \rightarrow S_{\text{delivery}} \rightarrow N_{\text{delivered}} \rightarrow \text{driverId}$. |

---

## 3. Strict Quality Gates

1. **Test Coverage:** All 10 acceptance scenarios passing.
2. **Regression Zero:** 223/223 existing tests remain passing.
3. **Type Safety:** Backend `npx tsc --noEmit` = 0 errors; Frontend `npx tsc --noEmit` = 0 errors.
4. **Production Build:** Next.js `npm run build` cleanly compiling with 0 errors.
