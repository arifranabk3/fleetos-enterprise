'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  X,
  FileCheck,
  DollarSign,
  Plus,
} from 'lucide-react';
import { formatCents, formatDate } from '@/lib/financialFormatters';

export default function FinancialReconciliationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reconciliation summary
  const [reconciliation, setReconciliation] = useState<any | null>(null);

  // Integrity engine audit
  const [integrityAudit, setIntegrityAudit] = useState<any | null>(null);

  // Manual Allocation Modal
  const [allocModalOpen, setAllocModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [openInvoices, setOpenInvoices] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<{ [invId: string]: string }>({});
  const [allocReason, setAllocReason] = useState('');
  const [allocLoading, setAllocLoading] = useState(false);
  const [allocError, setAllocError] = useState<string | null>(null);
  const [allocSuccess, setAllocSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reconRes, auditRes] = await Promise.all([
        fetch('/api/v1/financial-reports/reconciliation'),
        fetch('/api/v1/financial-reports/integrity'),
      ]);

      if (reconRes.ok) {
        const j = await reconRes.json();
        setReconciliation(j.data);
      } else {
        setError('Failed to fetch reconciliation metrics.');
      }

      if (auditRes.ok) {
        const j = await auditRes.json();
        setIntegrityAudit(j.data);
      }
    } catch {
      setError('Communication error loading financial reconciliation engine.');
    } finally {
      setLoading(false);
    }
  };

  const openAllocationModal = async (rcpt: any) => {
    setSelectedReceipt(rcpt);
    setAllocModalOpen(true);
    setAllocError(null);
    setAllocSuccess(null);
    setAllocReason('');
    setAllocations({});

    try {
      const res = await fetch(`/api/v1/billing/invoices?customerId=${rcpt.customerId}&status=ISSUED,PARTIALLY_PAID`);
      if (res.ok) {
        const j = await res.json();
        setOpenInvoices(j.data?.invoices || []);
      }
    } catch {
      setOpenInvoices([]);
    }
  };

  const handleAllocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceipt) return;

    if (!allocReason || allocReason.trim().length < 5) {
      setAllocError('A comprehensive GAAP audit justification of at least 5 characters is required.');
      return;
    }

    const allocList = Object.entries(allocations)
      .filter(([_, val]) => (parseFloat(val) || 0) > 0)
      .map(([invoiceId, val]) => ({
        invoiceId,
        amountCents: Math.round((parseFloat(val) || 0) * 100),
      }));

    if (allocList.length === 0) {
      setAllocError('Enter an amount to allocate to at least one invoice.');
      return;
    }

    setAllocLoading(true);
    setAllocError(null);
    setAllocSuccess(null);

    try {
      const res = await fetch('/api/v1/financial-reports/reconciliation/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId: selectedReceipt.receiptId,
          allocations: allocList,
          reason: allocReason,
        }),
      });

      const j = await res.json();
      if (res.ok) {
        setAllocSuccess('Receipt balance successfully allocated to open invoices.');
        loadData();
        setTimeout(() => {
          setAllocModalOpen(false);
        }, 1500);
      } else {
        setAllocError(j.error?.message || 'Allocation failed');
      }
    } catch {
      setAllocError('Network communication error applying reconciliation allocation.');
    } finally {
      setAllocLoading(false);
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
            <span className="text-slate-900 font-medium">Reconciliation & Integrity</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Reconciliation & Integrity Engine</h1>
          <p className="text-slate-500 text-sm">
            Continuous auditing of payment receipts, unallocated customer cash, invoice mismatches, and double-entry balancing.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Run Integrity Audit
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* High-Level Status Banner */}
      {reconciliation && integrityAudit && (
        <div className={`p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          integrityAudit.isHealthy
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/70 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              integrityAudit.isHealthy ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {integrityAudit.isHealthy ? <ShieldCheck className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {integrityAudit.isHealthy
                  ? 'All Financial Records Reconciled & Balanced'
                  : 'Financial Discrepancies Require Attention'}
              </h2>
              <p className="text-xs opacity-80">
                Audited {integrityAudit.metrics?.invoicesAudited || 0} invoices, {integrityAudit.metrics?.receiptsAudited || 0} receipts, and {integrityAudit.metrics?.journalsAudited || 0} journal entries across double-entry general ledger.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 font-mono text-xs">
            <div>
              <span className="block opacity-60 text-[10px] uppercase">Unallocated Cash</span>
              <span className="text-base font-bold text-slate-900">
                {formatCents(reconciliation.totalUnallocatedCents || 0)}
              </span>
            </div>
            <div>
              <span className="block opacity-60 text-[10px] uppercase">Integrity Mismatches</span>
              <span className="text-base font-bold text-slate-900">
                {integrityAudit.totalMismatchesFound || 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* UNALLOCATED CUSTOMER CASH SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-600" />
              Unallocated Customer Payments (On Account)
            </h2>
            <p className="text-xs text-slate-500">
              Payments received with available credit balance not yet applied to specific freight invoices.
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
            {reconciliation?.unallocatedPayments?.length || 0} Receipts
          </span>
        </div>

        {reconciliation?.unallocatedPayments?.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            No unallocated payments found. All collections are fully reconciled against issued customer invoices.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                  <th className="py-2.5 px-3">Receipt #</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Payment Date</th>
                  <th className="py-2.5 px-3">Payment Method</th>
                  <th className="py-2.5 px-3 text-right">Total Received</th>
                  <th className="py-2.5 px-3 text-right">Allocated</th>
                  <th className="py-2.5 px-3 text-right">Unallocated Balance</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciliation?.unallocatedPayments?.map((u: any) => (
                  <tr key={u.receiptId} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">{u.receiptNumber}</td>
                    <td className="py-2.5 px-3 text-slate-900 font-medium">{u.customerName}</td>
                    <td className="py-2.5 px-3 text-slate-500">{formatDate(u.paymentDate)}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{u.paymentMethod}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">{formatCents(u.amountCents)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatCents(u.allocatedCents)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">{formatCents(u.unallocatedCents)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => openAllocationModal(u)}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                      >
                        Allocate <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FINANCIAL INTEGRITY AUDIT WARNINGS & FINDINGS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-600" />
              Automated Integrity Audit Log
            </h2>
            <p className="text-xs text-slate-500">
              Mathematical checks comparing line item totals, receipt application sums, journal equality, and driver pay stubs.
            </p>
          </div>
        </div>

        {integrityAudit?.mismatches?.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            100% Mathematical Precision. Zero financial discrepancies detected across invoices, receipts, and ledger journals.
          </div>
        ) : (
          <div className="space-y-3">
            {integrityAudit?.mismatches?.map((m: any, idx: number) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between gap-3 text-xs ${
                  m.severity === 'CRITICAL' ? 'bg-red-50/60 border-red-200 text-red-900' : 'bg-amber-50/60 border-amber-200 text-amber-900'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                      m.severity === 'CRITICAL' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
                    }`}>
                      {m.severity}
                    </span>
                    <span className="font-bold font-mono">{m.code}</span>
                    <span className="text-slate-500">• Reference: {m.referenceNumber}</span>
                  </div>
                  <p className="text-slate-800 font-medium">{m.description}</p>
                  <p className="text-slate-600 text-[11px]">
                    <span className="font-semibold">Recommended Correction:</span> {m.recommendedAction}
                  </p>
                </div>

                {m.discrepancyCents !== undefined && (
                  <div className="text-right font-mono flex-shrink-0 self-end md:self-center">
                    <span className="text-[10px] text-slate-500 block uppercase">Discrepancy</span>
                    <span className="font-bold text-sm text-rose-600">{formatCents(m.discrepancyCents)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ALLOCATION MODAL */}
      {allocModalOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Allocate Unapplied Customer Receipt</h3>
                <p className="text-xs text-slate-500">
                  Receipt #{selectedReceipt.receiptNumber} ({selectedReceipt.customerName})
                </p>
              </div>
              <button
                onClick={() => setAllocModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between text-xs">
              <span className="text-slate-600">Available Unallocated Balance:</span>
              <span className="font-bold font-mono text-emerald-600">{formatCents(selectedReceipt.unallocatedCents)}</span>
            </div>

            {allocError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{allocError}</span>
              </div>
            )}

            {allocSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{allocSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAllocationSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Open Customer Invoices
                </label>
                {openInvoices.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-slate-400">
                    No open invoices available for this customer.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="py-2 px-3">Invoice #</th>
                          <th className="py-2 px-3">Balance Due</th>
                          <th className="py-2 px-3 text-right">Allocate ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {openInvoices.map((inv) => (
                          <tr key={inv._id}>
                            <td className="py-2 px-3 font-mono font-medium text-slate-900">{inv.invoiceNumber}</td>
                            <td className="py-2 px-3 font-mono text-rose-600 font-semibold">{formatCents(inv.balanceDueCents || inv.outstandingBalanceCents || 0)}</td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={allocations[inv._id] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAllocations((prev) => ({ ...prev, [inv._id]: val }));
                                }}
                                className="w-24 text-right px-2 py-1 text-xs font-mono border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  GAAP Audit Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Authorized customer settlement allocation to outstanding invoice."
                  value={allocReason}
                  onChange={(e) => setAllocReason(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAllocModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allocLoading || openInvoices.length === 0}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {allocLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Apply Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

