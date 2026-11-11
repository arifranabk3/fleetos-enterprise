import { TelemetryAlert, AlertSeverity } from '../models/TelemetryAlert';
import { SocketService } from './SocketService';

export interface TelemetryMetrics {
  vehicleId: string;
  plateNumber: string;
  speedKmh: number;
  motionStatus: 'MOVING' | 'IDLE' | 'STOPPED' | 'OFFLINE';
  source: 'SIMULATED' | 'HARDWARE_GPS';
}

export class TelemetryAlertEngine {
  private static readonly OVERSPEED_THRESHOLD_KMH = 105; // ~65 mph for commercial trucks

  public static async processAlerts(
    organizationId: string,
    metrics: TelemetryMetrics
  ): Promise<void> {
    const { vehicleId, plateNumber, speedKmh, source } = metrics;

    // 1. Overspeeding Alert Check
    if (speedKmh > TelemetryAlertEngine.OVERSPEED_THRESHOLD_KMH) {
      // Deduplicate: check if an overspeeding alert was generated in the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentAlert = await TelemetryAlert.findOne({
        organizationId,
        vehicleId,
        type: 'OVERSPEEDING',
        timestamp: { $gte: fiveMinutesAgo },
      });

      if (!recentAlert) {
        const alert = await TelemetryAlert.create({
          organizationId,
          vehicleId,
          type: 'OVERSPEEDING',
          severity: 'WARNING',
          title: `Overspeeding Alert: ${plateNumber}`,
          message: `Vehicle ${plateNumber} exceeded speed limit at ${Math.round(speedKmh)} km/h.`,
          source,
          metadata: {
            speedKmh,
            thresholdKmh: TelemetryAlertEngine.OVERSPEED_THRESHOLD_KMH,
          },
        });

        SocketService.broadcastAlert(organizationId, alert);
      }
    }
  }
}
