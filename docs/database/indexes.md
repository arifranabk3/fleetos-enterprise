# FleetOS Database Indexing Directory

## 1. Multi-Tenant Compound Indexes
Every collection containing tenant-scoped data enforces compound indexes where `organizationId` is the leading prefix.

| Collection | Index Fields | Type | Purpose |
|---|---|---|---|
| **`organizations`** | `{ slug: 1 }` | Unique | Tenant subdomain/slug lookup |
| **`users`** | `{ organizationId: 1, email: 1 }` | Unique | Prevents duplicate work emails in the same carrier |
| **`organization_members`**| `{ organizationId: 1, userId: 1 }` | Unique | Enforces 1 active membership per organization |
| **`vehicles`** | `{ organizationId: 1, plateNumber: 1 }` | Unique | Vehicle registration identifier per tenant |
| **`vehicles`** | `{ organizationId: 1, vin: 1 }` | Unique | Commercial VIN per tenant |
| **`drivers`** | `{ organizationId: 1, licenseNumber: 1 }`| Unique | CDL uniqueness within organization |
| **`drivers`** | `{ organizationId: 1, userId: 1 }` | Unique | User to driver profile link |
| **`shipments`** | `{ organizationId: 1, trackingNumber: 1 }`| Unique | Tenant freight tracking reference |
| **`shipments`** | `{ trackingNumber: 1 }` | Sparse Index | Public customer tracking portal lookup |
| **`dispatches`** | `{ organizationId: 1, dispatchNumber: 1 }`| Unique | Dispatch manifest identifier |
| **`telemetry_events`** | `{ organizationId: 1, vehicleId: 1, timestamp: -1 }` | Compound Descending | High-frequency telemetry time-series query |
| **`maintenances`** | `{ organizationId: 1, vehicleId: 1, performedAt: -1 }`| Compound Descending | Asset maintenance history |
| **`expenses`** | `{ organizationId: 1, category: 1, incurredAt: -1 }` | Compound Descending | Fuel & expense aggregation |
| **`invoices`** | `{ organizationId: 1, invoiceNumber: 1 }` | Unique | Invoicing reference per organization |
| **`notifications`** | `{ organizationId: 1, recipientUserId: 1, isRead: 1 }` | Compound | Fast unread notification fetch |
| **`audit_logs`** | `{ organizationId: 1, timestamp: -1 }` | Compound Descending | Security compliance chronological audit |

