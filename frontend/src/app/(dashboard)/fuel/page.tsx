'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Fuel,
  Plus,
  Search,
  Filter,
  DollarSign,
  Gauge,
  AlertTriangle,
  Zap,
  TrendingDown,
  Building,
  CheckCircle2,
  FileText,
} from 'lucide-react';

interface FuelTransactionUI {
  id: string;
  reference: string;
  vehiclePlate: string;
  driverName: string;
  vendorName: string;
  fuelType: 'DIESEL' | 'PETROL' | 'ELECTRIC' | 'CNG';
  quantity: number; // L or kWh
  pricePerUnit: number;
  totalCost: number;
  odometer: number;
  efficiency: number; // km/L or km/kWh
  status: 'VERIFIED' | 'PENDING_REVIEW' | 'FLAGGED_ANOMALY';
  date: string;
}

const INITIAL_TRANSACTIONS: FuelTransactionUI[] = [
  {
    id: 'tx-001',
    reference: 'PFJ-90412',
    vehiclePlate: 'FLT-8890',
    driverName: 'Frank Reynolds',
    vendorName: 'Pilot Flying J Travel Plaza',
    fuelType: 'DIESEL',
    quantity: 380,
    pricePerUnit: 1.25,
    totalCost: 475.0,
    odometer: 101200,
    efficiency: 4.1,
    status: 'VERIFIED',
    date: '2026-11-10',
  },
  {
    id: 'tx-002',
    reference: 'LOVES-4401',
    vehiclePlate: 'FLT-4021',
    driverName: 'Marcus Vance',
    vendorName: "Love's Travel Stops #440",
    fuelType: 'DIESEL',
    quantity: 420,
    pricePerUnit: 1.28,
    totalCost: 537.6,
    odometer: 145800,
    efficiency: 3.9,
    status: 'VERIFIED',
    date: '2026-11-09',
  },
  {
    id: 'tx-003',
    reference: 'TA-EXCESS-99',
    vehiclePlate: 'FLT-1102',
    driverName: 'Dave Miller',
    vendorName: 'TA Petro Center #12',
    fuelType: 'DIESEL',
    quantity: 1400, // Excessive tank anomaly
    pricePerUnit: 1.22,
    totalCost: 1708.0,
    odometer: 89000,
    efficiency: 2.1,
    status: 'FLAGGED_ANOMALY',
    date: '2026-11-08',
  },
  {
    id: 'tx-004',
    reference: 'TSLA-SC-88',
    vehiclePlate: 'EV-SEMI-01',
    driverName: 'Sarah Connor',
    vendorName: 'Tesla Megacharger Bay 4',
    fuelType: 'ELECTRIC',
    quantity: 500, // kWh
    pricePerUnit: 0.18,
    totalCost: 90.0,
    odometer: 24500,
    efficiency: 1.55,
    status: 'VERIFIED',
    date: '2026-11-08',
  },
];

