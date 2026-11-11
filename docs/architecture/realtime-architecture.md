# Real-Time Telemetry & Socket.IO Architecture — FleetOS

## 1. Real-Time Telemetry Flow (Mermaid)

```mermaid
sequenceDiagram
    autonumber
    participant Simulator as GPS Telemetry Engine (Background / Device)
    participant SocketServer as Socket.IO Hub (Express API)
    participant Room as Room: org:apex-logistics
    participant Operator as Dispatcher Console (Leaflet Map)
    participant Customer as Customer Portal View

    Simulator->>SocketServer: Emit "telemetry:emit" { vehicleId, lat, lng, speed, isSimulated: true }
    SocketServer->>SocketServer: Validate payload & verify tenant ownership
    SocketServer->>Room: Broadcast "vehicle:location_updated"
    Room->>Operator: Smooth marker translation on Leaflet Map
    opt If vehicle is assigned to active shipment
        SocketServer->>Customer: Broadcast "shipment:location_updated" { shipmentId, lat, lng }
    end
```

---

## 2. Transparent GPS Simulation Policy
- Because production hardware ELD / OBD-II devices are not attached during local evaluations, all simulated coordinates are stamped with:
  `isSimulated: true`
- The user interface explicitly presents an amber pill: **"SIMULATED GPS STREAM"** to adhere to honest engineering standards and avoid misleading claims.

