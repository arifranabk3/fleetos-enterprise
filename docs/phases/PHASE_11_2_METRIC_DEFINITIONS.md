# PHASE 11.2 — METRIC DEFINITIONS & MATHEMATICAL SPECIFICATIONS
## ADVANCED DRIVER PERFORMANCE & SAFETY INTELLIGENCE

**Document Version:** 1.1.0
**Status:** VALIDATION & AUDIT APPROVED
**Scope:** Mathematical formulas, boundary conditions, weighting models, fairness criteria, and missing-data behavior.
**Author:** Principal Software Architect, Data Architect & CTO

---

## 1. Executive Overview

Phase 11.2 introduces deterministic, legally fair, auditable workforce metrics for FleetOS. To guarantee algorithmic fairness, prevent industrial disputes, and maintain numerical stability across multi-tenant operations, every metric is bound to exact source fields, explicit normalized scoring ranges ($[0, 100]$), documented edge-case behavior, and strict data sufficiency criteria.

---

## 2. Driver Eligibility & Sufficient Data Rules

### 2.1 The Cold-Start & Low-Sample Problem
Unconstrained ratio calculations on new or inactive drivers (e.g., $1/1$ deliveries = $100\%$, or $0/1$ shifts = $0\%$) produce misleading anomalies that distort fleet leaderboards and rankings.

### 2.2 Minimum Evidence Requirements
To qualify for numerical scoring and inclusion in active fleet rankings, a driver within the reporting period ($T$) must meet **all** of the following threshold conditions:
1. **Active Employment:** Driver status is `ACTIVE` and `isArchived === false`.
2. **Minimum Exposure:** Must have at least **5 non-cancelled scheduled shifts** OR at least **5 concluded assigned shipments** (`DELIVERED` or `FAILED_DELIVERY`) within the reporting period.

### 2.3 Insufficient Data Behavior
If a driver does not meet the minimum evidence requirements:
- `hasSufficientData` is explicitly set to `false`.
- `scoreTier` is set to `'INSUFFICIENT_DATA'`.
- `compositePerformanceScore` is returned as `null` (or explicitly omitted from numerical aggregations).
- The driver is **excluded** from fleet-wide ranking leaderboards and is not assigned an artificial `0` or `100` score.

---

## 3. Metric 1: Delivery Score ($S_{\text{delivery}}$, Weight: 40%)

### 3.1 Exact Source Fields (`Shipment.ts`)
- `status`: `ShipmentStatus` enum.
- `driverId`: Reference to `Driver._id`.
- `expectedDeliveryDate`: `Date` representing agreed customer delivery deadline.
- `proofOfDelivery.deliveredAt`: `Date` timestamp captured upon physical delivery.
- `timeline`: Array of `IShipmentTimelineEntry` tracking status transitions and delay metadata.

### 3.2 Sub-Metrics & Formulas

#### A. Delivery Completion Rate (DCR)
Measures the proportion of assigned, actionable shipments that were successfully fulfilled:

$$\text{DCR} = \begin{cases} 100.0, & \text{if } N_{\text{eligible}} = 0 \\ \min\left(100.0, \max\left(0.0, \frac{N_{\text{delivered}}}{N_{\text{eligible}}} \times 100\right)\right), & \text{if } N_{\text{eligible}} > 0 \end{cases}$$

Where:
- $N_{\text{delivered}}$ = Count of shipments where `status === 'DELIVERED'`.
- $N_{\text{failed}}$ = Count of shipments where `status === 'FAILED_DELIVERY'`.
- $N_{\text{eligible}} = N_{\text{delivered}} + N_{\text{failed}}$.
- **Excluded Shipments:** `DRAFT`, `PENDING_DISPATCH`, `CONFIRMED`, `READY_FOR_DISPATCH`, `DISPATCHED`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, and `CANCELLED`.
- **Driver Reassignment:** If a shipment is reassigned to another driver prior to delivery, the shipment is linked only to the driver holding `driverId` at the time of final resolution (`DELIVERED` or `FAILED_DELIVERY`).

#### B. On-Time Delivery Rate (OTD)
Fulfilling a shipment does not inherently mean it was punctual. Punctuality is strictly evaluated against customer commitments:

$$\text{OTD} = \begin{cases} 100.0, & \text{if } N_{\text{delivered}} = 0 \\ \min\left(100.0, \max\left(0.0, \frac{N_{\text{on\_time}}}{N_{\text{delivered}}} \times 100\right)\right), & \text{if } N_{\text{delivered}} > 0 \end{cases}$$

