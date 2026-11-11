'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { DEMO_SHIPMENTS } from '@/lib/demoData';

export default function ShipmentsOverviewPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredShipments = DEMO_SHIPMENTS.filter((s) => {
    const matchesSearch =
      s.tracking.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.destination.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCount = DEMO_SHIPMENTS.length;
  const inTransitCount = DEMO_SHIPMENTS.filter((s) => s.status === 'IN_TRANSIT').length;
  const deliveredCount = DEMO_SHIPMENTS.filter((s) => s.status === 'DELIVERED').length;
  const pendingCount = DEMO_SHIPMENTS.filter((s) => s.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-graphite-600 uppercase flex items-center gap-1.5">
            <span>Logistics Dispatch</span> • <span>Active Freight Manifests</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
            Shipment Orders & Manifests
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dispatch"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-graphite-200 bg-white text-navy-900 font-semibold text-xs shadow-sm hover:bg-graphite-50"
          >
            <Truck className="w-3.5 h-3.5 text-navy-800" />
            <span>Dispatch Board</span>
          </Link>
          <Link
            href="/shipments/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-fleet-orange hover:bg-fleet-orangeHover text-white font-semibold text-xs shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Shipment</span>
          </Link>
        </div>
      </div>

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-graphite-100 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-graphite-600 uppercase">Total Orders</span>
            <Boxes className="w-4 h-4 text-navy-700" />
          </div>
          <div className="text-2xl font-extrabold text-navy-900 mt-2">{totalCount}</div>
          <div className="text-[11px] text-graphite-600 mt-1">Active customer contracts</div>
        </div>

        <div className="bg-white border border-graphite-100 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-graphite-600 uppercase">In Transit</span>
            <Truck className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-extrabold text-sky-600 mt-2">{inTransitCount}</div>
          <div className="text-[11px] text-graphite-600 mt-1">Rolling on highway routes</div>
        </div>

        <div className="bg-white border border-graphite-100 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-graphite-600 uppercase">Ready / Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-2">{pendingCount}</div>
          <div className="text-[11px] text-graphite-600 mt-1">Awaiting dispatch binding</div>
        </div>

        <div className="bg-white border border-graphite-100 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-graphite-600 uppercase">Delivered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">{deliveredCount}</div>
          <div className="text-[11px] text-graphite-600 mt-1">Signed proof of delivery</div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-graphite-100 rounded-2xl shadow-card overflow-hidden">
        {/* Table Filters Top Strip */}
        <div className="p-4 border-b border-graphite-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-96">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-graphite-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by tracking #, customer, origin or destination..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 border border-graphite-200 rounded-xl focus:outline-none focus:border-navy-900 text-graphite-900 bg-graphite-50/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-mono text-graphite-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-1.5 border border-graphite-200 rounded-lg bg-white text-navy-900 font-semibold focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-graphite-50 text-graphite-600 uppercase font-mono text-[10px] border-b border-graphite-100">
              <tr>
                <th className="py-3.5 px-4">Tracking Code</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Origin Hub</th>
                <th className="py-3.5 px-4">Destination</th>
                <th className="py-3.5 px-4">Cargo Weight</th>
                <th className="py-3.5 px-4">Assigned Resource</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100">
              {filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-graphite-500 font-mono text-xs">
                    No shipments match your criteria.
                  </td>
                </tr>
              ) : (
                filteredShipments.map((s) => (
                  <tr key={s.id} className="hover:bg-graphite-50/50 transition">
                    <td className="py-4 px-4 font-mono font-extrabold text-navy-900">
                      <Link
                        href={`/shipments/${s.id}`}
                        className="hover:text-fleet-orange underline decoration-dotted transition"
                      >
                        {s.tracking}
                      </Link>
                    </td>
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
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                          s.status === 'DELIVERED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.status === 'IN_TRANSIT'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {s.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Link
                        href={`/shipments/${s.id}`}
                        className="inline-flex items-center gap-1 text-navy-900 hover:text-fleet-orange font-semibold text-xs"
                      >
                        <span>Details</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
