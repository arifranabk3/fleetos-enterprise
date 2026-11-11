import React from 'react';
import Link from 'next/link';
import { Users, ArrowLeft, Star, Phone, Mail, Award, CheckCircle2, ShieldCheck, Truck } from 'lucide-react';

export default function DriverDetailPage({ params }: { params: { id: string } }) {
  const driver = {
    id: params.id,
    name: 'Hamza Khan',
    email: 'hamza.khan@apexlogistics.com',
    phone: '+1 (555) 234-8901',
    licenseNumber: 'CDL-IL-984210',
    licenseClass: 'Class A Commercial (CDL-A)',
    licenseExpiry: '2027-11-04',
    employmentStatus: 'FULL_TIME',
    status: 'DRIVING',
    rating: 4.95,
    assignedVehicle: 'FLT-8890 (Volvo VNL 860)',
    tripsCompleted: 142,
    joiningDate: '2023-03-15',
    emergencyContact: {
      name: 'Nadia Khan',
      phone: '+1 (555) 987-6543',
      relationship: 'Spouse',
    },
    history: [
      { tracking: 'FLT-SHP-89210', lane: 'Chicago, IL → Dallas, TX', status: 'IN_TRANSIT', date: 'Active Now' },
      { tracking: 'FLT-SHP-77192', lane: 'Indianapolis, IN → Chicago, IL', status: 'DELIVERED', date: 'Nov 02, 2026' },
      { tracking: 'FLT-SHP-66104', lane: 'Detroit, MI → Columbus, OH', status: 'DELIVERED', date: 'Oct 28, 2026' },
    ],
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Breadcrumb & Nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/drivers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-graphite-600 hover:text-navy-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Driver Roster</span>
        </Link>
        <span className="text-xs font-mono bg-navy-100 text-navy-900 px-3 py-1 rounded-full font-bold">
          Driver ID: {driver.licenseNumber}
        </span>
      </div>

      {/* Driver Card Header */}
      <div className="p-6 rounded-3xl bg-white border border-graphite-100 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-navy-sidebar text-white font-extrabold flex items-center justify-center font-mono text-lg shadow-sm">
            HK
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900">{driver.name}</h1>
              <span className="px-3 py-1 rounded-full bg-navy-100 text-navy-900 text-xs font-mono font-bold">
                ● {driver.status}
              </span>
            </div>
            <p className="text-xs font-mono text-graphite-600">{driver.email} • {driver.phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2.5 rounded-2xl border border-amber-200">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span className="text-sm font-bold text-amber-950 font-mono">{driver.rating} / 5.0</span>
          <span className="text-[11px] text-amber-800 font-mono font-medium">(142 Trips)</span>
        </div>
      </div>

      {/* Driver CDL Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs font-mono">
        <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-1">
          <span className="text-graphite-600 uppercase text-[10px]">Commercial License</span>
          <p className="text-base font-bold text-navy-900">{driver.licenseNumber}</p>
          <p className="text-[11px] text-graphite-600">{driver.licenseClass}</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-1">
          <span className="text-graphite-600 uppercase text-[10px]">License Expiry</span>
          <p className="text-base font-bold text-navy-900">{driver.licenseExpiry}</p>
          <p className="text-[11px] text-emerald-600 font-bold">Valid & CDL Certified</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-1">
          <span className="text-graphite-600 uppercase text-[10px]">Current Asset</span>
          <p className="text-base font-bold text-navy-900 truncate">{driver.assignedVehicle}</p>
          <p className="text-[11px] text-fleet-orange font-bold">Active Manifest Bound</p>
        </div>
      </div>

      {/* Driver Trip History */}
      <div className="p-6 rounded-3xl bg-white border border-graphite-100 shadow-card space-y-4">
        <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
          <Truck className="w-4 h-4 text-fleet-orange" />
          <span>Recent Dispatch Manifests</span>
        </h2>

        <div className="divide-y divide-graphite-100 text-xs font-mono">
          {driver.history.map((h, idx) => (
            <div key={idx} className="py-3.5 flex items-center justify-between">
              <div>
                <p className="font-bold text-navy-900">{h.tracking}</p>
                <p className="text-[11px] text-graphite-600">{h.lane}</p>
              </div>
              <div className="text-right space-y-0.5">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  h.status === 'IN_TRANSIT' ? 'bg-navy-100 text-navy-900' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {h.status}
                </span>
                <p className="text-[10px] text-graphite-600">{h.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

