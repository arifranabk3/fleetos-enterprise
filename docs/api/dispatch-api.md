# Dispatch Management API Reference

All endpoints are mounted under `/api/v1` and enforce multi-tenant organization context.

## 1. Create Dispatch Manifest
`POST /api/v1/dispatches`
- **Required Permission**: `DISPATCH:CREATE`
- **Request Body**:
```json
{
  "shipmentIds": ["60c72b2f9b1d8b2bad705123"],
  "vehicleId": "60c72b2f9b1d8b2bad705456",
  "driverId": "60c72b2f9b1d8b2bad705789",
  "originHub": "Dallas Gateway Hub",
  "destinationHub": "Austin Central Terminal",
  "notes": "Route via Interstate 35 South corridor"
}
```
- **Validation Guards**:
  - Validates that vehicle and driver belong to organization.
  - Checks that vehicle is operational (`AVAILABLE` or `ASSIGNED`).
  - Checks that driver is certified and eligible.
  - Verifies neither vehicle nor driver is already in an active dispatch.
  - Verifies that shipment is `CONFIRMED` or `READY_FOR_DISPATCH` without an existing active dispatch.
- **Side Effects**:
  - Sets shipment status to `DISPATCHED` and assigns `vehicleId`, `driverId`, and `activeDispatchId`.
  - Sets vehicle and driver status to `ASSIGNED`.
- **Response**: `201 Created` with generated `dispatchNumber` (`DSP-2611-MNF001`).

## 2. List Dispatches
`GET /api/v1/dispatches?status=ACTIVE&vehicleId=...&driverId=...&page=1&limit=20`
- **Required Permission**: `DISPATCH:READ`
- **Response**: `200 OK` with populated manifests.

## 3. Start Journey
`POST /api/v1/dispatches/:id/start`
- **Required Permission**: `DISPATCH:UPDATE`
- **Side Effects**:
  - Dispatch status -> `ACTIVE`.
  - Vehicle status -> `IN_TRANSIT`.
  - Driver status -> `ON_DUTY`.
  - Linked shipments -> `IN_TRANSIT`.
- **Response**: `200 OK`.

## 4. Complete Dispatch
`POST /api/v1/dispatches/:id/complete`
- **Required Permission**: `DISPATCH:UPDATE`
- **Side Effects**:
  - Dispatch status -> `COMPLETED`.
  - Vehicle status -> `AVAILABLE` (released).
  - Driver status -> `AVAILABLE` (released).
  - Linked shipments -> `DELIVERED`, `activeDispatchId` cleared.
- **Response**: `200 OK`.

## 5. Cancel Dispatch
`POST /api/v1/dispatches/:id/cancel`
- **Required Permission**: `DISPATCH:UPDATE`
- **Request Body**:
```json
{
  "reason": "Severe mechanical warning prior to highway departure"
}
```
- **Side Effects**:
  - Dispatch status -> `CANCELLED`.
  - Vehicle and driver released to `AVAILABLE`.
  - Shipments restored to `CONFIRMED` with dispatch references cleared.
- **Response**: `200 OK`.
