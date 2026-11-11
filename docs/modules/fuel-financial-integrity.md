# FleetOS — Fuel Financial Integrity & Expense Synchronization

## 1. Zero Duplicate Ledger Invariant
Every non-voided `FuelTransaction` corresponds to exactly one `Expense` entry with `category: 'FUEL'`.

### Safeguards:
1. **Compound Sparse Unique Index:**
   ```typescript
   ExpenseSchema.index(
     { organizationId: 1, fuelTransactionId: 1 },
     { unique: true, sparse: true }
   );
   ```
   Enforces at the database engine level that no organization can possess multiple expenses referencing the same fuel transaction.

2. **Idempotent Upsert Logic (`FuelExpenseSyncService.syncFuelExpense`):**
   - Queries `Expense.findOne({ organizationId, fuelTransactionId })`.
   - If found, performs an in-place mutation of amounts, dates, and odometer readings.
   - If not found, creates the expense and saves `expenseId` back onto the transaction.

3. **Void Synchronization (`FuelExpenseSyncService.voidFuelExpense`):**
   - When a fuel transaction is voided, the linked expense is updated with `isVoided: true`, recording the operational justification without destroying historical audit trails.
