# FLEETOS — PHASE 11 DATA AND ANALYTICS AUDIT
**Date:** November 12, 2026
**Auditor:** Principal Software Architect, Enterprise Data Architect & CTO
**Repository:** `d:\portfolio-projects\fleetos-enterprise-saas` (`arifranabk3/fleetos-enterprise`)
**Baseline Git Commit:** `57d004326293f52740af62716fc61d1100344d2c`

---

## 1. EXECUTIVE SUMMARY & OBJECTIVE

This document provides a comprehensive technical audit of the current FLEETOS data architecture, database schema, index definitions, and analytical query feasibility.

The primary objective is to evaluate whether FLEETOS's current MongoDB multi-tenant operational data model can natively and performantly power **Phase 11 (Executive, Fleet, Driver, Shipment & Financial Intelligence)** without introducing external data warehouses, paid analytics platforms, or duplicate financial ledgers.

---

## 2. AUDIT OF EXISTING MONGODB DATA ASSETS

FLEETOS currently manages **37 database models** across its modular architecture:

| Domain | Primary Collections | Current Analytics Readiness | Key Identified Gaps for Phase 11 |
| :--- | :--- | :--- | :--- |
| **Fleet & Assets** | `vehicles`, `vehiclecompliancedocuments` | High for current status; Medium for historical utilization. | Vehicle status is point-in-time (`AVAILABLE`, `IN_TRANSIT`, `MAINTENANCE`, etc.). Calculating daily utilization % requires aggregating `TelemetryEvent` or `Dispatch` spans. |
| **Telemetry & GPS** | `telemetryevents`, `telemetryalerts`, `geofences` | High for raw metrics; requires aggregation fences. | `telemetryevents` contains `motionStatus` (`MOVING`, `IDLE`, `STOPPED`), `speedKmh`, `odometerKm`, `source` (`SIMULATED` vs `HARDWARE_GPS`). Large event volume necessitates strict compound tenant indexes. |
| **Logistics & Shipments** | `shipments`, `dispatches`, `deliveries`, `routes`, `customers` | High. Complete timestamped timeline entries (`timeline` array) and `proofOfDelivery.deliveredAt`. | Dispatch contains `actualDistanceKm` and duration; shipments track `expectedDeliveryDate` and `proofOfDelivery.deliveredAt` enabling exact on-time % and delay calculations. |
| **Driver Workforce** | `drivers`, `driverdocuments`, `drivershifts`, `driverincidents` | High. `DriverPerformanceEngine` already provides a foundation. | `drivershifts` records `plannedStart/End`, `actualStart/End`, `overtimeMinutes`, `lateStartMinutes`. Need multi-driver comparative aggregation and historical trend rolling windows. |
| **Maintenance** | `maintenancerecords`, `maintenanceschedules`, `maintenancevendors` | High. Cost breakdown exists (`laborCost`, `partsCost`, `totalCost`, `currency`). | Maintenance records link to `vehicleId`, scheduled vs completed dates, and downtime status (`initialVehicleStatus`). |
| **Fuel & Energy** | `fueltransactions`, `fuelvendors`, `expenses` | Very High. Full-to-full efficiency engine, anomaly flags, and dual expense syncing exist. | `fueltransactions` provides verified km/L, total cost, fuel type (including EV kWh), and vendor analytics. |
| **Financial Engine** | `invoices`, `paymentreceipts`, `driversettlements`, `ledgeraccounts`, `journalentries`, `ratematrixes` | Complete & Hardened. Integer-cent precision, double-entry audit trails. | Actual accounting numbers (`invoices`, `payments`, `driversettlements`) exist alongside operational metrics, enabling unified profitability calculations. |

---

## 3. METRIC DERIVATION MATRIX (EXISTING VS CALCULATED VS ESTIMATED)

To uphold the core zero-fabrication and accounting integrity rules, every Phase 11 metric is strictly classified into one of four tiers:

