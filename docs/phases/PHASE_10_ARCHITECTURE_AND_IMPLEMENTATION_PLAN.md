# FLEETOS — PHASE 10 ARCHITECTURE & IMPLEMENTATION PLAN
## Freight Invoicing, Dynamic Rate Engine, Driver Settlements & Financial Ledger

---

### Executive Summary

FLEETOS has achieved a hardened, enterprise-grade foundation spanning Phases 01 through 09.1, covering multi-tenant identity, asset management, dispatch orchestration, real-time telemetry, maintenance scheduling, fuel auditing, and driver safety/performance scoring. 

The natural and imperative progression for **Phase 10** is the **Financial Engine & Freight Settlement Layer**. Without automated customer invoicing and driver settlements, logistics operations cannot achieve revenue cycle realization or carrier financial reconciliation.

Phase 10 bridges operational events (completed shipments, fulfilled dispatches, recorded distance, fuel surcharges, driver shift hours) directly into an idempotent, immutable, double-entry-aligned financial ledger with customer billing, invoice state machines, rate matrices, and driver settlement runs.

---

### 1. Architectural Principles & Constraints

1. **Strict Multi-Tenant Isolation**: Every financial entity (`RateMatrix`, `Invoice`, `InvoiceLineItem`, `PaymentReceipt`, `DriverSettlement`) must enforce mandatory `organizationId: { type: Types.ObjectId, ref: 'Organization', required: true, index: true }`. Tenant context is exclusively resolved server-side via authenticated session context; client-provided `organizationId` is strictly ignored.
2. **Zero-Cost External Dependency Policy**: No mandatory paid subscriptions or proprietary SaaS APIs (e.g., Stripe, QuickBooks, Twilio). Open payment recording, manual reconciliation, structured webhook ingest, and self-hosted PDF/CSV export workflows are natively implemented.
3. **Idempotency & Anti-Duplication**: Generating invoices from shipments or generating driver settlements from shifts/dispatches must be strictly idempotent using database-enforced compound indexes and idempotency keys to guarantee no duplicate invoicing or settlement double-payouts.
4. **Immutability & Audit Trail**: Finalized/Issued invoices and Approved settlements cannot be mutated in place; any adjustments require credit notes, debit adjustments, or formal void/dispute workflows backed by `AuditLog`.
5. **Cross-Phase Operational Grounding**:
   - Consumes `Shipment` (Phase 05) status `DELIVERED` for revenue billing.
   - Consumes `FuelTransaction` (Phase 08) fuel price index for dynamic fuel surcharge calculation.
   - Consumes `DriverShift` and `DriverIncident` (Phase 09/09.1) for settlement base pay, mileage pay, overtime, and safety bonus/penalty calculations.

---

### 2. Domain Data Models & Schema Design

#### 2.1 `RateMatrix` (`backend/src/models/RateMatrix.ts`)
Defines contractual freight pricing agreements between the fleet operator and customers.
- `organizationId`: `ObjectId` (Tenant)
- `customerId`: `ObjectId` (Optional: customer-specific; `null` for default fleet tariff)
- `name`: `string`
- `status`: `'ACTIVE' | 'DRAFT' | 'ARCHIVED'`
- `effectiveFrom`: `Date`
- `effectiveTo`: `Date | null`
- `pricingModel`: `'FLAT' | 'DISTANCE_BASED' | 'WEIGHT_BASED' | 'ZONE_BASED' | 'HYBRID'`
- `rates`:
  - `baseFee`: `number` (minimum flat charge)
  - `perKmRate`: `number` (rate per distance unit)
  - `perKgRate`: `number` (rate per weight unit)
  - `minimumCharge`: `number`
  - `waitingTimeRatePerHour`: `number`
  - `fuelSurchargePercent`: `number` (dynamic or fixed index percentage)
- `currency`: `string` (default: `'USD'`)
- Compound Indexes:
  - `{ organizationId: 1, customerId: 1, status: 1 }`
  - `{ organizationId: 1, effectiveFrom: 1, effectiveTo: 1 }`

