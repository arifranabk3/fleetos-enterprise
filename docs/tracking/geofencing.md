# Geofencing Engine & Circular/Polygon Boundaries

## Overview
FleetOS provides native, organization-scoped geofencing capabilities supporting circular zones (e.g., carrier logistics hubs, terminals, and fuel stops) and polygonal restricted corridors.

## Mathematical Evaluation Algorithms
1. **Haversine Distance Model (Circular Geofences)**:
   Calculates great-circle distance between vehicle coordinate and geofence center point in meters:
   $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1\cos\phi_2\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
2. **Ray-Casting Algorithm (Polygon Geofences)**:
   Point-in-polygon ray casting determining boundary penetration across arbitrary irregular multi-coordinate polygons.
3. **Alert Deduplication**:
   Enforces a 10-minute cooldown window per vehicle/geofence pair to prevent alert flooding during maneuvers inside hubs.
