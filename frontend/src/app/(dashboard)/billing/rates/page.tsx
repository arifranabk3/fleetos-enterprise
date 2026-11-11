'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  Plus,
  Search,
  Calculator,
  History,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  X,
  FileSpreadsheet,
  TrendingUp,
} from 'lucide-react';
import { RateMatrix } from '@/types/billing';
import { formatCents, formatDate, getStatusBadgeClass } from '@/lib/financialFormatters';

export default function RatesManagementPage() {
  const [rates, setRates] = useState<RateMatrix[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [pricingModelFilter, setPricingModelFilter] = useState('');

  // Version History Drawer/Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedRateForHistory, setSelectedRateForHistory] = useState<RateMatrix | null>(null);
  const [rateVersions, setRateVersions] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Quotation Calculator State
  const [quoteDistanceKm, setQuoteDistanceKm] = useState('150');
  const [quoteWeightKg, setQuoteWeightKg] = useState('1200');
  const [quoteVehicleType, setQuoteVehicleType] = useState('BOX_TRUCK');
  const [quoteMatrixId, setQuoteMatrixId] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteResult, setQuoteResult] = useState<any | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Create Rate Tariff Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formPricingModel, setFormPricingModel] = useState<'PER_KM' | 'WEIGHT_DISTANCE' | 'FLAT_RATE' | 'ZONE_BASED'>('WEIGHT_DISTANCE');
  const [formVehicleType, setFormVehicleType] = useState('BOX_TRUCK');
  const [formBaseFee, setFormBaseFee] = useState('50.00');
  const [formPerKmRate, setFormPerKmRate] = useState('1.75');
  const [formPerKgRate, setFormPerKgRate] = useState('0.15');
  const [formMinimumCharge, setFormMinimumCharge] = useState('75.00');
  const [formFuelSurchargePct, setFormFuelSurchargePct] = useState('5.0');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchRates();
  }, [pricingModelFilter]);

  const fetchRates = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        ...(pricingModelFilter ? { pricingModel: pricingModelFilter } : {}),
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/v1/billing/rates?${q.toString()}`);
      if (res.ok) {
        const j = await res.json();
        const list = j.data?.rates || (Array.isArray(j.data) ? j.data : []);
        setRates(list);
        if (list.length > 0 && !quoteMatrixId) {
          setQuoteMatrixId(list[0]._id);
        }
      } else {
        setError('Failed to load freight rate matrices');
      }
    } catch {
      setError('Network communication failure');
    } finally {
      setLoading(false);
    }
  };

  // Run Quote Calculator
  const handleCalculateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuoteLoading(true);
    setQuoteError(null);
    setQuoteResult(null);

    try {
      const res = await fetch('/api/v1/billing/rates/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rateMatrixId: quoteMatrixId || undefined,
          distanceKm: parseFloat(quoteDistanceKm) || 0,
          weightKg: parseFloat(quoteWeightKg) || 0,
          vehicleType: quoteVehicleType,
        }),
      });

      const j = await res.json();
      if (res.ok) {
        setQuoteResult(j.data);
      } else {
        setQuoteError(j.message || 'Quotation calculation failed');
      }
    } catch {
      setQuoteError('Communication failure while requesting rate quote.');
    } finally {
      setQuoteLoading(false);
    }
  };

  // Open Version History Drawer
  const openVersionHistory = async (rate: RateMatrix) => {
    setSelectedRateForHistory(rate);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/v1/billing/rates/${rate._id}/versions`);
      if (res.ok) {
        const j = await res.json();
        setRateVersions(j.data?.versions || (Array.isArray(j.data) ? j.data : []));
      } else {
        setRateVersions([]);
      }
    } catch {
      setRateVersions([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setCreateModalOpen(true);
    setCreateError(null);
    setCreateSuccess(null);
    setFormCode(`TRF-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);

    const baseFeeCents = Math.round((parseFloat(formBaseFee) || 0) * 100);
    const perKmRateCents = Math.round((parseFloat(formPerKmRate) || 0) * 100);
    const perKgRateCents = Math.round((parseFloat(formPerKgRate) || 0) * 100);
    const minimumChargeCents = Math.round((parseFloat(formMinimumCharge) || 0) * 100);
    const fuelSurchargePercentage = parseFloat(formFuelSurchargePct) || 0;

    try {
      const res = await fetch('/api/v1/billing/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          code: formCode,
          pricingModel: formPricingModel,
          vehicleType: formVehicleType,
          baseFeeCents,
          perKmRateCents,
          perKgRateCents,
          minimumChargeCents,
          fuelSurchargePercentage,
          effectiveStartDate: new Date().toISOString(),
          isActive: true,
        }),
      });

      const j = await res.json();
      if (res.ok) {
        setCreateSuccess(`Rate matrix ${formName} (${formCode}) established successfully.`);
        fetchRates();
        setTimeout(() => {
          setCreateModalOpen(false);
        }, 1500);
      } else {
        setCreateError(j.message || 'Failed to establish freight rate tariff');
      }
    } catch {
      setCreateError('Error communicating with rate engine service.');
    } finally {
      setCreateLoading(false);
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
            <span className="text-slate-900 font-medium">Rate Matrix Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Freight Rate Tariffs & Matrix</h1>
          <p className="text-slate-500 text-sm">
            Maintain dynamic pricing matrices, fuel surcharge formulas, vehicle multipliers, and instant freight quote calculators.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Rate Tariff
          </button>
        </div>
      </div>

      {/* Interactive Quotation Calculator Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Dynamic Freight Quotation Engine</h2>
            <p className="text-xs text-indigo-200">
              Calculate instant billing quotes including base charges, mileage, weight tiers, and fuel surcharges.
            </p>
          </div>
        </div>

        <form onSubmit={handleCalculateQuote} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Active Tariff Matrix</label>
            <select
              value={quoteMatrixId}
              onChange={(e) => setQuoteMatrixId(e.target.value)}
              className="w-full text-xs bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Default Active Tariff</option>
              {rates.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.code} - {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Haul Distance (km)</label>
            <input
              type="number"
              min="0"
              required
              value={quoteDistanceKm}
              onChange={(e) => setQuoteDistanceKm(e.target.value)}
              className="w-full text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Cargo Weight (kg)</label>
            <input
              type="number"
              min="0"
              required
              value={quoteWeightKg}
              onChange={(e) => setQuoteWeightKg(e.target.value)}
              className="w-full text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Vehicle Category</label>
            <select
              value={quoteVehicleType}
              onChange={(e) => setQuoteVehicleType(e.target.value)}
              className="w-full text-xs bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="BOX_TRUCK">Box Truck</option>
              <option value="SEMI_TRAILER">Semi-Trailer / 18-Wheeler</option>
              <option value="FLATBED">Flatbed Heavy Haul</option>
              <option value="CARGO_VAN">Cargo Van / Sprinter</option>
              <option value="REEFER">Refrigerated (Reefer)</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={quoteLoading}
              className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-colors flex items-center justify-center gap-2 h-[38px]"
            >
              {quoteLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <TrendingUp className="w-4 h-4" />
                  Compute Quote
                </>
              )}
            </button>
          </div>
        </form>

        {quoteError && (
          <div className="mt-4 p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{quoteError}</span>
          </div>
        )}

        {quoteResult && (
          <div className="mt-5 p-4 bg-slate-800/60 border border-indigo-500/30 rounded-xl grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <span className="block text-[11px] text-slate-400 uppercase">Base Fee</span>
              <span className="text-sm font-semibold font-mono text-white">
                {formatCents(quoteResult.baseFeeCents || 0)}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-slate-400 uppercase">Distance Charge</span>
              <span className="text-sm font-semibold font-mono text-white">
                {formatCents(quoteResult.distanceChargeCents || 0)}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-slate-400 uppercase">Weight Charge</span>
              <span className="text-sm font-semibold font-mono text-white">
                {formatCents(quoteResult.weightChargeCents || 0)}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-slate-400 uppercase">Fuel Surcharge ({quoteResult.fuelSurchargePercentage || 0}%)</span>
              <span className="text-sm font-semibold font-mono text-amber-300">
                {formatCents(quoteResult.fuelSurchargeCents || 0)}
              </span>
            </div>
            <div className="col-span-2 md:col-span-1 border-t md:border-t-0 md:border-l border-slate-700 md:pl-4">
              <span className="block text-[11px] text-indigo-300 uppercase font-bold">Total Freight Quote</span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                {formatCents(quoteResult.totalQuotedCents || quoteResult.totalAmountCents || 0)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Matrix Ledger */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Configured Rate Matrices
          </h2>

          <div className="flex items-center gap-3">
            <select
              value={pricingModelFilter}
              onChange={(e) => setPricingModelFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">All Pricing Models</option>
              <option value="WEIGHT_DISTANCE">Weight + Distance</option>
              <option value="PER_KM">Per Kilometer</option>
              <option value="FLAT_RATE">Flat Fixed Fee</option>
              <option value="ZONE_BASED">Zone Based</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Code / Name</th>
                <th className="py-3.5 px-4">Pricing Model</th>
                <th className="py-3.5 px-4">Base Fee</th>
                <th className="py-3.5 px-4">Per Km / Kg</th>
                <th className="py-3.5 px-4">Fuel Surcharge</th>
                <th className="py-3.5 px-4">Min. Charge</th>
                <th className="py-3.5 px-4">Version</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent mb-2" />
                    <div>Loading freight rate matrix...</div>
                  </td>
                </tr>
              ) : rates.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-700">No rate matrices configured</p>
                    <p className="text-xs text-slate-400 mt-1">Create a freight rate tariff to enable automated quoting and shipment invoicing.</p>
                  </td>
                </tr>
              ) : (
                rates.map((rate) => (
                  <tr key={rate._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-indigo-600 text-xs">{rate.code}</div>
                      <div className="font-medium text-slate-900 text-sm">{rate.name}</div>
                      {rate.vehicleType && (
                        <span className="text-[11px] text-slate-400 font-mono">Type: {rate.vehicleType}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {rate.pricingModel}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {formatCents(rate.baseFeeCents)}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">
                      <div>Km: {formatCents(rate.perKmRateCents)}</div>
                      {rate.perKgRateCents ? <div>Kg: {formatCents(rate.perKgRateCents)}</div> : null}
                    </td>
                    <td className="py-3 px-4 font-mono text-amber-600 font-medium">
                      {rate.fuelSurchargePercentage}%
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {formatCents(rate.minimumChargeCents)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-50 text-indigo-700">
                        v{rate.version || 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${rate.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                        {rate.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openVersionHistory(rate)}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-md font-medium transition-colors"
                      >
                        <History className="w-3.5 h-3.5" />
                        Audit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VERSION HISTORY DRAWER/MODAL */}
      {historyModalOpen && selectedRateForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Rate Matrix Version History</h3>
                  <p className="text-xs text-slate-500">{selectedRateForHistory.code} — {selectedRateForHistory.name}</p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {historyLoading ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Loading version lineage and audit log...
              </div>
            ) : rateVersions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                This tariff is at its initial revision (v{selectedRateForHistory.version || 1}) with no subsequent amendments.
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {rateVersions.map((v, i) => (
                  <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 font-mono">Version {v.version}</span>
                      <span className="text-slate-400">{formatDate(v.createdAt)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-slate-600">
                      <div>Base: {formatCents(v.baseFeeCents)}</div>
                      <div>Km: {formatCents(v.perKmRateCents)}</div>
                      <div>Fuel: {v.fuelSurchargePercentage}%</div>
                    </div>
                    {v.changeReason && (
                      <p className="text-[11px] text-slate-500 italic pt-1">Reason: {v.changeReason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE RATE MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">New Freight Rate Tariff</h3>
                  <p className="text-xs text-slate-500">Establish pricing structure for billing automated calculations.</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            {createSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{createSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tariff Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Standard Regional Freight"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tariff Code</label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pricing Model</label>
                  <select
                    value={formPricingModel}
                    onChange={(e) => setFormPricingModel(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="WEIGHT_DISTANCE">Weight + Distance</option>
                    <option value="PER_KM">Per Kilometer Only</option>
                    <option value="FLAT_RATE">Flat Fixed Fee</option>
                    <option value="ZONE_BASED">Zone Based</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle Category</label>
                  <select
                    value={formVehicleType}
                    onChange={(e) => setFormVehicleType(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="BOX_TRUCK">Box Truck</option>
                    <option value="SEMI_TRAILER">Semi-Trailer / 18-Wheeler</option>
                    <option value="FLATBED">Flatbed Heavy Haul</option>
                    <option value="CARGO_VAN">Cargo Van / Sprinter</option>
                    <option value="REEFER">Refrigerated (Reefer)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Base Fee ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formBaseFee}
                    onChange={(e) => setFormBaseFee(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Per Km Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formPerKmRate}
                    onChange={(e) => setFormPerKmRate(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Per Kg Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formPerKgRate}
                    onChange={(e) => setFormPerKgRate(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fuel Surcharge (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formFuelSurchargePct}
                    onChange={(e) => setFormFuelSurchargePct(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading || !formName || !formCode}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {createLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Save Rate Tariff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

