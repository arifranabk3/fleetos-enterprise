# FLEETOS — PHASE 11.1 API SPECIFICATION
**Date:** November 12, 2026
**Author:** Principal Software Architect & API Designer
**Repository:** `d:\portfolio-projects\fleetos-enterprise-saas` (`arifranabk3/fleetos-enterprise`)

---

## 1. OVERVIEW & PROTOCOL

The Fleet Analytics API provides tenant-isolated analytical metrics for fleet utilization, availability distribution, motion intervals (moving vs idle vs stopped), telemetry coverage quality, and maintenance downtime.

- **Base URL:** `/api/v1`
- **Transport:** HTTPS / JSON
- **Authentication:** `Bearer <JWT_ACCESS_TOKEN>` or HttpOnly cookie `fleetos_access_token`
- **Tenant Context:** Enforced via server-side active organization membership (`requireTenantMembership`)
- **Required Permission:** `FLEET:READ` or `FLEET:MANAGE`

---

## 2. ENDPOINTS

### 2.1 Get Fleet Overview Analytics
`GET /api/v1/analytics/fleet/overview`

#### Query Parameters:
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `days` | integer | `30` | Reporting window duration in days (1 to 365). |
| `startDate` | ISO string | Optional | Window start boundary. Overrides `days`. |
| `endDate` | ISO string | Now | Window end boundary. |
| `timezone` | string | `'UTC'` | Reporting timezone identifier. |
| `vehicleType`| string | Optional | Filter by vehicle type (`SEMI_TRUCK`, `BOX_TRUCK`, etc.). |
| `statusFilter`| string | Optional | Filter by vehicle status (`AVAILABLE`, `IN_TRANSIT`, etc.). |
| `sourcePolicy`| string | `'ALL'` | Filter telemetry source (`'ALL'` \| `'HARDWARE_ONLY'` \| `'SIMULATED_ONLY'`). |
| `page` | integer | `1` | Page number for vehicle performance list. |
| `limit` | integer | `20` | Max vehicles returned per page (max 100). |

#### Success Response (`HTTP 200`):
```json
{
  "success": true,
  "data": {
    "reportingPeriod": {
      "from": "2026-10-13T00:00:00.000Z",
      "to": "2026-11-12T00:00:00.000Z",
      "timezone": "UTC",
      "totalWindowHours": 720.0
    },
    "generatedAt": "2026-11-12T05:22:00.000Z",
    "simulationPolicy": "ALL",
    "dataQuality": {
      "totalEligibleVehicleHours": 2880.0,
      "totalObservedHours": 2750.5,
      "fleetCoveragePercentage": 95.5,
      "classification": "HIGH_COVERAGE"
    },
    "utilization": {
      "fleetUtilizationPercentage": 78.4,
      "totalOperatingHours": 2258.0,
      "totalEligibleHours": 2880.0,
      "classification": "HIGH_UTILIZATION"
    },
    "availabilitySnapshot": {
      "totalFleetVehicles": 4,
      "eligibleVehicles": 4,
      "availableCount": 2,
      "inTransitCount": 1,
      "assignedCount": 0,
      "maintenanceCount": 1,
      "outOfServiceCount": 0,
      "retiredCount": 0,
      "availabilityRatioPercent": 75.0
    },
    "motionBreakdown": {
      "totalMovingHours": 2258.0,
      "totalIdleHours": 242.5,
      "totalStoppedHours": 250.0,
      "totalUnknownHours": 129.5
    },
    "maintenance": {
      "totalDowntimeHours": 48.0,
      "affectedVehicleCount": 1,
      "totalMaintenanceEvents": 2
    },
    "vehicles": [
      {
        "vehicleId": "6732cf3980bc712019a84210",
        "vin": "1M8GDM9A2KP049120",
        "plateNumber": "FL-9042",
        "make": "Freightliner",
        "modelName": "Cascadia",
        "type": "SEMI_TRUCK",
        "currentStatus": "IN_TRANSIT",
        "odometerKm": 142850,
        "eligibleHours": 720.0,
        "operatingHours": 560.5,
        "idleHours": 64.2,
        "stoppedHours": 60.0,
        "unknownHours": 35.3,
        "utilizationPercentage": 77.8,
        "coveragePercentage": 95.1,
        "coverageClassification": "HIGH_COVERAGE",
        "maintenanceDowntimeHours": 0.0,
        "maintenanceEventCount": 0,
        "telemetryEventCount": 8420,
        "isSimulatedOnly": false
      }
    ],
    "pagination": {
      "totalCount": 4,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 2.2 Get Vehicle Detail Analytics
`GET /api/v1/analytics/fleet/vehicles/:id`

#### Success Response (`HTTP 200`):
Returns the individual vehicle's performance summary object along with full hydrated vehicle record metadata.

#### Error Responses:
- `HTTP 401 UNAUTHORIZED`: Authentication token missing or invalid.
- `HTTP 403 FORBIDDEN_TENANT_ACCESS`: Requester is not an active member of the target tenant.
- `HTTP 404 NOT_FOUND`: Requested vehicle does not exist or belongs to another organization (strict IDOR mitigation).
- `HTTP 400 MAX_RANGE_EXCEEDED`: Date range query exceeds 365 days.
