'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Boxes,
  Truck,
  CheckCircle2,
  Calendar,
  DollarSign,
  MapPin,
  Building,
  User,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Send,
  XCircle,
} from 'lucide-react';
import { DEMO_SHIPMENTS } from '@/lib/demoData';

export default function ShipmentDetailsPage({ params }: { params: { id: string } }) {
  const [currentShipment, setCurrentShipment] = useState(() => {
    return DEMO_SHIPMENTS.find((s) => s.id === params.id) || DEMO_SHIPMENTS[0];
  });
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleConfirmOrder = () => {
    setActionNotice('Shipment status updated to CONFIRMED. Ready for dispatch binding.');
    setCurrentShipment((prev) => ({ ...prev, status: 'CONFIRMED' }));
  };

  const handleCancelOrder = () => {
    setActionNotice('Shipment order CANCELLED. Fleet resources returned.');
    setCurrentShipment((prev) => ({ ...prev, status: 'CANCELLED' }));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Strip */}
      <div>
        <Link
          href="/shipments"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-graphite-600 hover:text-navy-900 transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Shipments Overview</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-graphite-500 uppercase">Tracking Code</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-navy-100 text-navy-900">
                {currentShipment.tracking}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                  currentShipment.status === 'DELIVERED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : currentShipment.status === 'IN_TRANSIT'
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {currentShipment.status.replace('_', ' ')}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
              Freight Manifest — {currentShipment.customer}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleConfirmOrder}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy-900 text-white font-semibold text-xs shadow-sm hover:bg-navy-800"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Confirm Order</span>
            </button>
            <button
              onClick={handleCancelOrder}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-semibold text-xs shadow-sm hover:bg-rose-100"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Cancel Order</span>
            </button>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-navy-50 border border-navy-200 text-navy-900 text-xs font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-fleet-orange" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Origin & Destination Route Card */}
          <div className="bg-white border border-graphite-100 rounded-2xl p-6 shadow-card space-y-4">
            <h2 className="text-xs font-mono font-bold text-graphite-500 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-fleet-orange" />
              <span>Transit Route & Geography</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-graphite-50 border border-graphite-200/60">
                <div className="text-[10px] font-mono font-bold text-graphite-500 uppercase">Origin Terminal</div>
                <div className="text-base font-extrabold text-navy-900 mt-1">{currentShipment.origin}</div>
                <div className="text-xs text-graphite-600 mt-0.5">Facility Bay #4 - North Gate</div>
                <div className="text-[11px] font-mono text-graphite-500 mt-2">Lat: 32.7767° N | Lon: 96.7970° W</div>
              </div>

              <div className="p-4 rounded-xl bg-graphite-50 border border-graphite-200/60">
                <div className="text-[10px] font-mono font-bold text-graphite-500 uppercase">Destination Terminal</div>
                <div className="text-base font-extrabold text-navy-900 mt-1">{currentShipment.destination}</div>
                <div className="text-xs text-graphite-600 mt-0.5">Central Logistics Depot</div>
                <div className="text-[11px] font-mono text-graphite-500 mt-2">Lat: 30.2672° N | Lon: 97.7431° W</div>
              </div>
            </div>
          </div>

          {/* Cargo Specifications */}
          <div className="bg-white border border-graphite-100 rounded-2xl p-6 shadow-card space-y-4">
            <h2 className="text-xs font-mono font-bold text-graphite-500 uppercase tracking-wider flex items-center gap-2">
              <Boxes className="w-4 h-4 text-fleet-orange" />
              <span>Cargo Specifications & Quoting</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-3 bg-graphite-50 rounded-xl">
                <div className="text-[10px] font-mono text-graphite-500 uppercase">Cargo Weight</div>
                <div className="text-lg font-extrabold text-navy-900 font-mono mt-1">
                  {(currentShipment.weightKg / 1000).toFixed(1)} MT
                </div>
                <div className="text-[10px] text-graphite-500">{currentShipment.weightKg.toLocaleString()} kg</div>
              </div>

              <div className="p-3 bg-graphite-50 rounded-xl">
                <div className="text-[10px] font-mono text-graphite-500 uppercase">Freight Value</div>
                <div className="text-lg font-extrabold text-navy-900 font-mono mt-1">$2,450.00</div>
                <div className="text-[10px] text-graphite-500">USD standard billing</div>
              </div>

              <div className="p-3 bg-graphite-50 rounded-xl">
                <div className="text-[10px] font-mono text-graphite-500 uppercase">Category</div>
                <div className="text-xs font-bold text-navy-900 mt-1">HEAVY EQUIPMENT</div>
                <div className="text-[10px] text-graphite-500">Non-hazardous</div>
              </div>

              <div className="p-3 bg-graphite-50 rounded-xl">
                <div className="text-[10px] font-mono text-graphite-500 uppercase">Priority</div>
                <div className="text-xs font-bold text-navy-900 mt-1">EXPRESS TIER</div>
                <div className="text-[10px] text-graphite-500">Guaranteed SLA</div>
              </div>
            </div>
          </div>

          {/* Immutable Timeline */}
          <div className="bg-white border border-graphite-100 rounded-2xl p-6 shadow-card space-y-4">
            <h2 className="text-xs font-mono font-bold text-graphite-500 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-fleet-orange" />
              <span>Immutable Chain of Custody & Milestones</span>
            </h2>

            <div className="space-y-4 pt-2 pl-2 border-l-2 border-graphite-200 ml-3">
              <div className="relative pl-6">
                <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                <div className="text-xs font-bold text-navy-900">Shipment Order Created</div>
                <div className="text-[11px] text-graphite-600">Created by Apex Dispatch Operator</div>
                <div className="text-[10px] font-mono text-graphite-400 mt-0.5">Today at 08:30 AM</div>
              </div>

              <div className="relative pl-6">
                <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-sky-500 border-2 border-white" />
                <div className="text-xs font-bold text-navy-900">Assigned to Vehicle & Driver</div>
                <div className="text-[11px] text-graphite-600">
                  Bound to {currentShipment.vehiclePlate} ({currentShipment.driver})
                </div>
                <div className="text-[10px] font-mono text-graphite-400 mt-0.5">Today at 09:15 AM</div>
              </div>

              <div className="relative pl-6">
                <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-navy-900 border-2 border-white" />
                <div className="text-xs font-bold text-navy-900">Dispatched & Rolling</div>
                <div className="text-[11px] text-graphite-600">En route via Interstate Highway corridor</div>
                <div className="text-[10px] font-mono text-graphite-400 mt-0.5">Today at 10:00 AM</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Assigned Resource & Customer */}
        <div className="space-y-6">
          {/* Assigned Asset */}
          <div className="bg-white border border-graphite-100 rounded-2xl p-6 shadow-card space-y-4">
            <h3 className="text-xs font-mono font-bold text-graphite-500 uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-navy-800" />
              <span>Assigned Fleet Asset</span>
            </h3>

            <div className="p-4 rounded-xl bg-navy-50 border border-navy-100 space-y-2">
              <div className="text-xs font-mono text-graphite-500">Plate Number</div>
              <div className="text-xl font-extrabold text-navy-900 font-mono">{currentShipment.vehiclePlate}</div>
              <div className="text-xs text-graphite-700">Freightliner Cascadia (Semi-Truck)</div>
            </div>

            <div className="p-4 rounded-xl bg-graphite-50 border border-graphite-200/60 space-y-2">
              <div className="text-xs font-mono text-graphite-500">Assigned Driver</div>
              <div className="text-base font-bold text-navy-900">{currentShipment.driver}</div>
              <div className="text-xs text-graphite-600">Class A Commercial Driver License</div>
            </div>
          </div>

          {/* Customer Summary */}
          <div className="bg-white border border-graphite-100 rounded-2xl p-6 shadow-card space-y-4">
            <h3 className="text-xs font-mono font-bold text-graphite-500 uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-navy-800" />
              <span>Consignee Account</span>
            </h3>

            <div>
              <div className="text-sm font-bold text-navy-900">{currentShipment.customer}</div>
              <div className="text-xs text-graphite-600 mt-1">Enterprise Shipper Account</div>
            </div>

            <div className="pt-2 border-t border-graphite-100 text-xs text-graphite-600 space-y-1">
              <div>Phone: +1 (555) 019-2831</div>
              <div>Billing: Net-30 Terms</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