#### 2.2 `Invoice` (`backend/src/models/Invoice.ts` — Upgrade Existing Stub)
Upgrades the initial stub into an enterprise accounts receivable document.
- `organizationId`: `ObjectId`
- `invoiceNumber`: `string` (e.g., `INV-2026-000123`, auto-sequenced per organization)
- `customerId`: `ObjectId` (Ref: `Customer`)
- `status`: `'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'DISPUTED' | 'VOID'`
- `issueDate`: `Date`
- `dueDate`: `Date`
- `currency`: `string`
- `lineItems`:
  - `shipmentId`: `ObjectId` (Ref: `Shipment`, optional)
  - `description`: `string`
  - `quantity`: `number`
  - `unitPrice`: `number`
  - `taxRate`: `number`
  - `amount`: `number`
- `subtotal`: `number`
- `taxTotal`: `number`
- `discountTotal`: `number`
- `fuelSurcharge`: `number`
- `totalAmount`: `number`
- `amountPaid`: `number`
- `balanceDue`: `number`
- `paymentTerms`: `'NET_15' | 'NET_30' | 'NET_60' | 'DUE_ON_RECEIPT'`
- `notes`: `string`
- `paymentHistory`: Array of references to `PaymentReceipt`
- Compound Indexes:
  - `{ organizationId: 1, invoiceNumber: 1 }` (Unique)
  - `{ organizationId: 1, customerId: 1, status: 1 }`
  - `{ organizationId: 1, dueDate: 1, status: 1 }`

#### 2.3 `PaymentReceipt` (`backend/src/models/PaymentReceipt.ts`)
Tracks payment settlements against issued invoices.
- `organizationId`: `ObjectId`
- `receiptNumber`: `string`
- `invoiceId`: `ObjectId` (Ref: `Invoice`)
- `customerId`: `ObjectId` (Ref: `Customer`)
- `amount`: `number`
- `currency`: `string`
- `paymentDate`: `Date`
- `paymentMethod`: `'BANK_TRANSFER' | 'CREDIT_CARD' | 'CHECK' | 'CASH' | 'ACH' | 'OTHER'`
- `referenceNumber`: `string` (transaction/cheque/wire reference)
- `recordedBy`: `ObjectId` (Ref: `User`)
- `status`: `'RECORDED' | 'RECONCILED' | 'REVERSED'`

#### 2.4 `DriverSettlement` (`backend/src/models/DriverSettlement.ts`)
Automated settlement calculation and payroll realization for drivers.
- `organizationId`: `ObjectId`
- `settlementNumber`: `string` (e.g., `SETTLE-2026-0045`)
- `driverId`: `ObjectId` (Ref: `Driver`)
- `periodStart`: `Date`
- `periodEnd`: `Date`
- `status`: `'DRAFT' | 'CALCULATED' | 'APPROVED' | 'PAID' | 'REJECTED'`
- `breakdown`:
  - `totalDispatches`: `number`
  - `totalDistanceKm`: `number`
  - `totalHoursWorked`: `number`
  - `basePay`: `number`
  - `mileagePay`: `number`
  - `overtimePay`: `number`
  - `safetyBonus`: `number` (derived from Phase 09.1 safety score `> 90`)
  - `incidentDeductions`: `number` (derived from at-fault incidents in period)
  - `fuelEfficiencyBonus`: `number` (derived from Phase 08 efficiency score)
  - `otherDeductions`: `number`
  - `grossPay`: `number`
  - `taxWithheld`: `number`
  - `netPay`: `number`
- `dispatchesIncluded`: Array of `ObjectId` (Ref: `Dispatch`)
- `shiftsIncluded`: Array of `ObjectId` (Ref: `DriverShift`)
- `approvedBy`: `ObjectId | null` (Ref: `User`)
- `approvedAt`: `Date | null`
- `paidAt`: `Date | null`
- Compound Indexes:
  - `{ organizationId: 1, settlementNumber: 1 }` (Unique)
  - `{ organizationId: 1, driverId: 1, periodStart: 1, periodEnd: 1 }` (Unique for non-rejected)

