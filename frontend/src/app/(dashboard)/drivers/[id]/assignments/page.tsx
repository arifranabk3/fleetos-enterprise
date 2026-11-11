'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Truck,
  Plus,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export default function DriverAssignmentsPage() {
  const params = useParams();
  const id = params?.id as string;

  const [history, setHistory] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (id) {
      fetchHistory();
      fetchAvailableVehicles();
    }
  }, [id]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/drivers/${id}/assignment-history`);
      if (res.ok) {
        const j = await res.json();
        setHistory(j.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableVehicles = async () => {
    try {
      const res = await fetch('/api/v1/vehicles?status=AVAILABLE');
      if (res.ok) {
        const j = await res.json();
        setVehicles(j.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/driver-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: id,
          vehicleId: selectedVehicleId,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error?.message || 'Failed to assign vehicle.');
      }

      setShowAssignModal(false);
      setSelectedVehicleId('');
      setNotes('');
      fetchHistory();
      fetchAvailableVehicles();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleEndAssignment = async (assignmentId: string) => {
    const endKmStr = prompt('Enter ending vehicle odometer reading (km):');
    if (endKmStr === null) return;

    try {
      const res = await fetch(`/api/v1/driver-assignments/${assignmentId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endOdometerKm: Number(endKmStr) || undefined,
        }),
      });

      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error?.message || 'Failed to end assignment.');
      }

      fetchHistory();
      fetchAvailableVehicles();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const activeAssignment = history.find((a) => a.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/drivers/${id}`}
          className="inline-flex items-center gap-2 text-xs font-mono text-graphite-600 hover:text-navy-900 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Driver Profile</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
              Vehicle Assignment Lifecycle & History
            </h1>
            <p className="text-xs text-graphite-600 mt-0.5">
              Strict conflict prevention, mutual exclusion, and verifiable odometer start/release records.
            </p>
          </div>

          {!activeAssignment && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-fleet-orange hover:bg-fleet-orangeHover text-white font-semibold text-xs shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Assign Available Vehicle</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Assignment Card */}
      {activeAssignment && (
        <div className="p-5 rounded-2xl bg-white border border-graphite-200 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              ● Active Current Assignment
            </span>
            <button
              onClick={() => handleEndAssignment(activeAssignment._id)}
              className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold text-xs hover:bg-rose-100 transition"
            >
              Release & End Assignment
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <p className="text-[11px] font-mono text-graphite-500">Vehicle</p>
              <p className="text-base font-extrabold text-navy-900 mt-0.5">
                {activeAssignment.vehicleId?.plateNumber}
              </p>
              <p className="text-xs text-graphite-600">
                {activeAssignment.vehicleId?.make} {activeAssignment.vehicleId?.modelName}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-mono text-graphite-500">Assigned Since</p>
              <p className="text-xs font-mono font-bold text-navy-900 mt-0.5">
                {new Date(activeAssignment.assignedAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-mono text-graphite-500">Starting Odometer</p>
              <p className="text-xs font-mono font-bold text-navy-900 mt-0.5">
                {activeAssignment.startOdometerKm?.toLocaleString() || 0} km
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="p-5 rounded-2xl bg-white border border-graphite-200 shadow-card max-w-lg space-y-4">
          <h2 className="text-xs font-bold text-navy-900 uppercase font-mono tracking-wider">
            Pair Driver with Vehicle
          </h2>

          <form onSubmit={handleAssign} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Select Available Vehicle *</label>
              <select
                required
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 bg-white text-navy-900 font-mono"
              >
                <option value="">-- Choose an available vehicle --</option>
                {vehicles.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.plateNumber} ({v.make} {v.modelName} - {v.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Operational Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Dedicated linehaul driver for regional dispatch"
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 text-navy-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-3 py-1.5 text-xs text-graphite-600 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-navy-900 text-white font-semibold text-xs shadow-sm hover:bg-navy-800"
              >
                Confirm Assignment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assignment History Table */}
      <div className="bg-white rounded-2xl border border-graphite-100 shadow-card overflow-hidden">
        <div className="p-4 border-b border-graphite-100">
          <h3 className="text-xs font-bold text-navy-900 uppercase font-mono tracking-wider">
            Historical Vehicle Assignments
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-graphite-500">
            Loading assignment timeline...
          </div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center text-xs text-graphite-500 font-mono">
            No assignment history found for this driver.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-graphite-100 bg-graphite-50/50 text-graphite-500 font-mono uppercase text-[11px]">
                <th className="py-3 px-4 font-semibold">Vehicle</th>
                <th className="py-3 px-4 font-semibold">Assigned At</th>
                <th className="py-3 px-4 font-semibold">Released At</th>
                <th className="py-3 px-4 font-semibold">Odometer (Start / End)</th>
                <th className="py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100 font-mono">
              {history.map((h) => (
                <tr key={h._id} className="hover:bg-graphite-50/50 transition">
                  <td className="py-3.5 px-4 font-bold text-navy-900">
                    {h.vehicleId?.plateNumber || 'Vehicle'}
                  </td>
                  <td className="py-3.5 px-4 text-graphite-600">
                    {new Date(h.assignedAt).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-graphite-600">
                    {h.releasedAt ? new Date(h.releasedAt).toLocaleString() : 'Active Ongoing'}
                  </td>
                  <td className="py-3.5 px-4 text-graphite-700">
                    {h.startOdometerKm?.toLocaleString() || 0} km →{' '}
                    {h.endOdometerKm ? `${h.endOdometerKm.toLocaleString()} km` : '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        h.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-graphite-100 text-graphite-600'
                      }`}
                    >
                      {h.status}
                    </span>
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
