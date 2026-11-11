import { Response } from 'express';
import { Types } from 'mongoose';
import { FuelTransaction, IFuelTransaction } from '../models/FuelTransaction';
import { FuelVendor, IFuelVendor } from '../models/FuelVendor';
import { Vehicle } from '../models/Vehicle';
import { Driver } from '../models/Driver';
import { AuditLog } from '../models/AuditLog';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';
import { AuthRequest } from '../middleware/auth';
import { FuelEfficiencyEngine } from '../services/FuelEfficiencyEngine';
import { FuelAnomalyDetectionEngine } from '../services/FuelAnomalyDetectionEngine';
import { FuelExpenseSyncService } from '../services/FuelExpenseSyncService';

const transactionRepo = new BaseTenantRepository(FuelTransaction);
const vendorRepo = new BaseTenantRepository(FuelVendor);

export class FuelController {
  /* ==========================================================================
     FUEL TRANSACTIONS CRUD
     ========================================================================== */

  /**
   * POST /api/v1/fuel/transactions
   */
  public static async createTransaction(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const userId = tenant.userId as any;

      const {
        vehicleId,
        driverId,
        fuelVendorId,
        transactionReference,
        transactionDate,
        fuelType,
        quantityLiters,
        pricePerLiter,
        totalCost,
        odometerReading,
        paymentMethod = 'COMPANY_ACCOUNT',
        receiptReference,
        notes,
        source = 'MANUAL',
      } = req.body;

      if (!vehicleId || !transactionReference || !transactionDate || !fuelType || !quantityLiters || !pricePerLiter || !odometerReading) {
        res.status(400).json({
          success: false,
          error: { message: 'vehicleId, transactionReference, transactionDate, fuelType, quantityLiters, pricePerLiter, and odometerReading are required.' },
        });
        return;
      }

      const qLiters = Number(quantityLiters);
      const pLiter = Number(pricePerLiter);
      const odo = Number(odometerReading);
      const computedTotal = totalCost !== undefined ? Number(totalCost) : Math.round(qLiters * pLiter * 100) / 100;

      if (qLiters <= 0 || pLiter <= 0 || computedTotal <= 0 || odo < 0) {
        res.status(400).json({
          success: false,
          error: { message: 'Quantity, price, total cost, and odometer reading must be valid positive numbers.' },
        });
        return;
      }

      // Verify Vehicle belongs to tenant
      const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        organizationId: tenant.organizationId,
        isArchived: false,
      });

      if (!vehicle) {
        res.status(404).json({ success: false, error: { message: 'Vehicle not found in this organization.' } });
        return;
      }

      // Verify Vendor if provided
      if (fuelVendorId) {
        const vendor = await vendorRepo.findById(tenant, fuelVendorId);
        if (!vendor || !vendor.isActive) {
          res.status(404).json({ success: false, error: { message: 'Fuel vendor not found or inactive.' } });
          return;
        }
      }

      // Verify Driver if provided
      if (driverId) {
        const driver = await Driver.findOne({ _id: driverId, organizationId: tenant.organizationId });
        if (!driver) {
          res.status(404).json({ success: false, error: { message: 'Driver not found in this organization.' } });
          return;
        }
      }

      // Check unique transaction reference within tenant
      const existingRef = await FuelTransaction.findOne({
        organizationId: tenant.organizationId,
        transactionReference: transactionReference.trim(),
      });
      if (existingRef) {
        res.status(409).json({
          success: false,
          error: { message: `Transaction reference '${transactionReference}' already exists in this organization.` },
        });
        return;
      }

      const txDate = new Date(transactionDate);

      // 1. Calculate Fuel Efficiency via Engine
      const efficiencyResult = await FuelEfficiencyEngine.calculateTransactionEfficiency(
        tenant.organizationId,
        vehicleId,
        odo,
        qLiters,
        fuelType,
        txDate
      );

      // 2. Anomaly Detection Engine
      const anomalyResult = await FuelAnomalyDetectionEngine.evaluateTransaction(
        tenant.organizationId,
        vehicleId,
        qLiters,
        computedTotal,
        odo,
        efficiencyResult.fuelEfficiency,
        txDate
      );

      // 3. Persist FuelTransaction
      const transaction = await transactionRepo.create(tenant, {
        vehicleId: vehicle._id as any,
        driverId: driverId || undefined,
        fuelVendorId: fuelVendorId || undefined,
        transactionReference: transactionReference.trim(),
        transactionDate: txDate,
        fuelType,
        quantityLiters: qLiters,
        pricePerLiter: pLiter,
        totalCost: computedTotal,
        odometerReading: odo,
        previousOdometerReading: efficiencyResult.previousOdometer,
        distanceSinceLastRefuel: efficiencyResult.distanceTravelled,
        fuelEfficiency: efficiencyResult.fuelEfficiency,
        efficiencyStatus: efficiencyResult.efficiencyStatus,
        paymentMethod,
        receiptReference,
        notes,
        source,
        verificationStatus: anomalyResult.verificationStatus,
        anomalyFlags: anomalyResult.flags,
        createdBy: userId,
      } as any);

      // 4. Update Vehicle Odometer if newer
      if (odo > (vehicle.odometerKm || 0)) {
        await Vehicle.findByIdAndUpdate(vehicleId, { odometerKm: odo });
      }

      // 5. Sync to Expense Ledger
      await FuelExpenseSyncService.syncFuelExpense(transaction, userId);

      // 6. Notify if Anomaly Detected
      if (anomalyResult.isAnomaly) {
        await FuelAnomalyDetectionEngine.notifyIfAnomaly(
          tenant.organizationId,
          transaction._id.toString(),
          vehicle.plateNumber,
          anomalyResult.flags,
          anomalyResult.reasons
        );
      }

      // 7. Audit Log
      await AuditLog.create({
        organizationId: tenant.organizationId,
        actorId: userId,
        actorEmail: req.user?.email || 'operator',
        action: 'FUEL_TRANSACTION_CREATED',
        entity: 'FUEL_TRANSACTION',
        entityId: transaction._id.toString(),
        details: { vehicleId, transactionReference, totalCost: computedTotal, flags: anomalyResult.flags },
      });

      res.status(201).json({
        success: true,
        message: 'Fuel transaction logged and expense synced successfully.',
        data: transaction,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/fuel/transactions
   */
  public static async listTransactions(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const {
        vehicleId,
        driverId,
        fuelVendorId,
        fuelType,
        verificationStatus,
        isVoided,
        startDate,
        endDate,
        page = 1,
        limit = 20,
      } = req.query;

      const filter: any = {};
      if (vehicleId) filter.vehicleId = vehicleId;
      if (driverId) filter.driverId = driverId;
      if (fuelVendorId) filter.fuelVendorId = fuelVendorId;
      if (fuelType) filter.fuelType = fuelType;
      if (verificationStatus) filter.verificationStatus = verificationStatus;
      if (isVoided !== undefined) filter.isVoided = isVoided === 'true';

      if (startDate || endDate) {
        filter.transactionDate = {};
        if (startDate) filter.transactionDate.$gte = new Date(String(startDate));
        if (endDate) filter.transactionDate.$lte = new Date(String(endDate));
      }

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const total = await transactionRepo.count(tenant, filter);
      const transactions = await FuelTransaction.find({
        organizationId: tenant.organizationId,
        ...filter,
      })
        .sort({ transactionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('vehicleId', 'plateNumber make modelName type')
        .populate('driverId', 'firstName lastName')
        .populate('fuelVendorId', 'name')
        .lean();

      res.json({
        success: true,
        data: transactions,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/fuel/transactions/:id
   */
  public static async getTransaction(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const { id } = req.params;
      const transaction = await FuelTransaction.findOne({
        _id: id,
        organizationId: req.tenant.organizationId,
      })
        .populate('vehicleId', 'plateNumber make modelName type year odometerKm')
        .populate('driverId', 'firstName lastName email phone')
        .populate('fuelVendorId', 'name contactPerson phone email')
        .populate('createdBy', 'firstName lastName email')
        .populate('expenseId');

      if (!transaction) {
        res.status(404).json({ success: false, error: { message: 'Fuel transaction not found' } });
        return;
      }

      res.json({ success: true, data: transaction });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * PATCH /api/v1/fuel/transactions/:id
   */
  public static async updateTransaction(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const { id } = req.params;
      const { quantityLiters, pricePerLiter, odometerReading, notes, receiptReference } = req.body;

      const transaction = await transactionRepo.findById(tenant, id);
      if (!transaction) {
        res.status(404).json({ success: false, error: { message: 'Fuel transaction not found' } });
        return;
      }

      if (transaction.isVoided) {
        res.status(400).json({ success: false, error: { message: 'Cannot edit a voided transaction.' } });
        return;
      }

      if (quantityLiters !== undefined) transaction.quantityLiters = Number(quantityLiters);
      if (pricePerLiter !== undefined) transaction.pricePerLiter = Number(pricePerLiter);
      if (odometerReading !== undefined) transaction.odometerReading = Number(odometerReading);
      if (notes !== undefined) transaction.notes = notes;
      if (receiptReference !== undefined) transaction.receiptReference = receiptReference;

      transaction.totalCost = Math.round(transaction.quantityLiters * transaction.pricePerLiter * 100) / 100;

      // Recalculate efficiency if odometer or quantity changed
      const eff = await FuelEfficiencyEngine.calculateTransactionEfficiency(
        tenant.organizationId,
        transaction.vehicleId.toString(),
        transaction.odometerReading,
        transaction.quantityLiters,
        transaction.fuelType,
        transaction.transactionDate
      );

      transaction.previousOdometerReading = eff.previousOdometer;
      transaction.distanceSinceLastRefuel = eff.distanceTravelled;
      transaction.fuelEfficiency = eff.fuelEfficiency;
      transaction.efficiencyStatus = eff.efficiencyStatus;

      await transaction.save();

      // Sync updated figures to linked Expense
      await FuelExpenseSyncService.syncFuelExpense(transaction, tenant.userId as any);

      res.json({
        success: true,
        message: 'Fuel transaction updated and synced successfully.',
        data: transaction,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * POST /api/v1/fuel/transactions/:id/void
   */
  public static async voidTransaction(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const userId = tenant.userId as any;
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || reason.trim().length < 5) {
        res.status(400).json({
          success: false,
          error: { message: 'A documented void reason (minimum 5 characters) is required.' },
        });
        return;
      }

      const transaction = await transactionRepo.findById(tenant, id);
      if (!transaction) {
        res.status(404).json({ success: false, error: { message: 'Fuel transaction not found' } });
        return;
      }

      if (transaction.isVoided) {
        res.status(400).json({ success: false, error: { message: 'Transaction is already voided.' } });
        return;
      }

      transaction.isVoided = true;
      transaction.voidReason = reason.trim();
      transaction.voidedAt = new Date();
      transaction.voidedBy = userId;
      await transaction.save();

      // Void linked Expense
      await FuelExpenseSyncService.voidFuelExpense(transaction._id, reason.trim());

      await AuditLog.create({
        organizationId: tenant.organizationId,
        actorId: userId,
        actorEmail: req.user?.email || 'operator',
        action: 'FUEL_TRANSACTION_VOIDED',
        entity: 'FUEL_TRANSACTION',
        entityId: transaction._id.toString(),
        details: { reason },
      });

      res.json({
        success: true,
        message: 'Fuel transaction and linked expense voided successfully.',
        data: transaction,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /* ==========================================================================
     FUEL VENDORS CRUD
     ========================================================================== */

  /**
   * GET /api/v1/fuel/vendors
   */
  public static async listVendors(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const vendors = await vendorRepo.find(req.tenant, {});
      res.json({ success: true, data: vendors });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * POST /api/v1/fuel/vendors
   */
  public static async createVendor(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const { name, contactPerson, phone, email, address, supportedFuelTypes = ['DIESEL'], notes } = req.body;

      if (!name || !phone) {
        res.status(400).json({ success: false, error: { message: 'Vendor name and phone number are required.' } });
        return;
      }

      const vendor = await vendorRepo.create(req.tenant, {
        name: name.trim(),
        contactPerson: contactPerson?.trim(),
        phone: phone.trim(),
        email: email?.trim()?.toLowerCase(),
        address,
        supportedFuelTypes,
        notes,
        isActive: true,
      } as any);

      res.status(201).json({ success: true, message: 'Fuel vendor created successfully.', data: vendor });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * PATCH /api/v1/fuel/vendors/:id
   */
  public static async updateVendor(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const { id } = req.params;
      const vendor = await vendorRepo.findById(req.tenant, id);
      if (!vendor) {
        res.status(404).json({ success: false, error: { message: 'Fuel vendor not found' } });
        return;
      }

      const updated = await vendorRepo.updateById(req.tenant, id, req.body);
      res.json({ success: true, message: 'Vendor updated successfully.', data: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /* ==========================================================================
     FUEL ANALYTICS & REPORTS
     ========================================================================== */

  /**
   * GET /api/v1/fuel/overview
   */
  public static async getOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const orgId = new Types.ObjectId(req.tenant.organizationId);

      const [metrics] = await FuelTransaction.aggregate([
        { $match: { organizationId: orgId, isVoided: false } },
        {
          $group: {
            _id: null,
            totalCost: { $sum: '$totalCost' },
            totalFuel: { $sum: '$quantityLiters' },
            totalTransactions: { $sum: 1 },
            avgEfficiency: { $avg: '$fuelEfficiency' },
          },
        },
      ]);

      const anomaliesCount = await FuelTransaction.countDocuments({
        organizationId: orgId,
        isVoided: false,
        verificationStatus: { $in: ['PENDING_REVIEW', 'FLAGGED_ANOMALY'] },
      });

      res.json({
        success: true,
        data: {
          totalCost: metrics ? Math.round(metrics.totalCost * 100) / 100 : 0,
          totalFuelLiters: metrics ? Math.round(metrics.totalFuel * 100) / 100 : 0,
          totalTransactions: metrics ? metrics.totalTransactions : 0,
          averageEfficiencyKmL: metrics && metrics.avgEfficiency ? Math.round(metrics.avgEfficiency * 100) / 100 : 0,
          pendingAnomaliesCount: anomaliesCount,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/fuel/vehicle/:vehicleId/efficiency
   */
  public static async getVehicleEfficiency(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const { vehicleId } = req.params;
      const stats = await FuelEfficiencyEngine.calculateVehicleRollingEfficiency(
        req.tenant.organizationId,
        vehicleId
      );

      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/fuel/anomalies
   */
  public static async listAnomalies(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const anomalies = await FuelTransaction.find({
        organizationId: req.tenant.organizationId,
        isVoided: false,
        verificationStatus: { $in: ['PENDING_REVIEW', 'FLAGGED_ANOMALY'] },
      })
        .populate('vehicleId', 'plateNumber make modelName')
        .populate('driverId', 'firstName lastName')
        .sort({ transactionDate: -1 })
        .limit(50)
        .lean();

      res.json({ success: true, data: anomalies });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * POST /api/v1/fuel/anomalies/:id/resolve
   */
  public static async resolveAnomaly(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const { id } = req.params;
      const { resolution, resolutionNotes } = req.body;

      if (!resolution || !['VERIFIED', 'REJECTED'].includes(resolution)) {
        res.status(400).json({ success: false, error: { message: "Resolution must be either 'VERIFIED' or 'REJECTED'." } });
        return;
      }

      const tx = await transactionRepo.findById(req.tenant, id);
      if (!tx) {
        res.status(404).json({ success: false, error: { message: 'Fuel transaction not found' } });
        return;
      }

      tx.verificationStatus = resolution;
      if (resolutionNotes) {
        tx.notes = `${tx.notes ? tx.notes + ' | ' : ''}Resolved as ${resolution}: ${resolutionNotes}`;
      }
      await tx.save();

      res.json({ success: true, message: `Anomaly resolved as ${resolution}.`, data: tx });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
}
