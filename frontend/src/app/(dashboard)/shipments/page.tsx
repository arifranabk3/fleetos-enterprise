import React from 'react';
import { Boxes, Plus, Filter, Search, Download, ArrowUpRight } from 'lucide-react';
import { DEMO_SHIPMENTS } from '@/lib/demoData';

export default function ShipmentsOverviewPage() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-graphite-600 uppercase">
            <span>Logistics Dispatch</span> • <span>Active Manifests</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
            Shipments & Freight Manifests
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-graphite-200 bg-white text-navy-900 font-semibold text-xs shadow-sm hover:bg-graphite-50">
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-fleet-orange hover:bg-fleet-orangeHover text-white font-semibold text-xs shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            <span>Create Shipment</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-graphite-100 rounded-2xl shadow-card overflow-hidden">

        {/* Table Filters Top Strip */}
        <div className="p-4 border-b border-graphite-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-80">
            <Search className="w-4 h-4 text-graphite-600" />
            <input
              type="text"
              placeholder="Filter by tracking # or customer..."
              className="w-full text-xs bg-transparent focus:outline-none text-graphite-900"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-graphite-600">
            <span>Showing <strong>4</strong> active freight contracts</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-graphite-50 text-graphite-600 uppercase font-mono text-[10px] border-b border-graphite-100">
              <tr>
                <th className="py-3.5 px-4">Tracking Code</th>
                <th className="py-3.5 px-4">Consignee Customer</th>
                <th className="py-3.5 px-4">Origin Hub</th>
                <th className="py-3.5 px-4">Destination</th>
                <th className="py-3.5 px-4">Cargo Weight</th>
                <th className="py-3.5 px-4">Assigned Resource</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100">
              {DEMO_SHIPMENTS.map((s) => (
                <tr key={s.id} className="hover:bg-graphite-50/50 transition">
                  <td className="py-4 px-4 font-mono font-extrabold text-navy-900">{s.tracking}</td>
                  <td className="py-4 px-4 font-medium text-graphite-900">{s.customer}</td>
                  <td className="py-4 px-4 text-graphite-600">{s.origin}</td>
                  <td className="py-4 px-4 text-graphite-600">{s.destination}</td>
                  <td className="py-4 px-4 font-mono font-semibold text-navy-800">
                    {(s.weightKg / 1000).toFixed(1)} MT
                  </td>
                  <td className="py-4 px-4 font-mono text-xs">
                    <div className="font-bold text-navy-900">{s.vehiclePlate}</div>
                    <div className="text-[10px] text-graphite-600">{s.driver}</div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${s.status === 'DELIVERED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : s.status === 'IN_TRANSIT'
                          ? 'bg-navy-100 text-navy-900'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button className="text-xs font-semibold text-fleet-orange hover:underline font-mono">
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}

