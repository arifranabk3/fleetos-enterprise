'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Plus,
  AlertTriangle,
  CheckCircle,
  FileText,
  Search,
  Filter,
} from 'lucide-react';

export default function DriverIncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    category: 'TRAFFIC_VIOLATION',
    severity: 'MEDIUM',
    incidentDate: new Date().toISOString().split('T')[0],
    driverId: '',
    vehicleId: '',
    description: '',
  });

  useEffect(() => {
    fetchIncidents();
    fetchDrivers();
    fetchVehicles();
  }, []);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/driver-incidents');
      if (res.ok) {
        const j = await res.json();
        setIncidents(j.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const res = await fetch('/api/v1/drivers');
      if (res.ok) {
        const j = await res.json();
        setDrivers(j.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVehicles = async () => {
    try {
      const res = await fetch('/api/v1/vehicles');
      if (res.ok) {
        const j = await res.json();
        setVehicles(j.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/driver-incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: formData.category,
          severity: formData.severity,
          incidentDate: new Date(formData.incidentDate).toISOString(),
          driverId: formData.driverId,
          vehicleId: formData.vehicleId || undefined,
          description: formData.description,
        }),
      });

      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error?.message || 'Failed to file incident report.');
      }

      setShowModal(false);
      setFormData({
        category: 'TRAFFIC_VIOLATION',
        severity: 'MEDIUM',
        incidentDate: new Date().toISOString().split('T')[0],
        driverId: '',
        vehicleId: '',
        description: '',
      });
      fetchIncidents();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-graphite-600 uppercase flex items-center gap-2">
            <span>Safety & Workforce Protection</span>
            <span>•</span>
            <span>Incident Investigation</span>
          </div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight mt-1">
            Safety & Traffic Incident Register
          </h1>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Report Safety Incident</span>
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-2xl bg-white border border-graphite-200 shadow-card max-w-xl space-y-4"
        >
          <h2 className="text-xs font-bold text-navy-900 uppercase font-mono tracking-wider">
            File Driver Incident Report
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Incident Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 bg-white text-navy-900 font-mono"
              >
                <option value="TRAFFIC_VIOLATION">TRAFFIC_VIOLATION</option>
                <option value="ACCIDENT">ACCIDENT</option>
                <option value="VEHICLE_DAMAGE">VEHICLE_DAMAGE</option>
                <option value="SAFETY_COMPLAINT">SAFETY_COMPLAINT</option>
                <option value="DELIVERY_INCIDENT">DELIVERY_INCIDENT</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Severity *</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 bg-white text-navy-900 font-mono"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Select Driver *</label>
              <select
                required
                value={formData.driverId}
                onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 bg-white text-navy-900 font-mono"
              >
                <option value="">-- Choose Driver --</option>
                {drivers.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.fullName} ({d.licenseClass || 'CDL-A'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Related Vehicle (Optional)</label>
              <select
                value={formData.vehicleId}
                onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 bg-white text-navy-900 font-mono"
              >
                <option value="">-- None / Unknown --</option>
                {vehicles.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.plateNumber} ({v.make} {v.modelName})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-navy-900 mb-1">Incident Date *</label>
              <input
                type="date"
                required
                value={formData.incidentDate}
                onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 text-navy-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-navy-900 mb-1">Objective Incident Description *</label>
              <textarea
                required
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Factual statement of events. (Note: Reports are investigative and do not establish automatic driver fault)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 text-navy-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-3 py-1.5 text-xs text-graphite-600 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold text-xs shadow-sm hover:bg-rose-700"
            >
              File Incident Report
            </button>
          </div>
        </form>
      )}

      {/* Incidents Table */}
      <div className="bg-white rounded-2xl border border-graphite-100 shadow-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs font-mono text-graphite-500">
            Loading safety incident register...
          </div>
        ) : incidents.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-graphite-500 space-y-2">
            <ShieldAlert className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-emerald-800 font-bold">Zero Safety Incidents Reported</p>
            <p className="text-graphite-400">Clean safety and compliance record for this organization.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-graphite-100 bg-graphite-50/50 text-graphite-500 font-mono uppercase text-[11px]">
                <th className="py-3 px-4 font-semibold">Incident Ref</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Driver</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Severity</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100 font-mono">
              {incidents.map((inc) => (
                <tr key={inc._id} className="hover:bg-graphite-50/50 transition">
                  <td className="py-3.5 px-4 font-bold text-navy-900">{inc.incidentNumber}</td>
                  <td className="py-3.5 px-4 text-navy-800 font-semibold">{inc.category}</td>
                  <td className="py-3.5 px-4 text-navy-900 font-bold">
                    {inc.driverId?.fullName || 'Driver'}
                  </td>
                  <td className="py-3.5 px-4 text-graphite-600">
                    {new Date(inc.incidentDate).toISOString().split('T')[0]}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inc.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800'
                          : inc.severity === 'HIGH'
                          ? 'bg-orange-100 text-orange-800'
                          : inc.severity === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-graphite-100 text-graphite-700'
                      }`}
                    >
                      {inc.severity}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inc.status === 'RESOLVED' || inc.status === 'CLOSED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href={`/driver-incidents/${inc._id}`}
                      className="text-fleet-orange font-bold hover:underline"
                    >
                      Review & Resolve →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
