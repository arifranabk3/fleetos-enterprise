import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FleetAnalyticsService, TelemetrySourcePolicy } from '../services/FleetAnalyticsService';
import { z } from 'zod';

const FleetAnalyticsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  days: z.coerce.number().min(1).max(365).optional(),
  timezone: z.string().default('UTC'),
  vehicleId: z.string().optional(),
  vehicleType: z.string().optional(),
  statusFilter: z.string().optional(),
  sourcePolicy: z.enum(['ALL', 'HARDWARE_ONLY', 'SIMULATED_ONLY']).default('ALL'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export class FleetAnalyticsController {
  /**
   * GET /api/v1/analytics/fleet/overview
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

      const parsed = FleetAnalyticsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid analytics query parameters.',
            details: parsed.error.format(),
          },
        });
      }

      const { startDate, endDate, days, timezone, vehicleId, vehicleType, statusFilter, sourcePolicy, page, limit } =
        parsed.data;

      // Determine time boundaries
      let toDate = endDate ? new Date(endDate) : new Date();
      let fromDate: Date;

      if (startDate) {
        fromDate = new Date(startDate);
      } else {
        const spanDays = days || 30;
        fromDate = new Date(toDate.getTime() - spanDays * 24 * 3600 * 1000);
      }

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_DATE_RANGE', message: 'Provided dates are invalid.' },
        });
      }

      if (fromDate >= toDate) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_DATE_RANGE', message: 'startDate must be before endDate.' },
        });
      }

      // Max reporting range of 365 days to prevent performance degradation
      const maxSpanMs = 366 * 24 * 3600 * 1000;
      if (toDate.getTime() - fromDate.getTime() > maxSpanMs) {
        return res.status(400).json({
          success: false,
          error: { code: 'MAX_RANGE_EXCEEDED', message: 'Reporting range cannot exceed 365 days.' },
        });
      }

      const overview = await FleetAnalyticsService.getFleetOverview(tenantOrgId, {
        startDate: fromDate,
        endDate: toDate,
        timezone,
        vehicleId,
        vehicleType,
        statusFilter,
        sourcePolicy: sourcePolicy as TelemetrySourcePolicy,
        page,
        limit,
      });

      return res.status(200).json({
        success: true,
        data: overview,
      });
    } catch (error: any) {
      console.error('[FleetAnalyticsController.getFleetOverview Error]:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to calculate fleet analytics.' },
      });
    }
  }

  /**
   * GET /api/v1/analytics/fleet/vehicles/:id
   */
  public static async getVehicleDetail(req: AuthRequest, res: Response) {
    try {
      const tenantOrgId = req.tenant?.organizationId;
      if (!tenantOrgId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Tenant context required.' },
        });
      }

      const vehicleId = req.params.id;
      const parsed = FleetAnalyticsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters.' },
        });
      }

      const { startDate, endDate, days, sourcePolicy } = parsed.data;
      let toDate = endDate ? new Date(endDate) : new Date();
      let fromDate = startDate ? new Date(startDate) : new Date(toDate.getTime() - (days || 30) * 24 * 3600 * 1000);

      const vehicleAnalytics = await FleetAnalyticsService.getVehicleDetailAnalytics(
        tenantOrgId,
        vehicleId,
        fromDate,
        toDate,
        sourcePolicy as TelemetrySourcePolicy
      );

      return res.status(200).json({
        success: true,
        data: vehicleAnalytics,
      });
    } catch (error: any) {
      if (error.message === 'VEHICLE_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Vehicle not found or cross-tenant access denied.' },
        });
      }
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to retrieve vehicle analytics.' },
      });
    }
  }
}
