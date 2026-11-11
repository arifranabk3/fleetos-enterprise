'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Printer,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  Clock,
  ShieldCheck,
  Building,
  Truck,
  Download,
} from 'lucide-react';
import { Invoice } from '@/types/billing';
import { formatCents, formatDate, getStatusBadgeClass } from '@/lib/financialFormatters';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Void modal
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/billing/invoices/${id}`);
      if (res.ok) {
        const j = await res.json();
        setInvoice(j.data);
      } else {
        setError('Invoice not found or access denied.');
      }
    } catch {
      setError('Network communication failure');
    } finally {
      setLoading(false);
    }
  };

  const handleIssueInvoice = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/billing/invoices/${id}/issue`, { method: 'POST' });
      if (res.ok) {
        setActionSuccess('Invoice issued successfully.');
        fetchInvoice();
      } else {
        const j = await res.json();
        setError(j.error?.message || 'Failed to issue invoice.');
      }
    } catch {
      setError('Network failure while issuing invoice.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoidInvoice = async () => {
    if (!voidReason.trim()) {
      setError('Void reason is mandatory.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/billing/invoices/${id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });

      if (res.ok) {
        setActionSuccess('Invoice formally voided.');
        setVoidModalOpen(false);
        fetchInvoice();
      } else {
        const j = await res.json();
        setError(j.error?.message || 'Failed to void invoice.');
      }
    } catch {
      setError('Network failure while voiding invoice.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-graphite-400">
        Loading invoice document details...
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <Link href="/billing/invoices" className="inline-flex items-center gap-1.5 text-xs text-graphite-500 hover:text-navy-900">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Invoices</span>
        </Link>
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error || 'Unable to retrieve invoice'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Action Controls (Hidden on Print) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href="/billing/invoices"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-graphite-500 hover:text-navy-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Invoices</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-navy-800 border border-navy-200 hover:bg-navy-50 shadow-sm transition"
          >
            <Printer className="w-4 h-4 text-graphite-600" />
            <span>Print / PDF</span>
          </button>

          {invoice.status === 'DRAFT' && (
            <button
              onClick={handleIssueInvoice}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-navy-sidebar text-white hover:bg-navy-800 transition shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Issue Invoice</span>
            </button>
          )}

          {['DRAFT', 'ISSUED', 'OVERDUE'].includes(invoice.status) && (
            <button
              onClick={() => {
                setVoidReason('');
                setVoidModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
            >
              <XCircle className="w-4 h-4" />
              <span>Void</span>
            </button>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="print:hidden p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Printable Invoice Sheet */}
      <div className="bg-white rounded-3xl border border-graphite-200 shadow-md p-8 sm:p-12 space-y-8 print:shadow-none print:border-none print:p-0">
        {/* Invoice Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 pb-8 border-b border-graphite-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-navy-900 tracking-tight">FleetOS Enterprise</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-navy-100 text-navy-800 font-bold">
                Commercial Carrier
              </span>
            </div>
            <p className="text-xs text-graphite-500 mt-1">Apex Global Logistics Fleet Division</p>
            <p className="text-xs text-graphite-400">100 Fleet Boulevard, Suite 500, Dallas, TX</p>
          </div>

          <div className="text-right space-y-1">
            <span className="text-2xl font-black text-navy-900 block tracking-tight">
              {invoice.invoiceNumber}
            </span>
            <span
              className={`inline-block px-3 py-0.5 rounded-full text-xs font-mono font-bold border ${getStatusBadgeClass(
                invoice.status
              )}`}
            >
              {invoice.status}
            </span>
            <p className="text-xs text-graphite-500 pt-1">
              Issued: <span className="font-semibold text-navy-900">{formatDate(invoice.issuedAt)}</span>
            </p>
            <p className="text-xs text-graphite-500">
              Due Date: <span className="font-semibold text-navy-900">{formatDate(invoice.dueAt)}</span>
            </p>
          </div>
        </div>

        {/* Bill To & Freight Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="p-4 rounded-2xl bg-graphite-50/75 border border-graphite-200 space-y-1.5">
            <span className="font-bold text-graphite-500 uppercase tracking-wider text-[10px] block">
              Billed To Customer:
            </span>
            <p className="text-sm font-bold text-navy-900">{invoice.customer?.name || invoice.customerId?.name || 'Customer'}</p>
            <p className="text-graphite-600">{invoice.customer?.email || invoice.customerId?.email || ''}</p>
            {invoice.billingAddress && (
              <p className="text-graphite-600 whitespace-pre-line">
                {[
                  invoice.billingAddress.street,
                  invoice.billingAddress.city,
                  invoice.billingAddress.state,
                  invoice.billingAddress.postalCode,
                  invoice.billingAddress.country
                ].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-graphite-50/75 border border-graphite-200 space-y-1.5">
            <span className="font-bold text-graphite-500 uppercase tracking-wider text-[10px] block">
              Payment Terms & Snapshot:
            </span>
            <p className="text-navy-900 font-bold">Terms: Net {invoice.paymentTermsDays || 30} Days</p>
            {invoice.rateSnapshot ? (
              <div className="text-graphite-600 space-y-0.5 pt-1 text-[11px] font-mono">
                <p>Contract Tariff: {invoice.rateSnapshot.code} (v{invoice.rateSnapshot.version})</p>
                <p>Fuel Surcharge Index: {invoice.rateSnapshot.fuelSurchargePercent}%</p>
              </div>
            ) : (
              <p className="text-graphite-500 text-[11px]">Standard Agreed Freight Tariff</p>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-navy-900 text-navy-900 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-2">Description</th>
                <th className="py-3 px-2 text-center">Qty</th>
                <th className="py-3 px-2 text-right">Unit Price</th>
                <th className="py-3 px-2 text-right">Fuel Surcharge</th>
                <th className="py-3 px-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-200">
              {invoice.lineItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-graphite-50/40">
                  <td className="py-3.5 px-2 font-medium text-navy-900">{item.description}</td>
                  <td className="py-3.5 px-2 text-center text-graphite-600">{item.quantity}</td>
                  <td className="py-3.5 px-2 text-right text-graphite-600">
                    {formatCents(item.unitPriceCents, invoice.currency)}
                  </td>
                  <td className="py-3.5 px-2 text-right text-graphite-600">
                    {formatCents(item.fuelSurchargeCents, invoice.currency)}
                  </td>
                  <td className="py-3.5 px-2 text-right font-bold text-navy-900">
                    {formatCents(item.totalCents, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="flex justify-end pt-4 border-t border-graphite-200">
          <div className="w-full sm:w-80 space-y-2 text-xs">
            <div className="flex justify-between text-graphite-600">
              <span>Freight Subtotal:</span>
              <span className="font-medium text-navy-900">{formatCents(invoice.subtotalCents, invoice.currency)}</span>
            </div>

            <div className="flex justify-between text-graphite-600">
              <span>Fuel Surcharge:</span>
              <span className="font-medium text-navy-900">{formatCents(invoice.fuelSurchargeCents, invoice.currency)}</span>
            </div>

            {invoice.taxAmountCents > 0 && (
              <div className="flex justify-between text-graphite-600">
                <span>Sales Tax:</span>
                <span className="font-medium text-navy-900">{formatCents(invoice.taxAmountCents, invoice.currency)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-black text-navy-900 pt-2 border-t border-graphite-200">
              <span>Total Invoiced:</span>
              <span>{formatCents(invoice.totalAmountCents, invoice.currency)}</span>
            </div>

            <div className="flex justify-between text-xs text-emerald-700 font-bold">
              <span>Amount Paid:</span>
              <span>-{formatCents(invoice.amountPaidCents, invoice.currency)}</span>
            </div>

            <div className="flex justify-between text-sm font-black text-rose-700 pt-2 border-t-2 border-graphite-900">
              <span>Balance Due:</span>
              <span>{formatCents(invoice.balanceDueCents || (invoice.totalAmountCents - (invoice.amountPaidCents || 0)), invoice.currency)}</span>
            </div>
          </div>
        </div>

        {/* Audit History Timeline */}
        {invoice.auditTrail && invoice.auditTrail.length > 0 && (
          <div className="pt-8 border-t border-graphite-200 print:hidden space-y-3">
            <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
              Audit History & State Transitions
            </h4>
            <div className="space-y-2 text-xs">
              {invoice.auditTrail.map((log, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] text-graphite-500 bg-graphite-50 p-2.5 rounded-xl border border-graphite-200">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-navy-800">{log.action}</span>
                    {log.note && <span>• {log.note}</span>}
                  </div>
                  <span className="font-mono text-graphite-400">{formatDate(log.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Void Modal */}
      {voidModalOpen && (
        <div className="fixed inset-0 z-50 bg-navy-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-graphite-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Void Invoice #{invoice.invoiceNumber}</h3>
            <p className="text-xs text-graphite-500">
              Voiding an invoice cancels customer receivable balances and posts a reversal entry. This action cannot be undone.
            </p>

            <div>
              <label className="text-[11px] font-bold text-graphite-700 uppercase block">Formal Void Reason</label>
              <textarea
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Shipment re-routed and billed under revised contract..."
                className="mt-1 w-full text-xs p-3 rounded-xl border border-graphite-200 focus:outline-none focus:border-navy-900"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setVoidModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-graphite-100 text-graphite-700 hover:bg-graphite-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleVoidInvoice}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

