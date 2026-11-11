# Driver Attendance & Shift Rules (Phase 09.1)

## 1. Storage Standards
- All planned and actual shift timestamps are persisted strictly in UTC ISO-8601.
- `shiftDate` is stored as `YYYY-MM-DD` for rapid indexing and daily dispatch scheduling.

## 2. Organization-Level Grace Period Configuration
In Phase 09.1, the attendance grace period is fully configurable per organization via Organization Settings:
- `settings.attendanceSettings.lateStartGracePeriodMinutes` (default: 15, allowed: 0 - 120 minutes).
- `settings.attendanceSettings.timezone` (default: 'UTC').
- Evaluated on the server during shift start: `lateDiffMinutes > lateStartGracePeriodMinutes`.

## 3. Shift Lifecycle
1. `SCHEDULED`: Shift is assigned with planned start and end times.
2. `IN_PROGRESS`: Operator or driver logs duty start. Driver status transitions to `ON_DUTY`.
   - Late Start Check: If `actualStart > plannedStart + gracePeriod`, `isLateStart = true` and `lateStartMinutes` is recorded.
3. `COMPLETED`: Duty ends. Actual duration and overtime ($> \text{planned duration}$) are calculated. Driver transitions back to `AVAILABLE` (or `ASSIGNED` if an active vehicle assignment is open).
4. `MISSED`: Shift was not initiated during the planned window.

## 4. Mutual Exclusion & Overlap Prevention
The system queries existing shifts with status `['SCHEDULED', 'IN_PROGRESS']` and rejects creation if the time window intersects with another shift for the same driver.
