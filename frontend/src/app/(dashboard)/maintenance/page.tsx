'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  DollarSign,
  Truck,
  Building,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import { DEMO_VEHICLES } from '@/lib/demoData';

interface DemoMaintenanceRecord {
  id: string;
  vehiclePlate: string;
  serviceType: string;
  title: string;
  vendor: string;
  scheduledDate: string;
  cost: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

const INITIAL_RECORDS: DemoMaintenanceRecord[] = [
  {
    id: 'mnt-001',
    vehiclePlate: 'FLT-8890',
    serviceType: 'BRAKE_SERVICE',
    title: 'Drive Axle Brake Pad & Rotor Service',
    vendor: 'Apex Heavy Fleet Services',
    scheduledDate: '2026-11-14',
    cost: 780,
    status: 'IN_PROGRESS',
    priority: 'HIGH',
  },
  {
    id: 'mnt-002',
    vehiclePlate: 'FLT-4021',
    serviceType: 'OIL_CHANGE',
    title: 'Full Synthetic Engine Lube & Filter',
    vendor: 'Speedy Fleet Lube Center',
    scheduledDate: '2026-11-18',
    cost: 340,
    status: 'SCHEDULED',
    priority: 'MEDIUM',
  },
  {
    id: 'mnt-003',
    vehiclePlate: 'FLT-9902',
    serviceType: 'ANNUAL_DOT',
    title: 'Commercial DOT Annual Inspection',
    vendor: 'Lone Star DOT Certifications',
    scheduledDate: '2026-11-05',
    cost: 450,
    status: 'OVERDUE',
    priority: 'CRITICAL',
  },
  {
    id: 'mnt-004',
    vehiclePlate: 'FLT-2204',
    serviceType: 'TIRE_ROTATION',
    title: 'Tire Retreading & Alignment',
    vendor: 'Goodyear Commercial Tire Hub',
    scheduledDate: '2026-10-28',
    cost: 1120,
    status: 'COMPLETED',
    priority: 'MEDIUM',
  },
];

export default function MaintenanceOverviewPage() {
  const [records, setRecords] = useState<DemoMaintenanceRecord[]>(INITIAL_RECORDS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredRecords = records.filter((r) => {
    const matchSearch =
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.vendor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalCost = records
    .filter((r) => r.status === 'COMPLETED' || r.status === 'IN_PROGRESS')
    .reduce((acc, curr) => acc + curr.cost, 0);

  const inProgressCount = records.filter((r) => r.status === 'IN_PROGRESS').length;
  const overdueCount = records.filter((r) => r.status === 'OVERDUE').length;
  const scheduledCount = records.filter((r) => r.status === 'SCHEDULED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-graphite-600 uppercase flex items-center gap-1.5">
            <span>Asset Reliability</span> • <span>Work Orders & Schedules</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
            Vehicle Maintenance & Service Management
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/maintenance/schedules"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-graphite-200 bg-white text-navy-900 font-semibold text-xs shadow-sm hover:bg-graphite-50"
          >
            <Clock className="w-3.5 h-3.5 text-navy-800" />
            <span>Preventive Schedules</span>
          </Link>
          <Link
            href="/compliance"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-graphite-200 bg-white text-navy-900 font-semibold text-xs shadow-sm hover:bg-graphite-50"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-navy-800" />
            <span>Compliance Vault</span>
          </Link>
          <Link
            href="/maintenance/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-fleet-orange hover:bg-fleet-orangeHover text-white font-semibold text-xs shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Service</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-graphite-100 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-graphite-500 uppercase">Active Work Orders</span>
            <Wrench className="w-4 h-4 text-navy-700" />
          </div>
          <div className="text-2xl font-extrabold text-navy-900 mt-2">{records.length}</div>
          <div className="text-[11px] text-graphite-600 mt-1">Scheduled or active in bays</div>
        </div>

        <div className="bg-white border border-graphite-100 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-graphite-500 uppercase">In Service (Locked)</span>
            <Clock className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-extrabold text-sky-600 mt-2">{inProgressCount}</div>
          <div className="text-[11px] text-graphite-600 mt-1">Assets locked in repair</div>
        </div>

        <div className="bg-white border border-graphite-100 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-graphite-500 uppercase">Overdue Critical</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-600 mt-2">{overdueCount}</div>
          <div className="text-[11px] text-graphite-600 mt-1">Requires immediate intervention</div>
        </div>

        <div className="bg-white border border-graphite-100 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-graphite-500 uppercase">30-Day Service Cost</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">
            ${totalCost.toLocaleString()}
          </div>
          <div className="text-[11px] text-graphite-600 mt-1">Parts & authorized vendor labor</div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-graphite-100 rounded-2xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-graphite-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-96">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-graphite-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by title, vehicle plate, or vendor..."
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
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="OVERDUE">Overdue</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-graphite-50 text-graphite-600 uppercase font-mono text-[10px] border-b border-graphite-100">
              <tr>
                <th className="py-3.5 px-4">Work Order</th>
                <th className="py-3.5 px-4">Vehicle Plate</th>
                <th className="py-3.5 px-4">Service Type</th>
                <th className="py-3.5 px-4">Authorized Vendor</th>
                <th className="py-3.5 px-4">Scheduled Date</th>
                <th className="py-3.5 px-4">Cost (USD)</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100">
              {filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-graphite-50/50 transition">
                  <td className="py-4 px-4 font-bold text-navy-900">
                    <Link
                      href={`/maintenance/${r.id}`}
                      className="hover:text-fleet-orange underline decoration-dotted transition"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="py-4 px-4 font-mono font-extrabold text-navy-900">{r.vehiclePlate}</td>
                  <td className="py-4 px-4 font-mono text-[11px] text-graphite-600">
                    {r.serviceType.replace('_', ' ')}
                  </td>
                  <td className="py-4 px-4 text-graphite-700 font-medium">{r.vendor}</td>
                  <td className="py-4 px-4 font-mono text-graphite-600">{r.scheduledDate}</td>
                  <td className="py-4 px-4 font-mono font-bold text-navy-900">${r.cost}</td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        r.priority === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800'
                          : r.priority === 'HIGH'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-graphite-100 text-graphite-800'
                      }`}
                    >
                      {r.priority}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                        r.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.status === 'IN_PROGRESS'
                          ? 'bg-sky-100 text-sky-800'
                          : r.status === 'OVERDUE'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <Link
                      href={`/maintenance/${r.id}`}
                      className="inline-flex items-center gap-1 text-navy-900 hover:text-fleet-orange font-semibold text-xs"
                    >
                      <span>Details</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
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
