# Fleet Management Module Specification — FleetOS

## 1. Overview
The Fleet Management module handles commercial vehicle registration, maintenance records, and regulatory compliance documents within an isolated tenant scope.

## 2. API Endpoints
- `POST /api/v1/vehicles`: Register new fleet asset.
- `GET /api/v1/vehicles`: List assets with filtering by status and type.
- `GET /api/v1/vehicles/:id`: Fetch complete asset details with maintenance and active assignment.
- `PATCH /api/v1/vehicles/:id`: Update vehicle parameters.
- `PATCH /api/v1/vehicles/:id/status`: Controlled state transition.
- `DELETE /api/v1/vehicles/:id`: Soft-archive asset.
- `POST /api/v1/vehicles/:id/documents`: Attach compliance document metadata (DOT registration, insurance certs).

## 3. Controlled Status Transitions
- Valid statuses: `AVAILABLE`, `ASSIGNED`, `IN_TRANSIT`, `MAINTENANCE`, `OUT_OF_SERVICE`, `RETIRED`.
- Guard: Assets currently `ASSIGNED` cannot be placed in `OUT_OF_SERVICE` or `RETIRED` without first releasing active driver assignments.

