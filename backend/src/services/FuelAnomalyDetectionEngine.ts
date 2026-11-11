import { FuelTransaction, IFuelTransaction } from '../models/FuelTransaction';
import { Vehicle } from '../models/Vehicle';
import { Notification } from '../models/Notification';

export interface AnomalyEvaluationResult {
  isAnomaly: boolean;
  flags: string[];
  reasons: string[];
  verificationStatus: 'VERIFIED' | 'PENDING_REVIEW' | 'FLAGGED_ANOMALY';
}

export class FuelAnomalyDetectionEngine {
  /**
   * Evaluate fuel transaction against commercial fleet thresholds and vehicle baselines.
   * Categorizes flags into reviewable items without false fraud accusations.
   */
  public static async evaluateTransaction(
    organizationId: string,
    vehicleId: string,
    quantity: number,
    totalCost: number,
    odometer: number,
    fuelEfficiency?: number,
    transactionDate: Date = new Date()
  ): Promise<AnomalyEvaluationResult> {
    const flags: string[] = [];
    const reasons: string[] = [];

    const vehicle = await Vehicle.findById(vehicleId).lean();
    if (!vehicle) {
      return {
        isAnomaly: false,
        flags: [],
        reasons: [],
        verificationStatus: 'VERIFIED',
      };
    }

    // 1. Vehicle Tank Capacity Threshold Check
    // Typical semi-truck diesel tank: 400 - 1200 Liters, Box Truck: 150 - 300 Liters, Van: 70 - 120 Liters
    const maxCapacity =
      vehicle.type === 'SEMI_TRUCK'
        ? 1200
        : vehicle.type === 'BOX_TRUCK'
        ? 400
        : vehicle.type === 'FLATBED'
        ? 600
        : 150; // CARGO_VAN

    if (quantity > maxCapacity) {
      flags.push('EXCESSIVE_QUANTITY');
      reasons.push(
        `Quantity (${quantity} L/kWh) exceeds physical vehicle capacity estimate (${maxCapacity} L/kWh).`
      );
    }

    // 2. Refuelling while vehicle recorded as OUT_OF_SERVICE or RETIRED
    if (vehicle.status === 'OUT_OF_SERVICE' || vehicle.status === 'RETIRED') {
      flags.push('INACTIVE_VEHICLE_REFUEL');
      reasons.push(
        `Refuel recorded for vehicle currently in ${vehicle.status} status.`
      );
    }

    // 3. Efficiency Degradation Check
    // Baseline for semi-trucks: 2.5 - 4.5 km/L. Box trucks: 4.0 - 7.0 km/L. Vans: 7.0 - 12.0 km/L.
    if (fuelEfficiency !== undefined && fuelEfficiency > 0) {
      const historicalStats = await FuelTransaction.aggregate([
        {
          $match: {
            organizationId: vehicle.organizationId,
            vehicleId: vehicle._id,
            efficiencyStatus: 'CALCULATED',
            isVoided: false,
          },
        },
        {
          $group: {
            _id: null,
            avgEff: { $avg: '$fuelEfficiency' },
          },
        },
      ]);

      if (historicalStats.length > 0 && historicalStats[0].avgEff > 0) {
        const baseline = historicalStats[0].avgEff;
        // If efficiency dropped by more than 40% below historical baseline
        if (fuelEfficiency < baseline * 0.6) {
          flags.push('LOW_EFFICIENCY_DEVIATION');
          reasons.push(
            `Efficiency (${fuelEfficiency} km/L) is >40% below vehicle historical baseline (${Math.round(baseline * 100) / 100} km/L).`
          );
        }
      }
    }

    // 4. Duplicate Transaction Detection
    // Check if another transaction with same vehicle, exact same quantity, and within 30 minutes exists
    const thirtyMinutes = 30 * 60 * 1000;
    const duplicateCandidate = await FuelTransaction.findOne({
      organizationId,
      vehicleId,
      quantityLiters: quantity,
      isVoided: false,
      transactionDate: {
        $gte: new Date(transactionDate.getTime() - thirtyMinutes),
        $lte: new Date(transactionDate.getTime() + thirtyMinutes),
      },
    }).lean();

    if (duplicateCandidate) {
      flags.push('POTENTIAL_DUPLICATE_TRANSACTION');
      reasons.push(
        `Potential duplicate refuel: Identical quantity (${quantity} L) logged within 30 minutes.`
      );
    }

    // 5. Odometer Inconsistency
    if (vehicle.odometerKm && odometer < vehicle.odometerKm) {
      flags.push('ODOMETER_ROLLBACK');
      reasons.push(
        `Odometer reading (${odometer} km) is lower than vehicle current odometer (${vehicle.odometerKm} km).`
      );
    }

    const isAnomaly = flags.length > 0;
    const verificationStatus: 'VERIFIED' | 'PENDING_REVIEW' | 'FLAGGED_ANOMALY' = isAnomaly
      ? flags.includes('EXCESSIVE_QUANTITY') || flags.includes('INACTIVE_VEHICLE_REFUEL')
        ? 'FLAGGED_ANOMALY'
        : 'PENDING_REVIEW'
      : 'VERIFIED';

    return {
      isAnomaly,
      flags,
      reasons,
      verificationStatus,
    };
  }

  /**
   * Emit idempotent, deduplicated organization notification for flagged anomalies
   */
  public static async notifyIfAnomaly(
    organizationId: string,
    transactionId: string,
    vehiclePlateNumber: string,
    flags: string[],
    reasons: string[]
  ): Promise<void> {
    if (flags.length === 0) return;

    // 24hr cooldown deduplication check
    const existingNotification = await Notification.findOne({
      organizationId,
      type: 'FUEL_ANOMALY',
      'metadata.transactionId': transactionId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    if (!existingNotification) {
      await Notification.create({
        organizationId,
        type: 'FUEL_ANOMALY',
        title: `Fuel Anomaly Detected: ${vehiclePlateNumber}`,
        message: `Vehicle ${vehiclePlateNumber} flagged with: ${flags.join(', ')}. Details: ${reasons.join(' ')}`,
        metadata: {
          transactionId,
          flags,
          reasons,
          requiresReview: true,
        },
      });
    }
  }
}