---

### 3. REST API Contract & Endpoints

#### 3.1 Rate Matrices
- `GET /api/v1/billing/rates` — List rate cards with filtering.
- `POST /api/v1/billing/rates` — Create new rate matrix.
- `GET /api/v1/billing/rates/:id` — Get rate card details.
- `PUT /api/v1/billing/rates/:id` — Update rate matrix (draft/active).
- `POST /api/v1/billing/rates/calculate` — Test calculate quotation for a hypothetical or actual shipment.

#### 3.2 Freight Invoicing
- `GET /api/v1/billing/invoices` — List invoices with status, customer, date range, and pagination.
- `POST /api/v1/billing/invoices` — Manual invoice creation.
- `POST /api/v1/billing/invoices/generate-from-shipments` — Batch/single automated invoice generator for delivered shipments.
- `GET /api/v1/billing/invoices/:id` — Full invoice document with line items and payment reconciliation.
- `PUT /api/v1/billing/invoices/:id` — Update draft invoice.
- `POST /api/v1/billing/invoices/:id/issue` — Finalize & issue invoice (transitions to `ISSUED`, generates sequential invoice number, locks line items).
- `POST /api/v1/billing/invoices/:id/void` — Void invoice with mandatory reason.
- `POST /api/v1/billing/invoices/:id/payments` — Record payment receipt against invoice.
- `GET /api/v1/billing/invoices/:id/export/pdf` — Render lightweight PDF printable invoice view.
- `GET /api/v1/billing/invoices/aging-report` — Accounts receivable aging buckets (Current, 1-30, 31-60, 61-90, 90+ days overdue).

#### 3.3 Driver Settlements & Payroll
- `GET /api/v1/settlements` — List driver settlements with status, driver, and date filters.
- `POST /api/v1/settlements/calculate` — Automated preview & draft settlement generation for a driver over a date window.
- `GET /api/v1/settlements/:id` — Get detailed settlement breakdown including all linked shifts and dispatches.
- `POST /api/v1/settlements/:id/approve` — Approve settlement (RBAC: `FLEET_MANAGER` or `ADMIN`).
- `POST /api/v1/settlements/:id/mark-paid` — Mark settlement as disbursed with transaction reference.
- `GET /api/v1/settlements/driver/:driverId/summary` — Driver self-service settlement summary.

---

### 4. Implementation Phasing Breakdown

```
Phase 10: Financial Engine & Freight Billing
├── 10.0: Database Models, Schema Migrations & Validation Contracts (Zod)
├── 10.1: Rate Matrix Engine & Dynamic Pricing Calculator
├── 10.2: Freight Invoicing Lifecycle & Idempotent Shipment Billing
├── 10.3: Accounts Receivable Aging & Payment Reconciliation Ledger
├── 10.4: Driver Settlement & Payroll Calculation Engine (Phase 08/09 Integration)
└── 10.5: Frontend Billing, Invoicing & Settlement Management Portal
```

#### Subphase 10.0: Schema Architecture & Validation Contracts
- Implement Zod schemas in `shared/src/schemas/billing.ts` and `shared/src/schemas/settlement.ts`.
- Create Mongoose models:
  - `backend/src/models/RateMatrix.ts`
  - Enhanced `backend/src/models/Invoice.ts`
  - `backend/src/models/PaymentReceipt.ts`
  - `backend/src/models/DriverSettlement.ts`
- Implement compound indexes for strict tenant isolation and uniqueness.

#### Subphase 10.1: Rate Matrix Engine & Pricing Calculator
- Implement `RateMatrixService` to evaluate shipment parameters (origin/destination distance, billable weight, hazardous surcharge, fuel price index).
- Test quotation generator with deterministic edge cases (minimum charge caps, zero distance, volumetric weight).

