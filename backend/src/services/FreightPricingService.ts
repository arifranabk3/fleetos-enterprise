import { Types } from 'mongoose';
import { RateMatrix, IRateMatrix } from '../models/RateMatrix';
import { ITenantContext } from '../repositories/BaseTenantRepository';
import { MonetaryPrecision } from '../utils/MonetaryPrecision';

export interface RateCalculationInput {
  customerId?: Types.ObjectId;
  distanceKm: number;
  weightKg?: number;
  vehicleCategory?: 'VAN' | 'BOX_TRUCK' | 'SEMI_TRUCK' | 'FLATBED' | 'REFRIGERATED' | 'TANKER' | 'OTHER';
  cargoCategory?: 'GENERAL' | 'PERISHABLE' | 'HAZARDOUS' | 'ELECTRONICS' | 'FRAGILE' | 'HEAVY_EQUIPMENT';
  waitingHours?: number;
  appliedDate?: Date;
  fuelIndexMultiplier?: number; // Optional fuel surcharge multiplier
}

export interface RateCalculationBreakdown {
  rateMatrixId: Types.ObjectId;
  rateCode: string;
  version: number;
  pricingModel: string;
  currency: string;
  baseFeeCents: number;
  distanceChargeCents: number;
  weightChargeCents: number;
  waitingChargeCents: number;
  subtotalCents: number;
  fuelSurchargeCents: number;
  fuelSurchargePercent: number;
  totalCents: number;
}

export class FreightPricingService {
  /**
   * Resolves the most specific active rate matrix for a given customer and organization.
   * Priority: Customer-specific active rate > Fleet-wide active default rate.
   */
  static async resolveActiveRate(
    tenant: ITenantContext,
    customerId?: Types.ObjectId,
    vehicleCategory?: string,
    cargoCategory?: string,
    appliedDate: Date = new Date()
  ): Promise<IRateMatrix | null> {
    const orgId = typeof tenant.organizationId === 'string' ? new Types.ObjectId(tenant.organizationId) : tenant.organizationId;

    const baseFilter = {
      organizationId: orgId,
      status: 'ACTIVE',
      isArchived: false,
      effectiveFrom: { $lte: appliedDate },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: appliedDate } }],
    };

    // 1. Attempt customer-specific rate matrix
    if (customerId) {
      const customerRate = await RateMatrix.findOne({
        ...baseFilter,
        customerId,
        ...(vehicleCategory ? { vehicleCategory } : {}),
        ...(cargoCategory ? { cargoCategory } : {}),
      }).sort({ version: -1 });

      if (customerRate) return customerRate;
    }

    // 2. Fall back to organization default rate matrix (customerId === null)
    const defaultRate = await RateMatrix.findOne({
      ...baseFilter,
      customerId: null,
      ...(vehicleCategory ? { vehicleCategory } : {}),
      ...(cargoCategory ? { cargoCategory } : {}),
    }).sort({ version: -1 });

    return defaultRate;
  }

  /**
   * Deterministically calculates freight price for a shipment based on an active rate matrix.
   */
  static calculatePrice(
    rateMatrix: IRateMatrix,
    input: RateCalculationInput
  ): RateCalculationBreakdown {
    const distanceKm = Math.max(0, input.distanceKm || 0);
    const weightKg = Math.max(0, input.weightKg || 0);
    const waitingHours = Math.max(0, input.waitingHours || 0);

    let baseFeeCents = rateMatrix.baseFeeCents;
    let distanceChargeCents = Math.round(distanceKm * rateMatrix.perKmRateCents);
    let weightChargeCents = Math.round(weightKg * rateMatrix.perKgRateCents);
    let waitingChargeCents = Math.round(waitingHours * (rateMatrix.waitingTimeRatePerHourCents || 0));

    // Handle tiered pricing if configured
    if (rateMatrix.tiers && rateMatrix.tiers.length > 0) {
      for (const tier of rateMatrix.tiers) {
        const matchesDistance =
          (tier.minDistanceKm === undefined || distanceKm >= tier.minDistanceKm) &&
          (tier.maxDistanceKm === undefined || distanceKm <= tier.maxDistanceKm);

        const matchesWeight =
          (tier.minWeightKg === undefined || weightKg >= tier.minWeightKg) &&
          (tier.maxWeightKg === undefined || weightKg <= tier.maxWeightKg);

        if (matchesDistance && matchesWeight) {
          if (tier.ratePerKmCents !== undefined) {
            distanceChargeCents = Math.round(distanceKm * tier.ratePerKmCents);
          }
          if (tier.ratePerKgCents !== undefined) {
            weightChargeCents = Math.round(weightKg * tier.ratePerKgCents);
          }
          if (tier.flatFeeCents !== undefined) {
            baseFeeCents = tier.flatFeeCents;
          }
          break; // First matching tier applies
        }
      }
    }

    let subtotalCents = baseFeeCents + distanceChargeCents + weightChargeCents + waitingChargeCents;

    // Apply minimum charge constraint
    if (subtotalCents < rateMatrix.minimumChargeCents) {
      subtotalCents = rateMatrix.minimumChargeCents;
    }

    // Fuel surcharge calculation
    const fuelPercent = rateMatrix.fuelSurchargePercent || 0;
    const fuelSurchargeCents = Math.round(subtotalCents * (fuelPercent / 100));

    const totalCents = subtotalCents + fuelSurchargeCents;

    return {
      rateMatrixId: rateMatrix._id as Types.ObjectId,
      rateCode: rateMatrix.code,
      version: rateMatrix.version,
      pricingModel: rateMatrix.pricingModel,
      currency: rateMatrix.currency,
      baseFeeCents,
      distanceChargeCents,
      weightChargeCents,
      waitingChargeCents,
      subtotalCents,
      fuelSurchargeCents,
      fuelSurchargePercent: fuelPercent,
      totalCents,
    };
  }
}
