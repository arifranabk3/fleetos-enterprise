'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Fuel, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export default function NewFuelTransactionPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    vehicleId: '',
    driverId: '',
    fuelVendorId: '',
    transactionReference: '',
    transactionDate: new Date().toISOString().split('T')[0],
    fuelType: 'DIESEL',
    quantityLiters: '',
    pricePerLiter: '',
    odometerReading: '',
    paymentMethod: 'COMPANY_ACCOUNT',
    isFullTank: true,
    receiptReference: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/fuel/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          quantityLiters: Number(formData.quantityLiters),
          pricePerLiter: Number(formData.pricePerLiter),
          odometerReading: Number(formData.odometerReading),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to create transaction');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/fuel');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'An error occurred while logging fuel transaction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <Link
        href="/fuel"
        className="inline-flex items-center gap-2 text-sm font-medium text-graphite-500 hover:text-navy-900 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Fuel Dashboard
      </Link>

      <div className="bg-white border border-graphite-200/80 rounded-xl shadow-xs p-8">
        <div className="flex items-center gap-3 border-b border-graphite-100 pb-5 mb-6">
          <div className="p-2.5 bg-navy-900 text-orange-500 rounded-xl">
            <Fuel className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy-900">Log Refuel Transaction</h1>
            <p className="text-xs text-graphite-500">Record commercial refuelling event, compute km/L, and sync expense.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Transaction logged and expense synchronized! Redirecting...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-graphite-700 uppercase mb-2">
                Transaction Reference *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. PFJ-90412"
                value={formData.transactionReference}
                onChange={(e) => setFormData({ ...formData, transactionReference: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-graphite-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-graphite-700 uppercase mb-2">
                Transaction Date *
              </label>
              <input
                type="date"
                required
                value={formData.transactionDate}
                onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-graphite-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-graphite-700 uppercase mb-2">
                Vehicle ID or Plate *
              </label>
              <input
                type="text"
                required
                placeholder="Vehicle Object ID or Plate"
                value={formData.vehicleId}
                onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-graphite-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-graphite-700 uppercase mb-2">
                Fuel Type *
              </label>
              <select
                value={formData.fuelType}
                onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-graphite-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="DIESEL">Diesel</option>
                <option value="ELECTRIC">Electric (kWh)</option>
                <option value="PETROL">Petrol</option>
                <option value="CNG">CNG</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-graphite-700 uppercase mb-2">
                Quantity ({formData.fuelType === 'ELECTRIC' ? 'kWh' : 'Liters'}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="e.g. 380"
                value={formData.quantityLiters}
                onChange={(e) => setFormData({ ...formData, quantityLiters: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-graphite-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-graphite-700 uppercase mb-2">
                Price Per Unit ($) *
              </label>
              <input
                type="number"
                step="0.001"
                min="0.01"
                required
                placeholder="e.g. 1.25"
                value={formData.pricePerLiter}
                onChange={(e) => setFormData({ ...formData, pricePerLiter: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-graphite-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-graphite-700 uppercase mb-2">
                Odometer Reading (km) *
              </label>
              <input
                type="number"
                min="0"
                required
                placeholder="Current odometer"
                value={formData.odometerReading}
                onChange={(e) => setFormData({ ...formData, odometerReading: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-graphite-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-graphite-700 uppercase mb-2">
                Full-Tank Boundary
              </label>
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isFullTank"
                  checked={formData.isFullTank}
                  onChange={(e) => setFormData({ ...formData, isFullTank: e.target.checked })}
                  className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                />
                <label htmlFor="isFullTank" className="text-sm text-graphite-700 font-medium">
                  Tank filled to 100% capacity (Enables full-to-full verified efficiency)
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-graphite-700 uppercase mb-2">
              Operational Notes
            </label>
            <textarea
              rows={3}
              placeholder="Driver remarks, station number, pump details..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-graphite-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-graphite-100">
            <Link
              href="/fuel"
              className="px-4 py-2 border border-graphite-200 text-graphite-600 rounded-lg text-sm font-semibold hover:bg-graphite-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Save & Sync Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
