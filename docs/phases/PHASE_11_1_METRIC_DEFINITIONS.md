# FLEETOS — PHASE 11.1 METRIC DEFINITIONS & METHODOLOGY
**Date:** November 12, 2026
**Author:** Principal Software Architect & Fleet Systems Domain Expert
**Repository:** `d:\portfolio-projects\fleetos-enterprise-saas` (`arifranabk3/fleetos-enterprise`)

---

## 1. CORE REPORTING PRINCIPLES

1. **Explicit Reporting Timezone & UTC Storage:**
   All database timestamps are stored in UTC. Reporting windows (`from`, `to`) are evaluated against UTC unless an explicit `timezone` parameter is provided by the organization.
2. **Standard Metadata Envelope:**
   Every analytical response payload must include:
   - `reportingPeriod`: `{ from: Date, to: Date, timezone: string }`
   - `generatedAt`: ISO 8601 timestamp
   - `dataFreshness`: Date of the latest telemetry event considered
   - `telemetrySourceCoverage`: Observed hours, eligible hours, and coverage %
   - `simulationPolicy`: Whether simulated data was included (`'ALL'` | `'HARDWARE_ONLY'` | `'SIMULATED_ONLY'`)
   - `metricMethodology`: Semantic version of calculation logic (e.g., `v1.1-interval-bounded`)

---

## 2. FORMAL METRIC SPECIFICATIONS

### 2.1 Fleet Utilization (%)
- **Definition:** The proportion of eligible fleet time during which active vehicles were operating (in motion).
- **Formula:**
  $$\text{Utilization \%} = \left( \frac{\text{Eligible Vehicle Operating Hours}}{\text{Total Eligible Vehicle Hours}} \right) \times 100$$
- **Eligible Vehicle Operating Hours:**
  Sum of verified `MOVING` telemetry intervals within the reporting window for active, non-retired vehicles.
- **Eligible Vehicle Hours:**
  $$\text{Eligible Vehicle Hours} = \text{Eligible Fleet Vehicle Count} \times \text{Reporting Window Hours}$$
  - *Exclusions from Eligibility:* Vehicles with `status === 'RETIRED'` or archived vehicles (`isArchived === true`) are completely excluded from eligible fleet hours.
  - *Handling Insufficient Telemetry:* If `coveragePercentage < 5%`, utilization percentage is reported as `null` with `classification: 'INSUFFICIENT_DATA'` to prevent falsely reporting 0% utilization when trackers were simply uninstalled or offline.

### 2.2 Telemetry Interval & Motion Breakdown
Raw telemetry points are converted to continuous intervals using the **Point-to-Interval Transformation Rule**:
- Let $E_1, E_2, \dots, E_n$ be chronologically ordered telemetry events for vehicle $V$ within window $[T_{\text{start}}, T_{\text{end}}]$.
- The interval duration between $E_i$ and $E_{i+1}$ is $\Delta t = \min(E_{i+1}.\text{recordedAt} - E_i.\text{recordedAt}, \text{MAX\_FRESHNESS\_WINDOW})$.
- **Configurable Freshness Window ($\text{MAX\_FRESHNESS\_WINDOW}$):** Defaults to **300 seconds (5 minutes)**.
- If $E_{i+1}.\text{recordedAt} - E_i.\text{recordedAt} > \text{MAX\_FRESHNESS\_WINDOW}$, the time beyond 300 seconds is recorded as `unknownHours`.
- Categories:
  - `movingHours`: Sum of intervals where `motionStatus === 'MOVING'`.
  - `idleHours`: Sum of intervals where `motionStatus === 'IDLE'`.
  - `stoppedHours`: Sum of intervals where `motionStatus === 'STOPPED'`.
  - `unknownHours`: Window duration unobserved by telemetry.

### 2.3 Telemetry Coverage & Data Quality Classification
- **Formula:**
  $$\text{Coverage \%} = \left( \frac{\text{movingHours} + \text{idleHours} + \text{stoppedHours}}{\text{Eligible Vehicle Hours}} \right) \times 100$$
- **Classifications:**
  - `HIGH_COVERAGE`: $\ge 90.0\%$
  - `PARTIAL_COVERAGE`: $70.0\% \le \text{Coverage} < 90.0\%$
  - `LOW_COVERAGE`: $0.1\% \le \text{Coverage} < 70.0\%$
  - `NO_DATA`: $0.0\%$

### 2.4 Maintenance Downtime Hours
- **Definition:** Exact duration during which a vehicle was unavailable due to an active, in-progress, or completed maintenance event within the reporting window.
- **Interval Derivation:**
  - Start boundary: $M_{\text{start}} = \max(\text{record.startedDate} \text{ or scheduledDate}, T_{\text{start}})$.
  - End boundary: $M_{\text{end}} = \min(\text{record.completedDate} \text{ or Date.now()}, T_{\text{end}})$.
  - Record duration: $\max(0, M_{\text{end}} - M_{\text{start}})$.
- **Overlapping Prevention:** If a vehicle has multiple concurrent maintenance records, their intervals are merged (union of intervals) to strictly eliminate double-counting downtime hours.

### 2.5 Fleet Availability Ratio (%) & Snapshot Distribution
- **Fleet Availability Ratio (%):**
  $$\text{Availability \%} = \left( \frac{\text{Eligible Available Vehicle Hours}}{\text{Total Eligible Vehicle Hours}} \right) \times 100$$
  Where $\text{Eligible Available Hours} = \text{Total Eligible Hours} - \text{Maintenance Downtime Hours} - \text{Out-of-Service Hours}$.
- **Snapshot Distribution (Point-in-Time):**
  Counts of vehicles currently in:
  - `AVAILABLE`
  - `IN_TRANSIT`
  - `ASSIGNED`
  - `MAINTENANCE`
  - `OUT_OF_SERVICE`
  - `RETIRED` (archived/inactive)
  Clearly presented as a live status distribution.
