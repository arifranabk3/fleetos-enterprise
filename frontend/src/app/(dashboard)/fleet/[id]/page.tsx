import React from 'react';
import Link from 'next/link';
import { Truck, ArrowLeft, Calendar, FileText, Wrench, ShieldCheck, Gauge, CheckCircle2 } from 'lucide-react';

export default function VehicleDetailPage({ params }: { params: { id: string } }) {
  // Prototype display vehicle
  const vehicle = {
    id: params.id,
    plate: 'FLT-8890',
    vin: '1M8GDM9A4KP048291',
    make: 'Volvo',
    model: 'VNL 860',
    year: 2024,
    type: 'Heavy Semi-Truck',
    fuelType: 'Diesel Ultra-Low Sulfur',
    capacityKg: 36000,
    status: 'IN_TRANSIT',
    odometerKm: 42150,
    driver: 'Hamza Khan (CDL-IL-984210)',
    insuranceExpiry: '2027-04-15',
    inspectionExpiry: '2026-12-10',
    documents: [
      { type: 'REGISTRATION', num: 'DOT-REG-9841', expiry: '2027-01-01' },
      { type: 'INSURANCE_CERT', num: 'POL-AIG-99214', expiry: '2027-04-15' },
      { type: 'DOT_INSPECTION', num: 'INSP-DOT-4412', expiry: '2026-12-10' },
    ],
    maintenances: [
      { service: 'Full Synthetic Oil Change & Lube', date: '2026-09-15', odo: 38000, cost: '$480' },
      { service: 'Brake Pad & Air System Certification', date: '2026-06-20', odo: 28500, cost: '$1,250' },
    ],
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Breadcrumb & Nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/fleet"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-graphite-600 hover:text-navy-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Fleet Overview</span>
        </Link>
        <span className="text-xs font-mono bg-navy-100 text-navy-900 px-3 py-1 rounded-full font-bold">
          Asset ID: {vehicle.plate}
        </span>
      </div>

      {/* Hero Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-graphite-100 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900">
              {vehicle.make} {vehicle.model} ({vehicle.year})
            </h1>
            <span className="px-3 py-1 rounded-full bg-navy-100 text-navy-900 text-xs font-mono font-bold">
              ● {vehicle.status}
            </span>
          </div>
          <p className="text-xs font-mono text-graphite-600">
            VIN: <strong className="text-navy-900">{vehicle.vin}</strong> • Class: {vehicle.type}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/operations"
            className="px-4 py-2.5 rounded-xl bg-navy-sidebar text-white text-xs font-bold shadow-sm hover:bg-navy-800 transition"
          >
            Track on Live Map
          </Link>
        </div>
      </div>

      {/* Specs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-1">
          <span className="text-[11px] font-mono text-graphite-600 uppercase">Current Odometer</span>
          <p className="text-2xl font-extrabold text-navy-900 font-mono">42,150 KM</p>
          <p className="text-[10px] text-emerald-600 font-bold">Telemetry Live Stream Verified</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-1">
          <span className="text-[11px] font-mono text-graphite-600 uppercase">Assigned Driver</span>
          <p className="text-lg font-extrabold text-navy-900 truncate">Hamza Khan</p>
          <p className="text-[10px] text-graphite-600 font-mono">License: CDL-IL-984210</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-1">
          <span className="text-[11px] font-mono text-graphite-600 uppercase">DOT Inspection</span>
          <p className="text-lg font-extrabold text-navy-900 font-mono">Dec 10, 2026</p>
          <p className="text-[10px] text-emerald-600 font-bold">Valid & Compliant</p>
        </div>
      </div>

      {/* Document Compliance List */}
      <div className="p-6 rounded-3xl bg-white border border-graphite-100 shadow-card space-y-4">
        <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-fleet-orange" />
          <span>Vehicle Compliance Documents</span>
        </h2>

        <div className="divide-y divide-graphite-100 text-xs font-mono">
          {vehicle.documents.map((doc, idx) => (
            <div key={idx} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-navy-900">{doc.type}</p>
                <p className="text-[11px] text-graphite-600">Cert #: {doc.num}</p>
              </div>
              <div className="text-right">
                <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 text-[10px] font-bold">
                  Expires {doc.expiry}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Maintenance History */}
      <div className="p-6 rounded-3xl bg-white border border-graphite-100 shadow-card space-y-4">
        <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-fleet-orange" />
          <span>Recent Maintenance Records</span>
        </h2>

        <div className="space-y-3 text-xs font-mono">
          {vehicle.maintenances.map((m, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-graphite-50 border border-graphite-100 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-bold text-navy-900">{m.service}</p>
                <p className="text-graphite-600 text-[11px]">Date: {m.date} • At {m.odo} KM</p>
              </div>
              <span className="font-extrabold text-navy-950 text-sm">{m.cost}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

