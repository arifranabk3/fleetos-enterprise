import { FuelTransaction, IFuelTransaction } from '../models/FuelTransaction';
import { Vehicle, IVehicle } from '../models/Vehicle';

export interface FuelEfficiencyResult {
  previousOdometer?: number;
  distanceTravelled?: number;
  fuelEfficiency?: number; // km/L or km/kWh
  efficiencyStatus: 'CALCULATED' | 'ESTIMATED' | 'UNAVAILABLE';
  reason?: string;
}

export class FuelEfficiencyEngine {
  /**
   * Calculate fuel efficiency for a new or updated fuel transaction.
   * Compares current verified odometer against the most recent prior refuel event.
   * Handles liquid fuels (km/L) and EV (km/kWh).
   */
  public static async calculateTransactionEfficiency(
    organizationId: string,
    vehicleId: string,
    currentOdometer: number,
    quantity: number,
    fuelType: string,
    transactionDate: Date
  ): Promise<FuelEfficiencyResult> {
    // 1. Guard against non-positive fuel quantity
    if (!quantity || quantity <= 0) {
      return {
        efficiencyStatus: 'UNAVAILABLE',
        reason: 'Quantity must be greater than zero to calculate efficiency.',
      };
    }

    // 2. Fetch the most recent prior valid (non-voided) fuel transaction for this vehicle
    const previousTx = await FuelTransaction.findOne({
      organizationId,
      vehicleId,
      isVoided: false,
      transactionDate: { $lt: transactionDate },
    })
      .sort({ transactionDate: -1, odometerReading: -1 })
      .lean();

    if (!previousTx) {
      // First recorded refuel for vehicle in system: establishes initial baseline odometer
      return {
        previousOdometer: undefined,
        distanceTravelled: undefined,
        fuelEfficiency: undefined,
        efficiencyStatus: 'UNAVAILABLE',
        reason: 'Initial baseline refuel established. Efficiency will calculate on next refuel.',
      };
    }

    const prevOdometer = previousTx.odometerReading;

    // 3. Decreasing odometer check (Anomaly / rollback detection)
    if (currentOdometer < prevOdometer) {
      return {
        previousOdometer: prevOdometer,
        distanceTravelled: currentOdometer - prevOdometer,
        fuelEfficiency: undefined,
        efficiencyStatus: 'UNAVAILABLE',
        reason: `Decreasing odometer reading detected (Current: ${currentOdometer} km < Previous: ${prevOdometer} km).`,
      };
    }

    const distance = currentOdometer - prevOdometer;

    // 4. Zero distance refuel check (e.g. repeated top-up at same location without trip)
    if (distance === 0) {
      return {
        previousOdometer: prevOdometer,
        distanceTravelled: 0,
        fuelEfficiency: 0,
        efficiencyStatus: 'ESTIMATED',
        reason: 'Zero distance recorded since previous refuel (consecutive top-off).',
      };
    }

    // 5. Standard calculation: Distance / Quantity
    // Liquid Fuel -> km/L, Electric -> km/kWh
    const rawEfficiency = distance / quantity;
    const roundedEfficiency = Math.round(rawEfficiency * 100) / 100;

    return {
      previousOdometer: prevOdometer,
      distanceTravelled: distance,
      fuelEfficiency: roundedEfficiency,
      efficiencyStatus: 'CALCULATED',
    };
  }

  /**
   * Derive rolling fleet efficiency metrics for a vehicle across historical transactions
   */
  public static async calculateVehicleRollingEfficiency(
    organizationId: string,
    vehicleId: string
  ): Promise<{
    totalDistance: number;
    totalFuel: number;
    averageEfficiency: number;
    calculatedCount: number;
  }> {
    const records = await FuelTransaction.find({
      organizationId,
      vehicleId,
      isVoided: false,
      efficiencyStatus: 'CALCULATED',
    }).lean();

    let totalDistance = 0;
    let totalFuel = 0;

    for (const r of records) {
      if (r.distanceSinceLastRefuel && r.quantityLiters) {
        totalDistance += r.distanceSinceLastRefuel;
        totalFuel += r.quantityLiters;
      }
    }

    const averageEfficiency =
      totalFuel > 0 ? Math.round((totalDistance / totalFuel) * 100) / 100 : 0;

    return {
      totalDistance,
      totalFuel: Math.round(totalFuel * 100) / 100,
      averageEfficiency,
      calculatedCount: records.length,
    };
  }
}
