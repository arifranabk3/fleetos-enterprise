# Technical Decisions & Known Limitations — FleetOS

## 1. Key Technical Trade-offs
1. **In-Memory Testing vs Cloud Atlas:**
   - Automated unit tests run against `mongodb-memory-server` to allow offline CI/CD execution without hitting Atlas network rate limits.
   - Production and live staging connect to MongoDB Atlas (`sellzy-staging.tv1yvju.mongodb.net/fleetos`).

2. **Leaflet Dynamic Import in Next.js:**
   - Leaflet references `window` directly, which causes SSR crashes in Next.js App Router.
   - *Resolution:* All interactive Leaflet map components are rendered dynamically with `{ ssr: false }`.

## 2. Unresolved Decisions & Backlog
- Whether to introduce Redis for caching multi-tenant role permissions under high concurrent load (scheduled for Phase 10).
- Offline-first driver mobile PWA caching (deferred to future roadmap).

