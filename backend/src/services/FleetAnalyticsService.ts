import { Types } from 'mongoose';
import { Vehicle, IVehicle } from '../models/Vehicle';
import { TelemetryEvent } from '../models/TelemetryEvent';
import { MaintenanceRecord } from '../models/MaintenanceRecord';
import {
  TelemetryIntervalService,
  CoverageClassification,
} from './TelemetryIntervalService';
import { MaintenanceDowntimeCalculator } from './MaintenanceDowntimeCalculator';

export type TelemetrySourcePolicy = 'ALL' | 'HARDWARE_ONLY' | 'SIMULATED_ONLY';

export interface FleetAnalyticsQueryOptions {
  startDate: Date;
  endDate: Date;
  timezone?: string;
  vehicleId?: string;
  vehicleType?: string;
  statusFilter?: string;
  sourcePolicy?: TelemetrySourcePolicy;
  page?: number;
  limit?: number;
}

export interface VehiclePerformanceSummary {
  vehicleId: string;
  vin: string;
  plateNumber: string;
  make: string;
  modelName: string;
  type: string;
  currentStatus: string;
  odometerKm: number;
  eligibleHours: number;
  operatingHours: number;
  idleHours: number;
  stoppedHours: number;
  unknownHours: number;
  utilizationPercentage: number | null;
  coveragePercentage: number;
  coverageClassification: CoverageClassification;
  maintenanceDowntimeHours: number;
  maintenanceEventCount: number;
  telemetryEventCount: number;
  isSimulatedOnly: boolean;
}

