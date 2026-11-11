# FleetOS Database ERD & Entity Relationships

```
                     ┌───────────────────────┐
                     │     Organization      │
                     ├───────────────────────┤
                     │ _id: ObjectId         │
                     │ name: String          │
                     │ slug: String (unique) │
                     │ plan: String          │
                     │ status: String        │
                     └───────────┬───────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │ 1..*                  │ 1..*                  │ 1..*
         ▼                       ▼                       ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│       User       │    │     Vehicle      │    │      Driver      │
├──────────────────┤    ├──────────────────┤    ├──────────────────┤
│ _id: ObjectId    │    │ _id: ObjectId    │    │ _id: ObjectId    │
│ organizationId   │    │ organizationId   │    │ organizationId   │
│ email: String    │    │ vin: String      │    │ userId: ObjectId │
│ role: UserRole   │    │ plateNumber      │    │ licenseNumber    │
│ status: String   │    │ status: Status   │    │ status: Status   │
└──────────────────┘    └────────┬─────────┘    └────────┬─────────┘
                                 │                       │
                                 └───────────┬───────────┘
                                             │ Assigned
                                             ▼
                                ┌─────────────────────────┐
                                │        Shipment         │
                                ├─────────────────────────┤
                                │ _id: ObjectId           │
                                │ organizationId          │
                                │ trackingNumber (unique) │
                                │ vehicleId: ObjectId     │
                                │ driverId: ObjectId      │
                                │ status: ShipmentStatus  │
                                │ origin / destination    │
                                │ proofOfDelivery: Object │
                                └────────────┬────────────┘
                                             │
                                             ▼
                                ┌─────────────────────────┐
                                │      TelemetryEvent     │
                                ├─────────────────────────┤
                                │ _id: ObjectId           │
                                │ organizationId          │
                                │ vehicleId: ObjectId     │
                                │ location: GeoPoint      │
                                │ speed, heading          │
                                │ timestamp: Date         │
                                └─────────────────────────┘
```