### Tier 1: Exact Accounting Figures (From Phase 10 Ledger)
*These metrics are derived directly from posted double-entry journal entries and immutable financial records. They must NEVER be approximated or mixed with unbilled operational estimates.*
1. **Gross Billed Freight Revenue:** `Invoice.find({ status: { $in: ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] } })` (`totalAmountCents`).
2. **Cash Collected:** `PaymentReceipt.find({ status: { $in: ['POSTED', 'ALLOCATED', 'PARTIALLY_ALLOCATED'] } })` (`amountCents`).
3. **Accounts Receivable Outstanding:** `Invoice` (`outstandingBalanceCents`).
4. **Driver Settlement Obligations:** `DriverSettlement.find({ status: { $in: ['APPROVED', 'PAID'] } })` (`netPayCents`, `grossPayCents`).
5. **Direct Fuel Expense (Recorded):** `Expense.find({ category: 'FUEL', isVoided: false })` or `FuelTransaction.find({ isVoided: false })` (`totalCost`).
6. **Direct Maintenance Expense (Recorded):** `MaintenanceRecord.find({ status: 'COMPLETED' })` (`totalCost`).

### Tier 2: Real Operational Facts (From Historical Operational Records)
*Empirical operational events recorded at the point of action.*
1. **Total Dispatched Shipments:** `Shipment.countDocuments({ status: { $ne: 'DRAFT' } })`.
2. **Delivered vs Failed Shipments:** Count of `Shipment` with status `DELIVERED` vs `FAILED_DELIVERY`.
3. **On-Time Deliveries:** `Shipment` where `proofOfDelivery.deliveredAt <= expectedDeliveryDate`.
4. **Delivery Delay Duration:** `proofOfDelivery.deliveredAt - expectedDeliveryDate` (in minutes).
5. **Driver Shift Attendance:** `DriverShift` scheduled vs completed vs missed vs late starts (`lateStartMinutes`).
6. **Driver Safety Incidents:** `DriverIncident` count grouped by severity (`MINOR`, `MODERATE`, `SEVERE`, `CRITICAL`) and responsibility (`DRIVER_RESPONSIBLE`, `SHARED_RESPONSIBILITY`, `FORCE_MAJEURE`).
7. **Fuel Volume & Consumption:** `FuelTransaction` (`quantityLiters` or kWh).

### Tier 3: Calculated Operational Metrics (Deterministic Computations)
*Derived through well-defined mathematical formulas over operational records.*
1. **On-Time Delivery Rate (%):** `(OnTimeDeliveries / CompletedDeliveries) * 100`.
2. **Shipment Completion Rate (%):** `(DeliveredShipments / TotalNonCancelledShipments) * 100`.
3. **Fleet Utilization Rate (%):** `(Vehicle Operating Hours in Dispatches or Moving Telemetry / Total Available Vehicle Hours) * 100`.
4. **Vehicle Availability (%):** `(Vehicles not in MAINTENANCE, OUT_OF_SERVICE, or RETIRED / Total Fleet Vehicles) * 100`.
5. **Verified Fuel Efficiency (km/L):** `FuelEfficiencyEngine` full-to-full verified calculations (`distanceTravelled / litersConsumed`).
6. **Driver Composite Performance Score (0-100):** `DriverPerformanceEngine.calculateDriverScorecard()` weighted algorithm.

### Tier 4: Analytical Profitability Estimates (Operational Allocation)
*Because certain indirect costs (e.g. overhead, periodic insurance, depreciation) are not billed per-shipment, shipment-level profitability is an analytical management estimate, clearly labeled as such.*
1. **Shipment Gross Margin (Estimate):** `Shipment Quoted Amount - (Allocated Driver Pay + Estimated Fuel Cost + Ancillary Expenses)`.
2. **Vehicle Operating Cost per Kilometer:** `(Recorded Maintenance Costs + Recorded Fuel Costs) / Recorded Distance Driven`.
3. **Customer Contribution Margin:** `Customer Revenue - Direct Operating Expenses on Customer Shipments`.

---

## 4. TELEMETRY & GPS INTEGRITY: HARDWARE VS SIMULATED

FLEETOS features a live simulation engine for testing and demonstrations, as well as production hardware GPS ingest. Phase 11 analytics **must strictly segregate and label data sources**:

- **Database Flag:** Every `TelemetryEvent` and `Vehicle.lastLocation` has `source: 'SIMULATED' | 'HARDWARE_GPS'` and `isSimulated: boolean`.
- **UI Labeling:** Dashboards and charts must visibly indicate when telemetry metrics are derived from simulated data (e.g., displaying a "Simulated Data Indicator" pill).
- **Executive & Financial Isolation:** Financial intelligence (revenues, actual costs, driver settlements) is **never simulated**; it derives strictly from real invoices, expenses, and approved settlements.

---

## 5. DATABASE INDEXING AUDIT & OPTIMIZATION FOR PHASE 11

Complex aggregations across hundreds of thousands of records will cause memory errors or disk spills unless supported by compound tenant indexes.

