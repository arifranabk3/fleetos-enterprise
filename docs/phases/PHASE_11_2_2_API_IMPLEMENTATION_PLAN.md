# FLEETOS — PHASE 11.2.2 API IMPLEMENTATION PLAN
## DRIVER ANALYTICS API SECURITY & AUTHORIZATION

**Document Version:** 1.1.0
**Status:** ARCHITECTURE & READINESS APPROVED
**Implementation Target:** Subphase 11.2.2
**Author:** Principal Backend Security Architect & Senior Software Engineer

---

## 1. Route Definitions & Middleware Stack

All analytics routes will be implemented in `backend/src/routes/driverAnalyticsRoutes.ts` and mounted under `/api/v1` in `backend/src/app.ts`.

### Base Router Middleware:
```typescript
router.use(authenticate);
router.use(requireTenantMembership);
```

### Route Registration Sequence:
```typescript
// 1. Static Overview & Leaderboard (Managerial Access)
router.get(
  '/analytics/drivers/fleet-overview',
  requirePermission('driver.analytics.read'),
  DriverAnalyticsController.getFleetOverview
);

router.get(
  '/analytics/drivers/rankings',
  requirePermission('driver.analytics.read'),
  DriverAnalyticsController.getFleetRankings
);

router.get(
  '/analytics/drivers/shift-variance',
  requirePermission('driver.analytics.read'),
  DriverAnalyticsController.getShiftVariance
);

// 2. Static Driver Self-Service (Authenticated Driver Access)
router.get(
  '/analytics/drivers/me',
  DriverAnalyticsController.getDriverSelfScorecard
);

// 3. Parameterized Driver Scorecard & Trend (Manager or Verified Self)
router.get(
  '/analytics/drivers/:driverId/trend',
  DriverAnalyticsController.getDriverTrend
);

router.get(
  '/analytics/drivers/:driverId',
  DriverAnalyticsController.getDriverScorecard
);
```

---

## 2. Shift Variance Business Rules & Numerical Formulas

### 2.1 Core Rules:
1. **Planned Hours ($H_{\text{planned}}$):** Calculated as $\frac{\text{plannedEnd} - \text{plannedStart}}{3600 \times 1000}$.
2. **Actual Worked Hours ($H_{\text{actual}}$):** Derived from logged `durationMinutes / 60`.
3. **Variance ($\Delta H$):** $H_{\text{actual}} - H_{\text{planned}}$.
4. **Overtime Hours ($H_{\text{ot}}$):** Derived from logged `overtimeMinutes / 60`.
5. **Cancelled Shifts & Approved Absences:** Excluded from hours variance calculations.
6. **Missing Clock-In or Clock-Out:**
   - If shift status is `MISSED`: $H_{\text{actual}} = 0.0$, but $H_{\text{planned}}$ is preserved (producing negative variance: $-H_{\text{planned}}$).
   - If shift status is `SCHEDULED` (in future or uncommenced): Excluded from historical variance aggregation.
   - If shift status is `IN_PROGRESS` (active without clock-out): Bounded to duration logged up to query timestamp.
7. **Overnight Shifts:** Handled seamlessly because timestamps are stored as full UTC ISO Dates (e.g., `2026-11-01T22:00:00Z` to `2026-11-02T06:00:00Z`). Millisecond difference accurately yields $8.0$ hours across midnight boundaries.
8. **Timezone Uniformity:** All comparisons evaluate against UTC epoch timestamps.

### 2.2 Five Concrete Numerical Examples

| Scenario | Planned Start/End | Actual Duration | Overtime | Status | Resulting Planned Hrs | Resulting Actual Hrs | Net Variance ($\Delta H$) | Overtime Hrs |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Standard On-Time Shift** | 08:00 to 16:00 (8h) | 480 min | 0 min | `COMPLETED` | 8.0h | 8.0h | **0.0h** | 0.0h |
| **2. Extended Overtime Shift** | 08:00 to 16:00 (8h) | 600 min | 120 min | `COMPLETED` | 8.0h | 10.0h | **+2.0h** | 2.0h |
| **3. Early Relieved Shift** | 08:00 to 16:00 (8h) | 360 min | 0 min | `COMPLETED` | 8.0h | 6.0h | **-2.0h** | 0.0h |
| **4. Overnight Crossing Shift** | 22:00 to 06:00 (+1d, 8h) | 480 min | 0 min | `COMPLETED` | 8.0h | 8.0h | **0.0h** | 0.0h |
| **5. Unexcused No-Show (Missed)**| 08:00 to 16:00 (8h) | 0 min | 0 min | `MISSED` | 8.0h | 0.0h | **-8.0h** | 0.0h |

---

## 3. Driver Identity Resolution & Fail-Closed Behavior

### 3.1 Mapping User ID to Driver Profile
```typescript
const driver = await Driver.findOne({
  userId: req.user.id,
  organizationId: req.tenant.organizationId,
  isArchived: false,
});
```

### 3.2 Handling Ambiguities & Edge Cases:
1. **Unlinked User Account:** If an authenticated user with role `DRIVER` does not have a linked `Driver` record (`userId === req.user.id`), the request **fails closed** with `404 Not Found` (`DRIVER_PROFILE_NOT_FOUND`).
2. **Multiple Profiles (Cross-Tenant):** Drivers working across multiple organizations have distinct `Driver` records scoped by `organizationId`. The server resolves the profile strictly matching `req.tenant.organizationId`.
3. **Suspended / Inactive Driver:** If `driver.status === 'SUSPENDED'` or `'INACTIVE'`, or `isArchived === true`, the profile is blocked from self-service scorecard generation, returning `403 Forbidden` (`DRIVER_PROFILE_INACTIVE`).
4. **Revoked Membership:** If the driver's membership in `OrganizationMember` is revoked or suspended, `requireTenantMembership` rejects the request before it reaches the controller.
