'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Search,
  Filter,
  DollarSign,
  Download,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
} from 'lucide-react';
import { Invoice } from '@/types/billing';
import { formatCents, formatDate, getStatusBadgeClass } from '@/lib/financialFormatters';

interface DeliveredShipment {
  _id: string;
  trackingNumber: string;
  customer?: { name: string; email: string };
  cargo?: { description: string; weightKg: number };
  pricing?: { quotedAmount: number; currency: string };
  status: string;
}

export default function InvoicesListPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Shipment Invoicing Wizard State
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deliveredShipments, setDeliveredShipments] = useState<DeliveredShipment[]>([]);
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [taxRateInput, setTaxRateInput] = useState(0);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardSuccess, setWizardSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, [page, statusFilter]);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: '15',
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
      });

      const res = await fetch(`/api/v1/billing/invoices?${q.toString()}`);
      if (res.ok) {
        const j = await res.json();
        setInvoices(j.data?.invoices || []);
        setTotalPages(j.data?.pagination?.totalPages || 1);
      } else {
        setError('Failed to load invoices ledger');
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
    fetchInvoices();
  };

  // Open Wizard & Fetch Eligible Delivered Shipments
  const openInvoicingWizard = async () => {
    setWizardOpen(true);
    setWizardError(null);
    setWizardSuccess(null);
    setSelectedShipmentIds([]);
    setInvoiceNumberInput(`INV-2026-${Math.floor(100000 + Math.random() * 900000)}`);

    try {
      setWizardLoading(true);
      const res = await fetch('/api/v1/shipments?status=DELIVERED');
      if (res.ok) {
        const j = await res.json();
        setDeliveredShipments(j.data?.shipments || j.data || []);
      }
    } catch {
      setWizardError('Failed to fetch delivered shipments list');
    } finally {
      setWizardLoading(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (selectedShipmentIds.length === 0) {
      setWizardError('Please select at least one delivered shipment to invoice');
      return;
    }
    if (!invoiceNumberInput.trim()) {
      setWizardError('Please specify a unique invoice number');
      return;
    }

    setWizardLoading(true);
    setWizardError(null);
    try {
      const res = await fetch('/api/v1/billing/invoices/generate-from-shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentIds: selectedShipmentIds,
          invoiceNumber: invoiceNumberInput.trim().toUpperCase(),
          taxRatePercent: Number(taxRateInput) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setWizardError(data.error?.message || 'Invoice generation failed');
        return;
      }

      setWizardSuccess(`Successfully generated Invoice #${data.data?.invoiceNumber}`);
      fetchInvoices();
      setTimeout(() => {
        setWizardOpen(false);
      }, 1500);
    } catch {
      setWizardError('Network error while processing invoice creation');
    } finally {
      setWizardLoading(false);
    }
  };

  const toggleShipmentSelection = (id: string) => {
    if (selectedShipmentIds.includes(id)) {
      setSelectedShipmentIds(selectedShipmentIds.filter((item) => item !== id));
    } else {
      setSelectedShipmentIds([...selectedShipmentIds, id]);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Freight Invoices</h1>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
              Billing Ledger
            </span>
          </div>
          <p className="text-sm text-graphite-500 mt-1">
            Accounts receivable invoices generated from delivered customer shipments.
          </p>
        </div>

        <button
          onClick={openInvoicingWizard}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-fleet-orange text-white hover:bg-orange-600 shadow-md transition"
        >
          <Sparkles className="w-4 h-4" />
          <span>Generate from Delivered</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-graphite-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-graphite-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by invoice # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-graphite-200 focus:outline-none focus:border-navy-800 focus:ring-1 focus:ring-navy-800"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-navy-900 text-white hover:bg-navy-800 transition"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs py-2 px-3 rounded-xl border border-graphite-200 bg-white focus:outline-none focus:border-navy-800"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="VOID">Void</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-graphite-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-graphite-50/75 border-b border-graphite-200 text-graphite-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Invoice #</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Issue Date</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4 text-right">Total Amount</th>
                <th className="py-3.5 px-4 text-right">Balance Due</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-graphite-400">
                    Loading invoices ledger...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-graphite-400">
                    No freight invoices found.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-graphite-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-navy-900">
                      <Link href={`/billing/invoices/${inv._id}`} className="hover:text-fleet-orange">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-graphite-700 font-medium">
                      {inv.customer?.name || 'Customer'}
                    </td>
                    <td className="py-3.5 px-4 text-graphite-500">{formatDate(inv.issuedAt)}</td>
                    <td className="py-3.5 px-4 text-graphite-500">{formatDate(inv.dueAt)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-navy-900">
                      {formatCents(inv.totalAmountCents, inv.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-rose-700">
                      {formatCents(inv.balanceDueCents || (inv.totalAmountCents - (inv.amountPaidCents || 0)), inv.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border ${getStatusBadgeClass(
                          inv.status
                        )}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/billing/invoices/${inv._id}`}
                        className="text-xs font-semibold text-fleet-orange hover:text-navy-900 transition"
                      >
                        View &rarr;
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-graphite-100 flex items-center justify-between text-xs text-graphite-500">
          <span>
            Page <span className="font-bold text-navy-900">{page}</span> of{' '}
            <span className="font-bold text-navy-900">{totalPages}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-graphite-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-graphite-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-graphite-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-graphite-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Shipment Invoicing Wizard Modal */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 bg-navy-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-graphite-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-graphite-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-navy-900">
                  Shipment Invoicing Wizard
                </h3>
                <p className="text-xs text-graphite-500">
                  Select eligible delivered shipments to convert into a consolidated customer invoice.
                </p>
              </div>
              <button
                onClick={() => setWizardOpen(false)}
                className="p-1.5 rounded-lg text-graphite-400 hover:text-navy-900 hover:bg-graphite-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {wizardError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{wizardError}</span>
              </div>
            )}

            {wizardSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{wizardSuccess}</span>
              </div>
            )}

            {/* Inputs: Invoice Number & Tax */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-graphite-700 block uppercase">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={invoiceNumberInput}
                  onChange={(e) => setInvoiceNumberInput(e.target.value)}
                  className="mt-1 w-full text-xs px-3 py-2 rounded-xl border border-graphite-200 focus:outline-none focus:border-navy-900"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-graphite-700 block uppercase">
                  Sales Tax % (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.25"
                  value={taxRateInput}
                  onChange={(e) => setTaxRateInput(Number(e.target.value))}
                  className="mt-1 w-full text-xs px-3 py-2 rounded-xl border border-graphite-200 focus:outline-none focus:border-navy-900"
                />
              </div>
            </div>

            {/* Delivered Shipments Selection List */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-graphite-700 uppercase block">
                Select Delivered Shipments ({selectedShipmentIds.length} Selected)
              </span>

              <div className="max-h-60 overflow-y-auto border border-graphite-200 rounded-xl divide-y divide-graphite-100">
                {wizardLoading ? (
                  <div className="p-6 text-center text-xs text-graphite-400">Loading shipments...</div>
                ) : deliveredShipments.length === 0 ? (
                  <div className="p-6 text-center text-xs text-graphite-400">
                    No unbilled DELIVERED shipments available.
                  </div>
                ) : (
                  deliveredShipments.map((sh) => (
                    <label
                      key={sh._id}
                      className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-graphite-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedShipmentIds.includes(sh._id)}
                          onChange={() => toggleShipmentSelection(sh._id)}
                          className="rounded border-graphite-300 text-fleet-orange focus:ring-fleet-orange"
                        />
                        <div>
                          <span className="font-bold text-navy-900 block">{sh.trackingNumber}</span>
                          <span className="text-[11px] text-graphite-500">
                            {sh.customer?.name} • {sh.cargo?.description || 'Cargo'}
                          </span>
                        </div>
                      </div>

                      <span className="font-extrabold text-navy-900">
                        ${sh.pricing?.quotedAmount?.toFixed(2) || '0.00'}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-graphite-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setWizardOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-graphite-100 text-graphite-700 hover:bg-graphite-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateInvoice}
                disabled={wizardLoading || selectedShipmentIds.length === 0}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-fleet-orange text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition"
              >
                {wizardLoading ? 'Processing...' : 'Generate & Issue Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