### Existing Indexes Verified in Baseline:
1. `Shipment`: `{ organizationId: 1, status: 1, createdAt: -1 }` (Good).
2. `Shipment`: `{ organizationId: 1, customerId: 1 }` (Good).
3. `Shipment`: `{ organizationId: 1, driverId: 1 }` (Good).
4. `FuelTransaction`: `{ organizationId: 1, vehicleId: 1, transactionDate: -1 }` (Good).
5. `DriverShift`: `{ organizationId: 1, driverId: 1, shiftDate: 1 }` (Good).
6. `DriverIncident`: `{ organizationId: 1, driverId: 1, status: 1 }` (Good).
7. `Invoice`: `{ organizationId: 1, status: 1, issuedAt: -1 }` (Good).
8. `PaymentReceipt`: `{ organizationId: 1, status: 1, receiptDate: -1 }` (Good).

### Required Compound Indexes for Phase 11 Analytics:
To prevent collection scans (`COLLSCAN`) during multi-dimensional analytical queries, the following compound indexes must be introduced during Phase 11:

1. **Shipment Analytics Index:**
   `Shipment.index({ organizationId: 1, status: 1, 'proofOfDelivery.deliveredAt': -1 })`
   *Powers on-time delivery aggregations and delivery delay analysis.*

2. **Vehicle Utilization & Cost Index:**
   `Vehicle.index({ organizationId: 1, status: 1, type: 1 })`
   *Powers instant fleet availability slicing by vehicle category.*

3. **Maintenance Downtime & Cost Index:**
   `MaintenanceRecord.index({ organizationId: 1, status: 1, completedDate: -1, totalCost: 1 })`
   *Powers maintenance cost trends and vehicle downtime impact.*

4. **Telemetry Motion Analysis Index:**
   `TelemetryEvent.index({ organizationId: 1, vehicleId: 1, recordedAt: -1, motionStatus: 1 })`
   *Powers vehicle idle-time versus motion-time calculations.*

5. **Customer Profitability Index:**
   `Invoice.index({ organizationId: 1, customerId: 1, status: 1, totalAmountCents: 1 })`
   *Powers customer revenue ranking and revenue concentration.*

---

## 6. MULTI-CURRENCY & TIMEZONE STRATEGY

### Multi-Currency Integrity
- FLEETOS organizations operate with a tenant-default currency (`Organization.settings.currency`, e.g., `USD`, `EUR`, `CAD`, `GBP`).
- Invoices, fuel transactions, maintenance records, and driver settlements store their explicit currency code.
- **Rule:** Phase 11 analytics engines **group financial metrics by currency**. If an organization operates in multiple currencies, dashboards must present currency-specific breakdowns or allow filtering by currency. FLEETOS will **not perform speculative currency conversion** without explicit exchange-rate configuration.

### Timezone Correctness
- All database timestamps are persisted in strict ISO 8601 UTC (`Date.now()`).
- Daily groupings (`YYYY-MM-DD`) in MongoDB aggregation pipelines will utilize `$dateToString` with the organization's configured timezone (`Organization.settings.attendanceSettings.timezone || 'UTC'`), preventing date-boundary leakage between local day shifts and UTC.

---

## 7. AGGREGATION PIPELINE PERFORMANCE & MEMORY LIMITS

- MongoDB imposes a **100MB RAM limit** on aggregation pipeline stages unless `allowDiskUse: true` is enabled.
- **Optimization Rules for Phase 11:**
  1. The very first stage of every analytics pipeline MUST be a `$match` stage with `{ organizationId: orgObjectId, ... }` to reduce the working set immediately using indexes.
  2. Use `$project` or `$group` early to discard unused fields and avoid carrying large document arrays in memory.
  3. Pre-aggregate historical periods (e.g. daily summaries) where appropriate or cache computed metrics for heavy executive dashboards with short TTLs (5-15 minutes).
  4. Ensure cursor streaming or pagination is used when querying raw lists of analytical records.

---

## 8. ZERO-COST ARCHITECTURE VERDICT

FLEETOS's current MongoDB deployment natively supports the entire scope of Phase 11 analytics using:
- MongoDB `$facet`, `$bucket`, `$group`, and `$densify` aggregation operators.
- Compound tenant indexes.
- In-memory Node.js processing for lightweight comparative scoring.
- Zero external data warehousing costs (No Snowflake, BigQuery, ClickHouse, or paid SaaS analytics dependencies).
