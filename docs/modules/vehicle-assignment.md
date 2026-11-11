# Driver-Vehicle Assignment Workflow — FleetOS

## 1. Assignment Workflow
1. **Validation:** Dispatcher or Fleet Manager selects an `AVAILABLE` driver and an `AVAILABLE` vehicle.
2. **Atomic Execution:**
   - Create `Assignment` record `{ organizationId, vehicleId, driverId, status: 'ACTIVE', startOdometerKm }`.
   - Update `Vehicle.status = 'ASSIGNED'` and `Vehicle.currentDriverId = driverId`.
   - Update `Driver.status = 'ASSIGNED'` and `Driver.assignedVehicleId = vehicleId`.
3. **Release:**
   - When assignment is released, record `releasedAt` and `endOdometerKm`.
   - Vehicle and Driver are both atomically restored to `AVAILABLE` status.

## 2. API Endpoints
- `POST /api/v1/assignments`: Create active assignment.
- `GET /api/v1/assignments`: List active and historical assignments.
- `POST /api/v1/assignments/:id/release`: Release active assignment.

