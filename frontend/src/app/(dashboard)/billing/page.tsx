'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  FileText,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Plus,
  Calculator,
  ShieldCheck,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { AgingReportResponse, Invoice, PaymentReceipt } from '@/types/billing';
import { formatCents, formatDate, getStatusBadgeClass } from '@/lib/financialFormatters';

export default function BillingOverviewPage() {
  const [agingData, setAgingData] = useState<AgingReportResponse | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [agingRes, invoicesRes, receiptsRes] = await Promise.all([
        fetch('/api/v1/billing/invoices/aging-report'),
        fetch('/api/v1/billing/invoices?limit=5'),
        fetch('/api/v1/billing/receipts?limit=5'),
      ]);

      if (agingRes.ok) {
        const j = await agingRes.json();
        setAgingData(j.data);
      }

      if (invoicesRes.ok) {
        const j = await invoicesRes.json();
        setRecentInvoices(j.data?.invoices || []);
      }

      if (receiptsRes.ok) {
        const j = await receiptsRes.json();
        setRecentReceipts(j.data?.receipts || []);
      }
    } catch (err: any) {
      setError('Failed to connect to billing endpoints. Please check network connectivity.');
    } finally {
      setLoading(false);
    }
  };

  const usdAging = agingData?.byCurrency?.USD || (agingData as any)?.currencies?.USD || {
    currentCents: 0,
    days1To30Cents: 0,
    days31To60Cents: 0,
    days61To90Cents: 0,
    over90DaysCents: 0,
    totalOutstandingCents: 0,
    invoiceCount: 0,
    customers: {},
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">
              Financial & Billing Overview
            </h1>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-navy-100 text-navy-800 border border-navy-200">
              AR Ledger
            </span>
          </div>
          <p className="text-sm text-graphite-500 mt-1">
            Accounts receivable aging, real-time freight invoicing, and payment reconciliation.
          </p>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/billing/rates"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-navy-800 border border-navy-200 hover:bg-navy-50 shadow-sm transition"
          >
            <Calculator className="w-4 h-4 text-fleet-orange" />
            <span>Rate Matrix & Quote</span>
          </Link>

          <Link
            href="/billing/invoices"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-navy-800 border border-navy-200 hover:bg-navy-50 shadow-sm transition"
          >
            <FileText className="w-4 h-4 text-sky-600" />
            <span>Invoices Ledger</span>
          </Link>

          <Link
            href="/billing/receipts"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-navy-800 border border-navy-200 hover:bg-navy-50 shadow-sm transition"
          >
            <Receipt className="w-4 h-4 text-emerald-600" />
            <span>Payment Receipts</span>
          </Link>

          <Link
            href="/billing/reports"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-navy-800 border border-navy-200 hover:bg-navy-50 shadow-sm transition"
          >
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <span>Financial Reports</span>
          </Link>

          <Link
            href="/billing/reconciliation"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-navy-800 border border-navy-200 hover:bg-navy-50 shadow-sm transition"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Reconciliation</span>
          </Link>

          <Link
            href="/settlements"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-navy-sidebar text-white hover:bg-navy-800 shadow-md transition"
          >
            <DollarSign className="w-4 h-4 text-fleet-orange" />
            <span>Driver Payroll</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-graphite-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-graphite-500 uppercase tracking-wider">
              Total Outstanding AR
            </span>
            <div className="w-8 h-8 rounded-lg bg-navy-50 text-navy-800 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-navy-900 tracking-tight">
              {formatCents(usdAging.totalOutstandingCents)}
            </h3>
            <p className="text-xs text-graphite-500 mt-1">
              Across <span className="font-semibold text-navy-800">{usdAging.invoiceCount}</span> unpaid invoices
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-graphite-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-graphite-500 uppercase tracking-wider">
              Current / Due Today
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-emerald-700 tracking-tight">
              {formatCents(usdAging.currentCents)}
            </h3>
            <p className="text-xs text-graphite-500 mt-1">Within agreed payment terms</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-graphite-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-graphite-500 uppercase tracking-wider">
              1–30 Days Overdue
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-amber-700 tracking-tight">
              {formatCents(usdAging.days1To30Cents)}
            </h3>
            <p className="text-xs text-graphite-500 mt-1">Immediate follow-up bucket</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-graphite-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-graphite-500 uppercase tracking-wider">
              &gt; 30 Days Overdue
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-rose-700 tracking-tight">
              {formatCents(usdAging.days31To60Cents + usdAging.days61To90Cents + usdAging.over90DaysCents)}
            </h3>
            <p className="text-xs text-graphite-500 mt-1">Collections escalation</p>
          </div>
        </div>
      </div>

      {/* AR Aging Buckets Matrix Card */}
      <div className="bg-white rounded-2xl border border-graphite-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-graphite-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-navy-900">
              Accounts Receivable Aging Breakdown
            </h2>
            <p className="text-xs text-graphite-500">
              Server-calculated aging buckets as of {formatDate(agingData?.asOfDate)}
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-graphite-500 bg-graphite-100 px-2.5 py-1 rounded-lg">
            Currency: USD
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-2">
          <div className="p-3.5 rounded-xl bg-navy-50/50 border border-navy-100 text-center">
            <span className="text-[11px] font-bold text-graphite-500 block uppercase">Current</span>
            <span className="text-base font-extrabold text-navy-900 mt-1 block">
              {formatCents(usdAging.currentCents)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100 text-center">
            <span className="text-[11px] font-bold text-amber-700 block uppercase">1–30 Days</span>
            <span className="text-base font-extrabold text-amber-800 mt-1 block">
              {formatCents(usdAging.days1To30Cents)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-orange-50/50 border border-orange-100 text-center">
            <span className="text-[11px] font-bold text-orange-700 block uppercase">31–60 Days</span>
            <span className="text-base font-extrabold text-orange-800 mt-1 block">
              {formatCents(usdAging.days31To60Cents)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-100 text-center">
            <span className="text-[11px] font-bold text-rose-700 block uppercase">61–90 Days</span>
            <span className="text-base font-extrabold text-rose-800 mt-1 block">
              {formatCents(usdAging.days61To90Cents)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-100/60 border border-rose-200 text-center col-span-2 sm:col-span-1">
            <span className="text-[11px] font-bold text-rose-800 block uppercase">&gt; 90 Days</span>
            <span className="text-base font-extrabold text-rose-900 mt-1 block">
              {formatCents(usdAging.over90DaysCents)}
            </span>
          </div>
        </div>
      </div>

      {/* Operational Grids: Recent Invoices & Recent Receipts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices Ledger */}
        <div className="bg-white rounded-2xl border border-graphite-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-5 border-b border-graphite-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-navy-900">Recent Freight Invoices</h3>
              <p className="text-xs text-graphite-500">Delivered shipment billing transactions</p>
            </div>
            <Link
              href="/billing/invoices"
              className="text-xs font-semibold text-fleet-orange hover:text-navy-900 flex items-center gap-1 transition"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-5 divide-y divide-graphite-100">
            {recentInvoices.length === 0 ? (
              <div className="py-8 text-center text-xs text-graphite-400">
                No recent invoices recorded.
              </div>
            ) : (
              recentInvoices.map((inv) => (
                <div key={inv._id} className="py-3 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                  <div className="space-y-0.5">
                    <Link
                      href={`/billing/invoices/${inv._id}`}
                      className="font-bold text-navy-900 hover:text-fleet-orange transition"
                    >
                      {inv.invoiceNumber}
                    </Link>
                    <p className="text-[11px] text-graphite-500">{inv.customer?.name || 'Customer'}</p>
                    <span className="text-[10px] text-graphite-400">Due: {formatDate(inv.dueAt)}</span>
                  </div>

                  <div className="text-right space-y-1">
                    <span className="font-extrabold text-navy-900 block">
                      {formatCents(inv.totalAmountCents, inv.currency)}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getStatusBadgeClass(
                        inv.status
                      )}`}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Payment Receipts */}
        <div className="bg-white rounded-2xl border border-graphite-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-5 border-b border-graphite-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-navy-900">Recent Payment Receipts</h3>
              <p className="text-xs text-graphite-500">Reconciled customer deposits & settlements</p>
            </div>
            <Link
              href="/billing/receipts"
              className="text-xs font-semibold text-fleet-orange hover:text-navy-900 flex items-center gap-1 transition"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-5 divide-y divide-graphite-100">
            {recentReceipts.length === 0 ? (
              <div className="py-8 text-center text-xs text-graphite-400">
                No payment receipts recorded yet.
              </div>
            ) : (
              recentReceipts.map((rcp) => (
                <div key={rcp._id} className="py-3 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                  <div className="space-y-0.5">
                    <span className="font-bold text-navy-900 block">{rcp.receiptNumber}</span>
                    <p className="text-[11px] text-graphite-500">{rcp.customerId?.name || 'Customer'}</p>
                    <span className="text-[10px] text-graphite-400 font-mono">
                      {rcp.paymentMethod} • Ref: {rcp.referenceNumber}
                    </span>
                  </div>

                  <div className="text-right space-y-1">
                    <span className="font-extrabold text-emerald-700 block">
                      +{formatCents(rcp.amountCents, rcp.currency)}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getStatusBadgeClass(
                        rcp.status
                      )}`}
                    >
                      {rcp.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

