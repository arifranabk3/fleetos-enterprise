'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Award,
  Shield,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Users,
  Clock,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  ChevronRight,
  BarChart3,
  Calendar,
  Lock,
} from 'lucide-react';
import {
  FleetWorkforceOverview,
  DriverLeaderboardEntry,
  ShiftVarianceAnalytics,
  DriverScoreTier,
} from '@/types/driverAnalytics';

export default function DriverAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'variance'>('leaderboard');
  const [rankings, setRankings] = useState<DriverLeaderboardEntry[]>([]);
  const [overview, setOverview] = useState<FleetWorkforceOverview | null>(null);
  const [variance, setVariance] = useState<ShiftVarianceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    setPermissionDenied(false);

    try {
      const [resRankings, resOverview, resVariance] = await Promise.all([
        fetch(`/api/v1/analytics/drivers/rankings?days=${days}&limit=50`),
        fetch(`/api/v1/analytics/drivers/fleet-overview?days=${days}`),
        fetch(`/api/v1/analytics/drivers/shift-variance?days=${days}`),
      ]);

      if (resRankings.status === 403 || resOverview.status === 403) {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      if (!resRankings.ok || !resOverview.ok) {
        throw new Error(
          `Failed to load fleet analytics (HTTP ${resRankings.status}/${resOverview.status})`
        );
      }

      const jsonRankings = await resRankings.json();
      const jsonOverview = await resOverview.json();

      if (jsonRankings.success && jsonRankings.data) {
        setRankings(jsonRankings.data);
      }
      if (jsonOverview.success && jsonOverview.data) {
        setOverview(jsonOverview.data);
      }

      if (resVariance.ok) {
        const jsonVariance = await resVariance.json();
        if (jsonVariance.success && jsonVariance.data) {
          setVariance(jsonVariance.data);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error communicating with driver analytics service.');
    } finally {
      setLoading(false);
    }
  };

  const getTierBadge = (tier: DriverScoreTier, score: number | null) => {
    switch (tier) {
      case 'EXCELLENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3" /> Excellent ({score} pts)
          </span>
        );
      case 'GOOD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <CheckCircle className="w-3 h-3" /> Good ({score} pts)
          </span>
        );
      case 'SATISFACTORY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3" /> Satisfactory ({score} pts)
          </span>
        );
      case 'NEEDS_IMPROVEMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3" /> Needs Coaching ({score} pts)
          </span>
        );
      case 'INSUFFICIENT_DATA':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-graphite-100 text-graphite-600 border border-graphite-200">
            <HelpCircle className="w-3 h-3" /> Insufficient Data
          </span>
        );
    }
  };

  if (permissionDenied) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 text-center bg-white border border-graphite-200 rounded-2xl shadow-card space-y-4">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-extrabold text-navy-900 tracking-tight">Access Restricted</h2>
        <p className="text-xs text-graphite-600 leading-relaxed">
          Your current organizational role does not have authorization to view fleet workforce analytics
          and driver rankings (<code className="bg-graphite-100 px-1 py-0.5 rounded text-navy-900">driver.analytics.read</code>).
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold transition"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-graphite-600 uppercase flex items-center gap-2">
            <span>Workforce Analytics</span>
            <span>•</span>
            <span>Driver Performance & Safety Intelligence</span>
          </div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight mt-1">
            Fleet Driver Intelligence & Leaderboard
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-graphite-500">Evaluation Window:</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-1.5 text-xs rounded-xl border border-graphite-200 bg-white font-medium text-navy-900 focus:outline-none focus:border-navy-900 shadow-sm"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
          <button
            onClick={fetchAnalytics}
            className="p-1.5 rounded-lg border border-graphite-200 hover:bg-graphite-50 text-graphite-600 transition"
            title="Refresh Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Overview Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-graphite-100 shadow-card">
          <div className="flex items-center justify-between text-graphite-500 mb-1">
            <span className="text-[11px] font-mono uppercase">Enrolled Drivers</span>
            <Users className="w-4 h-4 text-graphite-400" />
          </div>
          <div className="text-2xl font-extrabold text-navy-900 font-mono">
            {loading ? '...' : overview?.totalActiveDrivers ?? 0}
          </div>
          <div className="text-[11px] font-mono text-graphite-500 mt-1">
            {overview?.scoredDriversCount ?? 0} scored • {overview?.insufficientDataDriversCount ?? 0} pending data
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-graphite-100 shadow-card">
          <div className="flex items-center justify-between text-indigo-600 mb-1">
            <span className="text-[11px] font-mono uppercase">Fleet Avg CPS</span>
            <Award className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-900 font-mono">
            {loading
              ? '...'
              : overview?.fleetAverageCompositeScore !== null && overview?.fleetAverageCompositeScore !== undefined
              ? `${overview.fleetAverageCompositeScore} pts`
              : 'N/A'}
          </div>
          <div className="text-[11px] font-mono text-indigo-700 mt-1">
            40% Deliv • 30% Safe • 20% Att • 10% Comp
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-graphite-100 shadow-card">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[11px] font-mono uppercase">Top Tier (Elite/Good)</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-800 font-mono">
            {loading
              ? '...'
              : (overview?.tierDistribution?.EXCELLENT ?? 0) + (overview?.tierDistribution?.GOOD ?? 0)}
          </div>
          <div className="text-[11px] font-mono text-emerald-700 mt-1">
            {overview?.tierDistribution?.EXCELLENT ?? 0} Excellent • {overview?.tierDistribution?.GOOD ?? 0} Good
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-graphite-100 shadow-card">
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-[11px] font-mono uppercase">Coaching Required</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-800 font-mono">
            {loading ? '...' : overview?.tierDistribution?.NEEDS_IMPROVEMENT ?? 0}
          </div>
          <div className="text-[11px] font-mono text-amber-700 mt-1">
            {overview?.totalIncidentsCount ?? 0} recorded incidents in period
          </div>
        </div>
      </div>

      {/* Tabs & View Switcher */}
      <div className="flex border-b border-graphite-200 gap-6">
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`pb-3 text-xs font-mono font-bold uppercase transition flex items-center gap-2 border-b-2 ${
            activeTab === 'leaderboard'
              ? 'border-navy-900 text-navy-900'
              : 'border-transparent text-graphite-400 hover:text-navy-900'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Driver Leaderboard & CPS Rankings ({rankings.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('variance')}
          className={`pb-3 text-xs font-mono font-bold uppercase transition flex items-center gap-2 border-b-2 ${
            activeTab === 'variance'
              ? 'border-navy-900 text-navy-900'
              : 'border-transparent text-graphite-400 hover:text-navy-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Shift Hours & Overtime Audit</span>
        </button>
      </div>

      {/* Tab 1: Leaderboard Table */}
      {activeTab === 'leaderboard' && (
        <div className="bg-white rounded-2xl border border-graphite-100 shadow-card overflow-hidden">
          <div className="p-4 border-b border-graphite-100 flex items-center justify-between bg-graphite-50/50">
            <div>
              <h2 className="text-xs font-bold text-navy-900 uppercase font-mono tracking-wider">
                Ranked Driver Performance Leaderboard
              </h2>
              <p className="text-[11px] text-graphite-500 font-sans mt-0.5">
                Deterministic Composite Performance Score (CPS) derived from verified deliveries, safety conclusions, attendance reliability, and document compliance.
              </p>
            </div>
            <span className="text-[10px] font-mono text-graphite-400 uppercase">
              Top {rankings.length} Drivers
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs font-mono text-graphite-500 space-y-3">
              <div className="w-6 h-6 border-2 border-navy-900 border-t-transparent rounded-full animate-spin mx-auto" />
              <span>Calculating verifiable fleet scorecard rankings...</span>
            </div>
          ) : rankings.length === 0 ? (
            <div className="p-12 text-center text-xs font-mono text-graphite-500 space-y-2">
              <p>No driver scorecard records found for this evaluation period ({days} days).</p>
              <p className="text-[11px] text-graphite-400 font-sans">
                Ensure drivers are enrolled and have completed shifts or shipments within the selected window.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-graphite-100 bg-graphite-50/70 text-graphite-500 font-mono uppercase text-[11px]">
                    <th className="py-3 px-4 font-semibold w-16">Rank</th>
                    <th className="py-3 px-4 font-semibold">Driver Name</th>
                    <th className="py-3 px-4 font-semibold">Score Tier</th>
                    <th className="py-3 px-4 font-semibold">Composite Score</th>
                    <th className="py-3 px-4 font-semibold">Delivery (40%)</th>
                    <th className="py-3 px-4 font-semibold">Safety (30%)</th>
                    <th className="py-3 px-4 font-semibold">Attendance (20%)</th>
                    <th className="py-3 px-4 font-semibold">Compliance (10%)</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-graphite-100 font-mono">
                  {rankings.map((r) => (
                    <tr key={r.driverId} className="hover:bg-graphite-50/50 transition">
                      <td className="py-3 px-4 font-extrabold text-navy-900">
                        {r.rank <= 3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-navy-900 text-white text-[11px]">
                            {r.rank}
                          </span>
                        ) : (
                          `#${r.rank}`
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-navy-900 font-sans">
                        {r.driverName}
                      </td>
                      <td className="py-3 px-4">
                        {getTierBadge(r.scoreTier, r.compositePerformanceScore)}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-navy-900">
                        {r.compositePerformanceScore !== null && r.compositePerformanceScore !== undefined
                          ? `${r.compositePerformanceScore} pts`
                          : 'INSUFFICIENT_DATA'}
                      </td>
                      <td className="py-3 px-4 text-graphite-700">
                        {r.deliveryScore !== null ? `${r.deliveryScore} / 100` : 'N/A'}
                        <span className="block text-[10px] text-graphite-400">
                          {r.completedDeliveries} deliv
                        </span>
                      </td>
                      <td className="py-3 px-4 text-graphite-700">
                        {r.safetyScore !== null ? `${r.safetyScore} / 100` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-graphite-700">
                        {r.attendanceScore !== null ? `${r.attendanceScore} / 100` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-graphite-700">
                        {r.complianceScore !== null ? `${r.complianceScore} / 100` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/drivers/${r.driverId}/performance`}
                          className="inline-flex items-center gap-1 text-fleet-orange font-bold hover:underline"
                        >
                          <span>Profile</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Shift Hours Variance & Overtime Audit */}
      {activeTab === 'variance' && (
        <div className="bg-white rounded-2xl border border-graphite-100 shadow-card overflow-hidden">
          <div className="p-4 border-b border-graphite-100 flex items-center justify-between bg-graphite-50/50">
            <div>
              <h2 className="text-xs font-bold text-navy-900 uppercase font-mono tracking-wider">
                Shift Hours Variance & Overtime Reconciliation
              </h2>
              <p className="text-[11px] text-graphite-500 font-sans mt-0.5">
                Audit of scheduled vs actual shift hours worked, unexcused overtime, and punctuality rate.
              </p>
            </div>
            {variance && (
              <span className="text-[11px] font-mono text-graphite-500">
                Punctuality: <strong className="text-navy-900">{variance.fleetPunctualityRate}%</strong>
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs font-mono text-graphite-500">
              Aggregating shift variance records...
            </div>
          ) : !variance || variance.discrepancyDrivers.length === 0 ? (
            <div className="p-12 text-center text-xs font-mono text-graphite-500">
              No shift hours variance detected in this {days}-day period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-graphite-100 bg-graphite-50/70 text-graphite-500 font-mono uppercase text-[11px]">
                    <th className="py-3 px-4 font-semibold">Driver Name</th>
                    <th className="py-3 px-4 font-semibold">Planned Hours</th>
                    <th className="py-3 px-4 font-semibold">Actual Hours</th>
                    <th className="py-3 px-4 font-semibold">Net Variance</th>
                    <th className="py-3 px-4 font-semibold">Overtime Hours</th>
                    <th className="py-3 px-4 font-semibold">Late Starts</th>
                    <th className="py-3 px-4 font-semibold text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-graphite-100 font-mono">
                  {variance.discrepancyDrivers.map((d) => (
                    <tr key={d.driverId} className="hover:bg-graphite-50/50 transition">
                      <td className="py-3 px-4 font-bold text-navy-900 font-sans">{d.driverName}</td>
                      <td className="py-3 px-4 text-graphite-700">{d.plannedHours.toFixed(1)}h</td>
                      <td className="py-3 px-4 text-navy-900 font-semibold">{d.actualHours.toFixed(1)}h</td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold ${
                            d.varianceHours > 0
                              ? 'text-amber-600'
                              : d.varianceHours < 0
                              ? 'text-rose-600'
                              : 'text-graphite-600'
                          }`}
                        >
                          {d.varianceHours > 0 ? `+${d.varianceHours.toFixed(1)}h` : `${d.varianceHours.toFixed(1)}h`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-graphite-700">
                        {d.overtimeHours > 0 ? (
                          <span className="text-amber-700 font-bold">+{d.overtimeHours.toFixed(1)}h</span>
                        ) : (
                          '0.0h'
                        )}
                      </td>
                      <td className="py-3 px-4 text-graphite-700">
                        {d.lateStarts > 0 ? (
                          <span className="text-rose-600 font-bold">{d.lateStarts} late</span>
                        ) : (
                          <span className="text-emerald-700">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/drivers/${d.driverId}/performance`}
                          className="text-fleet-orange font-bold hover:underline"
                        >
                          View Scorecard →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
