# FLEETOS — PHASE 11.2.2-C READINESS & ARCHITECTURAL SPECIFICATION

**Repository:** `d:\portfolio-projects\fleetos-enterprise-saas`
**Target Phase:** Phase 11.2.2-C — Driver Self-Service Portal & Operations Map Checkpoint
**Target Branch:** `feature/phase-11-2-2-driver-self-service-portal` (or continuing on `feature/phase-11-2-2-driver-analytics-ui` upon approval)
**Document Date:** 2026-11-12

---

## 1. SCOPE DEFINITION & OBJECTIVES

Based on `PHASE_11_2_IMPLEMENTATION_ROADMAP.md`, `PHASE_11_2_2_API_IMPLEMENTATION_PLAN.md`, and the approved security matrix, Phase 11.2.2-C consists of two distinct deliverables:

1. **Driver Self-Service Portal (`/portal/driver/performance` or `/driver-analytics/me`):**
   - Provide a dedicated, secure interface for authenticated drivers to view their own Composite Performance Score (CPS), trend analysis, and actionable coaching tips without exposure to peer rankings, fleet-wide averages, or sensitive operational logs.
2. **Operations Map Production Checkpoint Resolution:**
   - Restore and integrate the verified Operations Map fixes currently preserved in `stash@{0}`, ensuring dynamic SSR-safe rendering of Leaflet map tiles, live vehicle markers, and active trip telemetry.

---

## 2. EXISTING VS MISSING ASSETS AUDIT

### Component 1: Driver Self-Service API & UI
- **Existing Backend API (Already implemented & verified in Phase 11.2.2-A):**
  - Route: `GET /api/v1/analytics/drivers/me`
  - Controller: `DriverAnalyticsController.getMyScorecard`
  - Authorization: Restricted to authenticated drivers (`req.user.role === 'DRIVER'`). Automatically resolves `Driver.findOne({ userId: req.user.id, organizationId })`.
  - Security Verification: IDOR impossible (no client-provided driver ID accepted). Non-linked drivers return HTTP 404; inactive/suspended drivers return HTTP 403 `DRIVER_PROFILE_INACTIVE`.
- **Existing Frontend Assets:**
  - Route: Needs dedicated driver view at `frontend/src/app/(dashboard)/driver-analytics/me/page.tsx` or role-based dynamic view in `frontend/src/app/(dashboard)/driver-analytics/page.tsx`.
- **Missing Frontend Deliverables:**
  - Dedicated self-service scorecard component tailored for driver consumption.
  - Driver-specific coaching tips component displaying constructive feedback derived from safety/timeliness scores.
  - Clean error states for newly registered drivers (`INSUFFICIENT_DATA`).

### Component 2: Operations Map Integration
- **Existing In Stash (`stash@{0}`):**
  - `frontend/src/components/maps/OperationsMapClient.tsx` (Dynamic, SSR-safe Leaflet map wrapper with custom pin icons).
  - `frontend/src/app/(dashboard)/operations/page.tsx` (Operations dashboard consuming live vehicle/trip state).
  - `frontend/public/` Leaflet marker icon assets (`marker-icon.png`, `marker-icon-2x.png`, `marker-shadow.png`).
- **Missing Actions:**
  - Pop or apply `stash@{0}` after Phase 11.2.2-B is committed and merged.
  - Verify Leaflet tile loading and marker rendering without hydration mismatch errors.

---

## 3. ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSIONS MATRIX

| Role | Access to Fleet Dashboard (`/driver-analytics`) | Access to Peer Scorecards (`/drivers/:id/performance`) | Access to Self-Service Portal (`/driver-analytics/me`) | Access to Shift Variance Payroll |
| :--- | :---: | :---: | :---: | :---: |
| **OWNER / ADMIN** | Full Access | Full Access | Not Applicable | Full Access |
| **FLEET_MANAGER** | Full Access | Full Access | Not Applicable | Full Access |
| **DISPATCHER** | Read-Only (Operational) | Read-Only (Operational) | Not Applicable | Denied (HTTP 403) |
| **DRIVER** | Denied (HTTP 403) | Denied (HTTP 403 / IDOR blocked) | Full Access (Self Scorecard Only) | Denied (HTTP 403) |
| **ACCOUNTANT** | Denied (HTTP 403) | Denied (HTTP 403) | Denied (HTTP 403) | Denied (HTTP 403) |

---

## 4. PHASE 11.2.2-C IMPLEMENTATION WORKFLOW

1. **Prerequisite:** Commit and land Phase 11.2.2-B on GitHub via Pull Request.
2. **Step 1 (Operations Map Restoration):**
   - Apply `stash@{0}` cleanly to working tree.
   - Run Next.js production build to verify Leaflet dynamic imports and SSR hydration safety.
3. **Step 2 (Driver Self-Service Portal UI):**
   - Implement `frontend/src/app/(dashboard)/driver-analytics/me/page.tsx`.
   - Wire API client to fetch `/api/v1/analytics/drivers/me`.
   - Add automated contract tests verifying driver self-service views.
4. **Step 3 (Coaching Tips & Recommendations Engine):**
   - Map low-scoring metrics (e.g., hard braking, late delivery ratios) to driver-friendly improvement suggestions.
5. **Step 4 (Comprehensive Regression Testing):**
   - Execute all 15 test suites and frontend production builds.

---

## 5. ACCEPTANCE CRITERIA FOR PHASE 11.2.2-C

1. Authenticated drivers can access their personal performance scorecard at `/driver-analytics/me` without permissions errors.
2. Authenticated drivers attempting to view `/driver-analytics` (fleet overview) or `/drivers/:id/performance` (peer records) are strictly rejected with HTTP 403 or redirected to `/driver-analytics/me`.
3. Operations Map page loads fully with interactive Leaflet map tiles, vehicle markers, and trip overlays without SSR/hydration warnings.
4. Zero paid API dependencies utilized (OpenStreetMap / CartoDB free tiles).
5. All 262 enterprise test cases continue to pass with 100% success rate.
