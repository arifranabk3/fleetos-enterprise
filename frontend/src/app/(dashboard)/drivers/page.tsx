import React from 'react';
import { Users, Plus, ShieldCheck, Award, Star } from 'lucide-react';
import { DEMO_DRIVERS } from '@/lib/demoData';

export default function DriversOverviewPage() {
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-graphite-600 uppercase">
            <span>Human Capital</span> • <span>Commercial Driver Licenses</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
            CDL Driver Roster
          </h1>
        </div>

        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-fleet-orange hover:bg-fleet-orangeHover text-white font-semibold text-xs shadow-sm">
          <Plus className="w-3.5 h-3.5" />
          <span>Register New Driver</span>
        </button>
      </div>

      {/* Driver Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {DEMO_DRIVERS.map((d) => (
          <div key={d.id} className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-900 font-extrabold flex items-center justify-center font-mono text-xs border border-navy-100">
                  {d.name.split(' ').map(n => n[0]).join('')}
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  d.status === 'AVAILABLE' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : d.status === 'DRIVING'
                    ? 'bg-navy-100 text-navy-900'
                    : 'bg-graphite-100 text-graphite-600'
                }`}>
                  ● {d.status}
                </span>
              </div>

              <div>
                <h2 className="text-base font-bold text-navy-900">{d.name}</h2>
                <p className="text-xs font-mono text-graphite-600">{d.licenseNumber}</p>
              </div>

              <div className="space-y-1.5 text-xs text-graphite-600 font-mono pt-2 border-t border-graphite-100">
                <div className="flex justify-between">
                  <span>Assigned:</span>
                  <span className="text-navy-900 font-bold truncate max-w-[140px]">{d.assignedVehicle}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed Trips:</span>
                  <span className="text-navy-900 font-bold">{d.tripsCompleted}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Safety Rating:</span>
                  <span className="text-navy-900 font-bold flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>{d.rating}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-graphite-100 flex items-center justify-between text-xs font-mono">
              <span className="text-graphite-600">{d.phone}</span>
              <span className="text-fleet-orange font-bold cursor-pointer hover:underline text-[11px]">
                Profile
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

