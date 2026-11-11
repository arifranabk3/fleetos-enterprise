'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Building, Plus, ArrowLeft, Phone, Mail, CheckCircle2 } from 'lucide-react';

interface FuelVendorUI {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  supportedFuels: string[];
  isActive: boolean;
}

const INITIAL_VENDORS: FuelVendorUI[] = [
  {
    id: 'vn-01',
    name: 'Pilot Flying J Travel Plaza',
    contactPerson: 'Sarah Jenkins',
    phone: '+1-555-888-9999',
    email: 'commercial@pilotflyingj.com',
    supportedFuels: ['DIESEL', 'PETROL', 'CNG'],
    isActive: true,
  },
  {
    id: 'vn-02',
    name: "Love's Travel Stops & Country Stores",
    contactPerson: 'Dave Robertson',
    phone: '+1-555-777-1111',
    email: 'fleet@loves.com',
    supportedFuels: ['DIESEL', 'PETROL'],
    isActive: true,
  },
  {
    id: 'vn-03',
    name: 'Tesla Megacharger Commercial Network',
    contactPerson: 'Charging Ops',
    phone: '+1-800-666-8888',
    email: 'megacharger@tesla.com',
    supportedFuels: ['ELECTRIC'],
    isActive: true,
  },
];

export default function FuelVendorsPage() {
  const [vendors, setVendors] = useState<FuelVendorUI[]>(INITIAL_VENDORS);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <Link
        href="/fuel"
        className="inline-flex items-center gap-2 text-sm font-medium text-graphite-500 hover:text-navy-900 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Fuel Dashboard
      </Link>

      <div className="flex items-center justify-between border-b border-graphite-200/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-navy-900 text-orange-500 rounded-xl">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy-900">Approved Fuel Vendors & Stations</h1>
            <p className="text-xs text-graphite-500">Commercial fueling network directories and corporate pricing partners.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {vendors.map((v) => (
          <div key={v.id} className="p-5 bg-white border border-graphite-200/80 rounded-xl shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <h2 className="font-bold text-navy-900">{v.name}</h2>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="w-3 h-3" />
                Active
              </span>
            </div>
            <p className="text-xs text-graphite-500">Contact: {v.contactPerson}</p>

            <div className="space-y-1.5 text-xs text-graphite-600">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-graphite-400" />
                <span>{v.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-graphite-400" />
                <span>{v.email}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-graphite-100 flex flex-wrap gap-1.5">
              {v.supportedFuels.map((f) => (
                <span key={f} className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-graphite-100 text-graphite-700">
                  {f}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

