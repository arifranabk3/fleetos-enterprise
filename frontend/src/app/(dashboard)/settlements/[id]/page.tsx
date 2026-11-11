'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  FileText,
  Printer,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  RotateCcw,
  User,
  ShieldCheck,
  Calendar,
  Clock,
  Navigation,
  Award,
  DollarSign,
  TrendingDown,
} from 'lucide-react';
import { DriverSettlement } from '@/types/billing';
import { formatCents, formatDate, getStatusBadgeClass } from '@/lib/financialFormatters';

export default function SettlementDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [settlement, setSettlement] = useState<DriverSettlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchSettlement();
  }, [id]);

  const fetchSettlement = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/settlements/${id}`);
      if (res.ok) {
        const j = await res.json();
        setSettlement(j.data);
      } else {
        setError('Settlement pay stub not found or access denied');
      }
    } catch {
      setError('Communication failure with settlement service');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/settlements/${id}/review`, { method: 'POST' });
      if (res.ok) {
        fetchSettlement();
      } else {
        const j = await res.json();
        setActionError(j.message || 'Review action failed');
      }
    } catch {
      setActionError('Network failure');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm('Authorize this driver settlement for payroll disbursement?')) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/settlements/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        fetchSettlement();
      } else {
        const j = await res.json();
        setActionError(j.message || 'Approval action failed');
      }
    } catch {
      setActionError('Network failure');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mb-3" />
        <div className="text-slate-600 text-sm font-medium">Loading settlement pay stub...</div>
      </div>
    );
  }

  if (error || !settlement) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">{error || 'Settlement Not Found'}</h2>
        <Link
          href="/settlements"
          className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-semibold"
        >
          <ChevronLeft className="w-4 h-4" /> Return to Settlements
        </Link>
      </div>
    );
  }

  const driver = typeof settlement.driver === 'object' ? settlement.driver : null;

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden on Print) */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/settlements"
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 font-mono">
                {settlement.settlementNumber}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(settlement.status)}`}>
                {settlement.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Period: {formatDate(settlement.periodStartDate)} – {formatDate(settlement.periodEndDate)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {settlement.status === 'DRAFT' && (
            <button
              onClick={handleReview}
              disabled={actionLoading}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              Mark Under Review
            </button>
          )}

          {settlement.status === 'UNDER_REVIEW' && (
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve Settlement
            </button>
          )}

          <button
            onClick={handlePrint}
            className="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Pay Stub
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* PRINTABLE PAY STUB CONTAINER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 max-w-4xl mx-auto print:border-none print:shadow-none print:p-0">
        {/* Pay Stub Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                FL
              </div>
              <span className="text-lg font-black tracking-tight text-slate-900">FLEETOS ENTERPRISE</span>
            </div>
            <p className="text-xs text-slate-500">Driver Payroll & Settlement Statement</p>
            <p className="text-xs text-slate-500">100 Logistics Blvd, Suite 400 • Austin, TX 78701</p>
          </div>

          <div className="text-right">
            <h2 className="text-2xl font-black text-slate-900 font-mono tracking-tight">PAY STATEMENT</h2>
            <div className="text-xs text-slate-500 mt-1">
              Settlement #: <span className="font-mono font-semibold text-slate-800">{settlement.settlementNumber}</span>
            </div>
            <div className="text-xs text-slate-500">
              Generated: <span className="text-slate-800">{formatDate(settlement.createdAt)}</span>
            </div>
            <div className="text-xs text-slate-500">
              Pay Period: <span className="text-slate-800">{formatDate(settlement.periodStartDate)} – {formatDate(settlement.periodEndDate)}</span>
            </div>
          </div>
        </div>

        {/* Driver & Compensation Details */}
        <div className="grid grid-cols-2 gap-6 py-6 border-b border-slate-200">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Commercial Driver</h3>
            <div className="space-y-1 text-sm text-slate-700">
              <div className="font-bold text-slate-900 text-base">{driver?.name || 'Commercial Driver'}</div>
              {driver?.driverLicenseNumber && (
                <div className="text-xs font-mono text-slate-500">Commercial License: {driver.driverLicenseNumber}</div>
              )}
              {driver?.phone && <div className="text-xs text-slate-500">Phone: {driver.phone}</div>}
              {driver?.email && <div className="text-xs text-slate-500">Email: {driver.email}</div>}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Compensation Summary</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="text-slate-500">Gross Earnings:</span>
              <span className="font-mono font-semibold text-right text-slate-800">
                {formatCents(settlement.grossPayCents || 0, settlement.currency)}
              </span>
              <span className="text-slate-500">Safety Bonus:</span>
              <span className="font-mono font-semibold text-right text-emerald-600">
                +{formatCents(settlement.safetyBonusCents || 0, settlement.currency)}
              </span>
              <span className="text-slate-500">Total Deductions:</span>
              <span className="font-mono font-semibold text-right text-rose-600">
                -{formatCents(settlement.totalDeductionsCents || settlement.totalDeductionCents || 0, settlement.currency)}
              </span>
              <div className="col-span-2 border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-bold">
                <span className="text-slate-900">Net Pay:</span>
                <span className="font-mono text-base text-slate-900">
                  {formatCents(settlement.netPayCents || 0, settlement.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Itemized Shift Earnings Table */}
        <div className="py-6 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-indigo-600" />
            Verified Shifts & Hours
          </h3>
          {settlement.shiftBreakdown && settlement.shiftBreakdown.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase">
                  <th className="py-2">Shift Date</th>
                  <th className="py-2">Hours Worked</th>
                  <th className="py-2">Hourly Rate</th>
                  <th className="py-2 text-right">Shift Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlement.shiftBreakdown.map((s, idx) => (
                  <tr key={idx}>
                    <td className="py-2 text-slate-700">{formatDate(s.shiftDate)}</td>
                    <td className="py-2 font-mono text-slate-900">{s.hoursWorked} hrs</td>
                    <td className="py-2 font-mono text-slate-600">{formatCents(s.hourlyRateCents)}/hr</td>
                    <td className="py-2 font-mono font-semibold text-slate-900 text-right">
                      {formatCents(s.payCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-xs text-slate-400 italic">No hourly shift logs recorded for this pay cycle.</div>
          )}
        </div>

        {/* Itemized Mileage & Dispatch Pay Table */}
        <div className="py-6 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Navigation className="w-4 h-4 text-indigo-600" />
            Dispatch Mileage & Load Haul Pay
          </h3>
          {settlement.mileageBreakdown && settlement.mileageBreakdown.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase">
                  <th className="py-2">Dispatch Run</th>
                  <th className="py-2">Distance</th>
                  <th className="py-2">Per-Km Rate</th>
                  <th className="py-2 text-right">Mileage Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlement.mileageBreakdown.map((m, idx) => (
                  <tr key={idx}>
                    <td className="py-2 text-slate-700 font-mono">{m.dispatchNumber || `DSP-${idx + 1}`}</td>
                    <td className="py-2 font-mono text-slate-900">{m.distanceKm} km</td>
                    <td className="py-2 font-mono text-slate-600">{formatCents(m.perKmRateCents)}/km</td>
                    <td className="py-2 font-mono font-semibold text-slate-900 text-right">
                      {formatCents(m.payCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-xs text-slate-400 italic">No per-km dispatch haul mileage recorded for this pay cycle.</div>
          )}
        </div>

        {/* Deductions & Safety Bonus Breakdown */}
        <div className="grid grid-cols-2 gap-6 py-6 border-b border-slate-200">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-600" />
              Safety Score & Bonuses
            </h3>
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-emerald-800 font-medium">Safety Score Rating:</span>
                <span className="font-bold text-emerald-900 font-mono">{settlement.safetyScoreSnapshot || '100% (Clean)'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-emerald-800 font-medium">Safety Incentive Bonus:</span>
                <span className="font-bold text-emerald-700 font-mono">+{formatCents(settlement.safetyBonusCents || 0)}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              Itemized Deductions
            </h3>
            {settlement.deductions && settlement.deductions.length > 0 ? (
              <div className="space-y-1.5 text-xs">
                {settlement.deductions.map((d, idx) => (
                  <div key={idx} className="flex justify-between text-slate-600">
                    <span>{d.type}: {d.description}</span>
                    <span className="font-mono font-semibold text-rose-600">-{formatCents(d.amountCents)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">No deductions applied.</div>
            )}
          </div>
        </div>

        {/* Net Payout Banner */}
        <div className="mt-6 p-4 bg-slate-900 rounded-xl text-white flex justify-between items-center">
          <div>
            <span className="block text-xs uppercase text-slate-400 font-bold tracking-wider">NET DISBURSEMENT AMOUNT</span>
            <span className="text-xs text-slate-400">Payment Status: {settlement.status}</span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black font-mono text-emerald-400">
              {formatCents(settlement.netPayCents, settlement.currency)}
            </span>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center text-[11px] text-slate-400 border-t border-slate-100 pt-4">
          This document is an official pay statement generated by FleetOS Enterprise Logistics Platform.
          For payroll discrepancies, contact the driver operations dispatch desk within 7 days.
        </div>
      </div>
    </div>
  );
}

