'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Truck,
  Activity,
  Clock,
  Wrench,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  Radio,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface FleetOverviewData {
  reportingPeriod: {
    from: string;
    to: string;
    timezone: string;
    totalWindowHours: number;
  };
  generatedAt: string;
  simulationPolicy: string;
  dataQuality: {
    totalEligibleVehicleHours: number;
    totalObservedHours: number;
    fleetCoveragePercentage: number;
    classification: 'HIGH_COVERAGE' | 'PARTIAL_COVERAGE' | 'LOW_COVERAGE' | 'NO_DATA';
  };
  utilization: {
    fleetUtilizationPercentage: number | null;
    totalOperatingHours: number;
    totalEligibleHours: number;
    classification: string;
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
  vehicles: Array<{
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
    coverageClassification: string;
    maintenanceDowntimeHours: number;
    maintenanceEventCount: number;
    telemetryEventCount: number;
    isSimulatedOnly: boolean;
  }>;
  pagination: {
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function FleetAnalyticsPage() {
  const [data, setData] = useState<FleetOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<number>(30);
  const [sourcePolicy, setSourcePolicy] = useState<string>('ALL');

  useEffect(() => {
    fetchFleetAnalytics();
  }, [days, sourcePolicy]);

  const fetchFleetAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/analytics/fleet/overview?days=${days}&sourcePolicy=${sourcePolicy}`
      );
      if (!res.ok) {
        throw new Error(`Failed to load fleet analytics (HTTP ${res.status})`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error?.message || 'Unexpected response format.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error communicating with analytics service.');
    } finally {
      setLoading(false);
    }
  };

  const formatHours = (hours: number) => {
    return `${hours.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h`;
  };

  const getCoverageBadge = (classification: string, pct: number) => {
    switch (classification) {
      case 'HIGH_COVERAGE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3" /> High ({pct}%)
          </span>
        );
      case 'PARTIAL_COVERAGE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Activity className="w-3 h-3" /> Partial ({pct}%)
          </span>
        );
      case 'LOW_COVERAGE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3 h-3" /> Low ({pct}%)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-graphite-100 text-graphite-600 border border-graphite-200">
            <HelpCircle className="w-3 h-3" /> No Data
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-graphite-600 uppercase flex items-center gap-2">
            <span>Fleet Intelligence</span>
            <span>•</span>
            <span>Asset Utilization & Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
            Fleet Utilization & Motion Analytics
          </h1>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white border border-graphite-200 rounded-xl px-3 py-1.5 shadow-sm text-xs">
            <Filter className="w-3.5 h-3.5 text-graphite-500" />
            <span className="text-graphite-600 font-medium">Window:</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-transparent font-semibold text-navy-900 focus:outline-none"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-graphite-200 rounded-xl px-3 py-1.5 shadow-sm text-xs">
            <Radio className="w-3.5 h-3.5 text-graphite-500" />
            <span className="text-graphite-600 font-medium">Source:</span>
            <select
              value={sourcePolicy}
              onChange={(e) => setSourcePolicy(e.target.value)}
              className="bg-transparent font-semibold text-navy-900 focus:outline-none"
            >
              <option value="ALL">All Sources (GPS + Sim)</option>
              <option value="HARDWARE_ONLY">Hardware GPS Only</option>
              <option value="SIMULATED_ONLY">Simulated Only</option>
            </select>
          </div>

          <button
            onClick={fetchFleetAnalytics}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-graphite-200 hover:bg-graphite-50 text-graphite-700 transition shadow-sm"
            title="Refresh Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-graphite-100" />
          ))}
        </div>
      )}

      {/* Analytics Dashboard Body */}
      {data && (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Fleet Utilization */}
            <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-2">
              <div className="flex items-center justify-between text-graphite-600 text-xs font-medium">
                <span>Fleet Utilization %</span>
                <Activity className="w-4 h-4 text-fleet-orange" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-navy-900">
                  {data.utilization.fleetUtilizationPercentage !== null
                    ? `${data.utilization.fleetUtilizationPercentage}%`
                    : 'N/A'}
                </span>
                <span className="text-xs font-mono text-graphite-500">
                  {formatHours(data.utilization.totalOperatingHours)} operating
                </span>
              </div>
              <div className="text-[11px] text-graphite-600">
                Out of {formatHours(data.utilization.totalEligibleHours)} eligible fleet hours
              </div>
            </div>

            {/* Availability Snapshot */}
            <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-2">
              <div className="flex items-center justify-between text-graphite-600 text-xs font-medium">
                <span>Operational Availability</span>
                <Truck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-navy-900">
                  {data.availabilitySnapshot.availabilityRatioPercent}%
                </span>
                <span className="text-xs font-mono text-graphite-500">
                  {data.availabilitySnapshot.availableCount + data.availabilitySnapshot.inTransitCount} /{' '}
                  {data.availabilitySnapshot.totalFleetVehicles}
                </span>
              </div>
              <div className="text-[11px] text-graphite-600">
                {data.availabilitySnapshot.inTransitCount} In Transit •{' '}
                {data.availabilitySnapshot.maintenanceCount} in Maintenance
              </div>
            </div>

            {/* Idle-Time Waste */}
            <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-2">
              <div className="flex items-center justify-between text-graphite-600 text-xs font-medium">
                <span>Idle-Time Recorded</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-navy-900">
                  {formatHours(data.motionBreakdown.totalIdleHours)}
                </span>
                <span className="text-xs font-mono text-amber-600 font-bold">
                  Fuel impact tracked
                </span>
              </div>
              <div className="text-[11px] text-graphite-600">
                {formatHours(data.motionBreakdown.totalMovingHours)} Moving •{' '}
                {formatHours(data.motionBreakdown.totalStoppedHours)} Stopped
              </div>
            </div>

            {/* Maintenance Downtime */}
            <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-2">
              <div className="flex items-center justify-between text-graphite-600 text-xs font-medium">
                <span>Maintenance Downtime</span>
                <Wrench className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-navy-900">
                  {formatHours(data.maintenance.totalDowntimeHours)}
                </span>
                <span className="text-xs font-mono text-graphite-500">
                  {data.maintenance.totalMaintenanceEvents} events
                </span>
              </div>
              <div className="text-[11px] text-graphite-600">
                Across {data.maintenance.affectedVehicleCount} affected vehicles
              </div>
            </div>
          </div>

          {/* Motion Breakdown & Data Coverage Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Motion Duration Bar Visualizer */}
            <div className="lg:col-span-8 p-6 rounded-3xl bg-white border border-graphite-100 shadow-card space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-navy-900">Fleet Motion Distribution</h2>
                  <p className="text-xs text-graphite-600">
                    Calculated interval breakdown across {data.reportingPeriod.totalWindowHours}h window
                  </p>
                </div>
                {getCoverageBadge(
                  data.dataQuality.classification,
                  data.dataQuality.fleetCoveragePercentage
                )}
              </div>

              {/* Stacked Progress Bar */}
              <div className="space-y-2">
                <div className="w-full bg-graphite-100 rounded-full h-4 overflow-hidden flex">
                  {data.dataQuality.totalEligibleVehicleHours > 0 && (
                    <>
                      <div
                        style={{
                          width: `${(data.motionBreakdown.totalMovingHours / data.dataQuality.totalEligibleVehicleHours) * 100}%`,
                        }}
                        className="bg-emerald-500 h-full"
                        title={`Moving: ${data.motionBreakdown.totalMovingHours}h`}
                      />
                      <div
                        style={{
                          width: `${(data.motionBreakdown.totalIdleHours / data.dataQuality.totalEligibleVehicleHours) * 100}%`,
                        }}
                        className="bg-amber-400 h-full"
                        title={`Idle: ${data.motionBreakdown.totalIdleHours}h`}
                      />
                      <div
                        style={{
                          width: `${(data.motionBreakdown.totalStoppedHours / data.dataQuality.totalEligibleVehicleHours) * 100}%`,
                        }}
                        className="bg-blue-400 h-full"
                        title={`Stopped: ${data.motionBreakdown.totalStoppedHours}h`}
                      />
                      <div
                        style={{
                          width: `${(data.motionBreakdown.totalUnknownHours / data.dataQuality.totalEligibleVehicleHours) * 100}%`,
                        }}
                        className="bg-graphite-200 h-full"
                        title={`Unknown/Offline: ${data.motionBreakdown.totalUnknownHours}h`}
                      />
                    </>
                  )}
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span>Moving: {formatHours(data.motionBreakdown.totalMovingHours)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span>Idle: {formatHours(data.motionBreakdown.totalIdleHours)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-400" />
                    <span>Stopped: {formatHours(data.motionBreakdown.totalStoppedHours)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-graphite-200" />
                    <span>Unknown: {formatHours(data.motionBreakdown.totalUnknownHours)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Telemetry Data Freshness & Methodology */}
            <div className="lg:col-span-4 p-6 rounded-3xl bg-white border border-graphite-100 shadow-card space-y-4 text-xs">
              <h2 className="text-base font-bold text-navy-900">Data Integrity & Methodology</h2>
              <div className="space-y-3 font-mono text-graphite-700">
                <div className="flex justify-between py-1 border-b border-graphite-100">
                  <span>Reporting Timezone:</span>
                  <span className="font-bold text-navy-900">{data.reportingPeriod.timezone}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-graphite-100">
                  <span>Freshness Window:</span>
                  <span className="font-bold text-navy-900">300s (5m) Max Gap</span>
                </div>
                <div className="flex justify-between py-1 border-b border-graphite-100">
                  <span>Source Policy:</span>
                  <span className="font-bold text-navy-900">{data.simulationPolicy}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-graphite-100">
                  <span>Generated At:</span>
                  <span className="font-bold text-navy-900">
                    {new Date(data.generatedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Vehicle Performance Table */}
          <div className="bg-white rounded-3xl border border-graphite-100 shadow-card overflow-hidden">
            <div className="p-6 border-b border-graphite-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-navy-900">Vehicle Asset Performance</h2>
                <p className="text-xs text-graphite-600">
                  Individual asset operating metrics, idle times, and telemetry coverage
                </p>
              </div>
              <div className="text-xs font-mono text-graphite-500">
                Showing {data.vehicles.length} of {data.pagination.totalCount} assets
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-graphite-50 text-graphite-600 font-mono uppercase text-[11px] border-b border-graphite-200">
                  <tr>
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Utilization</th>
                    <th className="px-5 py-3">Moving Hours</th>
                    <th className="px-5 py-3">Idle Hours</th>
                    <th className="px-5 py-3">Maintenance</th>
                    <th className="px-5 py-3">Telemetry Coverage</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-graphite-100">
                  {data.vehicles.map((v) => (
                    <tr key={v.vehicleId} className="hover:bg-graphite-50/50 transition">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-navy-900">{v.plateNumber}</div>
                        <div className="text-[11px] text-graphite-500 font-mono">
                          {v.make} {v.modelName} • {v.type}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-navy-50 text-navy-900 font-semibold border border-navy-100">
                          {v.currentStatus}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-extrabold text-navy-900 text-sm">
                          {v.utilizationPercentage !== null ? `${v.utilizationPercentage}%` : 'N/A'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-navy-900">
                        {formatHours(v.operatingHours)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-amber-700">
                        {formatHours(v.idleHours)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-graphite-600">
                        {v.maintenanceDowntimeHours > 0 ? (
                          <span className="text-indigo-600 font-bold">
                            {formatHours(v.maintenanceDowntimeHours)} ({v.maintenanceEventCount})
                          </span>
                        ) : (
                          '0.0h'
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {getCoverageBadge(v.coverageClassification, v.coveragePercentage)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/fleet/${v.vehicleId}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-navy-700 hover:text-navy-900"
                        >
                          Details <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {data.vehicles.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-graphite-500">
                        No vehicles found matching the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
