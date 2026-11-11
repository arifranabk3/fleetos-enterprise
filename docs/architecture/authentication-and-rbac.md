# Authentication & Role-Based Access Control (RBAC) — FleetOS

## 1. Authentication Lifecycle (Mermaid)

```mermaid
sequenceDiagram
    autonumber
    actor User as Fleet Manager / Operator
    participant Client as Next.js Web App
    participant AuthAPI as Auth Controller (/api/v1/auth)
    participant DB as MongoDB Atlas

    User->>Client: Submit email, password, organizationSlug
    Client->>AuthAPI: POST /api/v1/auth/login
    AuthAPI->>DB: Find Organization by slug (active check)
    AuthAPI->>DB: Find User by organizationId + email
    AuthAPI->>AuthAPI: Compare bcrypt passwordHash
    alt Password Invalid
        AuthAPI-->>Client: 401 Invalid Credentials
    else Password Valid
        AuthAPI->>AuthAPI: Sign JWT with payload: { userId, orgId, role }
        AuthAPI-->>Client: 200 OK + HttpOnly cookie (or Bearer Token)
        Client->>Client: Store session state & redirect to dashboard
    end
```

---

## 2. Role-Based Access Matrix

| Role | Organization Scope | Fleet & Vehicles | Shipments & Dispatch | Telemetry Map | Invoices & Billing | Audit Logs |
|---|---|---|---|---|---|---|
| **PLATFORM_SUPER_ADMIN** | Global / All Tenants | Full Access | Full Access | Full Access | Full Access | Full Access |
| **ORGANIZATION_ADMIN** | Tenant Only | Full Access | Full Access | Full Access | Full Access | Full Access |
| **DISPATCH_MANAGER** | Tenant Only | View Assets | Create, Assign, Dispatch | Full Access | View Only | View Operations |
| **FLEET_MANAGER** | Tenant Only | Manage Vehicles & Drivers | View Shipments | View Fleet | Maintenance & Fuel | View Operations |
| **DRIVER** | Assigned Assets | View Assigned Vehicle | View Assigned Shipment | Self-Location Only | None | None |
| **CUSTOMER** | Shipment Scope | None | View Own Tracking Number | Track Active Order | View Invoices | None |