export default function FuelManagementPage() {
  const [transactions, setTransactions] = useState<FuelTransactionUI[]>(INITIAL_TRANSACTIONS);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const filtered = transactions.filter((t) => {
    const matchesSearch =
      t.reference.toLowerCase().includes(search.toLowerCase()) ||
      t.vehiclePlate.toLowerCase().includes(search.toLowerCase()) ||
      t.vendorName.toLowerCase().includes(search.toLowerCase()) ||
      t.driverName.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'ALL' || t.fuelType === filterType;
    const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalFuelSpend = transactions.reduce((acc, t) => acc + t.totalCost, 0);
  const totalVolume = transactions.reduce((acc, t) => acc + t.quantity, 0);
  const anomalyCount = transactions.filter((t) => t.status === 'FLAGGED_ANOMALY').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-graphite-200/60 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-navy-900 text-orange-500 rounded-xl shadow-sm">
              <Fuel className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
              Fuel & Consumption Analytics
            </h1>
          </div>
          <p className="text-sm text-graphite-500 mt-1">
            Real-time fuel transactions, automated km/L & km/kWh efficiency calculations, and anomaly audits.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/fuel/transactions/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Log Refuel Event
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="p-5 bg-white border border-graphite-200/80 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-graphite-500 text-sm font-medium">
            <span>Total Fuel Spend</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-navy-900 mt-2">
            ${totalFuelSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-xs text-emerald-600 font-medium">Synced to Expense ledger</span>
        </div>

        <div className="p-5 bg-white border border-graphite-200/80 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-graphite-500 text-sm font-medium">
            <span>Total Volume</span>
            <Fuel className="w-4 h-4 text-navy-600" />
          </div>
          <p className="text-2xl font-bold text-navy-900 mt-2">
            {totalVolume.toLocaleString()} <span className="text-sm font-normal text-graphite-500">L / kWh</span>
          </p>
          <span className="text-xs text-graphite-500">Across active fleet assets</span>
        </div>

        <div className="p-5 bg-white border border-graphite-200/80 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-graphite-500 text-sm font-medium">
            <span>Avg Fleet Efficiency</span>
            <Gauge className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-navy-900 mt-2">
            4.05 <span className="text-sm font-normal text-graphite-500">km/L</span>
          </p>
          <span className="text-xs text-emerald-600 font-medium">Commercial benchmark: 3.8</span>
        </div>

        <div className="p-5 bg-white border border-graphite-200/80 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-graphite-500 text-sm font-medium">
            <span>Pending Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-navy-900 mt-2">{anomalyCount}</p>
          <span className="text-xs text-amber-600 font-medium">Requires compliance review</span>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 border border-graphite-200/80 rounded-xl shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-graphite-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search reference, plate, driver, or station..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-graphite-200 rounded-lg text-sm text-navy-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-graphite-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-graphite-200 rounded-lg text-sm text-navy-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="ALL">All Fuel Types</option>
            <option value="DIESEL">Diesel</option>
            <option value="ELECTRIC">Electric (kWh)</option>
            <option value="PETROL">Petrol</option>
            <option value="CNG">CNG</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-graphite-200 rounded-lg text-sm text-navy-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="ALL">All Statuses</option>
            <option value="VERIFIED">Verified</option>
            <option value="FLAGGED_ANOMALY">Flagged Anomaly</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-graphite-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-graphite-600">
            <thead className="bg-graphite-50 text-xs uppercase font-semibold text-graphite-500 border-b border-graphite-200">
              <tr>
                <th className="py-3.5 px-4">Ref & Date</th>
                <th className="py-3.5 px-4">Vehicle & Driver</th>
                <th className="py-3.5 px-4">Fuel Station</th>
                <th className="py-3.5 px-4">Volume & Price</th>
                <th className="py-3.5 px-4">Total Cost</th>
                <th className="py-3.5 px-4">Efficiency</th>
                <th className="py-3.5 px-4">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-graphite-50/50 transition">
                  <td className="py-4 px-4">
                    <span className="font-bold text-navy-900 block">{t.reference}</span>
                    <span className="text-xs text-graphite-400">{t.date}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-semibold text-navy-900 block">{t.vehiclePlate}</span>
                    <span className="text-xs text-graphite-500">{t.driverName}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-navy-900 block flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-graphite-400" />
                      {t.vendorName}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-medium text-navy-900 block">
                      {t.quantity} {t.fuelType === 'ELECTRIC' ? 'kWh' : 'L'}
                    </span>
                    <span className="text-xs text-graphite-400">${t.pricePerUnit} / unit</span>
                  </td>
                  <td className="py-4 px-4 font-bold text-navy-900">
                    ${t.totalCost.toFixed(2)}
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1 font-semibold text-navy-900">
                      {t.efficiency} {t.fuelType === 'ELECTRIC' ? 'km/kWh' : 'km/L'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    {t.status === 'VERIFIED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Flagged Anomaly
                      </span>
                    )}
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
