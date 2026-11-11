# FLEETOS — PHASE 10.0 ARCHITECTURAL SPECIFICATION
## Financial Architecture, Ledger Foundations & Enterprise Billing Engine

**Document Version:** 1.0.0  
**Phase:** 10.0  
**Domain:** Financial Systems, Freight Invoicing, Driver Payroll & Double-Entry General Ledger  
**Compliance Standard:** Multi-Tenant Isolation, Zero-Cost External Dependencies, Double-Entry Balanced Ledger

---

### 1. Executive Overview

Phase 10.0 establishes the mission-critical financial backend and database architecture for FLEETOS. Prior phases orchestrated operational assets (vehicles, shipments, dispatches, fuel entries, driver shifts, and safety incidents). Phase 10.0 unifies these operational artifacts into an immutable, idempotent, double-entry financial accounting ledger.

The core design centers around four foundational pillars:
1. **Integer-Cent Monetary Precision:** Complete elimination of IEEE 754 floating-point inaccuracies through micro-unit cent arithmetic.
2. **Immutable General Ledger:** Double-entry journal accounting with debit/credit balance enforcement and strict counter-reversal workflows.
3. **Operational-to-Financial Invoicing:** Idempotent conversion of `DELIVERED` shipments into customer invoices with frozen tariff rate snapshots.
4. **Driver Settlements & Payroll:** Accurate compensation runs aggregating shifts, mileage, and driver scorecard metrics (Phase 09.1 safety bonuses, at-fault incident penalties) without silent mutations.

---

### 2. Financial Domain Entity Architecture

```
                    ┌────────────────────────────┐
                    │      RateMatrix            │
                    │ (Customer or Default Plan) │
                    └─────────────┬──────────────┘
                                  │ applies tariff snapshot
                                  ▼
┌──────────────────┐       ┌────────────────────────────┐
│    Shipment      │──────▶│         Invoice            │
│ (DELIVERED only) │       │ (DRAFT/ISSUED/PAID/VOID)   │
└──────────────────┘       └──────────────┬─────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
   ┌─────────────────────────────┐                 ┌─────────────────────────────┐
   │       PaymentReceipt        │                 │        JournalEntry         │
   │  (Idempotent Reconciliation)│                 │   (Immutable Double-Entry)  │
   └─────────────────────────────┘                 └──────────────┬──────────────┘
                                                                  │ debits/credits
                                                                  ▼
                                                   ┌─────────────────────────────┐
                                                   │       LedgerAccount         │
                                                   │ (Assets, Liab, Rev, Exp)    │
                                                   └─────────────────────────────┘
```

#### 2.1 Entity Summary & Purpose

| Entity | Model File | Purpose & Architectural Invariants |
| :--- | :--- | :--- |
| `RateMatrix` | `backend/src/models/RateMatrix.ts` | Dynamic customer tariffs and default fleet rates. Supports flat fees, per-km rates, per-kg rates, minimum charge caps, tiered brackets, and fuel surcharge indexing. Fully versioned. |
| `Invoice` | `backend/src/models/Invoice.ts` | Upgraded enterprise accounts receivable document. Contains integer-cent line items, rate snapshot, tax calculations, discounts, payment terms, and status machine. |
| `PaymentReceipt` | `backend/src/models/PaymentReceipt.ts` | Payment recording document with invoice allocations. Prevents overpayments, supports partial payments, provides counter-reversal restoration, and uses idempotency keys. |
| `DriverSettlement` | `backend/src/models/DriverSettlement.ts` | Driver pay run document. Aggregates shifts, completed dispatches, mileage, overtime, safety bonuses, and authorized deductions. Protects against duplicate overlapping periods. |
| `LedgerAccount` | `backend/src/models/LedgerAccount.ts` | Chart of Accounts (COA) entities: Asset, Liability, Equity, Revenue, Expense. Tracks running account balances in integer cents. |
| `JournalEntry` | `backend/src/models/JournalEntry.ts` | Immutable general ledger journal entry. Strictly validates that total debits equal total credits. Reversals require balanced counter-entries. |
| `FinancialPeriod` | `backend/src/models/FinancialPeriod.ts` | Fiscal periods with `OPEN`, `CLOSED`, and `LOCKED` states. Prohibits journal entries against closed or locked fiscal windows. |

---

### 3. Monetary Precision & Rounding Rules

JavaScript's native floating point type (`number`) uses IEEE 754 double-precision floats, which introduces precision drift (e.g., `0.1 + 0.2 === 0.30000000000000004`). In enterprise billing, this produces balance discrepancies and reconciliation failures.

**FLEETOS Architectural Solution (`MonetaryPrecision.ts`):**
- All monetary amounts stored and computed internally as integer cents (e.g., \$154.50 = `15450` cents).
- Base precision is 2 decimal places.
- Multiplications (tax percentage, fuel surcharge) use half-up standard rounding:
  $$\text{cents} = \text{round}(\text{baseCents} \times \text{rate})$$
