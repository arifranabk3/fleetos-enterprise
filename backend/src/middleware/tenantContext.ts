import { Request, Response, NextFunction } from 'express';
import { OrganizationMember } from '../models';

export interface AuthenticatedTenantRequest extends Request {
  tenant?: {
    organizationId: string;
    userId: string;
    role: string;
  };
}

/**
 * resolveTenantContext
 * Resolves verified organization context from authenticated server-side session/membership.
 * NEVER trusts client-supplied organizationId headers.
 */
export const resolveTenantContext = async (
  req: AuthenticatedTenantRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // In Phase 02 foundation, extract user identity attached by auth or test token
    const userId = (req as any).user?.id || (req as any).user?._id;
    const requestedOrgSlug = req.headers['x-organization-slug'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required to access tenant operations.',
        },
      });
    }

    // Verify active membership in the database
    const membership = await OrganizationMember.findOne({
      userId,
      status: 'ACTIVE',
    }).populate('organizationId');

    if (!membership || !membership.organizationId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'TENANT_MEMBERSHIP_REQUIRED',
          message: 'Active organization membership not found for this user.',
        },
      });
    }

    // Bind trusted tenant context to request
    req.tenant = {
      organizationId: membership.organizationId._id.toString(),
      userId: userId.toString(),
      role: membership.role,
    };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'TENANT_RESOLUTION_ERROR',
        message: 'Failed to resolve organization tenant context.',
      },
    });
  }
};

