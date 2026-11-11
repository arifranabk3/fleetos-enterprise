import React from 'react';
import Link from 'next/link';
import { 
  Truck, 
  Boxes, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  ArrowUpRight, 
  MapPin, 
  Clock, 
  ShieldCheck 
} from 'lucide-react';
import { DEMO_VEHICLES, DEMO_SHIPMENTS, DEMO_DRIVERS } from '@/lib/demoData';

export default function MainDashboardPage() {
  const activeVehicles = DEMO_VEHICLES.filter(v => v.status === 'IN_TRANSIT').length;
  const availableDrivers = DEMO_DRIVERS.filter(d => d.status === 'AVAILABLE').length;
  const activeShipments = DEMO_SHIPMENTS.filter(s => s.status === 'IN_TRANSIT').length;

  return (
    <div className="space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-graphite-600 uppercase">
            <span>Enterprise Operations Console</span>
            <span>•</span>
            <span className="text-fleet-orange font-bold">Live Simulation Mode</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
            Fleet Operations Overview
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/operations"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-sidebar hover:bg-navy-800 text-white font-semibold text-xs transition shadow-sm"
          >
            <MapPin className="w-3.5 h-3.5 text-fleet-orange" />
            <span>Open Live Operations Map</span>
          </Link>
          <Link
            href="/shipments"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-fleet-orange hover:bg-fleet-orangeHover text-white font-semibold text-xs transition shadow-sm"
          >
            <Boxes className="w-3.5 h-3.5 text-white" />
            <span>Dispatch Shipment</span>
          </Link>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="p-3.5 rounded-xl bg-navy-50 border border-navy-100 flex items-center justify-between text-xs text-navy-900">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-fleet-orange animate-ping" />
          <span className="font-semibold">Prototype Demonstration Mode:</span>
          <span className="text-graphite-600">Displaying seeded carrier telemetry data for Apex Global Logistics.</span>
        </div>
        <span className="font-mono text-[11px] text-navy-800 font-bold bg-white px-2.5 py-1 rounded-lg border border-navy-100">
          Phase 01 UI Engine
        </span>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-2">
          <div className="flex items-center justify-between text-graphite-600 text-xs font-medium">
            <span>Active Fleet Vehicles</span>
            <div className="w-8 h-8 rounded-lg bg-navy-50 text-navy-900 flex items-center justify-center">
              <Truck className="w-4 h-4 text-fleet-orange" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-navy-900">{activeVehicles} / {DEMO_VEHICLES.length}</span>
            <span className="text-xs font-mono font-bold text-emerald-600">+12% vs last week</span>
          </div>
          <p className="text-[11px] text-graphite-600">2 Heavy semi-trucks actively in transit</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-2">
          <div className="flex items-center justify-between text-graphite-600 text-xs font-medium">
            <span>In-Transit Shipments</span>
            <div className="w-8 h-8 rounded-lg bg-navy-50 text-navy-900 flex items-center justify-center">
              <Boxes className="w-4 h-4 text-navy-900" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-navy-900">{activeShipments}</span>
            <span className="text-xs font-mono font-bold text-navy-900">4 Total Dispatches</span>
          </div>
          <p className="text-[11px] text-graphite-600">On-time delivery index 98.4%</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-2">
          <div className="flex items-center justify-between text-graphite-600 text-xs font-medium">
            <span>Available Drivers</span>
            <div className="w-8 h-8 rounded-lg bg-navy-50 text-navy-900 flex items-center justify-center">
              <Users className="w-4 h-4 text-fleet-orange" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-navy-900">{availableDrivers}</span>
            <span className="text-xs font-mono font-bold text-emerald-600">CDL-Certified</span>
          </div>
          <p className="text-[11px] text-graphite-600">Ready for immediate dispatch assignment</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-2">
          <div className="flex items-center justify-between text-graphite-600 text-xs font-medium">
            <span>Operational Alerts</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-600">01</span>
            <span className="text-xs font-mono text-graphite-600">Scheduled Service</span>
          </div>
          <p className="text-[11px] text-graphite-600">FLT-9042 at Omaha Maintenance Facility</p>
        </div>

      </div>

      {/* Active Shipments & Telemetry Live Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Active Shipments Table (Span 8) */}
        <div className="lg:col-span-8 bg-white border border-graphite-100 rounded-2xl p-6 shadow-card space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-navy-900">Active High-Priority Shipments</h2>
              <p className="text-xs text-graphite-600">Real-time status updates across cross-dock corridors</p>
            </div>
            <Link href="/shipments" className="text-xs font-semibold text-fleet-orange hover:underline flex items-center gap-1">
              <span>View All Shipments</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-graphite-50 text-graphite-600 uppercase font-mono text-[10px] border-y border-graphite-100">
                <tr>
                  <th className="py-3 px-3">Tracking #</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Origin / Destination</th>
                  <th className="py-3 px-3">Assigned Vehicle</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-100">
                {DEMO_SHIPMENTS.map((s) => (
                  <tr key={s.id} className="hover:bg-graphite-50/50 transition">
                    <td className="py-3.5 px-3 font-mono font-bold text-navy-900">{s.tracking}</td>
                    <td className="py-3.5 px-3 font-medium text-graphite-900">{s.customer}</td>
                    <td className="py-3.5 px-3 text-graphite-600">
                      <div>{s.origin}</div>
                      <div className="text-[10px] text-graphite-600 font-mono">→ {s.destination}</div>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-semibold text-navy-800">{s.vehiclePlate}</td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                        s.status === 'DELIVERED' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : s.status === 'IN_TRANSIT'
                          ? 'bg-navy-100 text-navy-900'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="w-24 bg-graphite-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-fleet-orange h-full rounded-full transition-all" 
                          style={{ width: `${s.progressPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-graphite-600 mt-0.5 block">{s.progressPercent}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Fleet Live Status Stream (Span 4) */}
        <div className="lg:col-span-4 bg-white border border-graphite-100 rounded-2xl p-6 shadow-card space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-navy-900">Fleet Telemetry Live Feed</h2>
            <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
              WSS Connected
            </span>
          </div>

          <div className="space-y-3.5">
            {DEMO_VEHICLES.map((v) => (
              <div key={v.id} className="p-3.5 rounded-xl border border-graphite-100 bg-graphite-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-fleet-orange animate-pulse" />
                    <span className="font-mono font-bold text-xs text-navy-900">{v.plate}</span>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    v.status === 'IN_TRANSIT' ? 'bg-navy-100 text-navy-900' : 'bg-white text-graphite-600'
                  }`}>
                    {v.status}
                  </span>
                </div>

                <div className="text-[11px] text-graphite-600 space-y-0.5">
                  <p className="font-medium text-graphite-900">{v.make} {v.model}</p>
                  <p className="flex items-center gap-1 text-[10px] font-mono text-graphite-600">
                    <MapPin className="w-3 h-3 text-fleet-orange" />
                    <span>{v.location}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-graphite-600 pt-1 border-t border-graphite-100">
                  <span>Driver: <strong className="text-navy-900">{v.driver}</strong></span>
                  <span>Fuel: <strong className="text-navy-900">{v.batteryFuel}%</strong></span>
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/operations"
            className="w-full py-2.5 rounded-xl border border-graphite-200 text-navy-900 hover:bg-graphite-50 font-semibold text-xs text-center block transition"
          >
            Launch Fullscreen Map Operations
          </Link>
        </div>

      </div>

    </div>
  );
}

