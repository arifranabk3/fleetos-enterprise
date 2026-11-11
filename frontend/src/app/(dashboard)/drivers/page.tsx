'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  ShieldAlert,
  Calendar,
  Award,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

export default function DriversDashboardPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (statusFilter) query.set('status', statusFilter);
      if (search) query.set('search', search);

      const [resDrivers, resOverview] = await Promise.all([
        fetch(`/api/v1/drivers?${query.toString()}`),
        fetch('/api/v1/drivers/performance/overview'),
      ]);

      if (resDrivers.ok) {
        const dJson = await resDrivers.json();
        setDrivers(dJson.data || []);
      }
      if (resOverview.ok) {
        const oJson = await resOverview.json();
        setOverview(oJson.data || null);
      }
    } catch (e) {
      console.error('Failed to fetch driver data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const availableCount = drivers.filter((d) => d.status === 'AVAILABLE').length;
  const onDutyCount = drivers.filter((d) => d.status === 'ON_DUTY' || d.status === 'ASSIGNED').length;
  const onLeaveCount = drivers.filter((d) => d.status === 'ON_LEAVE').length;
  const suspendedCount = drivers.filter((d) => d.status === 'SUSPENDED').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-graphite-600 uppercase flex items-center gap-2">
            <span>Workforce Operations</span>
            <span>•</span>
            <span>Fleet Crew Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
            Commercial Driver Directory
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/driver-shifts"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-graphite-200 hover:bg-graphite-50 text-navy-900 font-semibold text-xs shadow-sm"
          >
            <Clock className="w-3.5 h-3.5 text-navy-600" />
            <span>Shift Schedule</span>
          </Link>
          <Link
            href="/driver-incidents"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-graphite-200 hover:bg-graphite-50 text-navy-900 font-semibold text-xs shadow-sm"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>Safety Incidents</span>
          </Link>
          <Link
            href="/drivers/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-fleet-orange hover:bg-fleet-orangeHover text-white font-semibold text-xs shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Driver</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl bg-white border border-graphite-100 shadow-sm">
          <p className="text-[11px] font-mono uppercase text-graphite-500">Total Drivers</p>
          <p className="text-2xl font-extrabold text-navy-900 mt-1">{drivers.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 shadow-sm">
          <p className="text-[11px] font-mono uppercase text-emerald-700">Available</p>
          <p className="text-2xl font-extrabold text-emerald-800 mt-1">{availableCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 shadow-sm">
          <p className="text-[11px] font-mono uppercase text-blue-700">On Duty / Assigned</p>
          <p className="text-2xl font-extrabold text-blue-800 mt-1">{onDutyCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100 shadow-sm">
          <p className="text-[11px] font-mono uppercase text-amber-700">On Leave</p>
          <p className="text-2xl font-extrabold text-amber-800 mt-1">{onLeaveCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 shadow-sm">
          <p className="text-[11px] font-mono uppercase text-rose-700">Suspended</p>
          <p className="text-2xl font-extrabold text-rose-800 mt-1">{suspendedCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 shadow-sm">
          <p className="text-[11px] font-mono uppercase text-indigo-700">Avg Performance</p>
          <p className="text-2xl font-extrabold text-indigo-900 mt-1">
            {overview?.averageCompositeScore ? `${overview.averageCompositeScore}%` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-graphite-100 shadow-card">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-graphite-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, license, phone or employee ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-graphite-200 focus:outline-none focus:ring-2 focus:ring-navy-900/10 text-navy-900"
          />
        </form>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-graphite-200 bg-white font-medium text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/10"
          >
            <option value="">All Driver Statuses</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="ON_DUTY">ON_DUTY</option>
            <option value="ON_LEAVE">ON_LEAVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>
      </div>

      {/* Drivers Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-graphite-500 bg-white rounded-2xl border border-graphite-100">
          Loading commercial driver roster...
        </div>
      ) : drivers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-graphite-100 shadow-sm space-y-3">
          <Users className="w-10 h-10 text-graphite-400 mx-auto" />
          <h3 className="text-base font-bold text-navy-900">No Drivers Found</h3>
          <p className="text-xs text-graphite-500 max-w-sm mx-auto">
            No drivers match your current filter criteria or none have been enrolled in this organization yet.
          </p>
          <Link
            href="/drivers/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-fleet-orange text-white font-semibold text-xs shadow-sm hover:bg-fleet-orangeHover"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Driver</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {drivers.map((d) => (
            <div
              key={d._id}
              className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card flex flex-col justify-between hover:border-navy-200 transition"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-900 font-extrabold flex items-center justify-center font-mono text-xs border border-navy-100">
                      {d.fullName
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-navy-900">{d.fullName}</h2>
                      <p className="text-[11px] font-mono text-graphite-500">
                        {d.employeeNumber ? `EMP: ${d.employeeNumber} • ` : ''}
                        {d.licenseClass || 'CDL-A'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      d.status === 'AVAILABLE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : d.status === 'ON_DUTY' || d.status === 'ASSIGNED'
                        ? 'bg-blue-100 text-blue-800'
                        : d.status === 'ON_LEAVE'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    ● {d.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-graphite-600 font-mono pt-3 border-t border-graphite-100">
                  <div className="flex justify-between">
                    <span>License No:</span>
                    <span className="text-navy-900 font-bold">{d.licenseNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>License Expiry:</span>
                    <span
                      className={`font-bold ${
                        new Date(d.licenseExpiry) < new Date()
                          ? 'text-rose-600'
                          : 'text-navy-900'
                      }`}
                    >
                      {new Date(d.licenseExpiry).toISOString().split('T')[0]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Assigned Vehicle:</span>
                    <span className="text-navy-900 font-bold truncate max-w-[140px]">
                      {d.assignedVehicleId?.plateNumber || 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Depot / Hub:</span>
                    <span className="text-navy-900 font-bold">{d.assignedDepot || 'HQ Depot'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-graphite-100 flex items-center justify-between text-xs font-mono">
                <span className="text-graphite-500 truncate max-w-[150px]">{d.phone}</span>
                <Link
                  href={`/drivers/${d._id}`}
                  className="inline-flex items-center gap-1 text-fleet-orange font-bold hover:underline text-xs"
                >
                  <span>Profile & Ops</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
