import { Model, Document, FilterQuery, UpdateQuery, QueryOptions, Types, PipelineStage } from 'mongoose';

export interface ITenantContext {
  organizationId: string | Types.ObjectId;
  userId?: string | Types.ObjectId;
  role?: string;
}

/**
 * BaseTenantRepository
 * Enforces automatic, non-bypassable tenant isolation at the repository query layer.
 */
export class BaseTenantRepository<T extends Document> {
  protected readonly model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  /**
   * Enforces organizationId in the filter query.
   */
  private applyTenantScope(
    tenant: ITenantContext,
    filter: FilterQuery<T> = {}
  ): FilterQuery<T> {
    if (!tenant || !tenant.organizationId) {
      throw new Error(
        'SECURITY EXCEPTION: Missing organization context. Operation rejected to prevent cross-tenant data leak.'
      );
    }

    const orgId =
      typeof tenant.organizationId === 'string'
        ? new Types.ObjectId(tenant.organizationId)
        : tenant.organizationId;

    return {
      ...filter,
      organizationId: orgId,
    };
  }

  async findOne(
    tenant: ITenantContext,
    filter: FilterQuery<T> = {},
    projection?: any,
    options?: QueryOptions
  ): Promise<T | null> {
    const scopedFilter = this.applyTenantScope(tenant, filter);
    return this.model.findOne(scopedFilter, projection, options).exec();
  }

  async findById(
    tenant: ITenantContext,
    id: string | Types.ObjectId,
    projection?: any,
    options?: QueryOptions
  ): Promise<T | null> {
    const scopedFilter = this.applyTenantScope(tenant, { _id: id } as FilterQuery<T>);
    return this.model.findOne(scopedFilter, projection, options).exec();
  }

  async find(
    tenant: ITenantContext,
    filter: FilterQuery<T> = {},
    projection?: any,
    options?: QueryOptions
  ): Promise<T[]> {
    const scopedFilter = this.applyTenantScope(tenant, filter);
    return this.model.find(scopedFilter, projection, options).exec();
  }

  async create(tenant: ITenantContext, doc: Partial<T>): Promise<T> {
    if (!tenant || !tenant.organizationId) {
      throw new Error('SECURITY EXCEPTION: Cannot create record without tenant context.');
    }

    const orgId =
      typeof tenant.organizationId === 'string'
        ? new Types.ObjectId(tenant.organizationId)
        : tenant.organizationId;

    // Force organizationId on the document
    const payload = {
      ...doc,
      organizationId: orgId,
    };

    return this.model.create(payload as any);
  }

  async updateOne(
    tenant: ITenantContext,
    filter: FilterQuery<T>,
    update: UpdateQuery<T>
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    const scopedFilter = this.applyTenantScope(tenant, filter);

    // Prevent tampering with organizationId in update payload
    if (update && typeof update === 'object') {
      delete (update as any).organizationId;
      if (update.$set) {
        delete update.$set.organizationId;
      }
    }

    const res = await this.model.updateOne(scopedFilter, update).exec();
    return {
      matchedCount: res.matchedCount,
      modifiedCount: res.modifiedCount,
    };
  }

  async deleteOne(
    tenant: ITenantContext,
    filter: FilterQuery<T>
  ): Promise<{ deletedCount: number }> {
    const scopedFilter = this.applyTenantScope(tenant, filter);
    const res = await this.model.deleteOne(scopedFilter).exec();
    return { deletedCount: res.deletedCount || 0 };
  }

  async count(
    tenant: ITenantContext,
    filter: FilterQuery<T> = {}
  ): Promise<number> {
    const scopedFilter = this.applyTenantScope(tenant, filter);
    return this.model.countDocuments(scopedFilter).exec();
  }

  async updateById(
    tenant: ITenantContext,
    id: string | Types.ObjectId,
    update: UpdateQuery<T>
  ): Promise<T | null> {
    const scopedFilter = this.applyTenantScope(tenant, { _id: id } as FilterQuery<T>);

    if (update && typeof update === 'object') {
      delete (update as any).organizationId;
      if (update.$set) {
        delete update.$set.organizationId;
      }
    }

    return this.model.findOneAndUpdate(scopedFilter, update, { new: true }).exec();
  }

  async aggregate(tenant: ITenantContext, pipeline: PipelineStage[]): Promise<any[]> {
    if (!tenant || !tenant.organizationId) {
      throw new Error('SECURITY EXCEPTION: Missing tenant context in aggregation.');
    }

    const orgId =
      typeof tenant.organizationId === 'string'
        ? new Types.ObjectId(tenant.organizationId)
        : tenant.organizationId;

    // Prepend a $match stage to guarantee tenant isolation before any aggregation stages
    const tenantMatchStage: PipelineStage = {
      $match: { organizationId: orgId },
    };

    const scopedPipeline = [tenantMatchStage, ...pipeline];
    return this.model.aggregate(scopedPipeline).exec();
  }
}
