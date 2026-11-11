import React from 'react';
import { Settings, Building, Users, Shield, Key, Bell, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      
      {/* Header */}
      <div>
        <div className="text-xs font-mono text-graphite-600 uppercase">
          <span>Enterprise Configuration</span> • <span>Tenant Governance</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
          Settings & Organization Profile
        </h1>
      </div>

      {/* Organization Details Card */}
      <div className="p-6 rounded-3xl bg-white border border-graphite-100 shadow-card space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-graphite-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-navy-50 text-navy-900 flex items-center justify-center border border-navy-100">
              <Building className="w-5 h-5 text-fleet-orange" />
            </div>
            <div>
              <h2 className="text-base font-bold text-navy-900">Apex Global Logistics, LLC</h2>
              <p className="text-xs font-mono text-graphite-600">Tenant Slug: apex-logistics • Plan: ENTERPRISE</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono font-bold">
            Verified Carrier
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 rounded-2xl bg-graphite-50 border border-graphite-100 space-y-1">
            <p className="text-graphite-600">DOT Operating Authority:</p>
            <p className="text-sm font-bold text-navy-900">US DOT # 3948210 / MC-94812</p>
          </div>
          <div className="p-4 rounded-2xl bg-graphite-50 border border-graphite-100 space-y-1">
            <p className="text-graphite-600">Telemetry Resolution Interval:</p>
            <p className="text-sm font-bold text-navy-900">5 Seconds (High-Frequency Stream)</p>
          </div>
        </div>
      </div>

      {/* Role Management Preview */}
      <div className="p-6 rounded-3xl bg-white border border-graphite-100 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-graphite-100">
          <div>
            <h2 className="text-base font-bold text-navy-900">Configured Role Permissions</h2>
            <p className="text-xs text-graphite-600">Role-based access matrix applied to all tenant users</p>
          </div>
          <span className="text-xs font-mono text-navy-900 font-bold bg-navy-50 px-2.5 py-1 rounded-lg">
            7 Active Roles
          </span>
        </div>

        <div className="space-y-2.5 text-xs font-mono">
          {[
            { role: 'ORGANIZATION_ADMIN', scope: 'Full read/write governance, billing, user lifecycle' },
            { role: 'DISPATCH_MANAGER', scope: 'Shipment assignment, driver routing, live manifest dispatch' },
            { role: 'FLEET_MANAGER', scope: 'Vehicle onboarding, maintenance scheduling, fuel logs' },
            { role: 'DRIVER', scope: 'Driver portal view, route waypoints, proof-of-delivery upload' },
          ].map((r, idx) => (
            <div key={idx} className="p-3.5 rounded-xl border border-graphite-100 bg-graphite-50 flex items-center justify-between">
              <span className="font-bold text-navy-900">{r.role}</span>
              <span className="text-graphite-600 text-[11px]">{r.scope}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

