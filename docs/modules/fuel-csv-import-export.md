# FleetOS — CSV Import & Export Strategy

## 1. Overview
The Fuel CSV Service provides high-throughput, organization-isolated batch processing for fleet fueling records. It implements strict validation, formula injection protection, duplicate suppression, and audit trail logging.

## 2. CSV Import Endpoint
`POST /api/v1/fuel/import-csv`

### Request Body:
```json
{
  "csvData": "Transaction Reference,Plate Number,Quantity,Price,Odometer,Date,Fuel Type,Is Full Tank\nTX-101,FLT-8890,350,1.25,103600,2026-11-09,DIESEL,true",
  "previewOnly": false
}
```

### Security & Integrity Controls:
1. **Formula Injection Sanitization:** Inputs beginning with `=`, `+`, `-`, or `@` are safely escaped with a leading apostrophe (`'`).
2. **Entity Validation:** Validates that plate numbers exist and belong strictly to `req.tenant.organizationId`.
3. **Idempotent Insertion:** Existing references within the tenant are recorded as duplicates and skipped without failing the entire batch.
4. **Expense Generation:** Every imported row triggers `FuelExpenseSyncService` to establish a synchronized expense ledger entry.

## 3. CSV Export Endpoint
`GET /api/v1/fuel/export-csv`
- Filters by `vehicleId`, `driverId`, `fuelType`, `startDate`, `endDate`.
- Returns streaming `text/csv` with `Content-Disposition: attachment; filename="fuel-transactions-YYYY-MM-DD.csv"`.
- All fields are escaped against formula injection.
