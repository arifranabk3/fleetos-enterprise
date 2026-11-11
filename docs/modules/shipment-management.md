# Shipment Management Module

## Overview
The **Shipment Management Module** is responsible for managing customer freight contracts, cargo specifications, pricing quotations, and complete chain-of-custody tracking across multi-tenant carrier organizations.

## Core Domain Capabilities
1. **Shipment Order Creation**:
   - Automated human-readable tracking number generation (`FOS-[YYMM]-[HEX6]`) with guaranteed intra-tenant and global collision prevention.
   - Rigorous validation of consignor (sender), consignee (receiver), and customer billing entities.
   - Comprehensive cargo classification (`GENERAL`, `PERISHABLE`, `HAZARDOUS`, `ELECTRONICS`, `FRAGILE`, `HEAVY_EQUIPMENT`), weight (kg), package count, dimensions, and declared freight value.
   - Tenant isolation automatically applied via `BaseTenantRepository<Shipment>`.

2. **Customer Integration**:
   - Integrated tenant-scoped `Customer` entity supporting individual, business, and enterprise shipping accounts.
   - Automated verification that any referenced `customerId` belongs exclusively to the requesting tenant before order generation.

3. **Immutable Timeline & Activity Audit Trail**:
   - Each state transition, dispatch assignment, milestone update, or exceptional event appends an immutable timeline record capturing timestamp, actor user ID, actor role, and notes.

## API Endpoints
- `POST /api/v1/shipments`: Create new shipment order. Requires `SHIPMENTS:CREATE`.
- `GET /api/v1/shipments`: List shipments with query filters (status, priority, customer, search) and pagination. Requires `SHIPMENTS:READ`.
- `GET /api/v1/shipments/:id`: Full shipment details with populated customer, vehicle, driver, and active dispatch references. Requires `SHIPMENTS:READ`.
- `PATCH /api/v1/shipments/:id`: Update shipment specifications (permitted only prior to dispatch). Requires `SHIPMENTS:UPDATE`.
- `POST /api/v1/shipments/:id/confirm`: Confirm draft order for dispatch readiness. Requires `SHIPMENTS:UPDATE`.
- `POST /api/v1/shipments/:id/cancel`: Cancel order with mandatory documented justification. Requires `SHIPMENTS:CANCEL`.
- `GET /api/v1/shipments/:id/history`: Return immutable timeline records. Requires `SHIPMENTS:READ`.
- `GET /api/v1/shipments/:id/dispatches`: List historical dispatches associated with the shipment. Requires `SHIPMENTS:READ`.
