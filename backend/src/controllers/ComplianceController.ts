import { Response } from 'express';
import {
  VehicleComplianceDocument,
  IVehicleComplianceDocument,
} from '../models/VehicleComplianceDocument';
import { Vehicle } from '../models/Vehicle';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';
import { AuthRequest } from '../middleware/auth';
import { ComplianceEngine } from '../services/ComplianceEngine';

const documentRepo = new BaseTenantRepository(VehicleComplianceDocument);

export class ComplianceController {
  /**
   * POST /api/v1/compliance/documents
   */
  public static async createDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }
      const tenant = req.tenant;
      const userId = tenant.userId as any;

      const {
        vehicleId,
        documentType,
        documentNumber,
        issuingAuthority,
        issueDate,
        expiryDate,
        fileReference,
        reminderDays = 30,
        notes,
      } = req.body;

      if (!vehicleId || !documentType || !documentNumber || !issueDate || !expiryDate) {
        res.status(400).json({
          success: false,
          error: { message: 'vehicleId, documentType, documentNumber, issueDate, and expiryDate are required.' },
        });
        return;
      }

      const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        organizationId: tenant.organizationId,
        isArchived: false,
      });

      if (!vehicle) {
        res.status(404).json({ success: false, error: { message: 'Vehicle not found.' } });
        return;
      }

      const status = ComplianceEngine.calculateStatus(new Date(expiryDate), Number(reminderDays));

      const document = await documentRepo.create(tenant, {
        vehicleId: vehicle._id as any,
        documentType,
        documentNumber: documentNumber.trim(),
        issuingAuthority: issuingAuthority?.trim(),
        issueDate: new Date(issueDate),
        expiryDate: new Date(expiryDate),
        fileReference,
        reminderDays: Number(reminderDays),
        status,
        notes,
        isArchived: false,
        uploadedBy: userId,
      } as any);

      res.status(201).json({
        success: true,
        message: 'Vehicle compliance document recorded successfully.',
        data: document,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/compliance/documents
   */
  public static async listDocuments(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const { vehicleId, documentType, status, page = 1, limit = 50 } = req.query;

      const filter: any = { isArchived: false };
      if (vehicleId) filter.vehicleId = vehicleId;
      if (documentType) filter.documentType = documentType;
      if (status) filter.status = status;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      const total = await documentRepo.count(req.tenant, filter);
      const docs = await VehicleComplianceDocument.find({
        organizationId: req.tenant.organizationId,
        ...filter,
      })
        .sort({ expiryDate: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('vehicleId', 'plateNumber make modelName')
        .populate('uploadedBy', 'firstName lastName email')
        .lean();

      res.json({
        success: true,
        data: docs,
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
   * GET /api/v1/compliance/overview
   */
  public static async getComplianceOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const scanResult = await ComplianceEngine.scanOrganizationDocuments(req.tenant.organizationId.toString());

      res.json({
        success: true,
        data: {
          validDocuments: scanResult.validCount,
          expiringSoonDocuments: scanResult.expiringSoonCount,
          expiredDocuments: scanResult.expiredCount,
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * DELETE /api/v1/compliance/documents/:id
   */
  public static async archiveDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const { id } = req.params;
      const doc = await VehicleComplianceDocument.findOneAndUpdate(
        { _id: id, organizationId: req.tenant.organizationId },
        { isArchived: true },
        { new: true }
      );

      if (!doc) {
        res.status(404).json({ success: false, error: { message: 'Compliance document not found.' } });
        return;
      }

      res.json({
        success: true,
        message: 'Compliance document archived successfully.',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
}
