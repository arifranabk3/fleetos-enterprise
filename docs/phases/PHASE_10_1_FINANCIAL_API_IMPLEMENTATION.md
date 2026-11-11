# FLEETOS — PHASE 10.1 API IMPLEMENTATION SPECIFICATION
## Rate Matrix, Automated Freight Invoicing & Driver Settlement REST APIs

**Phase:** 10.1  
**Architecture Reference:** `docs/phases/PHASE_10_0_FINANCIAL_FOUNDATION.md`  
**Security & Tenant Isolation:** Non-bypassable server-side organization resolution, compound unique indexing, granular RBAC  

---

### 1. Overview & Architecture

Phase 10.1 implements the complete production-grade REST API layer for Freight Invoicing, Dynamic Pricing, Payment Reconciliation, and Driver Settlements on top of the Phase 10.0 database and ledger foundation.

All endpoints adhere strictly to enterprise multi-tenant standards:
- Organization context is never accepted from request payloads; it is resolved server-side from validated JWT claims and authenticated tenant membership (`req.tenant.organizationId`).
- Permissions are enforced via granular RBAC: `billing.read`, `billing.rates.manage`, `billing.invoices.generate`, `billing.invoices.manage`, `billing.receipts.record`, `billing.receipts.reverse`, `billing.settlements.read`, `billing.settlements.manage`, `billing.reports.read`.
- All monetary operations compute and store values in integer cents using `MonetaryPrecision.ts`.

---

### 2. Implemented Endpoints & Contracts

#### 2.1 Rate Matrix API (`/api/v1/billing/rates`)
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/billing/rates` | `billing.read` | Lists organization rate cards with pagination and filtering by customer, status, vehicle category, and cargo type. |
| `POST` | `/api/v1/billing/rates` | `billing.rates.manage` | Creates a new rate matrix. Enforces code uniqueness within tenant; returns HTTP 409 if duplicate code exists. |
| `GET` | `/api/v1/billing/rates/:id` | `billing.read` | Retrieves full rate card details by ID with populated customer details. |
| `PATCH` | `/api/v1/billing/rates/:id` | `billing.rates.manage` | Updates non-pricing metadata (name, description, active status, effectiveTo). Core rates cannot be mutated in place. |
| `POST` | `/api/v1/billing/rates/:id/versions` | `billing.rates.manage` | Creates a version successor (e.g. v2) for a rate card, automatically ending the validity of the previous version. |
| `GET` | `/api/v1/billing/rates/:id/versions` | `billing.read` | Retrieves the immutable version history for a tariff code. |
| `POST` | `/api/v1/billing/rates/quote` | `billing.read` | Generates a deterministic preview quotation based on active customer or organization default tariff. |

#### 2.2 Freight Invoicing API (`/api/v1/billing/invoices`)
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/billing/invoices` | `billing.read` | Lists freight invoices with filtering by customer, date range, status, and text search. |
| `POST` | `/api/v1/billing/invoices` | `billing.invoices.manage` | Creates a manual draft invoice with server-side total validation. |
| `POST` | `/api/v1/billing/invoices/generate-from-shipments` | `billing.invoices.generate` | Idempotently generates an issued invoice from delivered shipments. Blocks double-billing with HTTP 409 and auto-posts AR journal entries. |
| `GET` | `/api/v1/billing/invoices/:id` | `billing.read` | Retrieves detailed invoice with line items, rate snapshot, and customer billing address. |
| `POST` | `/api/v1/billing/invoices/:id/issue` | `billing.invoices.manage` | Transitions a draft invoice to `ISSUED`. |
| `POST` | `/api/v1/billing/invoices/:id/void` | `billing.invoices.manage` | Voids an unpaid invoice with mandatory reason. Invoices with recorded payments cannot be voided without prior payment reversal. |
| `GET` | `/api/v1/billing/invoices/:id/audit-history` | `billing.read` | Returns chronological audit events for the invoice lifecycle. |
| `GET` | `/api/v1/billing/invoices/aging-report` | `billing.reports.read` | Computes accounts receivable aging buckets: Current, 1-30, 31-60, 61-90, and >90 days overdue. |

#### 2.3 Payment Receipt API (`/api/v1/billing/receipts`)
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/billing/receipts` | `billing.read` | Lists recorded payment receipts with date range and customer filters. |
| `POST` | `/api/v1/billing/receipts` | `billing.receipts.record` | Records a payment receipt and reconciles against allocated invoices. Idempotency key deduplication returns HTTP 200 on retry. |
| `GET` | `/api/v1/billing/receipts/:id` | `billing.read` | Retrieves receipt details with invoice allocations. |
| `POST` | `/api/v1/billing/receipts/:id/reverse` | `billing.receipts.reverse` | Reverses a payment receipt with mandatory reason, restores outstanding invoice balances, and posts general ledger reversals. |
| `GET` | `/api/v1/billing/receipts/:id/audit-history` | `billing.read` | Retrieves audit history for payment receipts. |

#### 2.4 Driver Settlement API (`/api/v1/settlements`)
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/settlements` | `billing.settlements.read` | Lists driver settlements with driver and pay period filtering. |
| `POST` | `/api/v1/settlements/calculate` | `billing.settlements.manage` | Calculates a draft settlement for a driver and date window. Prevents overlapping active settlement runs with HTTP 409. |
| `GET` | `/api/v1/settlements/:id` | `billing.settlements.read` | Retrieves itemized settlement breakdown including linked shifts and dispatches. |
| `POST` | `/api/v1/settlements/:id/review` | `billing.settlements.manage` | Appends review verification to settlement audit log. |
| `POST` | `/api/v1/settlements/:id/approve` | `billing.settlements.manage` | Formally approves settlement for disbursement. |
| `POST` | `/api/v1/settlements/:id/pay` | `billing.settlements.manage` | Marks settlement as `PAID` with disbursement reference and posts payroll expense journal entries. |
| `POST` | `/api/v1/settlements/:id/reverse` | `billing.settlements.manage` | Reverses settlement payment payout back to `APPROVED` status with mandatory reason. |
| `GET` | `/api/v1/settlements/:id/audit-history` | `billing.settlements.read` | Retrieves settlement audit history. |

---

### 3. General Ledger Integration Strategy

Every monetary API automatically interfaces with `FinancialLedgerService`:
1. **Invoice Generated/Issued:** Debits Accounts Receivable (`1100`) and Credits Freight Revenue (`4010`).
2. **Payment Receipt Recorded:** Debits Operating Cash (`1010`) and Credits Accounts Receivable (`1100`).
3. **Payment Receipt Reversed:** Counter-entry Debits Accounts Receivable (`1100`) and Credits Operating Cash (`1010`).
4. **Driver Settlement Paid:** Debits Driver Compensation Expense (`5010`) and Credits Operating Cash (`1010`).

All journal postings are idempotent and protected by compound uniqueness on `{ organizationId: 1, idempotencyKey: 1 }`.
