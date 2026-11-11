# Dispatch Management Module

## Overview
The **Dispatch Management Module** orchestrates physical carrier execution by binding confirmed shipments to available vehicles and qualified commercial drivers under an official Dispatch Manifest (`DSP-[YYMM]-[HEX6]`).

## Conflict Prevention Safeguards
The dispatch engine enforces strict business rules before a manifest can be generated:
1. **Tenant Ownership**:
   - The selected vehicle, driver, and shipments must all belong to the authenticated active organization context.
2. **Operational Vehicle Eligibility**:
   - Vehicles in `MAINTENANCE`, `OUT_OF_SERVICE`, or `RETIRED` statuses are rejected.
3. **Driver Certification & Availability**:
   - Drivers in `SUSPENDED`, `INACTIVE`, or `ON_LEAVE` statuses are rejected.
4. **Active Dispatch Exclusivity**:
   - A vehicle already engaged in an active dispatch (`PENDING`, `ACCEPTED`, `ACTIVE`) cannot be assigned to another dispatch concurrently.
   - A driver already engaged in an active dispatch cannot be assigned concurrently.
5. **Shipment Dispatch Exclusivity**:
   - A shipment can only belong to one active dispatch manifest at any given time (`activeDispatchId`).

## Dispatch Lifecycle States
- `PENDING`: Manifest generated; driver and vehicle bound.
- `ACCEPTED`: Driver acknowledges manifest assignment.
- `ACTIVE`: Journey commenced; vehicle status transitions to `IN_TRANSIT`, driver transitions to `ON_DUTY`, and linked shipments transition to `IN_TRANSIT`.
- `COMPLETED`: Manifest completed at destination; vehicle and driver are released back to `AVAILABLE`; linked shipments transition to `DELIVERED`.
- `CANCELLED`: Manifest cancelled; vehicle and driver released; shipments returned to `CONFIRMED` unassigned queue.
