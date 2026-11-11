import { Geofence, IGeofence } from '../models/Geofence';
import { TelemetryAlert, AlertSeverity } from '../models/TelemetryAlert';
import { SocketService } from './SocketService';

export class GeofenceEngine {
  /**
   * Calculate distance between two coordinate pairs using Haversine Formula (returns meters)
   */
  public static calculateDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Point-in-polygon ray casting algorithm for polygonal geofences
   */
  public static isPointInPolygon(
    latitude: number,
    longitude: number,
    polygon: Array<[number, number]>
  ): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];

      const intersect =
        yi > longitude !== yj > longitude &&
        latitude < ((xj - xi) * (longitude - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Evaluate geofence entry / exit transitions for vehicle telemetry
   */
  public static async evaluateGeofences(
    organizationId: string,
    vehicleId: string,
    plateNumber: string,
    latitude: number,
    longitude: number,
    source: 'SIMULATED' | 'HARDWARE_GPS'
  ): Promise<void> {
    const activeGeofences = await Geofence.find({
      organizationId,
      isActive: true,
    }).lean();

    for (const gf of activeGeofences) {
      let isInside = false;

      if (gf.type === 'CIRCLE' && gf.circleConfig) {
        const dist = GeofenceEngine.calculateDistanceMeters(
          latitude,
          longitude,
          gf.circleConfig.latitude,
          gf.circleConfig.longitude
        );
        isInside = dist <= gf.circleConfig.radiusMeters;
      } else if (gf.type === 'POLYGON' && gf.polygonCoordinates?.length) {
        isInside = GeofenceEngine.isPointInPolygon(latitude, longitude, gf.polygonCoordinates);
      }

      if (isInside) {
        // Check if recent entry alert already created within 10 minutes to prevent spamming
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const existingAlert = await TelemetryAlert.findOne({
          organizationId,
          vehicleId,
          type: 'GEOFENCE_ENTER',
          'metadata.geofenceId': gf._id,
          timestamp: { $gte: tenMinutesAgo },
        });

        if (!existingAlert) {
          const alert = await TelemetryAlert.create({
            organizationId,
            vehicleId,
            type: 'GEOFENCE_ENTER',
            severity: (gf.category === 'RESTRICTED_ZONE' ? 'CRITICAL' : 'INFO') as AlertSeverity,
            title: `Geofence Entered: ${gf.name}`,
            message: `Vehicle ${plateNumber} entered ${gf.name} (${gf.category}).`,
            source,
            metadata: {
              geofenceId: gf._id,
              geofenceName: gf.name,
              category: gf.category,
              latitude,
              longitude,
            },
          });

          SocketService.broadcastAlert(organizationId, alert);
        }
      }
    }
  }
}