Where a delivery is categorized as $N_{\text{on\_time}}$ if:
1. `proofOfDelivery.deliveredAt` exists AND `expectedDeliveryDate` exists AND:
   $$\text{proofOfDelivery.deliveredAt} \le \text{expectedDeliveryDate} + \text{GracePeriod}_{\text{delivery}} \quad (\text{default: } 15\text{ minutes})$$
2. **Customer-Caused Delay / Force Majeure Exception:** If the shipment timeline contains an entry with `status === 'DELAYED'` or `status === 'ON_HOLD'` where `metadata.reason` indicates customer absence, access denial, or dispatch hold, the shipment is classified as excusably on-time.
3. **Missing Delivery Timestamp:** If `proofOfDelivery.deliveredAt` is missing on a `DELIVERED` shipment, the timestamp of the `'DELIVERED'` transition in `timeline` is used as fallback. If timeline timestamp is also missing, it is excluded from $N_{\text{on\_time}}$ (penalizing administrative unreliability).

#### C. Normalized Delivery Score Calculation
$$S_{\text{delivery}} = \text{round}\left((\text{DCR} \times 0.50) + (\text{OTD} \times 0.50), 1\right)$$

---

## 4. Metric 2: Safety & Risk Score ($S_{\text{safety}}$, Weight: 30%)

### 4.1 Exact Source Fields (`DriverIncident.ts`)
- `status`: `DriverIncidentStatus` (`OPEN`, `UNDER_REVIEW`, `RESOLVED`, `CLOSED`).
- `responsibilityStatus`: `IncidentResponsibilityStatus` (`UNDETERMINED`, `DRIVER_RESPONSIBLE`, `DRIVER_NOT_RESPONSIBLE`, `SHARED_RESPONSIBILITY`).
- `severity`: `DriverIncidentSeverity` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- `incidentDate`: `Date`.
- `incidentNumber`: Unique tenant identifier (used for deduplication).

### 4.2 Legal Due Process & Fairness Rules
1. **Presumption of Innocence:** Incidents with status `OPEN` or `UNDER_REVIEW`, or `responsibilityStatus === 'UNDETERMINED'`, are under active investigation. They **must never** result in score deductions.
2. **Exoneration:** Incidents concluded with `responsibilityStatus === 'DRIVER_NOT_RESPONSIBLE'` represent full exoneration and apply **0 deduction**.
3. **Rejected / Dismissed Allegations:** If an incident investigation is closed as unsubstantiated or false, `responsibilityStatus` is set to `'DRIVER_NOT_RESPONSIBLE'`, yielding 0 deduction.
4. **Duplicate Reports:** Multiple reports referencing the same physical occurrence (`incidentNumber` or identical `shipmentId` + timestamp) are consolidated; only one incident is scored.

### 4.3 Severity Deductions & Responsibility Multipliers
The base safety score begins at $100.0$ points. Deductions are calculated only over incidents occurring within the reporting period ($T$):

$$\text{Deduction}(i) = \text{BasePoints}(\text{severity}_i) \times M_{\text{responsibility}}(i)$$

Where:
- $\text{BasePoints}(\text{severity})$:
  - `CRITICAL`: 35 points
  - `HIGH`: 20 points
  - `MEDIUM`: 10 points
  - `LOW`: 5 points
- Responsibility Multiplier $M_{\text{responsibility}}$:
  - `DRIVER_RESPONSIBLE`: $1.0$
  - `SHARED_RESPONSIBILITY`: $0.5$ (Documented 50% fault sharing)
  - `DRIVER_NOT_RESPONSIBLE`: $0.0$
  - `UNDETERMINED`: $0.0$

### 4.4 Normalized Safety Score Calculation
$$S_{\text{safety}} = \max\left(0.0, 100.0 - \sum_{i \in \text{Concluded Incidents}} \text{Deduction}(i)\right)$$

Penalty Cap: Total deductions cannot exceed 100 points ($S_{\text{safety}} \ge 0.0$).

---

## 5. Metric 3: Attendance & Punctuality Reliability ($S_{\text{attendance}}$, Weight: 20%)

### 5.1 Exact Source Fields (`DriverShift.ts`)
- `status`: `DriverShiftStatus` (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `MISSED`, `CANCELLED`).
- `plannedStart`, `plannedEnd`: `Date`.
- `actualStart`, `actualEnd`: `Date`.
- `isLateStart`: `Boolean`.
- `lateStartMinutes`: `Number`.
- `durationMinutes`: `Number`.
- `overtimeMinutes`: `Number`.
- `settlementId`: `ObjectId` (indicates shift is locked by payroll/settlement).

