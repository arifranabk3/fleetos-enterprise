'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Truck, MapPin, Navigation, Radio, AlertCircle } from 'lucide-react';
import { DEMO_VEHICLES } from '@/lib/demoData';

// Dynamically import Leaflet components to prevent SSR window reference crashes
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

export default function OperationsMapClient() {
  const [mounted, setMounted] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(DEMO_VEHICLES[0]);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Top Banner with Strict Simulated GPS Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-graphite-600 uppercase">
            <span>Live Telemetry Hub</span> • <span>OpenStreetMap / Leaflet</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
            Live Fleet Operations Center
          </h1>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-mono font-bold">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>SIMULATED GPS TELEMETRY STREAM</span>
        </div>
      </div>

      {/* Map + Dispatch Sidebar Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[650px]">
        
        {/* Interactive OpenStreetMap Container (Span 8) */}
        <div className="lg:col-span-8 rounded-3xl overflow-hidden border border-graphite-200 shadow-elevated relative bg-graphite-100 flex flex-col justify-center items-center">
          
          {mounted ? (
            <MapContainer
              center={[40.5, -93.5]}
              zoom={5}
              scrollWheelZoom={false}
              className="w-full h-full z-10"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {DEMO_VEHICLES.map((v) => (
                <Marker key={v.id} position={[v.lat, v.lng]}>
                  <Popup>
                    <div className="p-1 space-y-1 font-sans text-xs">
                      <p className="font-bold text-navy-900 font-mono">{v.plate}</p>
                      <p className="text-[11px] text-graphite-600">{v.make} {v.model}</p>
                      <p className="text-[10px] font-mono text-navy-800">Driver: {v.driver}</p>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-navy-100 text-navy-900 font-semibold block mt-1">
                        ● {v.status}
                      </span>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="flex flex-col items-center gap-2 text-graphite-600 font-mono text-xs">
              <Radio className="w-5 h-5 text-fleet-orange animate-spin" />
              <span>Bootstrapping OpenStreetMap tiles...</span>
            </div>
          )}

          {/* Map Overlay Badge */}
          <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-sm p-3 rounded-2xl border border-graphite-200 shadow-md text-xs font-mono space-y-1">
            <p className="font-bold text-navy-900 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-fleet-orange" />
              <span>Active Waypoints (4 Semi-Trucks)</span>
            </p>
            <p className="text-[10px] text-graphite-600">Zero-cost Leaflet & OpenStreetMap Layer</p>
          </div>

        </div>

        {/* Live Telemetry Panel (Span 4) */}
        <div className="lg:col-span-4 bg-white border border-graphite-100 rounded-3xl p-6 shadow-card flex flex-col justify-between overflow-y-auto space-y-4">
          
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-graphite-100">
              <h2 className="text-base font-bold text-navy-900">Active Vehicle Telemetry</h2>
              <span className="text-[10px] font-mono bg-navy-100 text-navy-900 px-2 py-0.5 rounded font-bold">
                Apex-Yard-01
              </span>
            </div>

            <div className="space-y-3">
              {DEMO_VEHICLES.map((v) => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVehicle(v)}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-1.5 ${
                    selectedVehicle.id === v.id
                      ? 'bg-navy-50 border-fleet-orange shadow-sm'
                      : 'bg-white border-graphite-100 hover:bg-graphite-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-navy-900">{v.plate}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold bg-white border border-graphite-200 text-graphite-900">
                      {v.status}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-graphite-900">{v.make} {v.model}</p>
                  <p className="text-[11px] font-mono text-graphite-600 truncate">{v.location}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-graphite-50 border border-graphite-100 space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-graphite-600">Selected Plate:</span>
              <span className="font-bold text-navy-900">{selectedVehicle.plate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-graphite-600">Speed / Telemetry:</span>
              <span className="font-bold text-navy-900">68 MPH (Simulated)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-graphite-600">Telemetry Stream:</span>
              <span className="font-bold text-emerald-600">Socket.IO Active</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

