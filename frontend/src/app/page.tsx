import React from 'react';
import Link from 'next/link';
import { Truck, ShieldCheck, Activity, MapPin, BarChart3, Users, ChevronRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="border-b border-navy-100 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-900 flex items-center justify-center text-white shadow-sm">
              <Truck className="w-5 h-5 text-fleet-orange" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-navy-950">Fleet<span className="text-fleet-orange">OS</span></span>
              <span className="ml-2 text-[10px] font-mono uppercase bg-navy-100 text-navy-800 px-2 py-0.5 rounded-full font-semibold">Enterprise SaaS</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-xs font-semibold text-graphite-700 hover:text-navy-900 px-3 py-2 transition"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold shadow-sm transition"
            >
              <span>Launch Console</span>
              <ChevronRight className="w-3.5 h-3.5 text-fleet-orange" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-16">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-navy-100 border border-navy-200 text-navy-800 text-xs font-mono font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-fleet-orange" />
            <span>Multi-Tenant Enterprise Logistics Architecture</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold text-navy-950 tracking-tight leading-[1.1]">
            Next-Generation Fleet Telemetry & Dispatch Control.
          </h1>
          <p className="text-base sm:text-lg text-graphite-600 leading-relaxed">
            Real-time vehicle tracking via Socket.IO, intelligent shipment dispatching, proof-of-delivery signatures, and automated operational expense telemetry.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-navy-100 shadow-card space-y-3">
            <div className="w-10 h-10 rounded-xl bg-navy-50 text-fleet-orange flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-navy-950">Live Vehicle Telemetry</h3>
            <p className="text-xs text-graphite-600 leading-relaxed">
              Real-time location simulation and Socket.IO channels with OpenStreetMap Leaflet integration.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-navy-100 shadow-card space-y-3">
            <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-navy-950">Tenant Data Isolation</h3>
            <p className="text-xs text-graphite-600 leading-relaxed">
              Multi-tenant architecture with strict organization-level segregation and role-based access control.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-navy-100 shadow-card space-y-3">
            <div className="w-10 h-10 rounded-xl bg-navy-50 text-fleet-orange flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-navy-950">Operational Analytics</h3>
            <p className="text-xs text-graphite-600 leading-relaxed">
              Fuel expense tracking, preventative maintenance logs, and exportable shipment metrics.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-navy-100 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-graphite-500 gap-4">
          <p>© {new Date().getFullYear()} FleetOS Enterprise. Built by Arif Mahmood.</p>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>Next.js 14 App Router</span>
            <span>•</span>
            <span>Node.js / Express</span>
            <span>•</span>
            <span>Socket.IO</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

