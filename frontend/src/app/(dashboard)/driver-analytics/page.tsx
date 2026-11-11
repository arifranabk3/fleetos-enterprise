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
} from 'lucide-react';

export default function DriverAnalyticsPage() {
  const [rankings, setRankings] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [resRankings, resOverview] = await Promise.all([
        fetch(`/api/v1/drivers/performance/rankings?days=${days}`),
        fetch(`/api/v1/drivers/performance/overview?days=${days}`),
      ]);

      if (resRankings.ok) {
        const j = await resRankings.json();
        setRankings(j.data || []);
      }
      if (resOverview.ok) {
        const j = await resOverview.json();
        setOverview(j.data || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-graphite-600 uppercase flex items-center gap-2">
            <span>Workforce Analytics</span>
            <span>•</span>
            <span>Fleet Rankings & KPIs</span>
          </div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight mt-1">
            Driver Performance Intelligence
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-graphite-500">Evaluation Window:</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-1.5 text-xs rounded-xl border border-graphite-200 bg-white font-medium text-navy-900"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-graphite-100 shadow-sm">
          <p className="text-[11px] font-mono uppercase text-graphite-500">Total Enrolled</p>
          <p className="text-2xl font-extrabold text-navy-900 mt-1">{overview?.totalDrivers || 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 shadow-sm">
          <p className="text-[11px] font-mono uppercase text-indigo-700">Fleet Avg Score</p>
          <p className="text-2xl font-extrabold text-indigo-900 mt-1">
            {overview?.averageCompositeScore ? `${overview.averageCompositeScore}%` : 'N/A'}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 shadow-sm">
          <p className="text-[11px] font-mono uppercase text-emerald-700">Top Tier (Excellent)</p>
          <p className="text-2xl font-extrabold text-emerald-800 mt-1">{overview?.excellentCount || 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100 shadow-sm">
          <p className="text-[11px] font-mono uppercase text-amber-700">Coaching Required</p>
          <p className="text-2xl font-extrabold text-amber-800 mt-1">{overview?.needsImprovementCount || 0}</p>
        </div>
      </div>

      {/* Fleet Rankings Table */}
      <div className="bg-white rounded-2xl border border-graphite-100 shadow-card overflow-hidden">
        <div className="p-4 border-b border-graphite-100">
          <h2 className="text-xs font-bold text-navy-900 uppercase font-mono tracking-wider">
            Fleet Driver Scorecard Rankings
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs font-mono text-graphite-500">
            Calculating fleet scorecard rankings...
          </div>
        ) : rankings.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-graphite-500">
            No driver data found for this evaluation period.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-graphite-100 bg-graphite-50/50 text-graphite-500 font-mono uppercase text-[11px]">
                <th className="py-3 px-4 font-semibold">Rank</th>
                <th className="py-3 px-4 font-semibold">Driver Name</th>
                <th className="py-3 px-4 font-semibold">Composite Score</th>
                <th className="py-3 px-4 font-semibold">Deliveries (On-Time %)</th>
                <th className="py-3 px-4 font-semibold">Safety Score</th>
                <th className="py-3 px-4 font-semibold">Attendance</th>
                <th className="py-3 px-4 font-semibold text-right">Scorecard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100 font-mono">
              {rankings.map((r, index) => (
                <tr key={r.driverId} className="hover:bg-graphite-50/50 transition">
                  <td className="py-3.5 px-4 font-extrabold text-navy-900">#{index + 1}</td>
                  <td className="py-3.5 px-4 font-bold text-navy-900">{r.driverName}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        r.compositePerformanceScore >= 90
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.compositePerformanceScore >= 75
                          ? 'bg-blue-100 text-blue-800'
                          : r.compositePerformanceScore >= 60
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-graphite-100 text-graphite-600'
                      }`}
                    >
                      {r.hasSufficientData ? `${r.compositePerformanceScore} pts (${r.scoreTier})` : 'Insufficient Data'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-graphite-700">
                    {r.completedDeliveries} / {r.totalAssignedShipments} ({r.onTimeDeliveryRatePercent}%)
                  </td>
                  <td className="py-3.5 px-4 text-graphite-700">{r.safetyScore} / 100</td>
                  <td className="py-3.5 px-4 text-graphite-700">{r.attendanceReliabilityPercent}%</td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href={`/drivers/${r.driverId}/performance`}
                      className="text-fleet-orange font-bold hover:underline"
                    >
                      Inspect →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