- Database pre-validation hooks synchronize legacy float fields (`subtotalAmount`, `taxAmount`, `totalAmount`) with integer cent fields (`subtotalCents`, `taxAmountCents`, `totalAmountCents`) to preserve 100% backwards compatibility with earlier phase tests.

---

### 4. Lifecycle State Machines

#### 4.1 Invoice Lifecycle (`FinancialStateMachine.ts`)

```
   ┌─────────┐
   │  DRAFT  │───────┐
   └────┬────┘       │
        │            │
        ▼            ▼
   ┌─────────┐   ┌───────┐
   │ ISSUED  │──▶│ VOID  │ (Terminal)
   └────┬────┘   └───────┘
        │            ▲
        ├────────────┤
        ▼            │
   ┌─────────────────┴──┐
   │   PARTIALLY_PAID   │
   └────────┬───────────┘
            │
            ▼
   ┌─────────────────┐
   │      PAID       │──▶ DISPUTED
   └─────────────────┘
```

- **Rules:**
  - A `POSTED` or `ISSUED` invoice cannot be deleted.
  - An invoice with status `PAID` cannot receive additional payments.
  - An invoice in `VOID` status cannot be unvoided or allocated payments.
  - Transitioning an invoice requires recorded audit trail logs (`Invoice.auditTrail`).

#### 4.2 Driver Settlement Lifecycle

```
┌───────┐      ┌────────────┐      ┌──────────┐      ┌──────┐
│ DRAFT │─────▶│ CALCULATED │─────▶│ APPROVED │─────▶│ PAID │ (Terminal)
└───────┘      └─────┬──────┘      └──────────┘      └──────┘
                     │                   ▲
                     ▼                   │
                ┌──────────┐             │
                │ REJECTED │─────────────┘
                └──────────┘
```

- **Rules:**
  - Settlements are automatically calculated from completed shifts and completed dispatches within `[periodStart, periodEnd]`.
  - Fuel expenses are never deducted automatically from driver pay without an explicit, authorized business rule.
  - Once a settlement is `APPROVED` or `PAID`, operational records (shifts, dispatches) cannot be recalculated in a competing settlement run.

---

### 5. Double-Entry General Ledger Rules

1. **Balanced Debits and Credits:** Every transaction posted to `JournalEntry` must satisfy:
   $$\sum \text{LineDebits} = \sum \text{LineCredits}$$
2. **Immutability:** Journal entries are write-once. An entry cannot be edited or deleted.
3. **Correction Workflow:** Any erroneous journal posting must be reversed using `FinancialLedgerService.reverseJournalEntry()`, which:
   - Validates that the original entry is not already reversed.
   - Posts a counter-entry with inverted lines (`DEBIT` $\leftrightarrow$ `CREDIT`).
   - Stamps the original entry with status `REVERSED` and links the reversal entry ID.
4. **Idempotency Protection:** All financial postings accept an optional `idempotencyKey` indexed uniquely within `{ organizationId: 1, idempotencyKey: 1 }`. Duplicate requests return the original transaction without re-posting.

---

### 6. Database Compound Indexes & Integrity

The following compound indexes guarantee intra-tenant uniqueness and performance:

```typescript
// Rate Matrix
RateMatrixSchema.index({ organizationId: 1, code: 1, version: 1 }, { unique: true });
RateMatrixSchema.index({ organizationId: 1, customerId: 1, status: 1, effectiveFrom: 1, effectiveTo: 1 });

// Invoice
InvoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ organizationId: 1, customerId: 1, status: 1 });
InvoiceSchema.index({ organizationId: 1, shipmentIds: 1 });

// Payment Receipt
PaymentReceiptSchema.index({ organizationId: 1, receiptNumber: 1 }, { unique: true });
PaymentReceiptSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

// Driver Settlement
DriverSettlementSchema.index({ organizationId: 1, settlementNumber: 1 }, { unique: true });
DriverSettlementSchema.index({ organizationId: 1, driverId: 1, periodStart: 1, periodEnd: 1 });

// General Ledger
JournalEntrySchema.index({ organizationId: 1, entryNumber: 1 }, { unique: true });
JournalEntrySchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
JournalEntrySchema.index({ organizationId: 1, sourceType: 1, sourceReferenceId: 1 });
```

---

### 7. RBAC Security & Tenant Isolation

- **Tenant Isolation:** Enforced via `BaseTenantRepository` and explicit database filters. Every financial entity requires `organizationId`. Cross-tenant queries return `null` or `0 matched`.
- **Role Permissions:**
  - `ACCOUNTANT`: Full access to `BILLING:MANAGE`, `billing.rates.manage`, `billing.invoices.generate`, `billing.receipts.record`, `billing.receipts.reverse`, `billing.settlements.manage`, `billing.ledger.post`.
  - `ADMIN` & `ORGANIZATION_OWNER`: Full billing and settlement administrative privileges.
  - `FLEET_MANAGER`: Operational access; read-only on customer billing.
  - `DRIVER`: Can view own pay stubs and settlements (`driver.read`); cannot view organization general ledger or invoice rates.
  - `VIEWER`: Read-only access; financial reversal or posting operations strictly rejected.
