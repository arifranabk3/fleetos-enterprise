import { Response } from 'express';
import { Customer } from '../models/Customer';
import { BaseTenantRepository } from '../repositories/BaseTenantRepository';
import { AuthRequest } from '../middleware/auth';
import { AuditLog } from '../models/AuditLog';

const customerRepo = new BaseTenantRepository(Customer);

export class CustomerController {
  /**
   * POST /api/v1/customers
   */
  public static async createCustomer(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const { name, type, email, phone, billingAddress, contactPerson, notes } = req.body;

      if (!name || !email || !phone || !billingAddress?.street || !billingAddress?.city) {
        res.status(400).json({
          success: false,
          error: { message: 'Name, email, phone and billing address (street, city) are required' },
        });
        return;
      }

      // Check duplicate email within tenant
      const existing = await customerRepo.findOne(req.tenant, {
        email: email.toLowerCase().trim(),
        isArchived: false,
      });

      if (existing) {
        res.status(409).json({
          success: false,
          error: { message: `Customer with email ${email} already exists in this organization` },
        });
        return;
      }

      const customer = await customerRepo.create(req.tenant, {
        name: name.trim(),
        type: type || 'BUSINESS',
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        billingAddress,
        contactPerson,
        notes,
        status: 'ACTIVE',
        isArchived: false,
      } as any);

      await AuditLog.create({
        organizationId: req.tenant.organizationId,
        actorId: req.tenant.userId,
        actorEmail: req.user?.email || 'operator',
        action: 'CUSTOMER_CREATED',
        entity: 'CUSTOMER',
        entityId: customer._id.toString(),
        details: { name: customer.name, email: customer.email },
      });

      res.status(201).json({
        success: true,
        message: 'Customer profile registered successfully',
        data: customer,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/customers
   */
  public static async listCustomers(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const { search, status, type, page = 1, limit = 20 } = req.query;

      const filter: any = { isArchived: false };

      if (status) filter.status = status;
      if (type) filter.type = type;
      if (search) {
        filter.$or = [
          { name: { $regex: String(search), $options: 'i' } },
          { email: { $regex: String(search), $options: 'i' } },
          { phone: { $regex: String(search), $options: 'i' } },
        ];
      }

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const total = await customerRepo.count(req.tenant, filter);
      const customers = await Customer.find({
        organizationId: req.tenant.organizationId,
        ...filter,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      res.json({
        success: true,
        data: customers,
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
   * GET /api/v1/customers/:id
   */
  public static async getCustomer(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const { id } = req.params;
      const customer = await customerRepo.findById(req.tenant, id);

      if (!customer || customer.isArchived) {
        res.status(404).json({ success: false, error: { message: 'Customer not found in this organization' } });
        return;
      }

      res.json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * PATCH /api/v1/customers/:id
   */
  public static async updateCustomer(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const { id } = req.params;
      const { name, type, phone, billingAddress, contactPerson, status, notes } = req.body;

      const existing = await customerRepo.findById(req.tenant, id);
      if (!existing || existing.isArchived) {
        res.status(404).json({ success: false, error: { message: 'Customer not found' } });
        return;
      }

      const updateFields: any = {};
      if (name !== undefined) updateFields.name = name.trim();
      if (type !== undefined) updateFields.type = type;
      if (phone !== undefined) updateFields.phone = phone.trim();
      if (billingAddress !== undefined) updateFields.billingAddress = billingAddress;
      if (contactPerson !== undefined) updateFields.contactPerson = contactPerson;
      if (status !== undefined) updateFields.status = status;
      if (notes !== undefined) updateFields.notes = notes;

      const updated = await customerRepo.updateById(req.tenant, id, updateFields);

      res.json({
        success: true,
        message: 'Customer profile updated successfully',
        data: updated,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * DELETE /api/v1/customers/:id (Soft archive)
   */
  public static async deleteCustomer(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { message: 'Missing tenant context' } });
        return;
      }

      const { id } = req.params;
      const existing = await customerRepo.findById(req.tenant, id);
      if (!existing || existing.isArchived) {
        res.status(404).json({ success: false, error: { message: 'Customer not found' } });
        return;
      }

      await customerRepo.updateById(req.tenant, id, {
        isArchived: true,
        status: 'ARCHIVED',
      });

      res.json({
        success: true,
        message: 'Customer archived successfully',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
}
