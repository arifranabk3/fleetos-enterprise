# Driver Performance Methodology & KPI Scoring Engine

## 1. Principles
FLEETOS enforces reproducible, transparent performance evaluation. No black-box algorithms or fabricated telemetry data are used.

## 2. Four-Pillar Weighted Scorecard

The composite performance score ($S_{composite}$) is scaled from 0 to 100 points:

$$S_{composite} = (S_{delivery} \times 0.40) + (S_{safety} \times 0.30) + (S_{attendance} \times 0.20) + (S_{compliance} \times 0.10)$$

### Pillar 1: Delivery Reliability (40% Weight)
- **Shipment Completion Rate:** 
  $$\text{Completion Rate} = \frac{\text{Completed Deliveries}}{\text{Assigned Non-Cancelled Shipments}} \times 100$$
- **On-Time Delivery Rate:**
  $$\text{On-Time Rate} = \frac{\text{On-Time Deliveries}}{\text{Completed Deliveries}} \times 100$$
- **Delivery Score:**
  $$S_{delivery} = (\text{Completion Rate} \times 0.5) + (\text{On-Time Rate} \times 0.5)$$
*Note: Cancelled shipments (`CANCELLED`) and draft orders (`DRAFT`) are strictly excluded from completion denominators.*

### Pillar 2: Safety & Incident Record (30% Weight)
- Base score begins at 100.
- Deductions per incident in evaluation window:
  - Critical Severity: $-35$ points
  - High Severity: $-20$ points
  - Medium Severity: $-10$ points
  - Low Severity: $-5$ points
- Lower bound clamped at 0:
  $$S_{safety} = \max(0, 100 - \sum \text{Deductions})$$

### Pillar 3: Shift Attendance & Reliability (20% Weight)
- Calculated over scheduled shifts:
  $$\text{Attendance Reliability} = \frac{\text{Completed On-Time Shifts}}{\text{Total Scheduled Shifts}} \times 100$$
- Grace period: Up to 15 minutes past planned start is considered on-time. $>15$ minutes is flagged as `isLateStart`.

### Pillar 4: Qualification & Document Compliance (10% Weight)
- Base score: 100.
- $-30$ per expired document.
- $-20$ per missing required document (Driving License or Medical Fitness Certificate).
- Minimum clamped at 0:
  $$S_{compliance} = \max(0, 100 - (\text{Expired} \times 30) - (\text{Missing} \times 20))$$

## 3. Data Sufficiency Tiers
If a driver has zero assigned shipments and zero scheduled shifts in the evaluation window, the engine returns `hasSufficientData = false` with score tier `INSUFFICIENT_DATA`.
Otherwise:
- $\ge 90$: `EXCELLENT`
- $\ge 75$: `GOOD`
- $\ge 60$: `SATISFACTORY`
- $< 60$: `NEEDS_IMPROVEMENT`
