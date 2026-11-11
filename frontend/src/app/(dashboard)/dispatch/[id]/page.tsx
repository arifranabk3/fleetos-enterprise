'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  Boxes,
  Play,
  CheckCheck,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

export default function DispatchDetailsPage({ params }: { params: { id: string } }) {
  const [status, setStatus] = useState<'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ACTIVE');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleStart = () => {
    setStatus('ACTIVE');
    setActionNotice('Dispatch journey started! Vehicle & shipment status set to IN_TRANSIT.');
  };

  const handleComplete = () => {
    setStatus('COMPLETED');
    setActionNotice('Dispatch completed! Assigned vehicle and driver released to AVAILABLE status.');
  };

  const handleCancel = () => {
    setStatus('CANCELLED');
    setActionNotice('Dispatch cancelled. Linked shipments returned to unassigned queue.');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Link
          href="/dispatch"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-graphite-600 hover:text-navy-900 transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dispatch Board</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-graphite-500 uppercase">Manifest ID</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-navy-100 text-navy-900">
                {params.id}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                  status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : status === 'ACTIVE'
                    ? 'bg-sky-100 text-sky-800'
                    : status === 'CANCELLED'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {status}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
              Active Manifest Control
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {status === 'PENDING' && (
              <button
                onClick={handleStart}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy-900 text-white font-semibold text-xs shadow-sm hover:bg-navy-800"
              >
                <Play className="w-3.5 h-3.5 text-fleet-orange" />
                <span>Start Journey</span>
              </button>
            )}
            {status === 'ACTIVE' && (
              <button
                onClick={handleComplete}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow-sm hover:bg-emerald-700"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Complete Manifest</span>
              </button>
            )}
            {status !== 'COMPLETED' && status !== 'CANCELLED' && (
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-semibold text-xs shadow-sm hover:bg-rose-100"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-navy-50 border border-navy-200 text-navy-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Manifest Bound Assets */}
          <div className="bg-white border border-graphite-100 rounded-2xl p-6 shadow-card space-y-4">
            <h2 className="text-xs font-mono font-bold text-graphite-500 uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-fleet-orange" />
              <span>Assigned Fleet Resources</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-graphite-50 border border-graphite-200/60">
                <div className="text-[10px] font-mono text-graphite-500 uppercase">Assigned Vehicle</div>
                <div className="text-xl font-extrabold text-navy-900 font-mono mt-1">TX-FL-4001</div>
                <div className="text-xs text-graphite-600">Freightliner Cascadia (20,000 kg capacity)</div>
                <div className="text-[11px] font-mono text-sky-700 font-bold mt-2">STATUS: {status === 'ACTIVE' ? 'IN_TRANSIT' : 'AVAILABLE'}</div>
              </div>

              <div className="p-4 rounded-xl bg-graphite-50 border border-graphite-200/60">
                <div className="text-[10px] font-mono text-graphite-500 uppercase">Certified Driver</div>
                <div className="text-lg font-bold text-navy-900 mt-1">Marcus Vance</div>
                <div className="text-xs text-graphite-600">License: CDL-TX-987654 (Class A)</div>
                <div className="text-[11px] font-mono text-emerald-700 font-bold mt-2">STATUS: {status === 'ACTIVE' ? 'ON_DUTY' : 'AVAILABLE'}</div>
              </div>
            </div>
          </div>

          {/* Bound Shipments List */}
          <div className="bg-white border border-graphite-100 rounded-2xl p-6 shadow-card space-y-4">
            <h2 className="text-xs font-mono font-bold text-graphite-500 uppercase tracking-wider flex items-center gap-2">
              <Boxes className="w-4 h-4 text-fleet-orange" />
              <span>Linked Shipment Consignments</span>
            </h2>

            <div className="divide-y divide-graphite-100 border border-graphite-100 rounded-xl overflow-hidden">
              <div className="p-4 flex items-center justify-between hover:bg-graphite-50">
                <div>
                  <div className="font-mono font-bold text-navy-900 text-xs">FOS-2611-ABC123</div>
                  <div className="text-xs text-graphite-600 mt-0.5">Acme Mega Corp — Industrial Bearings (4,200 kg)</div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-100 text-sky-800">
                  {status === 'COMPLETED' ? 'DELIVERED' : 'IN_TRANSIT'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Route Card */}
        <div className="space-y-6">
          <div className="bg-white border border-graphite-100 rounded-2xl p-6 shadow-card space-y-4">
            <h3 className="text-xs font-mono font-bold text-graphite-500 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-navy-800" />
              <span>Transit Hubs</span>
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-graphite-50 rounded-xl">
                <div className="text-[10px] font-mono text-graphite-500 uppercase">Departure Terminal</div>
                <div className="text-sm font-bold text-navy-900 mt-0.5">Dallas North Hub</div>
                <div className="text-xs text-graphite-500">Departure Gate Bay 2</div>
              </div>

              <div className="p-3 bg-graphite-50 rounded-xl">
                <div className="text-[10px] font-mono text-graphite-500 uppercase">Arrival Destination</div>
                <div className="text-sm font-bold text-navy-900 mt-0.5">Austin Central Depot</div>
                <div className="text-xs text-graphite-500">Consignment Receiving Bay</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