export interface FleetAnalyticsOverview {
  reportingPeriod: {
    from: string;
    to: string;
    timezone: string;
    totalWindowHours: number;
  };
  generatedAt: string;
  simulationPolicy: TelemetrySourcePolicy;
  dataQuality: {
    totalEligibleVehicleHours: number;
    totalObservedHours: number;
    fleetCoveragePercentage: number;
    classification: CoverageClassification;
  };
  utilization: {
    fleetUtilizationPercentage: number | null;
    totalOperatingHours: number;
    totalEligibleHours: number;
    classification: 'HIGH_UTILIZATION' | 'MODERATE_UTILIZATION' | 'UNDERUTILIZED' | 'INSUFFICIENT_DATA';
  };
  availabilitySnapshot: {
    totalFleetVehicles: number;
    eligibleVehicles: number;
    availableCount: number;
    inTransitCount: number;
    assignedCount: number;
    maintenanceCount: number;
    outOfServiceCount: number;
    retiredCount: number;
    availabilityRatioPercent: number;
  };
  motionBreakdown: {
    totalMovingHours: number;
    totalIdleHours: number;
    totalStoppedHours: number;
    totalUnknownHours: number;
  };
  maintenance: {
    totalDowntimeHours: number;
    affectedVehicleCount: number;
    totalMaintenanceEvents: number;
  };
  vehicles: VehiclePerformanceSummary[];
  pagination: {
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class FleetAnalyticsService {
  /**
   * Primary Fleet Analytics Engine: Calculates fleet-wide utilization, availability,
   * idle-time, and maintenance impact for a verified tenant.
   */
  public static async getFleetOverview(
    organizationId: Types.ObjectId | string,
    options: FleetAnalyticsQueryOptions
  ): Promise<FleetAnalyticsOverview> {
    const orgId = typeof organizationId === 'string' ? new Types.ObjectId(organizationId) : organizationId;
    const windowStart = new Date(options.startDate);
    const windowEnd = new Date(options.endDate);
    const tz = options.timezone || 'UTC';
    const sourcePolicy = options.sourcePolicy || 'ALL';

    const windowMs = Math.max(0, windowEnd.getTime() - windowStart.getTime());
    const windowHours = Math.round((windowMs / (1000 * 3600)) * 100) / 100;

    // 1. Fetch eligible vehicles for the organization
    const vehicleFilter: any = { organizationId: orgId, isArchived: false };
    if (options.vehicleType) {
      vehicleFilter.type = options.vehicleType;
    }
    if (options.statusFilter) {
      vehicleFilter.status = options.statusFilter;
    }
    if (options.vehicleId) {
      vehicleFilter._id = new Types.ObjectId(options.vehicleId);
    }

    const allVehicles = await Vehicle.find(vehicleFilter).lean();

    // 2. Snapshot distribution counts
    let availableCount = 0;
    let inTransitCount = 0;
    let assignedCount = 0;
    let maintenanceCount = 0;
    let outOfServiceCount = 0;
    let retiredCount = 0;

    const eligibleVehicles: typeof allVehicles = [];

    for (const v of allVehicles) {
      switch (v.status) {
        case 'AVAILABLE':
          availableCount++;
          eligibleVehicles.push(v);
          break;
        case 'IN_TRANSIT':
          inTransitCount++;
          eligibleVehicles.push(v);
          break;
        case 'ASSIGNED':
          assignedCount++;
          eligibleVehicles.push(v);
          break;
        case 'MAINTENANCE':
          maintenanceCount++;
          eligibleVehicles.push(v);
          break;
        case 'OUT_OF_SERVICE':
          outOfServiceCount++;
          eligibleVehicles.push(v);
          break;
        case 'RETIRED':
          retiredCount++;
          // Excluded from operational fleet hours
          break;
        default:
          eligibleVehicles.push(v);
      }
    }

    const eligibleVehicleCount = eligibleVehicles.length;
    const totalEligibleFleetHours = Math.round(eligibleVehicleCount * windowHours * 100) / 100;

    // 3. Telemetry Filter
    const telemetryMatch: any = {
      organizationId: orgId,
      recordedAt: { $gte: windowStart, $lte: windowEnd },
    };

    if (sourcePolicy === 'HARDWARE_ONLY') {
      telemetryMatch.source = 'HARDWARE_GPS';
      telemetryMatch.isSimulated = false;
    } else if (sourcePolicy === 'SIMULATED_ONLY') {
      telemetryMatch.isSimulated = true;
    }

    // 4. Batch query telemetry points for all eligible vehicles
    const vehicleIds = eligibleVehicles.map((v) => v._id);
    telemetryMatch.vehicleId = { $in: vehicleIds };

    const telemetryEvents = await TelemetryEvent.find(telemetryMatch, {
      vehicleId: 1,
      recordedAt: 1,
      motionStatus: 1,
      speedKmh: 1,
      odometerKm: 1,
      source: 1,
      isSimulated: 1,
    })
      .sort({ vehicleId: 1, recordedAt: 1 })
      .lean();

    // Group telemetry points by vehicleId
    const telemetryByVehicle = new Map<string, any[]>();
    for (const te of telemetryEvents) {
      const vId = te.vehicleId.toString();
      if (!telemetryByVehicle.has(vId)) {
        telemetryByVehicle.set(vId, []);
      }
      telemetryByVehicle.get(vId)!.push(te);
    }

    // 5. Query maintenance records for downtime calculations
    const maintenanceRecords = await MaintenanceRecord.find({
      organizationId: orgId,
      vehicleId: { $in: vehicleIds },
      status: { $ne: 'CANCELLED' },
      $or: [
        { scheduledDate: { $lte: windowEnd }, completedDate: { $gte: windowStart } },
        { startedDate: { $lte: windowEnd }, completedDate: { $gte: windowStart } },
        { startedDate: { $lte: windowEnd }, completedDate: null },
      ],
    }).lean();

    const maintenanceByVehicle = new Map<string, any[]>();
    for (const mr of maintenanceRecords) {
      const vId = mr.vehicleId.toString();
      if (!maintenanceByVehicle.has(vId)) {
        maintenanceByVehicle.set(vId, []);
      }
      maintenanceByVehicle.get(vId)!.push(mr);
    }

    // 6. Compute per-vehicle performance metrics
    let totalFleetMovingHours = 0;
    let totalFleetIdleHours = 0;
    let totalFleetStoppedHours = 0;
    let totalFleetUnknownHours = 0;
    let totalFleetObservedHours = 0;
    let totalFleetMaintenanceDowntimeHours = 0;
    let totalFleetMaintenanceEvents = 0;
    let affectedVehiclesCount = 0;

    const vehicleSummaries: VehiclePerformanceSummary[] = [];

    for (const v of eligibleVehicles) {
      const vId = v._id.toString();
      const vEvents = telemetryByVehicle.get(vId) || [];
      const vMaintenance = maintenanceByVehicle.get(vId) || [];

      // Calculate motion intervals
      const motion = TelemetryIntervalService.calculateMotionIntervals(
        vEvents,
        windowStart,
        windowEnd
      );

      // Calculate maintenance downtime
      const downtime = MaintenanceDowntimeCalculator.calculateDowntime(
        vMaintenance,
        windowStart,
        windowEnd
      );

      const vehicleEligibleHours = windowHours;
      const coveragePct = vehicleEligibleHours > 0
        ? Math.min(100, Math.round((motion.observedHours / vehicleEligibleHours) * 1000) / 10)
        : 0;
      const coverageClass = TelemetryIntervalService.classifyCoverage(coveragePct);

      // Utilization is only meaningful if coverage >= 5%
      let utilizationPct: number | null = null;
      if (coveragePct >= 5 && vehicleEligibleHours > 0) {
        utilizationPct = Math.min(100, Math.round((motion.movingHours / vehicleEligibleHours) * 1000) / 10);
      }

      totalFleetMovingHours += motion.movingHours;
      totalFleetIdleHours += motion.idleHours;
      totalFleetStoppedHours += motion.stoppedHours;
      totalFleetUnknownHours += motion.unknownHours;
      totalFleetObservedHours += motion.observedHours;

      if (downtime.downtimeHours > 0) {
        totalFleetMaintenanceDowntimeHours += downtime.downtimeHours;
        affectedVehiclesCount++;
      }
      totalFleetMaintenanceEvents += downtime.eventCount;

      const isSimulatedOnly = vEvents.length > 0 && vEvents.every((e) => e.isSimulated);

      vehicleSummaries.push({
        vehicleId: vId,
        vin: v.vin,
        plateNumber: v.plateNumber,
        make: v.make,
        modelName: v.modelName,
        type: v.type,
        currentStatus: v.status,
        odometerKm: v.odometerKm,
        eligibleHours: vehicleEligibleHours,
        operatingHours: motion.movingHours,
        idleHours: motion.idleHours,
        stoppedHours: motion.stoppedHours,
        unknownHours: motion.unknownHours,
        utilizationPercentage: utilizationPct,
        coveragePercentage: coveragePct,
        coverageClassification: coverageClass,
        maintenanceDowntimeHours: downtime.downtimeHours,
        maintenanceEventCount: downtime.eventCount,
        telemetryEventCount: motion.eventCount,
        isSimulatedOnly,
      });
    }

    // 7. Fleet-wide aggregates
    const fleetCoveragePct = totalEligibleFleetHours > 0
      ? Math.min(100, Math.round((totalFleetObservedHours / totalEligibleFleetHours) * 1000) / 10)
      : 0;

    const fleetCoverageClass = TelemetryIntervalService.classifyCoverage(fleetCoveragePct);

    let fleetUtilizationPct: number | null = null;
    let utilizationClass: 'HIGH_UTILIZATION' | 'MODERATE_UTILIZATION' | 'UNDERUTILIZED' | 'INSUFFICIENT_DATA' =
      'INSUFFICIENT_DATA';

    if (fleetCoveragePct >= 5 && totalEligibleFleetHours > 0) {
      fleetUtilizationPct = Math.min(
        100,
        Math.round((totalFleetMovingHours / totalEligibleFleetHours) * 1000) / 10
      );
      if (fleetUtilizationPct >= 70) utilizationClass = 'HIGH_UTILIZATION';
      else if (fleetUtilizationPct >= 40) utilizationClass = 'MODERATE_UTILIZATION';
      else utilizationClass = 'UNDERUTILIZED';
    }

    const availableRatio = allVehicles.length > 0
      ? Math.round(((availableCount + inTransitCount) / allVehicles.length) * 1000) / 10
      : 0;

    // 8. Pagination for vehicle summaries
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const totalCount = vehicleSummaries.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const paginatedVehicles = vehicleSummaries.slice((page - 1) * limit, page * limit);

    return {
      reportingPeriod: {
        from: windowStart.toISOString(),
        to: windowEnd.toISOString(),
        timezone: tz,
        totalWindowHours: windowHours,
      },
      generatedAt: new Date().toISOString(),
      simulationPolicy: sourcePolicy,
      dataQuality: {
        totalEligibleVehicleHours: roundTwo(totalEligibleFleetHours),
        totalObservedHours: roundTwo(totalFleetObservedHours),
        fleetCoveragePercentage: fleetCoveragePct,
        classification: fleetCoverageClass,
      },
      utilization: {
        fleetUtilizationPercentage: fleetUtilizationPct,
        totalOperatingHours: roundTwo(totalFleetMovingHours),
        totalEligibleHours: roundTwo(totalEligibleFleetHours),
        classification: utilizationClass,
      },
      availabilitySnapshot: {
        totalFleetVehicles: allVehicles.length,
        eligibleVehicles: eligibleVehicleCount,
        availableCount,
        inTransitCount,
        assignedCount,
        maintenanceCount,
        outOfServiceCount,
        retiredCount,
        availabilityRatioPercent: availableRatio,
      },
      motionBreakdown: {
        totalMovingHours: roundTwo(totalFleetMovingHours),
        totalIdleHours: roundTwo(totalFleetIdleHours),
        totalStoppedHours: roundTwo(totalFleetStoppedHours),
        totalUnknownHours: roundTwo(totalFleetUnknownHours),
      },
      maintenance: {
        totalDowntimeHours: roundTwo(totalFleetMaintenanceDowntimeHours),
        affectedVehicleCount: affectedVehiclesCount,
        totalMaintenanceEvents: totalFleetMaintenanceEvents,
      },
      vehicles: paginatedVehicles,
      pagination: {
        totalCount,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Per-vehicle detailed analytics timeline and metrics.
   */
  public static async getVehicleDetailAnalytics(
    organizationId: Types.ObjectId | string,
    vehicleId: string,
    startDate: Date,
    endDate: Date,
    sourcePolicy: TelemetrySourcePolicy = 'ALL'
  ): Promise<VehiclePerformanceSummary & { vehicle: IVehicle }> {
    const orgId = typeof organizationId === 'string' ? new Types.ObjectId(organizationId) : organizationId;
    const vId = new Types.ObjectId(vehicleId);

    const vehicle = await Vehicle.findOne({ _id: vId, organizationId: orgId, isArchived: false });
    if (!vehicle) {
      throw new Error('VEHICLE_NOT_FOUND');
    }

    const overview = await this.getFleetOverview(orgId, {
      startDate,
      endDate,
      vehicleId,
      sourcePolicy,
      limit: 1,
    });

    const summary = overview.vehicles[0];
    if (!summary) {
      throw new Error('VEHICLE_ANALYTICS_UNAVAILABLE');
    }

    return {
      ...summary,
      vehicle,
    };
  }
}

function roundTwo(num: number): number {
  return Math.round(num * 100) / 100;
}
