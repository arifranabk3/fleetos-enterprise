# FleetOS Architecture Specification

## 1. Domain Architecture & Boundaries
FleetOS follows an enterprise Domain-Driven, multi-tenant modular SaaS architecture with strict tenant boundaries.

```
                    ┌─────────────────────────┐
                    │      Next.js 14 App     │
                    │   (Responsive Frontend) │
                    └────────────┬────────────┘
                                 │ HTTP / WSS
                    ┌────────────▼────────────┐
                    │   Express + Socket.IO   │
                    │   (Modular API Gateway) │
                    └────────────┬────────────┘
           ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  Identity & RBAC │   │  Fleet & Drivers │   │ Dispatch & Tracks│
└──────────┬───────┘   └──────────┬───────┘   └──────────┬───────┘
           │                      │                      │
           └──────────────────────┼──────────────────────┘
                                  ▼
                    ┌─────────────────────────┐
                    │  Tenant Isolation Layer │
                    │   (orgId filter/index)  │
                    └────────────┬────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │    MongoDB & Mongoose   │
                    │  (Indexed Schema Stores)│
                    └─────────────────────────┘
```

## 2. Multi-Tenant Isolation Strategy
- **Shared Database, Separate Organization Context (`orgId`):**
  Every tenant-specific document contains `organizationId` indexed compound keys:
  `{ organizationId: 1, _id: 1 }`
- **Mandatory Mongoose Middleware / Service Boundary:**
  Queries without explicit super-admin bypass must enforce `organizationId: req.tenant.id`.
- **Socket.IO Room Isolation:**
  Real-time event channels are partitioned into rooms:
  `org:${organizationId}` and `shipment:${shipmentId}`.

