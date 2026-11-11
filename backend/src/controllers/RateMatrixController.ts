import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { RateMatrix } from '../models/RateMatrix';
import { FreightPricingService } from '../services/FreightPricingService';
import { CreateRateMatrixSchema } from '../validators/financialValidators';

export class RateMatrixController {
  /**
   * GET /api/v1/billing/rates
   * List rate matrices with filtering and pagination.
   */
  static async listRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { customerId, status, vehicleCategory, cargoCategory, page = 1, limit = 20 } = req.query;

      const filter: any = { organizationId: orgId, isArchived: false };
      if (customerId) filter.customerId = new Types.ObjectId(customerId as string);
      if (status) filter.status = status;
      if (vehicleCategory) filter.vehicleCategory = vehicleCategory;
      if (cargoCategory) filter.cargoCategory = cargoCategory;

      const skip = (Number(page) - 1) * Number(limit);
      const [rates, total] = await Promise.all([
        RateMatrix.find(filter)
          .sort({ effectiveFrom: -1, version: -1 })
          .skip(skip)
          .limit(Number(limit))
          .populate('customerId', 'name email'),
        RateMatrix.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          rates,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/billing/rates
   * Create a new rate matrix.
   */
  static async createRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const userId = new Types.ObjectId(req.tenant!.userId);

      const parsed = CreateRateMatrixSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid rate matrix parameters',
            details: parsed.error.format(),
          },
        });
      }

      const data = parsed.data;

      // Check for code uniqueness within organization
      const existing = await RateMatrix.findOne({
        organizationId: orgId,
        code: data.code.toUpperCase(),
        version: 1,
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'RATE_CODE_CONFLICT',
            message: `A rate matrix with code '${data.code}' already exists. Use versioning to update rates.`,
          },
        });
      }

      const rateMatrix = await RateMatrix.create({
        organizationId: orgId,
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description,
        customerId: data.customerId ? new Types.ObjectId(data.customerId) : null,
        status: 'ACTIVE',
        version: 1,
        pricingModel: data.pricingModel,
        currency: data.currency.toUpperCase(),
        vehicleCategory: data.vehicleCategory,
        cargoCategory: data.cargoCategory,
        originZone: data.originZone,
        destinationZone: data.destinationZone,
        baseFeeCents: data.baseFeeCents,
        perKmRateCents: data.perKmRateCents,
        perKgRateCents: data.perKgRateCents,
        minimumChargeCents: data.minimumChargeCents,
        waitingTimeRatePerHourCents: data.waitingTimeRatePerHourCents,
        fuelSurchargePercent: data.fuelSurchargePercent,
        tiers: data.tiers,
        additionalCharges: data.additionalCharges,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        createdBy: userId,
        auditTrail: [
          {
            action: 'RATE_MATRIX_CREATED',
            performedBy: userId,
            timestamp: new Date(),
            note: 'Initial rate tariff creation',
          },
        ],
      });

      return res.status(201).json({
        success: true,
        data: rateMatrix,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/billing/rates/:id
   * Get rate matrix by ID.
   */
  static async getRateById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Invalid rate matrix ID' },
        });
      }

      const rate = await RateMatrix.findOne({
        _id: new Types.ObjectId(id),
        organizationId: orgId,
      }).populate('customerId', 'name email');

      if (!rate) {
        return res.status(404).json({
          success: false,
          error: { code: 'RATE_NOT_FOUND', message: 'Rate matrix not found in organization' },
        });
      }

      return res.status(200).json({
        success: true,
        data: rate,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/billing/rates/:id
   * Update rate matrix metadata (name, description, status, effective dates).
   * Note: Changing core pricing numbers requires creating a new version.
   */
  static async updateRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const userId = new Types.ObjectId(req.tenant!.userId);
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Invalid rate matrix ID' },
        });
      }

      const rate = await RateMatrix.findOne({
        _id: new Types.ObjectId(id),
        organizationId: orgId,
      });

      if (!rate) {
        return res.status(404).json({
          success: false,
          error: { code: 'RATE_NOT_FOUND', message: 'Rate matrix not found in organization' },
        });
      }

      const { name, description, status, effectiveTo, isArchived } = req.body;

      if (name) rate.name = name;
      if (description !== undefined) rate.description = description;
      if (status) rate.status = status;
      if (effectiveTo !== undefined) rate.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
      if (isArchived !== undefined) rate.isArchived = Boolean(isArchived);

      rate.auditTrail.push({
        action: 'RATE_MATRIX_UPDATED',
        performedBy: userId,
        timestamp: new Date(),
        note: 'Updated rate matrix metadata',
      });

      await rate.save();

      return res.status(200).json({
        success: true,
        data: rate,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/billing/rates/:id/versions
   * Create a new version of an existing rate matrix.
   */
  static async createRateVersion(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const userId = new Types.ObjectId(req.tenant!.userId);
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Invalid rate matrix ID' },
        });
      }

      const previousRate = await RateMatrix.findOne({
        _id: new Types.ObjectId(id),
        organizationId: orgId,
      });

      if (!previousRate) {
        return res.status(404).json({
          success: false,
          error: { code: 'RATE_NOT_FOUND', message: 'Base rate matrix not found in organization' },
        });
      }

      // Find the latest version number for this rate code
      const latestVersionDoc = await RateMatrix.findOne({
        organizationId: orgId,
        code: previousRate.code,
      }).sort({ version: -1 });

      const newVersion = (latestVersionDoc?.version || previousRate.version) + 1;

      // Deprecate / end-date previous rate
      const effectiveDate = req.body.effectiveFrom ? new Date(req.body.effectiveFrom) : new Date();
      previousRate.effectiveTo = effectiveDate;
      await previousRate.save();

      const newRate = await RateMatrix.create({
        organizationId: orgId,
        code: previousRate.code,
        name: req.body.name || previousRate.name,
        description: req.body.description || previousRate.description,
        customerId: previousRate.customerId,
        status: 'ACTIVE',
        version: newVersion,
        pricingModel: req.body.pricingModel || previousRate.pricingModel,
        currency: (req.body.currency || previousRate.currency).toUpperCase(),
        vehicleCategory: req.body.vehicleCategory || previousRate.vehicleCategory,
        cargoCategory: req.body.cargoCategory || previousRate.cargoCategory,
        originZone: req.body.originZone || previousRate.originZone,
        destinationZone: req.body.destinationZone || previousRate.destinationZone,
        baseFeeCents: req.body.baseFeeCents ?? previousRate.baseFeeCents,
        perKmRateCents: req.body.perKmRateCents ?? previousRate.perKmRateCents,
        perKgRateCents: req.body.perKgRateCents ?? previousRate.perKgRateCents,
        minimumChargeCents: req.body.minimumChargeCents ?? previousRate.minimumChargeCents,
        waitingTimeRatePerHourCents: req.body.waitingTimeRatePerHourCents ?? previousRate.waitingTimeRatePerHourCents,
        fuelSurchargePercent: req.body.fuelSurchargePercent ?? previousRate.fuelSurchargePercent,
        tiers: req.body.tiers || previousRate.tiers,
        additionalCharges: req.body.additionalCharges || previousRate.additionalCharges,
        effectiveFrom: effectiveDate,
        effectiveTo: req.body.effectiveTo ? new Date(req.body.effectiveTo) : null,
        createdBy: userId,
        auditTrail: [
          {
            action: 'RATE_VERSION_CREATED',
            performedBy: userId,
            timestamp: new Date(),
            note: `Created version ${newVersion} successor to version ${previousRate.version}`,
          },
        ],
      });

      return res.status(201).json({
        success: true,
        data: newRate,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/billing/rates/:id/versions
   * Retrieve version history for a rate code.
   */
  static async getRateVersions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgId = new Types.ObjectId(req.tenant!.organizationId);
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Invalid rate matrix ID' },
        });
      }

      const target = await RateMatrix.findOne({
        _id: new Types.ObjectId(id),
        organizationId: orgId,
      });

      if (!target) {
        return res.status(404).json({
          success: false,
          error: { code: 'RATE_NOT_FOUND', message: 'Rate matrix not found' },
        });
      }

      const history = await RateMatrix.find({
        organizationId: orgId,
        code: target.code,
      })
        .sort({ version: -1 })
        .populate('createdBy', 'firstName lastName email');

      return res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/billing/rates/quote
   * Preview freight pricing without creating an invoice.
   */
  static async previewQuote(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantContext = { organizationId: req.tenant!.organizationId };
      const { customerId, distanceKm, weightKg, vehicleCategory, cargoCategory, waitingHours } = req.body;

      if (distanceKm === undefined || isNaN(Number(distanceKm))) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_DISTANCE', message: 'Valid distance in km is required for quotation' },
        });
      }

      const customerObjectId = customerId && Types.ObjectId.isValid(customerId) ? new Types.ObjectId(customerId) : undefined;

      const rateMatrix = await FreightPricingService.resolveActiveRate(
        tenantContext,
        customerObjectId,
        vehicleCategory,
        cargoCategory
      );

      if (!rateMatrix) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NO_ACTIVE_TARIFF',
            message: 'No active rate matrix found for this organization or customer criteria',
          },
        });
      }

      const breakdown = FreightPricingService.calculatePrice(rateMatrix, {
        customerId: customerObjectId,
        distanceKm: Number(distanceKm),
        weightKg: weightKg ? Number(weightKg) : 0,
        vehicleCategory,
        cargoCategory,
        waitingHours: waitingHours ? Number(waitingHours) : 0,
      });

      return res.status(200).json({
        success: true,
        data: {
          quote: breakdown,
          appliedTariff: {
            id: rateMatrix._id,
            code: rateMatrix.code,
            version: rateMatrix.version,
            name: rateMatrix.name,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
