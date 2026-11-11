'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  DollarSign,
  TrendingUp,
  CreditCard,
  Briefcase,
  Layers,
  FileText,
  Printer,
  ChevronRight,
  AlertCircle,
  Building,
} from 'lucide-react';
import { formatCents, formatDate } from '@/lib/financialFormatters';

type ReportTab = 'REVENUE' | 'CASH' | 'STATEMENT' | 'SETTLEMENTS' | 'GL';

export default function FinancialReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('REVENUE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerOptions, setCustomerOptions] = useState<Array<{ _id: string; name: string }>>([]);

  // Data states
  const [revenueData, setRevenueData] = useState<any | null>(null);
  const [cashData, setCashData] = useState<any | null>(null);
  const [statementData, setStatementData] = useState<any | null>(null);
  const [settlementData, setSettlementData] = useState<any | null>(null);
  const [glData, setGlData] = useState<any | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [activeTab, startDate, endDate, currencyFilter, customerId]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/v1/customers');
      if (res.ok) {
        const j = await res.json();
        const list = j.data?.customers || (Array.isArray(j.data) ? j.data : []);
        setCustomerOptions(list);
        if (list.length > 0 && !customerId) {
          setCustomerId(list[0]._id);
        }
      }
    } catch {
      // Ignore
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (startDate) q.append('startDate', startDate);
      if (endDate) q.append('endDate', endDate);
      if (currencyFilter) q.append('currency', currencyFilter);

      let url = '';
      if (activeTab === 'REVENUE') {
        if (customerId) q.append('customerId', customerId);
        url = `/api/v1/financial-reports/revenue?${q.toString()}`;
      } else if (activeTab === 'CASH') {
        if (customerId) q.append('customerId', customerId);
        url = `/api/v1/financial-reports/cash-collections?${q.toString()}`;
      } else if (activeTab === 'STATEMENT') {
        if (!customerId) {
          setLoading(false);
          return;
        }
        q.append('customerId', customerId);
        url = `/api/v1/financial-reports/customer-statement?${q.toString()}`;
      } else if (activeTab === 'SETTLEMENTS') {
        url = `/api/v1/financial-reports/driver-settlements?${q.toString()}`;
      } else if (activeTab === 'GL') {
        url = `/api/v1/financial-reports/general-ledger?${q.toString()}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const j = await res.json();
        if (activeTab === 'REVENUE') setRevenueData(j.data);
        else if (activeTab === 'CASH') setCashData(j.data);
        else if (activeTab === 'STATEMENT') setStatementData(j.data);
        else if (activeTab === 'SETTLEMENTS') setSettlementData(j.data);
        else if (activeTab === 'GL') setGlData(j.data);
      } else {
        const errJson = await res.json().catch(() => null);
        setError(errJson?.error?.message || 'Failed to generate financial report.');
      }
    } catch {
      setError('Communication failure retrieving financial report.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const q = new URLSearchParams();
    if (startDate) q.append('startDate', startDate);
    if (endDate) q.append('endDate', endDate);
    if (currencyFilter) q.append('currency', currencyFilter);
    q.append('format', 'csv');

    let endpoint = '';
    if (activeTab === 'REVENUE') {
      if (customerId) q.append('customerId', customerId);
      endpoint = '/api/v1/financial-reports/revenue';
    } else if (activeTab === 'CASH') {
      if (customerId) q.append('customerId', customerId);
      endpoint = '/api/v1/financial-reports/cash-collections';
    } else if (activeTab === 'STATEMENT') {
      if (!customerId) return;
      q.append('customerId', customerId);
      endpoint = '/api/v1/financial-reports/customer-statement';
    } else if (activeTab === 'SETTLEMENTS') {
      endpoint = '/api/v1/financial-reports/driver-settlements';
    } else if (activeTab === 'GL') {
      endpoint = '/api/v1/financial-reports/general-ledger';
    }

    window.open(`${endpoint}?${q.toString()}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/billing" className="hover:text-indigo-600 transition-colors">Billing</Link>
            <span>/</span>
            <span className="text-slate-900 font-medium">Financial Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Reports & Statements</h1>
          <p className="text-slate-500 text-sm">
            Audited GAAP reporting, revenue recognition, cash collection summaries, customer statements, and general ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Print Report
          </button>
        </div>
      </div>

      {/* Report Category Navigation Pills */}
      <div className="print:hidden flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('REVENUE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'REVENUE' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Earned Revenue
        </button>
        <button
          onClick={() => setActiveTab('CASH')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'CASH' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Cash Collections
        </button>
        <button
          onClick={() => setActiveTab('STATEMENT')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'STATEMENT' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          Customer Statement
        </button>
        <button
          onClick={() => setActiveTab('SETTLEMENTS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'SETTLEMENTS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Driver Settlements
        </button>
        <button
          onClick={() => setActiveTab('GL')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'GL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          General Ledger
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {(activeTab === 'REVENUE' || activeTab === 'CASH' || activeTab === 'STATEMENT') && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer Account {activeTab === 'STATEMENT' && <span className="text-rose-500">*</span>}
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              {activeTab !== 'STATEMENT' && <option value="">All Customer Accounts</option>}
              {customerOptions.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
          >
            <option value="">All Currencies (Separate Groups)</option>
            <option value="USD">USD ($)</option>
            <option value="CAD">CAD (C$)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* REPORT CONTENT BODY */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mb-3" />
          <div className="text-slate-600 text-sm font-medium">Compiling GAAP financial report...</div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 print:border-none print:shadow-none print:p-0 space-y-6">
          {/* TAB 1: REVENUE REPORT */}
          {activeTab === 'REVENUE' && revenueData && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Earned Revenue Report</h2>
                  <p className="text-xs text-slate-500">
                    Recognized from issued freight invoices. Excludes drafts and voided bills.
                  </p>
                </div>
              </div>

              {/* Currency Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Object.entries(revenueData.summaryByCurrency || {}).map(([curr, val]: [string, any]) => (
                  <div key={curr} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 font-mono font-bold block">{curr} Earned Revenue</span>
                    <span className="text-xl font-bold font-mono text-slate-900 block mt-1">
                      {formatCents(val.totalEarnedRevenueCents, curr)}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      {val.invoiceCount} invoices • Tax: {formatCents(val.totalTaxAmountCents, curr)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Invoices Ledger Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Issued</th>
                      <th className="py-2.5 px-3">Due</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 text-right">Tax</th>
                      <th className="py-2.5 px-3 text-right">Total Revenue</th>
                      <th className="py-2.5 px-3 text-right">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {revenueData.invoices?.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-medium text-indigo-600">{inv.invoiceNumber}</td>
                        <td className="py-2.5 px-3 text-slate-900">{inv.customerName}</td>
                        <td className="py-2.5 px-3 text-slate-500">{formatDate(inv.issuedAt)}</td>
                        <td className="py-2.5 px-3 text-slate-500">{formatDate(inv.dueAt)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatCents(inv.subtotalCents, inv.currency)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatCents(inv.taxAmountCents, inv.currency)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatCents(inv.totalAmountCents, inv.currency)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-600">{formatCents(inv.balanceDueCents, inv.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: CASH COLLECTIONS */}
          {activeTab === 'CASH' && cashData && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Cash Collections & Banking Report</h2>
                <p className="text-xs text-slate-500">
                  Total payments recorded across bank transfer, ACH, wire, check, and cash. Net collections reflect reversals.
                </p>
              </div>

              {/* Net Collection Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(cashData.summaryByCurrency || {}).map(([curr, val]: [string, any]) => (
                  <div key={curr} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 font-mono font-bold block">{curr} Net Collections</span>
                    <span className="text-xl font-bold font-mono text-emerald-600 block mt-1">
                      {formatCents(val.netCollectionsCents, curr)}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Gross: {formatCents(val.grossReceiptsCents, curr)} | Reversals: -{formatCents(val.reversedReceiptsCents, curr)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Receipts Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                      <th className="py-2.5 px-3">Receipt #</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cashData.receipts?.map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-medium text-indigo-600">{r.receiptNumber}</td>
                        <td className="py-2.5 px-3 text-slate-900">{r.customerName}</td>
                        <td className="py-2.5 px-3 text-slate-500">{formatDate(r.paymentDate)}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono">{r.paymentMethod}</td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono">{r.referenceNumber || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatCents(r.amountCents, r.currency)}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'REVERSED' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMER STATEMENT */}
          {activeTab === 'STATEMENT' && statementData && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Customer Account Statement</h2>
                  <p className="text-xs text-slate-500">
                    Chronological activity statement reconciling freight invoices, payment receipts, and reversals.
                  </p>
                  <div className="mt-2 text-xs text-slate-700 font-medium">
                    <span className="font-bold text-slate-900">{statementData.customer?.name}</span> • {statementData.customer?.email}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 uppercase font-bold block">Closing Balance</span>
                  <span className="text-2xl font-black font-mono text-slate-900">
                    {formatCents(statementData.summary?.closingBalanceCents || 0)}
                  </span>
                </div>
              </div>

              {/* Statement Ledger */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Invoiced / Debit</th>
                      <th className="py-2.5 px-3 text-right">Paid / Credit</th>
                      <th className="py-2.5 px-3 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {statementData.ledger?.map((e: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-slate-500">{formatDate(e.date)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[10px] text-slate-600">{e.type}</td>
                        <td className="py-2.5 px-3 font-mono text-indigo-600">{e.referenceNumber}</td>
                        <td className="py-2.5 px-3 text-slate-700">{e.description}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-900">
                          {e.debitCents > 0 ? formatCents(e.debitCents) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-600">
                          {e.creditCents > 0 ? `-${formatCents(e.creditCents)}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCents(e.runningBalanceCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: DRIVER SETTLEMENTS */}
          {activeTab === 'SETTLEMENTS' && settlementData && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Driver Workforce Payroll & Settlement Report</h2>
                <p className="text-xs text-slate-500">
                  Gross pay, safety bonuses, fuel adjustments, paid disbursements, and outstanding payables.
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 font-bold block">Total Gross Pay</span>
                  <span className="text-xl font-bold font-mono text-slate-900 block mt-1">
                    {formatCents(settlementData.summary?.totalGrossPayCents || 0)}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 font-bold block">Safety Bonuses</span>
                  <span className="text-xl font-bold font-mono text-emerald-600 block mt-1">
                    +{formatCents(settlementData.summary?.totalSafetyBonusCents || 0)}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 font-bold block">Disbursed / Paid</span>
                  <span className="text-xl font-bold font-mono text-slate-900 block mt-1">
                    {formatCents(settlementData.summary?.totalPaidCents || 0)}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">{settlementData.summary?.countPaid} settlements paid</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 font-bold block">Outstanding Payable</span>
                  <span className="text-xl font-bold font-mono text-amber-600 block mt-1">
                    {formatCents(settlementData.summary?.totalPayableOutstandingCents || 0)}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">{settlementData.summary?.countApproved} approved ready to pay</span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                      <th className="py-2.5 px-3">Settlement #</th>
                      <th className="py-2.5 px-3">Driver</th>
                      <th className="py-2.5 px-3">Period</th>
                      <th className="py-2.5 px-3">Hours / Km</th>
                      <th className="py-2.5 px-3 text-right">Gross Pay</th>
                      <th className="py-2.5 px-3 text-right">Safety Bonus</th>
                      <th className="py-2.5 px-3 text-right">Deductions</th>
                      <th className="py-2.5 px-3 text-right">Net Payable</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {settlementData.settlements?.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-medium text-indigo-600">{s.settlementNumber}</td>
                        <td className="py-2.5 px-3 text-slate-900 font-medium">{s.driverName}</td>
                        <td className="py-2.5 px-3 text-slate-500">{formatDate(s.periodStart)} – {formatDate(s.periodEnd)}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono">{s.totalHoursWorked}h / {s.totalDistanceKm}km</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-800">{formatCents(s.grossPayCents)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600">+{formatCents(s.bonusCents)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-600">-{formatCents(s.deductionCents)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatCents(s.netPayCents)}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: GENERAL LEDGER */}
          {activeTab === 'GL' && glData && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">General Ledger Trial Balance</h2>
                  <p className="text-xs text-slate-500">
                    Double-entry bookkeeping verification. Total debits must equal total credits.
                  </p>
                </div>
                <div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    glData.trialBalanceTotals?.isBalanced ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {glData.trialBalanceTotals?.isBalanced ? 'Trial Balance Balanced' : 'Out of Balance'}
                  </span>
                </div>
              </div>

              {/* Accounts Trial Balance Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                      <th className="py-2.5 px-3">Account #</th>
                      <th className="py-2.5 px-3">Account Name</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Normal Balance</th>
                      <th className="py-2.5 px-3 text-right">Debit Movements</th>
                      <th className="py-2.5 px-3 text-right">Credit Movements</th>
                      <th className="py-2.5 px-3 text-right">Net Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {glData.accounts?.map((acc: any) => (
                      <tr key={acc.accountNumber} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">{acc.accountNumber}</td>
                        <td className="py-2.5 px-3 text-slate-900 font-medium">{acc.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{acc.type}</td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono">{acc.normalBalance}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-800">{formatCents(acc.debitCents)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-800">{formatCents(acc.creditCents)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatCents(acc.netBalanceCents)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                      <td colSpan={4} className="py-2.5 px-3 text-slate-900">Total Trial Balance Movements</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900">{formatCents(glData.trialBalanceTotals?.totalDebitsCents || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900">{formatCents(glData.trialBalanceTotals?.totalCreditsCents || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600">$0.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

