'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Truck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  User,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { DEMO_VEHICLES, DEMO_DRIVERS, DEMO_SHIPMENTS } from '@/lib/demoData';

export default function DispatchBoardPage() {
  const [selectedVehicle, setSelectedVehicle] = useState(DEMO_VEHICLES[0]?.id || '');
  const [selectedDriver, setSelectedDriver] = useState(DEMO_DRIVERS[0]?.id || '');
  const [selectedShipment, setSelectedShipment] = useState(DEMO_SHIPMENTS[0]?.id || '');
  const [originHub, setOriginHub] = useState('Dallas Logistics Gateway');
  const [destinationHub, setDestinationHub] = useState('Austin Central Terminus');
  const [notice, setNotice] = useState<string | null>(null);

  const handleCreateDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(
      `Dispatch Manifest created successfully! Vehicle and driver bound to active dispatch route.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-graphite-600 uppercase flex items-center gap-1.5">
            <span>Operations & Allocation</span> • <span>Dispatch Control Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
            Dispatch Management & Manifests
          </h1>
        </div>

        <Link
          href="/shipments/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-fleet-orange hover:bg-fleet-orangeHover text-white font-semibold text-xs shadow-sm transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Shipment Order</span>
        </Link>
      </div>

      {notice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Dispatch Creator Panel */}
      <div className="bg-white border border-graphite-100 rounded-2xl p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy-900 uppercase font-mono tracking-wider flex items-center gap-2">
            <Truck className="w-4 h-4 text-fleet-orange" />
            <span>Generate Dispatch Manifest & Asset Binding</span>
          </h2>
          <span className="text-xs font-mono text-graphite-500">Atomic Conflict Prevention Active</span>
        </div>

        <form onSubmit={handleCreateDispatch} className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-graphite-700 mb-1">Select Ready Shipment</label>
            <select
              value={selectedShipment}
              onChange={(e) => setSelectedShipment(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 border border-graphite-200 rounded-xl focus:border-navy-900 focus:outline-none bg-white font-medium"
            >
              {DEMO_SHIPMENTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.tracking} — {s.customer} ({(s.weightKg / 1000).toFixed(1)} MT)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-graphite-700 mb-1">Select Available Vehicle</label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 border border-graphite-200 rounded-xl focus:border-navy-900 focus:outline-none bg-white font-medium"
            >
              {DEMO_VEHICLES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} — {v.make} {v.model} ({v.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-graphite-700 mb-1">Select Eligible Driver</label>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 border border-graphite-200 rounded-xl focus:border-navy-900 focus:outline-none bg-white font-medium"
            >
              {DEMO_DRIVERS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — Status: {d.status} (Rating: {d.rating} ★)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-graphite-700 mb-1">Origin Logistics Hub</label>
            <input
              type="text"
              value={originHub}
              onChange={(e) => setOriginHub(e.target.value)}
              className="w-full text-xs px-3.5 py-2 border border-graphite-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-graphite-700 mb-1">Destination Hub</label>
            <input
              type="text"
              value={destinationHub}
              onChange={(e) => setDestinationHub(e.target.value)}
              className="w-full text-xs px-3.5 py-2 border border-graphite-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 bg-navy-900 hover:bg-navy-800 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5 text-fleet-orange" />
              <span>Confirm & Dispatch Assets</span>
            </button>
          </div>
        </form>
      </div>

      {/* Active Dispatches Table */}
      <div className="bg-white border border-graphite-100 rounded-2xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-graphite-100 flex items-center justify-between">
          <div className="text-xs font-bold text-navy-900 font-mono uppercase">
            Active Dispatched Manifests
          </div>
          <span className="text-xs font-mono text-graphite-500">Live Operations</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-graphite-50 text-graphite-600 uppercase font-mono text-[10px] border-b border-graphite-100">
              <tr>
                <th className="py-3.5 px-4">Manifest #</th>
                <th className="py-3.5 px-4">Assigned Vehicle</th>
                <th className="py-3.5 px-4">Assigned Driver</th>
                <th className="py-3.5 px-4">Origin / Destination</th>
                <th className="py-3.5 px-4">Cargo Units</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100">
              <tr className="hover:bg-graphite-50/50 transition">
                <td className="py-4 px-4 font-mono font-extrabold text-navy-900">
                  <Link href="/dispatch/DSP-2611-MNF001" className="hover:text-fleet-orange underline decoration-dotted">
                    DSP-2611-MNF001
                  </Link>
                </td>
                <td className="py-4 px-4 font-mono font-bold text-navy-900">TX-FL-4001</td>
                <td className="py-4 px-4 font-medium text-graphite-900">Marcus Vance</td>
                <td className="py-4 px-4 text-graphite-600">Dallas Hub → Austin Hub</td>
                <td className="py-4 px-4 font-mono font-semibold text-navy-800">1 Shipment (4.2 MT)</td>
                <td className="py-4 px-4">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-sky-100 text-sky-800">
                    ACTIVE TRANSIT
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <Link
                    href="/dispatch/DSP-2611-MNF001"
                    className="inline-flex items-center gap-1 text-navy-900 hover:text-fleet-orange font-semibold text-xs"
                  >
                    <span>View Manifest</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </td>
              </tr>

              <tr className="hover:bg-graphite-50/50 transition">
                <td className="py-4 px-4 font-mono font-extrabold text-navy-900">
                  <Link href="/dispatch/DSP-2611-MNF002" className="hover:text-fleet-orange underline decoration-dotted">
                    DSP-2611-MNF002
                  </Link>
                </td>
                <td className="py-4 px-4 font-mono font-bold text-navy-900">TX-FL-4002</td>
                <td className="py-4 px-4 font-medium text-graphite-900">Sarah Jenkins</td>
                <td className="py-4 px-4 text-graphite-600">Houston Port → San Antonio</td>
                <td className="py-4 px-4 font-mono font-semibold text-navy-800">2 Shipments (6.8 MT)</td>
                <td className="py-4 px-4">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800">
                    PENDING START
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <Link
                    href="/dispatch/DSP-2611-MNF002"
                    className="inline-flex items-center gap-1 text-navy-900 hover:text-fleet-orange font-semibold text-xs"
                  >
                    <span>View Manifest</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
