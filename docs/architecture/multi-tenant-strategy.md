# Multi-Tenant Strategy — FleetOS

## 1. Multi-Tenant Philosophy
FleetOS adopts a **SaaS Shared Database with Logical Tenant Segregation** approach. This maximizes hardware efficiency while guaranteeing bulletproof isolation via multi-layer controls.

---

## 2. Tenant Isolation Sequence (Mermaid)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Authenticated Operator
    participant Gateway as Express API Gateway
    participant TenantMiddleware as Tenant Resolver Middleware
    participant Service as Fleet Domain Service
    participant Database as MongoDB Atlas

    Client->>Gateway: HTTP Request with Bearer JWT
    Gateway->>TenantMiddleware: Verify JWT & Extract claims
    Note over TenantMiddleware: Extract userId, role, and organizationId
    alt Token Invalid or Missing Organization
        TenantMiddleware-->>Client: 401 Unauthorized / 403 Forbidden
    else Token Valid
        TenantMiddleware->>Service: req.tenant = { orgId, role, userId }
        Service->>Database: Model.find({ organizationId: req.tenant.orgId, ...filter })
        Database-->>Service: Tenant-isolated records only
        Service-->>Client: 200 OK (Clean payload)
    end
```

---

## 3. Defense-in-Depth Tenant Rules
1. **No Queries Without `organizationId`:** Every controller/service must explicitly append `{ organizationId: req.tenant.orgId }` to reads, updates, and deletes.
2. **Compound Unique Constraints:** Unique fields (e.g. `plateNumber` or `email`) are never globally unique across competing carriers; they are unique only within `{ organizationId: 1, field: 1 }`.
3. **Socket.IO Room Partitioning:** Live telemetry broadcasts emit strictly to `io.to("org:" + orgId).emit(...)`.

