'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Award,
  Shield,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  AlertCircle,
  Calendar,
  Clock,
  FileCheck,
  Package,
  HelpCircle,
  RefreshCw,
  Lock,
} from 'lucide-react';
import {
  DriverScorecardAnalytics,
  DriverTrendPoint,
  DriverScoreTier,
} from '@/types/driverAnalytics';

export default function DriverPerformancePage() {
  const params = useParams();
  const id = params?.id as string;

  const [scorecard, setScorecard] = useState<DriverScorecardAnalytics | null>(null);
  const [trends, setTrends] = useState<DriverTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (id) {
      fetchScorecardAndTrend();
    }
  }, [id, days]);

  const fetchScorecardAndTrend = async () => {
    setLoading(true);
    setError(null);
    setPermissionDenied(false);

    try {
      const [resScorecard, resTrend] = await Promise.all([
        fetch(`/api/v1/analytics/drivers/${id}?days=${days}`),
        fetch(`/api/v1/analytics/drivers/${id}/trend?months=6`),
      ]);

      if (resScorecard.status === 403 || resTrend.status === 403) {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      if (resScorecard.status === 404) {
        throw new Error('Driver profile not found or belongs to another organization.');
      }

      if (!resScorecard.ok) {
        throw new Error(`Failed to load driver scorecard (HTTP ${resScorecard.status})`);
      }

      const jsonScorecard = await resScorecard.json();
      if (jsonScorecard.success && jsonScorecard.data) {
        setScorecard(jsonScorecard.data);
      } else {
        throw new Error(jsonScorecard.error?.message || 'Invalid scorecard response.');
      }

      if (resTrend.ok) {
        const jsonTrend = await resTrend.json();
        if (jsonTrend.success && jsonTrend.data) {
          setTrends(jsonTrend.data);
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" /> EXCELLENT ({score} pts)
          </span>
        );
      case 'GOOD':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-sky-100 text-sky-800 border border-sky-200">
            <CheckCircle className="w-3.5 h-3.5" /> GOOD ({score} pts)
          </span>
        );
      case 'SATISFACTORY':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" /> SATISFACTORY ({score} pts)
          </span>
        );
      case 'NEEDS_IMPROVEMENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" /> NEEDS COACHING ({score} pts)
          </span>
        );
      case 'INSUFFICIENT_DATA':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-graphite-100 text-graphite-700 border border-graphite-200">
            <HelpCircle className="w-3.5 h-3.5 text-graphite-500" /> INSUFFICIENT DATA
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
          You do not have permission to inspect this driver's scorecard, or you are attempting to access
          another driver's record (<code className="bg-graphite-100 px-1 py-0.5 rounded text-navy-900">driver.performance.read</code>).
        </p>
        <div className="pt-2">
          <Link
            href="/driver-analytics"
            className="inline-flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold transition"
          >
            Back to Driver Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/drivers/${id}`}
          className="inline-flex items-center gap-2 text-xs font-mono text-graphite-600 hover:text-navy-900 mb-2 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Driver Profile</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-graphite-600 uppercase">
              <span>Workforce Analytics</span>
              <span>•</span>
              <span>Driver Performance Scorecard</span>
            </div>
            <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight mt-1">
              {scorecard?.driverName || 'Driver Performance Profile'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-graphite-500">Evaluation Window:</span>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="px-3 py-1.5 text-xs rounded-xl border border-graphite-200 bg-white font-medium text-navy-900 shadow-sm"
              >
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 90 Days</option>
              </select>
            </div>
            <button
              onClick={fetchScorecardAndTrend}
              className="p-1.5 rounded-lg border border-graphite-200 hover:bg-graphite-50 text-graphite-600 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-xs font-mono text-graphite-500 bg-white rounded-2xl border border-graphite-100 space-y-3">
          <div className="w-6 h-6 border-2 border-navy-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <span>Synthesizing multi-dimensional driver scorecard...</span>
        </div>
      ) : !scorecard ? (
        <div className="p-12 text-center text-xs font-mono text-graphite-500 bg-white rounded-2xl border border-graphite-100">
          No scorecard data available for this driver.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Score Banner */}
          <div className="p-6 rounded-2xl bg-white border border-graphite-100 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase text-graphite-500">
                Composite Performance Score (CPS)
              </span>
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-extrabold text-navy-900 font-mono">
                  {scorecard.hasSufficientData && scorecard.compositePerformanceScore !== null
                    ? `${scorecard.compositePerformanceScore} / 100`
                    : 'N/A'}
                </span>
                {getTierBadge(scorecard.scoreTier, scorecard.compositePerformanceScore)}
              </div>
              {!scorecard.hasSufficientData ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg font-sans">
                  <strong>Notice:</strong> Insufficient operational data. A minimum of 5 completed shifts, 5 shipments, and active compliance documents are required for an authoritative score. Missing dimensions are never fabricated as zero.
                </p>
              ) : (
                <p className="text-xs text-graphite-500 font-sans">
                  Derived from 4 independent verifiable pillars: Delivery (40%), Safety (30%), Attendance (20%), Document Compliance (10%).
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 w-full md:w-auto font-mono text-xs">
              <div className="p-3 rounded-xl bg-graphite-50 border border-graphite-100">
                <p className="text-[10px] text-graphite-500 uppercase">Completed Shifts</p>
                <p className="text-base font-bold text-navy-900 mt-0.5">
                  {scorecard.attendance.completedShiftCount} / {scorecard.attendance.eligibleScheduledShiftCount}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-graphite-50 border border-graphite-100">
                <p className="text-[10px] text-graphite-500 uppercase">Completed Deliveries</p>
                <p className="text-base font-bold text-navy-900 mt-0.5">
                  {scorecard.delivery.deliveredCount} / {scorecard.delivery.totalAssignedShipments}
                </p>
              </div>
            </div>
          </div>

          {/* 4 Pillars Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pillar 1: Delivery Operations (40%) */}
            <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-navy-900 font-bold text-xs uppercase font-mono">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <span>1. Delivery (40%)</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-navy-900">
                    {scorecard.delivery.deliveryScore !== null ? `${scorecard.delivery.deliveryScore} pts` : 'N/A'}
                  </span>
                </div>
                <div className="space-y-2 text-xs font-mono text-graphite-600 pt-3 mt-2 border-t border-graphite-100">
                  <div className="flex justify-between">
                    <span>Assigned Shipments:</span>
                    <span className="text-navy-900 font-bold">{scorecard.delivery.totalAssignedShipments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>On-Time Delivered:</span>
                    <span className="text-emerald-700 font-bold">{scorecard.delivery.onTimeDeliveredCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>On-Time Rate:</span>
                    <span className="text-navy-900 font-bold">
                      {scorecard.delivery.onTimeDeliveryRate !== null ? `${scorecard.delivery.onTimeDeliveryRate}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Excused Customer Delays:</span>
                    <span className="text-graphite-500">{scorecard.delivery.excusableDelaysApplied}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cancelled (Excluded):</span>
                    <span className="text-graphite-400">{scorecard.delivery.cancelledShipmentsExcluded}</span>
                  </div>
                </div>
              </div>
              <div className="pt-2 text-[10px] font-mono text-graphite-400 border-t border-graphite-100">
                Threshold: ≥5 shipments ({scorecard.delivery.hasSufficientData ? 'Met' : 'Pending'})
              </div>
            </div>

            {/* Pillar 2: Safety & Incidents (30%) */}
            <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-navy-900 font-bold text-xs uppercase font-mono">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span>2. Safety (30%)</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-navy-900">
                    {scorecard.safety.safetyScore !== null ? `${scorecard.safety.safetyScore} pts` : 'N/A'}
                  </span>
                </div>
                <div className="space-y-2 text-xs font-mono text-graphite-600 pt-3 mt-2 border-t border-graphite-100">
                  <div className="flex justify-between">
                    <span>Total Incidents:</span>
                    <span className="text-navy-900 font-bold">{scorecard.safety.totalIncidents}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Driver Fault Concluded:</span>
                    <span className="text-rose-600 font-bold">{scorecard.safety.concludedResponsibleIncidents}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shared Fault (50%):</span>
                    <span className="text-amber-600 font-bold">{scorecard.safety.sharedResponsibilityIncidents}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Exonerated (0 deduction):</span>
                    <span className="text-emerald-700 font-bold">{scorecard.safety.exoneratedIncidents}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Under Review:</span>
                    <span className="text-graphite-400">{scorecard.safety.pendingIncidents}</span>
                  </div>
                </div>
              </div>
              <div className="pt-2 text-[10px] font-mono text-graphite-400 border-t border-graphite-100">
                Presumption of innocence enforced
              </div>
            </div>

            {/* Pillar 3: Attendance Reliability (20%) */}
            <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-navy-900 font-bold text-xs uppercase font-mono">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>3. Attendance (20%)</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-navy-900">
                    {scorecard.attendance.attendanceReliabilityIndex !== null ? `${scorecard.attendance.attendanceReliabilityIndex} pts` : 'N/A'}
                  </span>
                </div>
                <div className="space-y-2 text-xs font-mono text-graphite-600 pt-3 mt-2 border-t border-graphite-100">
                  <div className="flex justify-between">
                    <span>Reliability Index:</span>
                    <span className="text-navy-900 font-bold">
                      {scorecard.attendance.attendanceReliabilityIndex !== null ? `${scorecard.attendance.attendanceReliabilityIndex}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>On-Time Starts:</span>
                    <span className="text-emerald-700 font-bold">{scorecard.attendance.completedOnTimeShiftCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Late Starts (50% cred):</span>
                    <span className="text-amber-600 font-bold">{scorecard.attendance.lateShiftCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Unexcused Missed:</span>
                    <span className="text-rose-600 font-bold">{scorecard.attendance.missedShiftCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hours Worked:</span>
                    <span className="text-navy-900">{scorecard.attendance.totalActualHours.toFixed(1)}h</span>
                  </div>
                </div>
              </div>
              <div className="pt-2 text-[10px] font-mono text-graphite-400 border-t border-graphite-100">
                Threshold: ≥5 shifts ({scorecard.attendance.hasSufficientData ? 'Met' : 'Pending'})
              </div>
            </div>

            {/* Pillar 4: Document Compliance (10%) */}
            <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-navy-900 font-bold text-xs uppercase font-mono">
                    <FileCheck className="w-4 h-4 text-fleet-orange" />
                    <span>4. Compliance (10%)</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-navy-900">
                    {scorecard.compliance.score !== null ? `${scorecard.compliance.score} pts` : 'N/A'}
                  </span>
                </div>
                <div className="space-y-2 text-xs font-mono text-graphite-600 pt-3 mt-2 border-t border-graphite-100">
                  <div className="flex justify-between">
                    <span>Total Required Docs:</span>
                    <span className="text-navy-900 font-bold">{scorecard.compliance.totalDocuments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valid & Verified:</span>
                    <span className="text-emerald-700 font-bold">{scorecard.compliance.validRequiredDocs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expired Required:</span>
                    <span className="text-rose-600 font-bold">{scorecard.compliance.expiredRequiredDocs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Missing Required:</span>
                    <span className="text-rose-600 font-bold">{scorecard.compliance.missingRequiredDocs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Compliance Rate:</span>
                    <span className="text-navy-900 font-bold">
                      {scorecard.compliance.complianceRate !== null ? `${scorecard.compliance.complianceRate}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 text-[10px] font-mono text-graphite-400 border-t border-graphite-100">
                CDL & Medical Fitness audit
              </div>
            </div>
          </div>

          {/* Historical Trend Trajectory */}
          <div className="bg-white rounded-2xl border border-graphite-100 shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xs font-bold text-navy-900 uppercase font-mono tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-fleet-orange" />
                  <span>Historical Performance Trajectory (Last 6 Months)</span>
                </h2>
                <p className="text-[11px] text-graphite-500 font-sans mt-0.5">
                  Monthly Composite Performance Score progression and dimension breakdown.
                </p>
              </div>
            </div>

            {trends.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-graphite-400">
                No historical trend points recorded for this driver.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-graphite-100 bg-graphite-50/70 text-graphite-500 font-mono uppercase text-[11px]">
                      <th className="py-2.5 px-4 font-semibold">Period</th>
                      <th className="py-2.5 px-4 font-semibold">Composite Score</th>
                      <th className="py-2.5 px-4 font-semibold">Delivery Score</th>
                      <th className="py-2.5 px-4 font-semibold">Safety Score</th>
                      <th className="py-2.5 px-4 font-semibold">Attendance Score</th>
                      <th className="py-2.5 px-4 font-semibold">Deliveries</th>
                      <th className="py-2.5 px-4 font-semibold">Incidents</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-graphite-100 font-mono">
                    {trends.map((t) => (
                      <tr key={t.periodLabel} className="hover:bg-graphite-50/50 transition">
                        <td className="py-3 px-4 font-bold text-navy-900">{t.periodLabel}</td>
                        <td className="py-3 px-4">
                          {t.compositePerformanceScore !== null ? (
                            <span className="font-extrabold text-navy-900">
                              {t.compositePerformanceScore} pts
                            </span>
                          ) : (
                            <span className="text-graphite-400 text-[11px]">INSUFFICIENT_DATA</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-graphite-700">
                          {t.deliveryScore !== null ? `${t.deliveryScore} pts` : '—'}
                        </td>
                        <td className="py-3 px-4 text-graphite-700">
                          {t.safetyScore !== null ? `${t.safetyScore} pts` : '—'}
                        </td>
                        <td className="py-3 px-4 text-graphite-700">
                          {t.attendanceScore !== null ? `${t.attendanceScore} pts` : '—'}
                        </td>
                        <td className="py-3 px-4 text-graphite-700">{t.completedDeliveries}</td>
                        <td className="py-3 px-4 text-graphite-700">
                          {t.concludedIncidents > 0 ? (
                            <span className="text-rose-600 font-bold">{t.concludedIncidents}</span>
                          ) : (
                            <span className="text-emerald-700">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
