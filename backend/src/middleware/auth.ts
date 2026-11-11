import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token';
import { OrganizationMember, User } from '../models';
import { hasPermission } from '../utils/permissions';
import { UserRole } from '../types/domain';

export interface AuthenticatedUser {
  id: string;
  email: string;
  activeOrganizationId?: string;
  role?: UserRole;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  tenant?: {
    organizationId: string;
    role: UserRole;
    userId: string;
  };
}

/**
 * authenticate:
 * Validates JWT access token from Authorization header or signed HttpOnly cookie.
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.fleetos_access_token) {
      token = req.cookies.fleetos_access_token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication token missing.' },
      });
    }

    const decoded = verifyAccessToken(token);
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      activeOrganizationId: decoded.activeOrganizationId,
      role: decoded.role as UserRole,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Access token expired or malformed.' },
    });
  }
};

/**
 * requireTenantMembership:
 * Enforces verified server-side active organization membership.
 */
export const requireTenantMembership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User context required.' },
      });
    }

    // Determine target organization from header, param, or token active org
    const targetOrgId =
      (req.headers['x-organization-id'] as string) ||
      req.params.organizationId ||
      req.user.activeOrganizationId;

    if (!targetOrgId) {
      return res.status(400).json({
        success: false,
        error: { code: 'ORG_CONTEXT_MISSING', message: 'Organization context must be specified.' },
      });
    }

    const membership = await OrganizationMember.findOne({
      organizationId: targetOrgId,
      userId: req.user.id,
      status: 'ACTIVE',
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_TENANT_ACCESS',
          message: 'Access denied: You are not an active member of this organization.',
        },
      });
    }

    req.tenant = {
      organizationId: membership.organizationId.toString(),
      role: membership.role as UserRole,
      userId: req.user.id,
    };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to verify organization membership.' },
    });
  }
};

/**
 * requirePermission:
 * Granular RBAC middleware enforcing specific domain actions.
 */
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.tenant || !req.tenant.role) {
      return res.status(403).json({
        success: false,
        error: { code: 'ROLE_REQUIRED', message: 'Tenant role required to evaluate permissions.' },
      });
    }

    if (!hasPermission(req.tenant.role, permission)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Forbidden: Role '${req.tenant.role}' lacks '${permission}' permission.`,
        },
      });
    }

    next();
  };
};

