# API Design & Technical Decisions — FleetOS

## 1. RESTful API Versioning & Conventions
- Base Endpoint: `/api/v1`
- Standard Response Envelope:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 128
  }
}
```

---

## 2. Technical Decisions Log (ADRs)

| Decision | Selected Option | Rationale | Alternatives Considered |
|---|---|---|---|
| **Mapping Engine** | Leaflet + OpenStreetMap | 100% Free, zero proprietary API limits, no billing friction for reviewers. | Google Maps Platform, Mapbox (rejected due to paid API keys). |
| **Persistence** | MongoDB Atlas + Mongoose | Native JSON document model, flexible telemetry timestamps, high write-throughput for GPS logs. | PostgreSQL (rejected for faster prototyping of nested schemas). |
| **Monorepo Strategy** | Decoupled Monolith (`apps/web` & `apps/api`) | Eliminates microservice network latency while keeping frontend and backend independently deployable. | Microservices with Kafka (rejected due to excessive resource overhead). |

