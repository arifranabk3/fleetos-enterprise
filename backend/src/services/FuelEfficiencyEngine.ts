import { FuelTransaction, IFuelTransaction } from '../models/FuelTransaction';
import { Vehicle } from '../models/Vehicle';

export interface FuelEfficiencyResult {
  previousOdometer?: number;
  distanceTravelled?: number;
  fuelEfficiency?: number; // km/L or km/kWh
  efficiencyStatus: 'VERIFIED' | 'ESTIMATED' | 'UNAVAILABLE';
  calculationMethod: 'FULL_TO_FULL' | 'INTERMEDIATE_PARTIAL' | 'EV_CHARGING_SESSION' | 'MANUAL_BASELINE';
  reason?: string;
}

export class FuelEfficiencyEngine {
  /**
   * Calculate fuel efficiency for a new or updated fuel transaction using full-to-full methodology.
   *
   * For Liquid Fuel:
   * 1. If this is a full-tank refuel (isFullTank === true):
   *    - Find the most recent prior non-voided FULL_TANK transaction as starting boundary.
   *    - If found:
   *      - Sum all intervening partial refuels plus current full refuel.
   *      - distance = currentOdometer - priorFullTank.odometerReading.
   *      - efficiency = distance / totalLiters.
   *      - Status: VERIFIED (meets full-to-full measurement criteria).
   *    - If no prior full-tank exists:
   *      - Baseline established. Status: UNAVAILABLE.
   * 2. If this is a partial refuel (isFullTank === false):
   *    - Cannot compute verified tank-to-tank efficiency yet because remaining fuel is unknown.
   *    - Calculate intermediate estimated efficiency against immediate prior refuel:
   *      - Status: ESTIMATED (tagged INTERMEDIATE_PARTIAL to prevent polluting verified fleet averages).
   *
   * For Electric Vehicles (EV):
   * - Charging sessions deliver measured energy (kWh).
   * - Computes distance / kWh consumed.
   * - Method: EV_CHARGING_SESSION, Status: VERIFIED (or ESTIMATED if partial battery level).
   */
  public static async calculateTransactionEfficiency(
    organizationId: string,
    vehicleId: string,
    currentOdometer: number,
    quantity: number,
    fuelType: string,
    transactionDate: Date,
    isFullTank: boolean = true
  ): Promise<FuelEfficiencyResult> {
    // 1. Guard against non-positive fuel quantity
    if (!quantity || quantity <= 0) {
      return {
        efficiencyStatus: 'UNAVAILABLE',
        calculationMethod: 'MANUAL_BASELINE',
        reason: 'Quantity must be greater than zero to calculate efficiency.',
      };
    }

    // 2. Fetch the immediate prior valid transaction (for odometer rollback & distance checks)
    const immediatePriorTx = await FuelTransaction.findOne({
      organizationId,
      vehicleId,
      isVoided: false,
      transactionDate: { $lt: transactionDate },
    })
      .sort({ transactionDate: -1, odometerReading: -1 })
      .lean();

    if (!immediatePriorTx) {
      return {
        previousOdometer: undefined,
        distanceTravelled: undefined,
        fuelEfficiency: undefined,
        efficiencyStatus: 'UNAVAILABLE',
        calculationMethod: 'MANUAL_BASELINE',
        reason: 'Initial baseline refuel established. Efficiency will calculate on subsequent refuel cycles.',
      };
    }

    const prevOdometer = immediatePriorTx.odometerReading;

    // 3. Decreasing odometer check (Anomaly / rollback detection)
    if (currentOdometer < prevOdometer) {
      return {
        previousOdometer: prevOdometer,
        distanceTravelled: currentOdometer - prevOdometer,
        fuelEfficiency: undefined,
        efficiencyStatus: 'UNAVAILABLE',
        calculationMethod: 'MANUAL_BASELINE',
        reason: `Decreasing odometer reading detected (Current: ${currentOdometer} km < Previous: ${prevOdometer} km).`,
      };
    }

    const immediateDistance = currentOdometer - prevOdometer;

    // 4. Consecutive zero-distance check
    if (immediateDistance === 0) {
      return {
        previousOdometer: prevOdometer,
        distanceTravelled: 0,
        fuelEfficiency: 0,
        efficiencyStatus: 'ESTIMATED',
        calculationMethod: 'INTERMEDIATE_PARTIAL',
        reason: 'Zero distance recorded since previous refuel (consecutive top-off).',
      };
    }

    // 5. Electric Vehicle (EV) Specialization
    if (fuelType === 'ELECTRIC') {
      const evEff = immediateDistance / quantity;
      return {
        previousOdometer: prevOdometer,
        distanceTravelled: immediateDistance,
        fuelEfficiency: Math.round(evEff * 100) / 100,
        efficiencyStatus: isFullTank ? 'VERIFIED' : 'ESTIMATED',
        calculationMethod: 'EV_CHARGING_SESSION',
        reason: 'Electric vehicle kWh consumption calculated.',
      };
    }

    // 6. Liquid Fuel: Full-Tank vs Partial-Tank Logic
    if (isFullTank) {
      // Find the most recent prior FULL_TANK transaction to form the complete boundary
      const priorFullTankTx = await FuelTransaction.findOne({
        organizationId,
        vehicleId,
        isVoided: false,
        isFullTank: true,
        transactionDate: { $lt: transactionDate },
      })
        .sort({ transactionDate: -1, odometerReading: -1 })
        .lean();

      if (priorFullTankTx) {
        // Collect all intervening partial refuels strictly between priorFullTankTx and current transaction
        const interveningPartials = await FuelTransaction.find({
          organizationId,
          vehicleId,
          isVoided: false,
          transactionDate: {
            $gt: priorFullTankTx.transactionDate,
            $lt: transactionDate,
          },
        }).lean();

        let totalInterveningLiters = 0;
        for (const p of interveningPartials) {
          totalInterveningLiters += p.quantityLiters;
        }

        const totalLitersInCycle = totalInterveningLiters + quantity;
        const totalCycleDistance = currentOdometer - priorFullTankTx.odometerReading;

        if (totalLitersInCycle > 0 && totalCycleDistance > 0) {
          const verifiedKmL = totalCycleDistance / totalLitersInCycle;
          return {
            previousOdometer: priorFullTankTx.odometerReading,
            distanceTravelled: totalCycleDistance,
            fuelEfficiency: Math.round(verifiedKmL * 100) / 100,
            efficiencyStatus: 'VERIFIED',
            calculationMethod: 'FULL_TO_FULL',
            reason: `Full-to-full cycle verified across ${interveningPartials.length} partial refuel(s).`,
          };
        }
      }
    }

    // If partial refuel or no prior full-tank boundary exists yet:
    // Compute estimated interim efficiency against immediate refuel
    const interimEfficiency = immediateDistance / quantity;
    return {
      previousOdometer: prevOdometer,
      distanceTravelled: immediateDistance,
      fuelEfficiency: Math.round(interimEfficiency * 100) / 100,
      efficiencyStatus: 'ESTIMATED',
      calculationMethod: isFullTank ? 'FULL_TO_FULL' : 'INTERMEDIATE_PARTIAL',
      reason: isFullTank
        ? 'First full-tank refuel boundary established.'
        : 'Partial refuel logged. Efficiency marked as ESTIMATED pending full-tank boundary.',
    };
  }

  /**
   * Derive rolling fleet efficiency metrics for a vehicle, strictly separating
   * VERIFIED full-to-full cycles from unverified partial refuels.
   */
  public static async calculateVehicleRollingEfficiency(
    organizationId: string,
    vehicleId: string
  ): Promise<{
    totalDistance: number;
    totalFuel: number;
    averageEfficiency: number;
    verifiedCount: number;
    estimatedCount: number;
  }> {
    const verifiedRecords = await FuelTransaction.find({
      organizationId,
      vehicleId,
      isVoided: false,
      efficiencyStatus: 'VERIFIED',
    }).lean();

    const estimatedRecords = await FuelTransaction.find({
      organizationId,
      vehicleId,
      isVoided: false,
      efficiencyStatus: 'ESTIMATED',
    }).lean();

    let totalDistance = 0;
    let totalFuel = 0;

    for (const r of verifiedRecords) {
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
      verifiedCount: verifiedRecords.length,
      estimatedCount: estimatedRecords.length,
    };
  }
}
