# FleetOS Development Database Seeding Guide

## 1. Overview
The development seed script (`backend/src/database/seed.ts`) idempotently seeds a complete demo logistics carrier (**Apex Global Logistics, LLC**) without creating duplicate documents on repeated runs.

## 2. Seeded Resources
1. **Organization:** `Apex Global Logistics, LLC` (`slug: apex-logistics`)
2. **Admin User:** `arif.mahmood@apexlogistics.com`
3. **Membership:** Scoped `ORGANIZATION_ADMIN`
4. **Vehicles:**
   - `FLT-8890` (Volvo VNL 860, Semi-Truck)
   - `FLT-4021` (Freightliner Cascadia, Semi-Truck)
5. **Drivers:**
   - `Hamza Khan` (CDL-IL-984210, Assigned to `FLT-8890`)
6. **Active Shipment:**
   - `FLT-SHP-89210` (Chicago Central Yard to Dallas Logistics Hub)

## 3. How to Run
```bash
# Execute against configured MONGODB_URI
npm --prefix fleetos-enterprise-saas/backend run build
node fleetos-enterprise-saas/backend/dist/database/seed.js
```

