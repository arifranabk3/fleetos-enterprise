'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Truck,
  MapPin,
  Navigation,
  Radio,
  AlertCircle,
  Activity,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Gauge,
  Compass,
  Zap,
  Play,
  RotateCcw,
} from 'lucide-react';
import { DEMO_VEHICLES, DemoVehicle } from '@/lib/demoData';

// Dynamically import Leaflet map components to prevent SSR window reference crashes
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
const Circle = dynamic(
  () => import('react-leaflet').then((mod) => mod.Circle),
  { ssr: false }
);

interface TelemetryPoint {
  vehicleId: string;
  plate: string;
  lat: number;
  lng: number;
  speedKmh: number;
  headingDeg: number;
  motionStatus: 'MOVING' | 'IDLE' | 'STOPPED' | 'OFFLINE';
  source: 'SIMULATED' | 'HARDWARE_GPS';
  isSimulated: boolean;
  updatedAt: string;
}

export default function OperationsMapClient() {
  const [mounted, setMounted] = useState(false);
  const [vehicles, setVehicles] = useState<DemoVehicle[]>(DEMO_VEHICLES);
  const [selectedVehicle, setSelectedVehicle] = useState<DemoVehicle>(DEMO_VEHICLES[0]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [socketConnected, setSocketConnected] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [recentEvents, setRecentEvents] = useState<
    Array<{ id: string; time: string; text: string; type: 'LOCATION' | 'ALERT' | 'GEOFENCE' }>
  >([
    { id: 'ev-1', time: '10:45:12 AM', text: 'FLT-8890 entered Dallas Gateway Geofence', type: 'GEOFENCE' },
    { id: 'ev-2', time: '10:44:50 AM', text: 'FLT-4021 speed recorded at 68 km/h on I-35', type: 'LOCATION' },
    { id: 'ev-3', time: '10:41:20 AM', text: 'FLT-9902 speed warning (108 km/h)', type: 'ALERT' },
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Real-time telemetry tick simulation loop
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.status !== 'IN_TRANSIT') return v;
          // Smooth delta movement
          const deltaLat = (Math.random() - 0.48) * 0.003;
          const deltaLng = (Math.random() - 0.48) * 0.003;
          const newSpeed = Math.min(105, Math.max(45, Math.round(v.speedKmh ? v.speedKmh + (Math.random() * 6 - 3) : 75)));

          return {
            ...v,
            lat: Number((v.lat + deltaLat).toFixed(5)),
            lng: Number((v.lng + deltaLng).toFixed(5)),
            speedKmh: newSpeed,
          };
        })
      );
    }, 3500);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // Keep selectedVehicle in sync
  const currentSelected = vehicles.find((v) => v.id === selectedVehicle.id) || selectedVehicle;

  // Filtered vehicles list
  const filteredVehicles = vehicles.filter((v) => {
    const matchSearch =
      v.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.driver.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.make.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || v.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // KPI Calculations
  const totalVehicles = vehicles.length;
  const movingVehicles = vehicles.filter((v) => v.status === 'IN_TRANSIT').length;
  const idleVehicles = vehicles.filter((v) => v.status === 'ASSIGNED').length;
  const availableVehicles = vehicles.filter((v) => v.status === 'AVAILABLE').length;

  return (
    <div className="space-y-4">
      {/* Top Banner with Strict Simulated GPS Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-graphite-600 uppercase">
            <span>Live Telemetry Hub</span> • <span>OpenStreetMap / Leaflet Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
            Fleet Operations & Real-Time Telemetry Center
          </h1>
        </div>

        {/* Real GPS Notice & Connection Status */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-mono font-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>SIMULATED GPS STREAM</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>SOCKET CONNECTED</span>
          </div>
        </div>
      </div>

      {/* Top KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3.5 bg-white border border-graphite-100 rounded-xl shadow-card">
          <div className="text-[10px] font-mono text-graphite-500 uppercase">Active Fleet</div>
          <div className="text-xl font-extrabold text-navy-900 font-mono mt-0.5">{totalVehicles} Assets</div>
        </div>
        <div className="p-3.5 bg-white border border-graphite-100 rounded-xl shadow-card">
          <div className="text-[10px] font-mono text-graphite-500 uppercase">Rolling (Moving)</div>
          <div className="text-xl font-extrabold text-sky-600 font-mono mt-0.5">{movingVehicles}</div>
        </div>
        <div className="p-3.5 bg-white border border-graphite-100 rounded-xl shadow-card">
          <div className="text-[10px] font-mono text-graphite-500 uppercase">Assigned / Idle</div>
          <div className="text-xl font-extrabold text-amber-600 font-mono mt-0.5">{idleVehicles}</div>
        </div>
        <div className="p-3.5 bg-white border border-graphite-100 rounded-xl shadow-card">
          <div className="text-[10px] font-mono text-graphite-500 uppercase">Available</div>
          <div className="text-xl font-extrabold text-emerald-600 font-mono mt-0.5">{availableVehicles}</div>
        </div>
        <div className="p-3.5 bg-white border border-graphite-100 rounded-xl shadow-card">
          <div className="text-[10px] font-mono text-graphite-500 uppercase">Critical Alerts</div>
          <div className="text-xl font-extrabold text-navy-900 font-mono mt-0.5">0 Active</div>
        </div>
      </div>

      {/* Main 3-Column Interactive Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Vehicle Selector List (3 cols) */}
        <div className="lg:col-span-3 bg-white border border-graphite-100 rounded-2xl shadow-card flex flex-col h-[580px] overflow-hidden">
          <div className="p-3 border-b border-graphite-100 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-graphite-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search plate, driver..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-graphite-50 border border-graphite-200 rounded-lg focus:outline-none focus:border-navy-900 text-graphite-900"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-mono">
              {['ALL', 'IN_TRANSIT', 'AVAILABLE', 'MAINTENANCE'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    filterStatus === st
                      ? 'bg-navy-900 text-white'
                      : 'bg-graphite-100 text-graphite-600 hover:bg-graphite-200'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-graphite-100">
            {filteredVehicles.map((v) => {
              const isSelected = v.id === currentSelected.id;
              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVehicle(v)}
                  className={`p-3 cursor-pointer transition ${
                    isSelected ? 'bg-navy-50/70 border-l-4 border-navy-900' : 'hover:bg-graphite-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-navy-900">{v.plate}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                        v.status === 'IN_TRANSIT'
                          ? 'bg-sky-100 text-sky-800'
                          : v.status === 'AVAILABLE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {v.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-[11px] text-graphite-600 mt-0.5 truncate">
                    {v.make} {v.model} • {v.driver}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-graphite-500 mt-1">
                    <span>{v.location}</span>
                    <span>{v.speedKmh || (v.status === 'IN_TRANSIT' ? 72 : 0)} km/h</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Column: Interactive Leaflet Map (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-graphite-100 rounded-2xl shadow-card overflow-hidden flex flex-col h-[580px]">
          <div className="p-3 border-b border-graphite-100 flex items-center justify-between bg-graphite-50/70">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-fleet-orange" />
              <span className="text-xs font-mono font-bold text-navy-900 uppercase">
                Geospatial Vector Engine
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-graphite-500">Live Overlays:</span>
              <span className="px-2 py-0.5 rounded bg-navy-100 text-navy-900 font-bold text-[10px]">
                Active Geofences (Dallas / Austin)
              </span>
            </div>
          </div>

          <div className="flex-1 relative w-full h-full min-h-[460px]">
            {mounted ? (
              <MapContainer
                center={[currentSelected.lat, currentSelected.lng]}
                zoom={11}
                scrollWheelZoom={true}
                className="w-full h-full z-0"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Geofence Hub Demonstration Circles */}
                <Circle
                  center={[32.7767, -96.797]}
                  radius={2500}
                  pathOptions={{ color: '#F28C45', fillColor: '#F28C45', fillOpacity: 0.12 }}
                />
                <Circle
                  center={[30.2672, -97.7431]}
                  radius={3000}
                  pathOptions={{ color: '#17263C', fillColor: '#17263C', fillOpacity: 0.12 }}
                />

                {/* Render markers for all vehicles */}
                {vehicles.map((v) => (
                  <Marker key={v.id} position={[v.lat, v.lng]}>
                    <Popup>
                      <div className="text-xs p-1 font-sans">
                        <div className="font-mono font-extrabold text-navy-900 text-sm">{v.plate}</div>
                        <div className="text-graphite-600 mt-0.5">
                          {v.make} {v.model}
                        </div>
                        <div className="text-[11px] font-medium text-navy-800 mt-1">Driver: {v.driver}</div>
                        <div className="text-[10px] font-mono text-emerald-700 font-bold mt-1">
                          Speed: {v.speedKmh || (v.status === 'IN_TRANSIT' ? 74 : 0)} km/h
                        </div>
                        <div className="text-[9px] font-mono text-amber-700 bg-amber-50 px-1 py-0.5 rounded mt-1.5 inline-block">
                          Source: Simulated GPS Stream
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-graphite-100 text-graphite-500 font-mono text-xs">
                Initializing Leaflet OpenStreetMap Engine...
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Vehicle Telemetry Telemetry Card (3 cols) */}
        <div className="lg:col-span-3 bg-white border border-graphite-100 rounded-2xl shadow-card p-4 flex flex-col justify-between h-[580px] overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-graphite-100">
              <span className="text-[11px] font-mono text-graphite-500 uppercase">Selected Asset</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-navy-100 text-navy-900">
                {currentSelected.type}
              </span>
            </div>

            <div>
              <div className="text-2xl font-extrabold text-navy-900 font-mono">{currentSelected.plate}</div>
              <div className="text-xs text-graphite-600 font-medium">
                {currentSelected.make} {currentSelected.model} ({currentSelected.year})
              </div>
            </div>

            {/* Real-time Telemetry Metrics */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-3 bg-graphite-50 rounded-xl">
                <div className="flex items-center gap-1 text-[10px] font-mono text-graphite-500">
                  <Gauge className="w-3.5 h-3.5 text-fleet-orange" />
                  <span>Velocity</span>
                </div>
                <div className="text-lg font-extrabold text-navy-900 font-mono mt-1">
                  {currentSelected.speedKmh || (currentSelected.status === 'IN_TRANSIT' ? 74 : 0)}{' '}
                  <span className="text-xs font-normal">km/h</span>
                </div>
              </div>

              <div className="p-3 bg-graphite-50 rounded-xl">
                <div className="flex items-center gap-1 text-[10px] font-mono text-graphite-500">
                  <Compass className="w-3.5 h-3.5 text-navy-800" />
                  <span>Heading</span>
                </div>
                <div className="text-lg font-extrabold text-navy-900 font-mono mt-1">
                  182° <span className="text-xs font-normal">South</span>
                </div>
              </div>
            </div>

            {/* Driver & Assignment Details */}
            <div className="p-3.5 rounded-xl border border-graphite-200/70 space-y-2">
              <div className="text-[10px] font-mono text-graphite-500 uppercase">Certified Driver</div>
              <div className="text-sm font-bold text-navy-900">{currentSelected.driver}</div>
              <div className="text-[11px] text-graphite-600">CDL Class A • Active Run</div>
            </div>

            <div className="p-3.5 rounded-xl border border-graphite-200/70 space-y-1">
              <div className="text-[10px] font-mono text-graphite-500 uppercase">Coordinates</div>
              <div className="text-xs font-mono text-navy-900">
                {currentSelected.lat}° N, {currentSelected.lng}° W
              </div>
              <div className="text-[10px] text-graphite-500">Highway Transit Corridor</div>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-mono flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Simulated GPS Data Stream</span>
            </div>
          </div>

          <div className="pt-3 border-t border-graphite-100">
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className="w-full py-2 bg-navy-900 hover:bg-navy-800 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
            >
              <Activity className="w-3.5 h-3.5 text-fleet-orange" />
              <span>{isSimulating ? 'Pause Telemetry Stream' : 'Resume Telemetry Stream'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Events Stream Bar */}
      <div className="bg-white border border-graphite-100 rounded-2xl p-4 shadow-card">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-graphite-100">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-navy-900 uppercase">
            <Radio className="w-3.5 h-3.5 text-fleet-orange animate-pulse" />
            <span>Live Telemetry & Geofence Event Feed</span>
          </div>
          <span className="text-[11px] font-mono text-graphite-500">Real-Time Ingestion Pipe</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {recentEvents.map((ev) => (
            <div key={ev.id} className="p-2.5 bg-graphite-50 rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <span
                  className={`w-2 h-2 rounded-full ${
                    ev.type === 'GEOFENCE'
                      ? 'bg-fleet-orange'
                      : ev.type === 'ALERT'
                      ? 'bg-rose-500'
                      : 'bg-sky-500'
                  }`}
                />
                <span className="text-navy-900 font-medium truncate">{ev.text}</span>
              </div>
              <span className="text-[10px] font-mono text-graphite-400 shrink-0">{ev.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
