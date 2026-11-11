# Phase 09 Driver & Workforce Testing Guide

## Test Suite Execution
Run the Phase 09 standalone test suite:
```bash
npm run test:p9  # or ts-node src/tests/driver_workforce.test.ts
```

Run the complete unified test runner (all 8 phases):
```bash
npm test
```

## Coverage Matrix (20 Test Cases)
1. **Test 1:** Create driver with enhanced profile (employeeNumber, licenseCategories, emergencyContact).
2. **Test 2:** Enforce unique driver licenseNumber within same organization.
3. **Test 3:** Allow identical licenseNumber across distinct organizations (Tenant Scoping).
4. **Test 4:** Validate driver status transitions (AVAILABLE -> ON_DUTY -> AVAILABLE).
5. **Test 5:** Prevent placing driver ON_LEAVE while an active vehicle assignment exists.
6. **Test 6:** Create tenant-scoped DriverDocument with verificationStatus PENDING.
7. **Test 7:** Reject cross-tenant lookup of DriverDocument.
8. **Test 8:** Detect expiring documents and generate deduplicated alert notification.
9. **Test 9:** Successfully assign AVAILABLE driver to AVAILABLE vehicle.
10. **Test 10:** Prevent double active assignment for same vehicle or driver.
11. **Test 11:** End vehicle assignment and restore assets to AVAILABLE with ending odometer.
12. **Test 12:** Schedule driver shift with plannedStart and plannedEnd in UTC.
13. **Test 13:** Prevent overlapping scheduled shifts for same driver.
14. **Test 14:** Start shift, flag late-start (>15 min) and update driver to ON_DUTY.
15. **Test 15:** End shift, calculate duration and overtime minutes.
16. **Test 16:** Accurately calculate driver scorecard excluding cancelled shipments.
17. **Test 17:** Return INSUFFICIENT_DATA tier for driver with zero operational records.
18. **Test 18:** File safety incident with unique incident number and trigger alert.
19. **Test 19:** Review and formally resolve safety incident with resolution notes.
20. **Test 20:** Reject cross-tenant access to DriverIncident.
