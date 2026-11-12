import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { DriverAnalyticsService } from '../services/DriverAnalyticsService';
import { Driver } from '../models/Driver';
import { z } from 'zod';

const DaysQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const TrendQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(12).default(6),
});

export class DriverAnalyticsController {
  /**
   * GET /api/v1/analytics/drivers/fleet-overview
   * Requires managerial permission: driver.analytics.read
   */
  public static async getFleetOverview(req: AuthRequest, res: Response) {
    try {
      const tenantOrgId = req.tenant?.organizationId;
      if (!tenantOrgId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant context required.' },
        });
      }

      const parsed = DaysQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters. Days must be an integer between 1 and 365.',
            details: parsed.error.format(),
          },
        });
      }

      const overview = await DriverAnalyticsService.calculateFleetOverview(
        new Types.ObjectId(tenantOrgId),
        parsed.data.days
      );

      return res.status(200).json({
        success: true,
        data: overview,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to calculate fleet workforce overview.' },
      });
    }
  }

  /**
   * GET /api/v1/analytics/drivers/rankings
   * Requires managerial permission: driver.analytics.read
   */
  public static async getFleetRankings(req: AuthRequest, res: Response) {
    try {
      const tenantOrgId = req.tenant?.organizationId;
      if (!tenantOrgId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant context required.' },
        });
      }

      const parsed = DaysQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters. Days (1-365) and Limit (1-100) required.',
            details: parsed.error.format(),
          },
        });
      }

      const rankings = await DriverAnalyticsService.calculateFleetRankings(
        new Types.ObjectId(tenantOrgId),
        parsed.data.days,
        parsed.data.limit
      );

      return res.status(200).json({
        success: true,
        data: rankings,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to calculate fleet rankings.' },
      });
    }
  }

  /**
   * GET /api/v1/analytics/drivers/shift-variance
   * Requires managerial permission: driver.analytics.read
   */
  public static async getShiftVariance(req: AuthRequest, res: Response) {
    try {
      const tenantOrgId = req.tenant?.organizationId;
      if (!tenantOrgId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant context required.' },
        });
      }

      const parsed = DaysQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters. Days must be an integer between 1 and 365.',
            details: parsed.error.format(),
          },
        });
      }

      const variance = await DriverAnalyticsService.calculateShiftVariance(
        new Types.ObjectId(tenantOrgId),
        parsed.data.days
      );

      return res.status(200).json({
        success: true,
        data: variance,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to calculate shift hours variance.' },
      });
    }
  }

  /**
   * GET /api/v1/analytics/drivers/me
   * Resolves driver record matching authenticated user ID and tenant context.
   */
  public static async getDriverSelfScorecard(req: AuthRequest, res: Response) {
    try {
      const tenantOrgId = req.tenant?.organizationId;
      const userId = req.user?.id;

      if (!tenantOrgId || !userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
        });
      }

      const parsed = DaysQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters. Days must be an integer between 1 and 365.',
            details: parsed.error.format(),
          },
        });
      }

      // Find driver profile linked to this user in this tenant
      const matchingDrivers = await Driver.find({
        userId: new Types.ObjectId(userId),
        organizationId: new Types.ObjectId(tenantOrgId),
      });

      if (matchingDrivers.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'DRIVER_PROFILE_NOT_FOUND',
            message: 'No driver profile linked to current user account in this organization.',
          },
        });
      }

      // Fail-closed if multiple profiles exist to prevent arbitrary identity selection
      if (matchingDrivers.length > 1) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'AMBIGUOUS_DRIVER_PROFILE',
            message: 'Multiple driver profiles linked to user. Contact organization administrator.',
          },
        });
      }

      const driver = matchingDrivers[0];

      // Fail-closed if driver profile is archived or inactive
      if (driver.isArchived || driver.status === 'INACTIVE' || driver.status === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'DRIVER_PROFILE_INACTIVE',
            message: 'Driver profile is inactive, suspended, or archived.',
          },
        });
      }

      const scorecard = await DriverAnalyticsService.calculateDriverScorecard(
        new Types.ObjectId(tenantOrgId),
        driver._id,
        parsed.data.days
      );

      return res.status(200).json({
        success: true,
        data: scorecard,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to calculate driver scorecard.' },
      });
    }
  }

  /**
   * GET /api/v1/analytics/drivers/:driverId
   * Managerial access, or verified driver self-access.
   */
  public static async getDriverScorecard(req: AuthRequest, res: Response) {
    try {
      const tenantOrgId = req.tenant?.organizationId;
      const callerRole = req.tenant?.role;
      const callerUserId = req.user?.id;
      const { driverId } = req.params;

      if (!tenantOrgId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant context required.' },
        });
      }

      if (!Types.ObjectId.isValid(driverId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID_FORMAT', message: 'Invalid driver ObjectId format.' },
        });
      }

      const parsed = DaysQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters. Days must be an integer between 1 and 365.',
            details: parsed.error.format(),
          },
        });
      }

      const targetDriver = await Driver.findOne({
        _id: new Types.ObjectId(driverId),
        organizationId: new Types.ObjectId(tenantOrgId),
      });

      // Cross-tenant or non-existent driver returns 404 (prevents tenant enumeration)
      if (!targetDriver) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Driver not found within current organization.' },
        });
      }

      // Authorization Guard:
      // If caller has role DRIVER, verify IDOR (can only access their own driver record).
      // Otherwise, caller must have managerial driver.performance.read or driver.analytics.read.
      if (callerRole === 'DRIVER') {
        const isSelf = targetDriver.userId && targetDriver.userId.toString() === callerUserId;
        if (!isSelf) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN_RESOURCE_ACCESS',
              message: 'Access denied: Drivers may only access their own performance analytics.',
            },
          });
        }
      } else {
        const allowedRoles = ['ORGANIZATION_OWNER', 'ADMIN', 'FLEET_MANAGER', 'VIEWER'];
        if (!callerRole || !allowedRoles.includes(callerRole)) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: `Forbidden: Role '${callerRole}' lacks permission to access driver performance.`,
            },
          });
        }
      }

      const scorecard = await DriverAnalyticsService.calculateDriverScorecard(
        new Types.ObjectId(tenantOrgId),
        targetDriver._id,
        parsed.data.days
      );

      return res.status(200).json({
        success: true,
        data: scorecard,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to calculate driver scorecard.' },
      });
    }
  }

  /**
   * GET /api/v1/analytics/drivers/:driverId/trend
   * Managerial access, or verified driver self-access.
   */
  public static async getDriverTrend(req: AuthRequest, res: Response) {
    try {
      const tenantOrgId = req.tenant?.organizationId;
      const callerRole = req.tenant?.role;
      const callerUserId = req.user?.id;
      const { driverId } = req.params;

      if (!tenantOrgId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant context required.' },
        });
      }

      if (!Types.ObjectId.isValid(driverId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID_FORMAT', message: 'Invalid driver ObjectId format.' },
        });
      }

      const parsed = TrendQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters. Months must be an integer between 1 and 12.',
            details: parsed.error.format(),
          },
        });
      }

      const targetDriver = await Driver.findOne({
        _id: new Types.ObjectId(driverId),
        organizationId: new Types.ObjectId(tenantOrgId),
      });

      if (!targetDriver) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Driver not found within current organization.' },
        });
      }

      // Authorization Guard
      if (callerRole === 'DRIVER') {
        const isSelf = targetDriver.userId && targetDriver.userId.toString() === callerUserId;
        if (!isSelf) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN_RESOURCE_ACCESS',
              message: 'Access denied: Drivers may only access their own performance analytics.',
            },
          });
        }
      } else {
        const allowedRoles = ['ORGANIZATION_OWNER', 'ADMIN', 'FLEET_MANAGER', 'VIEWER'];
        if (!callerRole || !allowedRoles.includes(callerRole)) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: `Forbidden: Role '${callerRole}' lacks permission to access driver performance trend.`,
            },
          });
        }
      }

      const trend = await DriverAnalyticsService.calculateDriverTrend(
        new Types.ObjectId(tenantOrgId),
        targetDriver._id,
        parsed.data.months
      );

      return res.status(200).json({
        success: true,
        data: trend,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to calculate driver performance trend.' },
      });
    }
  }
}