### 5.2 Fair Treatment of Shift States
- **Completed On-Time:** `status === 'COMPLETED'` AND `isLateStart === false`.
- **Late Arrival:** `status === 'COMPLETED'` AND `isLateStart === true` (where `actualStart > plannedStart + GracePeriod` [default: 15 min]).
- **Missed Shift (No-Show):** `status === 'MISSED'`. Treated as an unexcused absence.
- **Canceled Shifts:** `status === 'CANCELLED'`. Excluded from denominator.
- **Approved / Excused Absences:** Shifts canceled with administrative approval are marked `status === 'CANCELLED'` with documented notes, and **never** penalize the driver.
- **Partial Shifts:** If a driver works a partial shift due to approved operational relief or vehicle breakdown, `status === 'COMPLETED'` is maintained with logged `durationMinutes`.

### 5.3 Normalized Attendance Score Calculation (ARI)
$$\text{ARI} = \begin{cases} 100.0, & \text{if } N_{\text{scheduled}} = 0 \\ \min\left(100.0, \max\left(0.0, \frac{N_{\text{completed\_on\_time}} + (0.5 \times N_{\text{completed\_late}})}{N_{\text{scheduled}}} \times 100\right)\right), & \text{if } N_{\text{scheduled}} > 0 \end{cases}$$

Where:
- $N_{\text{scheduled}} = N_{\text{completed\_on\_time}} + N_{\text{completed\_late}} + N_{\text{missed}}$.
- $N_{\text{completed\_late}}$ receives partial credit ($50\%$), distinguishing late arrival from outright unexcused no-shows ($0\%$).

$$S_{\text{attendance}} = \text{round}(\text{ARI}, 1)$$

---

## 6. Metric 4: Document & Qualification Compliance ($S_{\text{compliance}}$, Weight: 10%)

### 6.1 Exact Source Fields (`DriverDocument.ts`)
- `documentType`: Enum (`DRIVING_LICENSE`, `MEDICAL_FITNESS_CERTIFICATE`, etc.).
- `verificationStatus`: Enum (`PENDING`, `VERIFIED`, `REJECTED`).
- `expiryStatus`: Enum (`VALID`, `EXPIRING_SOON`, `EXPIRED`, `NOT_APPLICABLE`).
- `expiryDate`: `Date`.
- `isArchived`: `Boolean`.

### 6.2 Compliance Rules & Formulas
Mandatory required documents:
1. `DRIVING_LICENSE` (Must be verified and not expired).
2. `MEDICAL_FITNESS_CERTIFICATE` (Must be verified and not expired).

$$\text{Missing Mandatory} = \sum [\text{Mandatory Doc Type Not Present or REJECTED}]$$
$$\text{Expired Docs} = \sum [\text{Active Doc where expiryDate} < \text{Now} \lor \text{expiryStatus} === \text{'EXPIRED'}]$$

$$S_{\text{compliance}} = \max\left(0.0, 100.0 - (\text{Expired Docs} \times 30) - (\text{Missing Mandatory} \times 20)\right)$$

---

## 7. Composite Performance Score (CPS) Formulation

The overall composite score synthesizes the four normalized dimensions:

$$\text{CPS} = \text{round}\left(S_{\text{delivery}} \times 0.40 + S_{\text{safety}} \times 0.30 + S_{\text{attendance}} \times 0.20 + S_{\text{compliance}} \times 0.10, 1\right)$$

### 7.1 Performance Tier Classifications
For drivers meeting minimum evidence thresholds:
- **`EXCELLENT`**: $\text{CPS} \ge 90.0$
- **`GOOD`**: $75.0 \le \text{CPS} < 90.0$
- **`SATISFACTORY`**: $60.0 \le \text{CPS} < 75.0$
- **`NEEDS_IMPROVEMENT`**: $\text{CPS} < 60.0$

For drivers not meeting threshold:
- **`INSUFFICIENT_DATA`**: Assigned automatically. `CPS` is returned as `null`.

### 7.2 Deterministic Ranking & Tie-Breaking Rules
When sorting drivers on the fleet leaderboard:
1. Primary Sort: `CPS` (Descending).
2. First Tie-Breaker: $S_{\text{safety}}$ (Descending — prioritize safety compliance).
3. Second Tie-Breaker: $S_{\text{delivery}}$ (Descending — prioritize delivery output).
4. Third Tie-Breaker: $N_{\text{delivered}}$ (Descending — absolute shipment volume).
5. Deterministic Final Tie-Breaker: `driverId` (Ascending lexicographical sort).

### 7.3 Historical Comparison & Trend Windows
- Default reporting window: 30 rolling calendar days.
- Historical trend analysis: Evaluates monthly rolling buckets ($M_0, M_{-1}, \dots, M_{-6}$) using the exact same formula to track progression.
