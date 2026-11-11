# Order Management Module

## Lifecycle Overview
The **Order Management Module** handles the commercial and freight lifecycle of incoming shipping requests prior to physical vehicle assignment.

## Order Workflows
1. **Quotation & Commercial Capture**:
   - Quoted freight charges in carrier default currency (USD).
   - Delivery priority tiers:
     - `STANDARD`: Normal hub-and-spoke transit time.
     - `EXPRESS`: Expedited highway routing.
     - `URGENT`: Guaranteed next-day transit window.
     - `SAME_DAY`: Dedicated asset direct-haul.
2. **Consignee Validation**:
   - Strict sender and receiver addresses, geographic coordinates (latitude, longitude), and direct contact telephone numbers for delivery notifications.
3. **Draft to Confirmed Transition**:
   - Carrier dispatchers review order weight and dimensions against available trailer payload capacities.
   - Upon commercial agreement, dispatcher confirms order (`status: CONFIRMED`), making it instantly eligible for inclusion in dispatch manifests.
