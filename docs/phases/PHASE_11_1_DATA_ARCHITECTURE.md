# FLEETOS — PHASE 11.1 DATA ARCHITECTURE
**Date:** November 12, 2026
**Author:** Senior MongoDB Data Architect & Performance Lead
**Repository:** `d:\portfolio-projects\fleetos-enterprise-saas` (`arifranabk3/fleetos-enterprise`)

---

## 1. REUSED DATA ASSETS

Phase 11.1 introduces **zero new database models**, fully reusing:
- `Vehicle` (`backend/src/models/Vehicle.ts`)
- `TelemetryEvent` (`backend/src/models/TelemetryEvent.ts`)
- `MaintenanceRecord` (`backend/src/models/MaintenanceRecord.ts`)
- `Dispatch` (`backend/src/models/Dispatch.ts`)

---

## 2. DATABASE INDEX OPTIMIZATION

To achieve sub-second P95 analytical performance across 1,000,000+ telemetry events and 10,000+ vehicles, the following compound tenant indexes are added to existing schemas:

### 2.1 `TelemetryEvent` Schema Indexes:
```typescript
// Fast range scans for vehicle-level and fleet-level motion analysis
TelemetryEventSchema.index({ organizationId: 1, vehicleId: 1, recordedAt: 1, motionStatus: 1 });
TelemetryEventSchema.index({ organizationId: 1, recordedAt: 1, motionStatus: 1 });
```

### 2.2 `MaintenanceRecord` Schema Indexes:
```typescript
// Fast range lookups for downtime window overlapping calculations
MaintenanceRecordSchema.index({ organizationId: 1, status: 1, startedDate: 1, completedDate: 1 });
```

### 2.3 `Vehicle` Schema Indexes:
```typescript
// Instant snapshot counts by vehicle operational status and category
VehicleSchema.index({ organizationId: 1, status: 1, isArchived: 1, type: 1 });
```

---

## 3. DATA PROCESSING PIPELINE & INTERVAL ALGORITHM

The core of Phase 11.1 is the **Deterministic Telemetry Interval Algorithm**:

```
[Raw Telemetry Stream (Unordered/Gaps)]
                 │
                 ▼
   1. Filter by organizationId & date window
                 │
                 ▼
   2. Group by vehicleId & sort by recordedAt ASC
                 │
                 ▼
   3. Deduplicate events with identical timestamps
                 │
                 ▼
   4. Iterate adjacent events (E_i -> E_i+1):
      - duration = min(E_i+1.recordedAt - E_i.recordedAt, 300s)
      - if duration <= 300s:
          accumulate duration into E_i.motionStatus (MOVING, IDLE, STOPPED)
      - if duration > 300s:
          accumulate 300s into E_i.motionStatus
          accumulate remaining gap into UNKNOWN (Offline)
                 │
                 ▼
   5. Aggregate per-vehicle and fleet totals
```

This ensures mathematical consistency, bounds memory usage, and eliminates artificial assumptions about offline or missing telemetry.
