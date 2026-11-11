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
  Fuel,
  Wrench,
  Calendar,
} from 'lucide-react';

export default function DriverPerformancePage() {
  const params = useParams();
  const id = params?.id as string;

  const [scorecard, setScorecard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (id) fetchScorecard();
  }, [id, days]);

  const fetchScorecard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/drivers/${id}/performance?days=${days}`);
      if (res.ok) {
        const j = await res.json();
        setScorecard(j.data);
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
      <div>
        <Link
          href={`/drivers/${id}`}
          className="inline-flex items-center gap-2 text-xs font-mono text-graphite-600 hover:text-navy-900 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Driver Profile</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
              Driver Performance Scorecard
            </h1>
            <p className="text-xs text-graphite-600 mt-0.5">
              Transparent, measurable KPI evaluation based on verified delivery on-time rates, safety, fuel efficiency, and attendance.
            </p>
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
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-graphite-500 bg-white rounded-2xl border border-graphite-100">
          Calculating verifiable operational metrics...
        </div>
      ) : !scorecard ? (
        <div className="p-12 text-center text-xs font-mono text-graphite-500 bg-white rounded-2xl border border-graphite-100">
          No scorecard data available.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Score Banner */}
          <div className="p-6 rounded-2xl bg-white border border-graphite-100 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase text-graphite-500">
                Composite FleetOS Performance Index
              </span>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-extrabold text-navy-900">
                  {scorecard.hasSufficientData ? `${scorecard.compositePerformanceScore}/100` : 'N/A'}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                    scorecard.scoreTier === 'EXCELLENT'
                      ? 'bg-emerald-100 text-emerald-800'
                      : scorecard.scoreTier === 'GOOD'
                      ? 'bg-blue-100 text-blue-800'
                      : scorecard.scoreTier === 'SATISFACTORY'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-graphite-100 text-graphite-600'
                  }`}
                >
                  {scorecard.scoreTier}
                </span>
              </div>
              <p className="text-xs text-graphite-500">
                Derived from 4 weighted core pillars: Delivery (40%), Safety (30%), Attendance (20%), Compliance (10%).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full md:w-auto font-mono text-xs">
              <div className="p-3 rounded-xl bg-graphite-50 border border-graphite-100">
                <p className="text-[10px] text-graphite-500">Deliveries Completed</p>
                <p className="text-base font-bold text-navy-900 mt-0.5">
                  {scorecard.completedDeliveries} / {scorecard.totalAssignedShipments}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-graphite-50 border border-graphite-100">
                <p className="text-[10px] text-graphite-500">On-Time Rate</p>
                <p className="text-base font-bold text-navy-900 mt-0.5">
                  {scorecard.onTimeDeliveryRatePercent}%
                </p>
              </div>
            </div>
          </div>

          {/* 4 Pillars Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pillar 1: Delivery Operations */}
            <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-3">
              <div className="flex items-center gap-2 text-navy-900 font-bold text-xs uppercase font-mono">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>1. Delivery Reliability</span>
              </div>
              <div className="space-y-2 text-xs font-mono text-graphite-600 pt-2 border-t border-graphite-100">
                <div className="flex justify-between">
                  <span>Shipment Completion:</span>
                  <span className="text-navy-900 font-bold">{scorecard.completionRatePercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Failed Deliveries:</span>
                  <span className="text-rose-600 font-bold">{scorecard.failedDeliveries}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cancelled (Excluded):</span>
                  <span className="text-graphite-400">{scorecard.cancelledShipmentsExcluded}</span>
                </div>
              </div>
            </div>

            {/* Pillar 2: Safety & Incidents */}
            <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-3">
              <div className="flex items-center gap-2 text-navy-900 font-bold text-xs uppercase font-mono">
                <Shield className="w-4 h-4 text-blue-600" />
                <span>2. Safety & Incidents</span>
              </div>
              <div className="space-y-2 text-xs font-mono text-graphite-600 pt-2 border-t border-graphite-100">
                <div className="flex justify-between">
                  <span>Safety Pillar Score:</span>
                  <span className="text-navy-900 font-bold">{scorecard.safetyScore} / 100</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Incidents:</span>
                  <span className="text-navy-900 font-bold">{scorecard.totalIncidents}</span>
                </div>
                <div className="flex justify-between">
                  <span>Critical Incidents:</span>
                  <span className="text-rose-600 font-bold">{scorecard.criticalIncidents}</span>
                </div>
              </div>
            </div>

            {/* Pillar 3: Attendance */}
            <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-3">
              <div className="flex items-center gap-2 text-navy-900 font-bold text-xs uppercase font-mono">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>3. Shift Attendance</span>
              </div>
              <div className="space-y-2 text-xs font-mono text-graphite-600 pt-2 border-t border-graphite-100">
                <div className="flex justify-between">
                  <span>Reliability Index:</span>
                  <span className="text-navy-900 font-bold">{scorecard.attendanceReliabilityPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Scheduled Shifts:</span>
                  <span className="text-navy-900 font-bold">{scorecard.scheduledShiftsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Late Starts:</span>
                  <span className="text-amber-600 font-bold">{scorecard.lateStartsCount}</span>
                </div>
              </div>
            </div>

            {/* Pillar 4: Fuel & Equipment */}
            <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-3">
              <div className="flex items-center gap-2 text-navy-900 font-bold text-xs uppercase font-mono">
                <Fuel className="w-4 h-4 text-fleet-orange" />
                <span>4. Fuel & Compliance</span>
              </div>
              <div className="space-y-2 text-xs font-mono text-graphite-600 pt-2 border-t border-graphite-100">
                <div className="flex justify-between">
                  <span>Avg Fuel Efficiency:</span>
                  <span className="text-navy-900 font-bold">
                    {scorecard.averageFuelEfficiencyKmPerL > 0
                      ? `${scorecard.averageFuelEfficiencyKmPerL} km/L`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Doc Compliance:</span>
                  <span className="text-navy-900 font-bold">{scorecard.documentComplianceRatePercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Expired Documents:</span>
                  <span className="text-rose-600 font-bold">{scorecard.expiredDocumentsCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
