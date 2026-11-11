'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Eye,
  RotateCcw,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  X,
  CreditCard,
  Briefcase,
  Award,
} from 'lucide-react';
import { DriverSettlement } from '@/types/billing';
import { formatCents, formatDate, getStatusBadgeClass } from '@/lib/financialFormatters';

interface DriverOption {
  _id: string;
  name: string;
  driverLicenseNumber?: string;
  status?: string;
  phone?: string;
}

export default function DriverSettlementsPage() {
  const [settlements, setSettlements] = useState<DriverSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Pay Run Generator Modal
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);

  // Disbursement / Pay Modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedSettlementForPay, setSelectedSettlementForPay] = useState<DriverSettlement | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'DIRECT_DEPOSIT' | 'CHECK' | 'WIRE'>('DIRECT_DEPOSIT');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Approval Action Loading State
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSettlements();
  }, [page, statusFilter]);

  const fetchSettlements = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: '15',
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
      });

      const res = await fetch(`/api/v1/settlements?${q.toString()}`);
      if (res.ok) {
        const j = await res.json();
        setSettlements(j.data?.settlements || []);
        setTotalPages(j.data?.pagination?.totalPages || 1);
      } else {
        setError('Failed to fetch driver settlements ledger');
      }
    } catch {
      setError('Network communication failure');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSettlements();
  };

  // Open Pay Run Generator
  const openGenerateModal = async () => {
    setGenerateModalOpen(true);
    setGenerateError(null);
    setGenerateSuccess(null);
    setSelectedDriverId('');

    try {
      const res = await fetch('/api/v1/drivers');
      if (res.ok) {
        const j = await res.json();
        const drvList = j.data?.drivers || (Array.isArray(j.data) ? j.data : []);
        setDrivers(drvList);
      }
    } catch {
      // Fallback
    }
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverId) {
      setGenerateError('Select an active commercial driver.');
      return;
    }

    setGenerateLoading(true);
    setGenerateError(null);
    setGenerateSuccess(null);

    try {
      const res = await fetch('/api/v1/settlements/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: selectedDriverId,
          periodStartDate: periodStart,
          periodEndDate: periodEnd,
        }),
      });

      const j = await res.json();
      if (res.ok) {
        setGenerateSuccess(`Driver settlement calculated successfully (${formatCents(j.data?.netPayCents || 0)} net pay).`);
        fetchSettlements();
        setTimeout(() => {
          setGenerateModalOpen(false);
        }, 1500);
      } else {
        setGenerateError(j.message || 'Settlement calculation failed');
      }
    } catch {
      setGenerateError('Communication error while compiling settlement pay run.');
    } finally {
      setGenerateLoading(false);
    }
  };

  // Review Settlement
  const handleReview = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/v1/settlements/${id}/review`, { method: 'POST' });
      if (res.ok) {
        fetchSettlements();
      } else {
        const j = await res.json();
        alert(j.message || 'Review action failed');
      }
    } catch {
      alert('Network failure');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Approve Settlement
  const handleApprove = async (id: string) => {
    if (!confirm('Authorize this driver settlement for payroll disbursement?')) return;
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/v1/settlements/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        fetchSettlements();
      } else {
        const j = await res.json();
        alert(j.message || 'Approval action failed');
      }
    } catch {
      alert('Network failure');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Pay Modal
  const openPayModal = (settlement: DriverSettlement) => {
    setSelectedSettlementForPay(settlement);
    setPaymentReference(`DIR-DEP-${Math.floor(100000 + Math.random() * 900000)}`);
    setPayError(null);
    setPayModalOpen(true);
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSettlementForPay) return;

    setPayLoading(true);
    setPayError(null);

    try {
      const res = await fetch(`/api/v1/settlements/${selectedSettlementForPay._id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentReference,
          paymentMethod,
        }),
      });

      const j = await res.json();
      if (res.ok) {
        setPayModalOpen(false);
        fetchSettlements();
      } else {
        setPayError(j.message || 'Payment execution failed');
      }
    } catch {
      setPayError('Network failure executing disbursement');
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/billing" className="hover:text-indigo-600 transition-colors">Billing</Link>
            <span>/</span>
            <span className="text-slate-900 font-medium">Driver Settlements</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Driver Payroll & Settlements Console</h1>
          <p className="text-slate-500 text-sm">
            Automated pay run calculations, safety bonuses, fuel deductions, advance reconciliations, and payroll disbursement.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openGenerateModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Generate Pay Run
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by settlement number, driver name, or license..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">All Settlement Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved / Ready to Pay</option>
              <option value="PAID">Paid / Disbursed</option>
              <option value="REVERSED">Reversed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Settlements Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Settlement #</th>
                <th className="py-3.5 px-4">Driver</th>
                <th className="py-3.5 px-4">Period</th>
                <th className="py-3.5 px-4">Gross Earnings</th>
                <th className="py-3.5 px-4">Safety Bonus</th>
                <th className="py-3.5 px-4">Deductions</th>
                <th className="py-3.5 px-4">Net Payout</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent mb-2" />
                    <div>Loading driver settlements ledger...</div>
                  </td>
                </tr>
              ) : settlements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-700">No driver settlements recorded</p>
                    <p className="text-xs text-slate-400 mt-1">Generate a pay run for completed shifts and dispatch mileage.</p>
                  </td>
                </tr>
              ) : (
                settlements.map((setl) => {
                  const driverName = typeof setl.driver === 'object' ? setl.driver?.name : 'Driver';
                  const driverLic = typeof setl.driver === 'object' ? setl.driver?.driverLicenseNumber : '';
                  const isActionLoading = actionLoadingId === setl._id;

                  return (
                    <tr key={setl._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-indigo-600">
                        <Link href={`/settlements/${setl._id}`} className="hover:underline">
                          {setl.settlementNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{driverName}</div>
                        {driverLic && <div className="text-[11px] font-mono text-slate-400">Lic: {driverLic}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        <div>{formatDate(setl.periodStartDate)}</div>
                        <div className="text-[11px] text-slate-400">to {formatDate(setl.periodEndDate)}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-900 font-medium">
                        {formatCents(setl.grossPayCents, setl.currency)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-600 font-medium text-xs">
                        {(setl.safetyBonusCents ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded text-emerald-700">
                            <Award className="w-3 h-3" />
                            +{formatCents(setl.safetyBonusCents || 0)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-rose-600 font-medium text-xs">
                        {(setl.totalDeductionsCents ?? setl.totalDeductionCents ?? 0) > 0 ? (
                          `-${formatCents(setl.totalDeductionsCents || setl.totalDeductionCents || 0)}`
                        ) : (
                          <span className="text-slate-400">$0.00</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-sm">
                        {formatCents(setl.netPayCents, setl.currency)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(setl.status)}`}>
                          {setl.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <Link
                            href={`/settlements/${setl._id}`}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
                            title="View Pay Stub"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {setl.status === 'DRAFT' && (
                            <button
                              disabled={isActionLoading}
                              onClick={() => handleReview(setl._id)}
                              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2 py-1 rounded transition-colors"
                            >
                              Review
                            </button>
                          )}

                          {setl.status === 'UNDER_REVIEW' && (
                            <button
                              disabled={isActionLoading}
                              onClick={() => handleApprove(setl._id)}
                              className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-2 py-1 rounded transition-colors flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Approve
                            </button>
                          )}

                          {setl.status === 'APPROVED' && (
                            <button
                              onClick={() => openPayModal(setl)}
                              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-2.5 py-1 rounded transition-colors flex items-center gap-1"
                            >
                              <CreditCard className="w-3 h-3" />
                              Disburse
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Page <span className="font-semibold text-slate-700">{page}</span> of <span className="font-semibold text-slate-700">{totalPages}</span>
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1 font-medium text-slate-600"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1 font-medium text-slate-600"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* GENERATE PAY RUN MODAL */}
      {generateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">New Driver Settlement Run</h3>
                  <p className="text-xs text-slate-500">Aggregate shifts, haul mileage, and fuel adjustments.</p>
                </div>
              </div>
              <button
                onClick={() => setGenerateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {generateError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{generateError}</span>
              </div>
            )}

            {generateSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{generateSuccess}</span>
              </div>
            )}

            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Driver</label>
                <select
                  required
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                >
                  <option value="">-- Choose Commercial Driver --</option>
                  {drivers.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} {d.driverLicenseNumber ? `(CDL: ${d.driverLicenseNumber})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Period Start</label>
                  <input
                    type="date"
                    required
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Period End</label>
                  <input
                    type="date"
                    required
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-[11px] text-indigo-900 leading-relaxed">
                <span className="font-bold">Automated Pay Compilation:</span> The engine aggregates all verified shifts, haul dispatches, safety bonuses, and approved advances within this date range.
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setGenerateModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generateLoading || !selectedDriverId}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {generateLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Compile Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISBURSEMENT / PAY MODAL */}
      {payModalOpen && selectedSettlementForPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-indigo-600">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Disburse Driver Payroll</h3>
                <p className="text-xs text-slate-500">Settlement #{selectedSettlementForPay.settlementNumber}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <span className="text-xs text-slate-600">Net Payable Amount:</span>
              <span className="text-base font-bold font-mono text-emerald-600">
                {formatCents(selectedSettlementForPay.netPayCents, selectedSettlementForPay.currency)}
              </span>
            </div>

            {payError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{payError}</span>
              </div>
            )}

            <form onSubmit={handlePaySubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Disbursement Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                >
                  <option value="DIRECT_DEPOSIT">Direct Deposit (ACH / Bank)</option>
                  <option value="CHECK">Company Payroll Check</option>
                  <option value="WIRE">Wire Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Reference / Batch #</label>
                <input
                  type="text"
                  required
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payLoading || !paymentReference}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {payLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Execute Disbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