#### Subphase 10.2: Freight Invoicing Lifecycle
- Implement `InvoiceStateMachine` managing transitions (`DRAFT` -> `ISSUED` -> `PARTIALLY_PAID` -> `PAID` / `OVERDUE` / `VOID`).
- Implement `generateInvoicesFromDeliveredShipments()` with database transaction ensuring shipments are stamped with `invoiceId` idempotently.
- Add overdue invoice detector worker / query helper.

#### Subphase 10.3: Accounts Receivable & Payment Ledger
- Implement `PaymentReceiptService` with balance recalculation.
- Support partial payments and multi-receipt balance depletion.
- Implement Accounts Receivable (AR) aging report service: `0-30`, `31-60`, `61-90`, `90+` days overdue.

#### Subphase 10.4: Driver Settlement & Payroll Realization
- Implement `DriverSettlementService`:
  - Aggregates completed `Dispatch` runs for driver within `[periodStart, periodEnd]`.
  - Integrates `DriverShift` total hours and overtime.
  - Applies driver safety score bonus/penalty from `DriverScorecard` (Phase 09.1).
  - Incorporates fuel efficiency bonus/penalty from `FuelEfficiencyService` (Phase 08.1).
  - Calculates gross pay, deductions, and net pay.
  - State machine: `DRAFT` -> `CALCULATED` -> `APPROVED` -> `PAID`.

#### Subphase 10.5: Frontend Billing & Settlement Console
- Next.js App Router pages:
  - `/billing` — Financial dashboard with AR summary, outstanding receivables, and monthly billing metrics.
  - `/billing/invoices` — Data table of all invoices with status chips, filtering, and "Generate from Delivered" batch trigger.
  - `/billing/invoices/[id]` — Detailed invoice view with printable layout, line-item breakdown, and "Record Payment" modal.
  - `/billing/rates` — Rate card matrix configuration table and rate calculator preview.
  - `/settlements` — Driver settlement ledger, payroll run generator, and approval actions.
  - `/settlements/[id]` — Itemized settlement pay stub view for managers and drivers.

---

### 5. Automated Verification & Test Strategy

1. **Unit Tests**:
   - `RateMatrixService.test.ts`: Pricing formula validation across flat, distance-based, and fuel-indexed rates.
   - `InvoiceStateMachine.test.ts`: State transition guards, invalid transition rejections, balance calculations.
   - `DriverSettlementService.test.ts`: Accurate calculation of base pay, overtime, safety bonus, and net pay.
2. **Integration & Multi-Tenant Tests**:
   - `Phase10_BillingTenantIsolation.test.ts`: Verify cross-tenant invoice/settlement queries return 404/empty.
   - `Phase10_ShipmentInvoicingIdempotency.test.ts`: Attempt double-generation on the same delivered shipment; verify single invoice produced.
   - `Phase10_PaymentReconciliation.test.ts`: Full flow from `ISSUED` -> `PARTIALLY_PAID` -> `PAID` with balance ledger.
3. **Regression Suite**:
   - Ensure all 138 existing tests (Phases 02 through 09.1) continue to pass without regression.
   - Frontend and backend production builds must exit 0.

---

### 6. Deliverable Checklist for Phase 10

- [ ] `RateMatrix`, `Invoice`, `PaymentReceipt`, `DriverSettlement` Mongoose models with compound tenant indexes.
- [ ] Zod schema definitions in shared package.
- [ ] `BillingService`, `InvoiceService`, `PaymentService`, and `SettlementService`.
- [ ] REST API routes registered under `/api/v1/billing` and `/api/v1/settlements`.
- [ ] Idempotent generation of invoices from delivered shipments.
- [ ] AR aging report calculation API.
- [ ] Driver settlement calculation integrating safety and fuel metrics.
- [ ] Comprehensive Phase 10 automated test suite (>= 20 tests).
- [ ] Next.js frontend pages for `/billing`, `/billing/invoices`, `/billing/rates`, and `/settlements`.
- [ ] 100% passing unified backend test suite and clean production builds.
