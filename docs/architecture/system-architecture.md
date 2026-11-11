# System Architecture — FleetOS Enterprise Fleet & Logistics SaaS

## 1. Architectural Philosophy
FleetOS is architected as a modular monolith. It prioritizes:
- **Low Operational Complexity:** Avoids premature microservice boundaries while maintaining strict internal domain decoupling.
- **Tenant Isolation by Construction:** Shared database architecture with mandatory organization scopes at database indexes and middleware layers.
- **Event-Driven Telemetry:** HTTP REST APIs for CRUD operations paired with bidirectional Socket.IO pipelines for live telemetry and shipment tracking.

---

## 2. High-Level Architectural Flow (Mermaid)

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Applications (Browser / Mobile Web)"]
        Browser["Next.js 14 Web App (Leaflet Maps + App Router)"]
        CustomerPortal["Customer Tracking Portal (Public Unauthenticated View)"]
    end

    subgraph GatewayLayer ["API & Ingress"]
        CORS["Helmet + CORS Gateway"]
        AuthMiddleware["JWT & Tenant Resolver Middleware"]
        RateLimiter["Express Rate Limiter"]
    end

    subgraph ServiceLayer ["Modular Monolith Domain Services"]
        IdentityDomain["Identity & Access (RBAC)"]
        FleetDomain["Fleet & Driver Operations"]
        DispatchDomain["Shipment & Dispatch Workflow"]
        TelemetryDomain["Live Telemetry Engine (Socket.IO)"]
        BillingDomain["Maintenance, Expenses & Invoicing"]
        AuditDomain["Audit & Compliance Logger"]
    end

    subgraph DataStore ["Persistence & Cache"]
        Atlas["MongoDB Atlas (Shared Multi-Tenant with Compound Indexes)"]
        MemoryStore["In-Memory Socket Registry"]
    end

    Browser -->|HTTPS REST| CORS
    Browser <-->|WSS Live Events| TelemetryDomain
    CustomerPortal -->|HTTPS REST| CORS

    CORS --> RateLimiter --> AuthMiddleware
    AuthMiddleware --> IdentityDomain
    AuthMiddleware --> FleetDomain
    AuthMiddleware --> DispatchDomain
    AuthMiddleware --> BillingDomain

    IdentityDomain --> Atlas
    FleetDomain --> Atlas
    DispatchDomain --> Atlas
    DispatchDomain -->|Trigger Status| TelemetryDomain
    BillingDomain --> Atlas
    AuditDomain --> Atlas
    TelemetryDomain --> MemoryStore
```

---

## 3. Communication Protocols
- **Client to Backend (Command / Query):** RESTful JSON APIs over TLS (HTTPS).
- **Client to Backend (Live Telemetry):** Bidirectional WebSockets via Socket.IO with token-authenticated handshake and organization room namespaces (`org:<orgId>`).
- **Telemetry Simulation:** Background GPS simulation worker delivering interpolated coordinates along realistic highway waypoints.

