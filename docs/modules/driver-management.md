# Driver Management Module Specification — FleetOS

## 1. Overview
The Driver Management module manages Commercial Driver License (CDL) holders, their employment details, safety ratings, and current vehicle bindings.

## 2. API Endpoints
- `POST /api/v1/drivers`: Onboard new driver.
- `GET /api/v1/drivers`: List drivers with search and status filtering.
- `GET /api/v1/drivers/:id`: Detailed profile with assignment history.
- `PATCH /api/v1/drivers/:id`: Update driver details.
- `PATCH /api/v1/drivers/:id/status`: Update driver duty status (`AVAILABLE`, `ON_DUTY`, `OFF_DUTY`, `ON_LEAVE`, etc.).
- `DELETE /api/v1/drivers/:id`: Soft-archive driver record.

## 3. Scoped Uniqueness & PII Protection
- License numbers are enforced unique per organization `{ organizationId: 1, licenseNumber: 1 }`.
- Contact information is accessible only to authorized roles (`FLEET_MANAGER`, `ADMIN`, `ORGANIZATION_OWNER`).

