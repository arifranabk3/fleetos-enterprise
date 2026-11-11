# Shipment Order Management API Reference

All endpoints are mounted under `/api/v1` and require authenticated session cookies or Bearer access tokens, accompanied by valid organization membership context headers (`x-organization-id` or active session context).

## 1. Create Shipment Order
`POST /api/v1/shipments`
- **Required Permission**: `SHIPMENTS:CREATE`
- **Request Body**:
```json
{
  "customerId": "60c72b2f9b1d8b2bad705123",
  "customer": {
    "name": "Acme Mega Corp",
    "email": "orders@acme.com",
    "phone": "+1-555-0100"
  },
  "sender": {
    "name": "Dallas Warehouse Bay 4",
    "phone": "+1-555-0111",
    "address": "450 Freight Rd",
    "city": "Dallas",
    "state": "TX",
    "country": "USA"
  },
  "receiver": {
    "name": "Austin Depot",
    "phone": "+1-555-0222",
    "address": "900 Logistics Way",
    "city": "Austin",
    "state": "TX",
    "country": "USA"
  },
  "origin": {
    "address": "450 Freight Rd, Dallas, TX",
    "city": "Dallas",
    "latitude": 32.7767,
    "longitude": -96.7970
  },
  "destination": {
    "address": "900 Logistics Way, Austin, TX",
    "city": "Austin",
    "latitude": 30.2672,
    "longitude": -97.7431
  },
  "cargo": {
    "description": "Industrial Bearings",
    "category": "HEAVY_EQUIPMENT",
    "weightKg": 4200,
    "packageCount": 12,
    "specialInstructions": "Forklift required at receiving bay"
  },
  "pricing": {
    "quotedAmount": 1850,
    "currency": "USD"
  },
  "priority": "EXPRESS"
}
```
- **Response**: `201 Created` with generated tracking number (`FOS-2611-ABC123`) and initial status `DRAFT`.

## 2. List Shipments
`GET /api/v1/shipments?status=IN_TRANSIT&priority=EXPRESS&page=1&limit=20&search=Austin`
- **Required Permission**: `SHIPMENTS:READ`
- **Response**: `200 OK` with paginated shipment list and metadata.

## 3. Get Shipment by ID
`GET /api/v1/shipments/:id`
- **Required Permission**: `SHIPMENTS:READ`
- **Response**: `200 OK` with populated `vehicleId`, `driverId`, and `customerId`.

## 4. Confirm Shipment Order
`POST /api/v1/shipments/:id/confirm`
- **Required Permission**: `SHIPMENTS:UPDATE`
- **Response**: `200 OK` with status transitioned to `CONFIRMED`.

## 5. Cancel Shipment Order
`POST /api/v1/shipments/:id/cancel`
- **Required Permission**: `SHIPMENTS:CANCEL`
- **Request Body**:
```json
{
  "reason": "Customer cancelled purchase order prior to transit"
}
```
- **Response**: `200 OK` with status transitioned to `CANCELLED`.
