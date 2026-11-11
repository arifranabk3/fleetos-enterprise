'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock,
  Plus,
  Play,
  Square,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Filter,
} from 'lucide-react';

export default function DriverShiftsPage() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const [formData, setFormData] = useState({
    driverId: '',
    shiftDate: new Date().toISOString().split('T')[0],
    plannedStart: '',
    plannedEnd: '',
    notes: '',
  });

  useEffect(() => {
    fetchShifts();
    fetchDrivers();
  }, []);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/driver-shifts');
      if (res.ok) {
        const j = await res.json();
        setShifts(j.data || []);
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

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/driver-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: formData.driverId,
          shiftDate: formData.shiftDate,
          plannedStart: new Date(formData.plannedStart).toISOString(),
          plannedEnd: new Date(formData.plannedEnd).toISOString(),
          notes: formData.notes || undefined,
        }),
      });

      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error?.message || 'Failed to schedule shift.');
      }

      setShowScheduleModal(false);
      setFormData({
        driverId: '',
        shiftDate: new Date().toISOString().split('T')[0],
        plannedStart: '',
        plannedEnd: '',
        notes: '',
      });
      fetchShifts();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleStartShift = async (shiftId: string) => {
    try {
      const res = await fetch(`/api/v1/driver-shifts/${shiftId}/start`, {
        method: 'POST',
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error?.message || 'Failed to start shift.');
      }
      fetchShifts();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleEndShift = async (shiftId: string) => {
    try {
      const res = await fetch(`/api/v1/driver-shifts/${shiftId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualEnd: new Date().toISOString() }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error?.message || 'Failed to end shift.');
      }
      fetchShifts();
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
            <span>Workforce Management</span>
            <span>•</span>
            <span>Driver Attendance & Shifts</span>
          </div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight mt-1">
            Driver Shift & Duty Schedule
          </h1>
        </div>

        <button
          onClick={() => setShowScheduleModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-fleet-orange hover:bg-fleet-orangeHover text-white font-semibold text-xs shadow-sm transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Schedule Driver Shift</span>
        </button>
      </div>

      {/* Modal */}
      {showScheduleModal && (
        <form
          onSubmit={handleScheduleSubmit}
          className="p-6 rounded-2xl bg-white border border-graphite-200 shadow-card max-w-xl space-y-4"
        >
          <h2 className="text-xs font-bold text-navy-900 uppercase font-mono tracking-wider">
            Schedule Operating Shift
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <label className="block text-xs font-bold text-navy-900 mb-1">Shift Date (YYYY-MM-DD) *</label>
              <input
                type="date"
                required
                value={formData.shiftDate}
                onChange={(e) => setFormData({ ...formData, shiftDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 text-navy-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Planned Start Time *</label>
              <input
                type="datetime-local"
                required
                value={formData.plannedStart}
                onChange={(e) => setFormData({ ...formData, plannedStart: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 text-navy-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Planned End Time *</label>
              <input
                type="datetime-local"
                required
                value={formData.plannedEnd}
                onChange={(e) => setFormData({ ...formData, plannedEnd: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 text-navy-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowScheduleModal(false)}
              className="px-3 py-1.5 text-xs text-graphite-600 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-navy-900 text-white font-semibold text-xs shadow-sm hover:bg-navy-800"
            >
              Schedule Shift
            </button>
          </div>
        </form>
      )}

      {/* Shifts Table */}
      <div className="bg-white rounded-2xl border border-graphite-100 shadow-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs font-mono text-graphite-500">
            Loading scheduled shifts...
          </div>
        ) : shifts.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-graphite-500 space-y-2">
            <Clock className="w-8 h-8 text-graphite-300 mx-auto" />
            <p>No driver shifts scheduled yet.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-graphite-100 bg-graphite-50/50 text-graphite-500 font-mono uppercase text-[11px]">
                <th className="py-3 px-4 font-semibold">Driver</th>
                <th className="py-3 px-4 font-semibold">Shift Date</th>
                <th className="py-3 px-4 font-semibold">Planned Time</th>
                <th className="py-3 px-4 font-semibold">Actual Time</th>
                <th className="py-3 px-4 font-semibold">Duration / OT</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100 font-mono">
              {shifts.map((s) => (
                <tr key={s._id} className="hover:bg-graphite-50/50 transition">
                  <td className="py-3.5 px-4 font-bold text-navy-900">
                    {s.driverId?.fullName || 'Driver'}
                  </td>
                  <td className="py-3.5 px-4 text-graphite-600">{s.shiftDate}</td>
                  <td className="py-3.5 px-4 text-graphite-700">
                    {new Date(s.plannedStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                    {new Date(s.plannedEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3.5 px-4 text-graphite-600">
                    {s.actualStart
                      ? `${new Date(s.actualStart).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })} - ${
                          s.actualEnd
                            ? new Date(s.actualEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Ongoing'
                        }`
                      : '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    {s.durationMinutes ? `${Math.round(s.durationMinutes / 60)}h ${s.durationMinutes % 60}m` : '—'}
                    {s.overtimeMinutes > 0 && (
                      <span className="text-[10px] text-amber-600 block">+{s.overtimeMinutes}m OT</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-800'
                          : s.status === 'SCHEDULED'
                          ? 'bg-graphite-100 text-graphite-700'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {s.status}
                    </span>
                    {s.isLateStart && (
                      <span className="text-[10px] text-amber-700 block font-semibold">Late Start</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {s.status === 'SCHEDULED' && (
                      <button
                        onClick={() => handleStartShift(s._id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100"
                      >
                        <Play className="w-3 h-3" />
                        <span>Start Duty</span>
                      </button>
                    )}
                    {s.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => handleEndShift(s._id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-bold hover:bg-rose-100"
                      >
                        <Square className="w-3 h-3" />
                        <span>End Duty</span>
                      </button>
                    )}
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
