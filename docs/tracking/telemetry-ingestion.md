# Telemetry Ingestion Pipeline & Contracts

## Endpoints
`POST /api/v1/telemetry/ingest`
- **Required Permission**: `TRACKING:CREATE`
- **Payload Contract**:
```json
{
  "vehicleId": "60c72b2f9b1d8b2bad705123",
  "latitude": 32.7767,
  "longitude": -96.7970,
  "speedKmh": 78,
  "headingDeg": 180,
  "altitudeMeters": 140,
  "accuracyMeters": 3.5,
  "odometerKm": 45200,
  "engineStatus": "RUNNING",
  "source": "SIMULATED",
  "recordedAt": "2026-11-11T08:30:00.000Z"
}
```

## Ingestion Safeguards
1. **Latitude/Longitude Range Bounds**: Strictly limited to valid planetary ranges (-90 to 90 lat, -180 to 180 lon).
2. **Speed & Heading Sanity**: Speed capped at realistic commercial limit (0-250 km/h), heading (0-360 deg).
3. **Stale Location Guard**: Older device timestamps cannot overwrite newer vehicle positions.
4. **Source Tagging**: Explicit tag (`SIMULATED` vs `HARDWARE_GPS`) ensuring transparency across UI representations.
