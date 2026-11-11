'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  FileText,
  User,
} from 'lucide-react';
import { PaymentReceipt, Invoice } from '@/types/billing';
import { formatCents, formatDate, getStatusBadgeClass } from '@/lib/financialFormatters';

interface CustomerOption {
  _id: string;
  name: string;
  email?: string;
  companyName?: string;
}

export default function PaymentReceiptsPage() {
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Record Receipt Modal State
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Form Fields
  const [receiptNumber, setReceiptNumber] = useState('');
  const [totalAmountDollars, setTotalAmountDollars] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'CREDIT_CARD' | 'CHECK' | 'CASH' | 'ACH'>('BANK_TRANSFER');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [allocations, setAllocations] = useState<{ [invoiceId: string]: string }>({});
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordSuccess, setRecordSuccess] = useState<string | null>(null);

  // Reversal Modal State
  const [reversalModalOpen, setReversalModalOpen] = useState(false);
  const [selectedReceiptForReversal, setSelectedReceiptForReversal] = useState<PaymentReceipt | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalLoading, setReversalLoading] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);

  useEffect(() => {
    fetchReceipts();
  }, [page, paymentMethodFilter]);

  const fetchReceipts = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: '15',
        ...(paymentMethodFilter ? { paymentMethod: paymentMethodFilter } : {}),
        ...(search ? { search } : {}),
      });

      const res = await fetch(`/api/v1/billing/receipts?${q.toString()}`);
      if (res.ok) {
        const j = await res.json();
        setReceipts(j.data?.receipts || []);
        setTotalPages(j.data?.pagination?.totalPages || 1);
      } else {
        setError('Failed to fetch payment receipts ledger');
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
    fetchReceipts();
  };

  // Open Record Modal & Fetch Customers
  const openRecordModal = async () => {
    setRecordModalOpen(true);
    setRecordError(null);
    setRecordSuccess(null);
    setReceiptNumber(`REC-2026-${Math.floor(100000 + Math.random() * 900000)}`);
    setTotalAmountDollars('');
    setReferenceNumber('');
    setNotes('');
    setSelectedCustomerId('');
    setUnpaidInvoices([]);
    setAllocations({});

    try {
      const res = await fetch('/api/v1/customers');
      if (res.ok) {
        const j = await res.json();
        const custList = j.data?.customers || (Array.isArray(j.data) ? j.data : []);
        setCustomers(custList);
      }
    } catch {
      // Fallback
    }
  };

  // On Customer Change: Load Unpaid Invoices
  const handleCustomerChange = async (custId: string) => {
    setSelectedCustomerId(custId);
    setAllocations({});
    if (!custId) {
      setUnpaidInvoices([]);
      return;
    }

    try {
      setInvoicesLoading(true);
      const res = await fetch(`/api/v1/billing/invoices?customerId=${custId}&status=ISSUED,PARTIALLY_PAID&limit=50`);
      if (res.ok) {
        const j = await res.json();
        setUnpaidInvoices(j.data?.invoices || []);
      }
    } catch {
      // Ignore
    } finally {
      setInvoicesLoading(false);
    }
  };

  // Auto-allocate entered total amount across unpaid invoices
  const handleAutoAllocate = () => {
    const totalCents = Math.round((parseFloat(totalAmountDollars) || 0) * 100);
    if (totalCents <= 0) return;

    let remaining = totalCents;
    const newAlloc: { [invId: string]: string } = {};

    for (const inv of unpaidInvoices) {
      if (remaining <= 0) break;
      const due = inv.balanceDueCents || (inv.totalAmountCents - (inv.amountPaidCents || 0));
      const alloc = Math.min(remaining, due);
      newAlloc[inv._id] = (alloc / 100).toFixed(2);
      remaining -= alloc;
    }

    setAllocations(newAlloc);
  };

  const calculateTotalAllocatedCents = (): number => {
    return Object.values(allocations).reduce((sum, val) => {
      const parsed = parseFloat(val);
      return sum + (isNaN(parsed) ? 0 : Math.round(parsed * 100));
    }, 0);
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecordLoading(true);
    setRecordError(null);
    setRecordSuccess(null);

    const amountCents = Math.round((parseFloat(totalAmountDollars) || 0) * 100);
    if (amountCents <= 0) {
      setRecordError('Payment amount must be greater than zero.');
      setRecordLoading(false);
      return;
    }

    if (!selectedCustomerId) {
      setRecordError('Customer selection is required.');
      setRecordLoading(false);
      return;
    }

    // Build invoice allocation array
    const invoiceAllocations = Object.entries(allocations)
      .filter(([_, val]) => (parseFloat(val) || 0) > 0)
      .map(([invoiceId, val]) => ({
        invoiceId,
        amountCents: Math.round((parseFloat(val) || 0) * 100),
      }));

    const allocatedSum = invoiceAllocations.reduce((sum, item) => sum + item.amountCents, 0);
    if (allocatedSum > amountCents) {
      setRecordError(`Total allocated ($${(allocatedSum / 100).toFixed(2)}) exceeds received amount ($${(amountCents / 100).toFixed(2)}).`);
      setRecordLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/billing/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptNumber,
          customerId: selectedCustomerId,
          amountCents,
          currency: 'USD',
          paymentMethod,
          referenceNumber: referenceNumber || undefined,
          notes: notes || undefined,
          invoiceAllocations,
        }),
      });

      const j = await res.json();
      if (res.ok) {
        setRecordSuccess(`Receipt ${receiptNumber} successfully booked and applied to AR ledger.`);
        fetchReceipts();
        setTimeout(() => {
          setRecordModalOpen(false);
        }, 1500);
      } else {
        setRecordError(j.message || 'Failed to record customer receipt');
      }
    } catch {
      setRecordError('Communication error while processing payment receipt.');
    } finally {
      setRecordLoading(false);
    }
  };

  // Open Reversal Modal
  const openReversalModal = (receipt: PaymentReceipt) => {
    setSelectedReceiptForReversal(receipt);
    setReversalReason('');
    setReversalError(null);
    setReversalModalOpen(true);
  };

  const handleReversalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceiptForReversal) return;
    if (!reversalReason.trim() || reversalReason.trim().length < 5) {
      setReversalError('A comprehensive audit reason of at least 5 characters is required for GAAP reversal.');
      return;
    }

    setReversalLoading(true);
    setReversalError(null);
    try {
      const res = await fetch(`/api/v1/billing/receipts/${selectedReceiptForReversal._id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reversalReason }),
      });

      const j = await res.json();
      if (res.ok) {
        setReversalModalOpen(false);
        fetchReceipts();
      } else {
        setReversalError(j.message || 'Failed to reverse receipt');
      }
    } catch {
      setReversalError('Communication error while processing GAAP reversal.');
    } finally {
      setReversalLoading(false);
    }
  };

  const enteredCents = Math.round((parseFloat(totalAmountDollars) || 0) * 100);
  const totalAllocatedCents = calculateTotalAllocatedCents();
  const unallocatedCents = Math.max(0, enteredCents - totalAllocatedCents);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/billing" className="hover:text-indigo-600 transition-colors">Billing</Link>
            <span>/</span>
            <span className="text-slate-900 font-medium">Customer Payment Receipts</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Receipts Ledger</h1>
          <p className="text-slate-500 text-sm">
            Record customer collections, auto-reconcile outstanding invoices, and track accounts receivable settlement.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openRecordModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Record Payment Receipt
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by receipt number, reference, or check number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={paymentMethodFilter}
              onChange={(e) => {
                setPaymentMethodFilter(e.target.value);
                setPage(1);
              }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">All Payment Methods</option>
              <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
              <option value="ACH">ACH Transfer</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="CHECK">Paper Check</option>
              <option value="CASH">Cash</option>
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

      {/* Receipts Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Receipt #</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Payment Method</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Invoices Applied</th>
                <th className="py-3.5 px-4">Payment Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent mb-2" />
                    <div>Loading payment receipts ledger...</div>
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <DollarSign className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-700">No payment receipts found</p>
                    <p className="text-xs text-slate-400 mt-1">Record a customer receipt to apply payments against outstanding freight invoices.</p>
                  </td>
                </tr>
              ) : (
                receipts.map((rcpt) => {
                  const custName = typeof rcpt.customer === 'object' ? rcpt.customer?.name : 'Customer';
                  const isReversed = rcpt.status === 'REVERSED';
                  return (
                    <tr key={rcpt._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-indigo-600">
                        {rcpt.receiptNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-900 font-medium">
                        {custName}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                          <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                          {rcpt.paymentMethod}
                        </span>
                        {rcpt.referenceNumber && (
                          <span className="block text-[11px] text-slate-400 mt-0.5">Ref: {rcpt.referenceNumber}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 font-mono">
                        {formatCents(rcpt.amountCents, rcpt.currency)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {rcpt.invoiceAllocations && rcpt.invoiceAllocations.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {rcpt.invoiceAllocations.map((alloc, idx) => {
                              const invId = typeof alloc.invoice === 'object' ? (alloc.invoice as any)?._id : alloc.invoice;
                              const invNum = typeof alloc.invoice === 'object' ? (alloc.invoice as any)?.invoiceNumber : 'INV';
                              return (
                                <Link
                                  key={idx}
                                  href={`/billing/invoices/${invId}`}
                                  className="text-[11px] font-mono bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors"
                                >
                                  {invNum}: {formatCents(alloc.allocatedAmountCents || alloc.amountCents || 0)}
                                </Link>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">Unallocated on Account</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs">
                        {formatDate(rcpt.paymentDate || rcpt.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(rcpt.status || 'PROCESSED')}`}>
                          {rcpt.status || 'PROCESSED'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isReversed ? (
                          <button
                            onClick={() => openReversalModal(rcpt)}
                            className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-md font-medium transition-colors"
                            title="Reverse payment receipt"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reverse
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Reversed</span>
                        )}
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

      {/* RECORD PAYMENT RECEIPT MODAL */}
      {recordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Record Customer Payment Receipt</h2>
                  <p className="text-xs text-slate-500">Book customer receipt and apply against outstanding invoices.</p>
                </div>
              </div>
              <button
                onClick={() => setRecordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleRecordSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {recordError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{recordError}</span>
                </div>
              )}

              {recordSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{recordSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt Number</label>
                  <input
                    type="text"
                    required
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Account</label>
                  <select
                    required
                    value={selectedCustomerId}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="">-- Select Customer --</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name || c.companyName} {c.email ? `(${c.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Total Payment Received ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={totalAmountDollars}
                      onChange={(e) => setTotalAmountDollars(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 text-xs font-mono font-medium border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="BANK_TRANSFER">Bank Wire / Electronic Transfer</option>
                    <option value="ACH">ACH Direct Debit</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="CHECK">Paper Check</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / Check # (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. WIRE-889102 or CHK-4401"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. October freight settlement"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Invoice Allocation Section */}
              {selectedCustomerId && (
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Allocate Payment Against Open Invoices
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Specify how much of this receipt applies to each outstanding invoice.
                      </p>
                    </div>
                    {unpaidInvoices.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAutoAllocate}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 bg-indigo-50 rounded"
                      >
                        Auto-Allocate FIFO
                      </button>
                    )}
                  </div>

                  {invoicesLoading ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      Loading open customer invoices...
                    </div>
                  ) : unpaidInvoices.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500">
                      No open or partially paid invoices found for this customer. Payment can be booked unallocated on account.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                          <tr>
                            <th className="py-2 px-3">Invoice #</th>
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Total</th>
                            <th className="py-2 px-3">Balance Due</th>
                            <th className="py-2 px-3 text-right">Apply Amount ($)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {unpaidInvoices.map((inv) => {
                            const balanceDue = inv.balanceDueCents || (inv.totalAmountCents - (inv.amountPaidCents || 0));
                            return (
                              <tr key={inv._id} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-mono font-medium text-slate-900">
                                  {inv.invoiceNumber}
                                </td>
                                <td className="py-2 px-3 text-slate-500">
                                  {formatDate(inv.issueDate || inv.createdAt)}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-700">
                                  {formatCents(inv.totalAmountCents)}
                                </td>
                                <td className="py-2 px-3 font-mono font-semibold text-rose-600">
                                  {formatCents(balanceDue)}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <div className="inline-flex items-center gap-1">
                                    <span className="text-slate-400 font-mono text-[11px]">$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max={(balanceDue / 100).toFixed(2)}
                                      placeholder="0.00"
                                      value={allocations[inv._id] || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setAllocations((prev) => ({ ...prev, [inv._id]: val }));
                                      }}
                                      className="w-24 text-right px-2 py-1 text-xs font-mono border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Allocation Summary Bar */}
                  <div className="mt-3 bg-slate-50 p-3 rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-500">Allocated to Invoices: </span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {formatCents(totalAllocatedCents)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Unallocated (On Account): </span>
                      <span className="font-semibold text-emerald-600 font-mono">
                        {formatCents(unallocatedCents)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRecordModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordLoading || !selectedCustomerId || enteredCents <= 0}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {recordLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Confirm & Post Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVERSAL CONFIRMATION MODAL */}
      {reversalModalOpen && selectedReceiptForReversal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Reverse Payment Receipt</h3>
                <p className="text-xs text-slate-500">Receipt #{selectedReceiptForReversal.receiptNumber}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will create a negative reversal entry in the financial ledger, unapply all customer invoice credits, and restore invoice balances due.
            </p>

            {reversalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{reversalError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                GAAP Audit Reason for Reversal <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Check returned for insufficient funds (NSF) or duplicate entry recorded in error."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReversalModalOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReversalSubmit}
                disabled={reversalLoading || reversalReason.trim().length < 5}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {reversalLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

