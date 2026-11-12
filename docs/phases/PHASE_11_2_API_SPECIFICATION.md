# PHASE 11.2 — API SPECIFICATION & DATA CONTRACTS

**Date:** November 12, 2026
**Document Version:** 1.0.0
**Target Controllers:** `DriverAnalyticsController` (Subphase 11.2.2)
**Mount Path:** `/api/v1/analytics/drivers`
**Author:** Principal Software Architect & API Designer

---

## 1. Authentication & Security Policy

All endpoints require:
1. `authenticate`: Valid JWT Bearer token.
2. `requireTenantMembership`: Resolves and sets `req.tenant.organizationId`.
3. `requirePermission(...)`: Role-based access permission check.

Client-supplied `organizationId` in query, body, or headers is strictly ignored and rejected.

---

## 2. Endpoint Contracts

### 2.1 `GET /api/v1/analytics/drivers/fleet-overview`
- **Permission:** `driver.analytics.read`
- **Query Parameters:**
  - `days`: Integer between 1 and 365 (Default: 30).
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "reportingPeriodDays": 30,
      "totalActiveDrivers": 42,
      "scoredDriversCount": 38,
      "insufficientDataDriversCount": 4,
      "fleetAverageCompositeScore": 86.4,
      "fleetOnTimeDeliveryRate": 93.1,
      "fleetAttendanceReliability": 95.8,
      "fleetSafetyAverageScore": 98.2,
      "totalIncidentsCount": 2,
      "tierDistribution": {
        "EXCELLENT": 16,
        "GOOD": 15,
        "SATISFACTORY": 5,
        "NEEDS_IMPROVEMENT": 2,
        "INSUFFICIENT_DATA": 4
      }
    }
  }
  ```

### 2.2 `GET /api/v1/analytics/drivers/rankings`
- **Permission:** `driver.performance.read`
- **Query Parameters:**
  - `days`: Integer between 1 and 365 (Default: 30).
  - `limit`: Integer between 1 and 100 (Default: 50).
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": [
      {
        "driverId": "6732f91a...",
        "driverName": "Jane Doe",
        "rank": 1,
        "compositePerformanceScore": 98.4,
        "scoreTier": "EXCELLENT",
        "safetyScore": 100,
        "deliveryScore": 98.0,
        "attendanceScore": 97.5,
        "complianceScore": 100,
        "completedDeliveries": 48
      }
    ]
  }
  ```

### 2.3 `GET /api/v1/analytics/drivers/shift-variance`
- **Permission:** `driver.shift.read`
- **Query Parameters:**
  - `days`: Integer between 1 and 365 (Default: 30).
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "reportingPeriodDays": 30,
      "totalScheduledHours": 3200.0,
      "totalActualHours": 3248.5,
      "netVarianceHours": 48.5,
      "totalOvertimeHours": 64.2,
      "lateStartsCount": 8,
      "fleetPunctualityRate": 94.2,
      "discrepancyDrivers": [
        {
          "driverId": "6732f91a...",
          "driverName": "John Smith",
          "plannedHours": 160.0,
          "actualHours": 178.5,
          "varianceHours": 18.5,
          "overtimeHours": 18.5,
          "lateStarts": 2
        }
      ]
    }
  }
  ```

### 2.4 `GET /api/v1/analytics/drivers/:id/trend`
- **Permission:** `driver.performance.read`
- **Access Rule:** Operational managers can access any driver in their tenant. Drivers with role `DRIVER` can only query their own linked `Driver._id` (IDOR enforcement).
- **Query Parameters:**
  - `months`: Integer between 1 and 12 (Default: 6).
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": [
      {
        "periodLabel": "Oct 2026",
        "startDate": "2026-10-01T00:00:00.000Z",
        "endDate": "2026-11-01T00:00:00.000Z",
        "compositePerformanceScore": 92.5,
        "deliveryScore": 94.0,
        "safetyScore": 100.0,
        "attendanceScore": 90.0,
        "completedDeliveries": 32,
        "concludedIncidents": 0,
        "attendanceReliabilityPercent": 90.0,
        "hasSufficientData": true
      }
    ]
  }
  ```
