import React from 'react';
import Link from 'next/link';
import { Truck, Plus, Filter, Search, Eye, BatteryCharging, AlertCircle } from 'lucide-react';
import { DEMO_VEHICLES } from '@/lib/demoData';

export default function FleetOverviewPage() {
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-graphite-600 uppercase">
            <span>Asset Inventory</span> • <span>Commercial Registry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
            Fleet Vehicles
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-graphite-200 bg-white text-navy-900 font-semibold text-xs shadow-sm hover:bg-graphite-50">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter Assets</span>
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-fleet-orange hover:bg-fleet-orangeHover text-white font-semibold text-xs shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            <span>Register Vehicle</span>
          </button>
        </div>
      </div>

      {/* Vehicle Grid & Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {DEMO_VEHICLES.map((v) => (
          <div 
            key={v.id} 
            className="rounded-2xl bg-white border border-graphite-100 p-5 shadow-card hover:shadow-elevated transition space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-extrabold text-navy-900 bg-navy-50 px-2.5 py-1 rounded-lg border border-navy-100">
                  {v.plate}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  v.status === 'AVAILABLE' 
                    ? 'bg-emerald-100 text-emerald-800'
                    : v.status === 'IN_TRANSIT'
                    ? 'bg-navy-100 text-navy-900'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  ● {v.status}
                </span>
              </div>

              <div>
                <h2 className="text-base font-bold text-navy-900">{v.make} {v.model}</h2>
                <p className="text-xs text-graphite-600">{v.year} • {v.type}</p>
              </div>

              <div className="space-y-1.5 text-xs text-graphite-600 font-mono pt-2 border-t border-graphite-100">
                <div className="flex justify-between">
                  <span>VIN:</span>
                  <span className="text-navy-900 font-bold truncate max-w-[140px]">{v.vin}</span>
                </div>
                <div className="flex justify-between">
                  <span>Capacity:</span>
                  <span className="text-navy-900 font-bold">{(v.capacityKg / 1000).toFixed(1)} MT</span>
                </div>
                <div className="flex justify-between">
                  <span>Assigned Driver:</span>
                  <span className="text-navy-900 font-bold">{v.driver}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-graphite-100 flex items-center justify-between text-xs font-mono">
              <span className="text-graphite-600 flex items-center gap-1">
                <BatteryCharging className="w-3.5 h-3.5 text-fleet-orange" />
                <span>{v.batteryFuel}%</span>
              </span>
              <Link 
                href="/operations"
                className="text-fleet-orange font-bold hover:underline flex items-center gap-1 text-[11px]"
              >
                <span>Track Asset</span>
                <Eye className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

