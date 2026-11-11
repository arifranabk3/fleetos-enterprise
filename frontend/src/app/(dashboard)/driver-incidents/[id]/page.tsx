'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldAlert,
  CheckCircle,
  AlertCircle,
  User,
  Truck,
  FileText,
  Clock,
} from 'lucide-react';

export default function IncidentDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [status, setStatus] = useState('UNDER_REVIEW');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) fetchIncident();
  }, [id]);

  const fetchIncident = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/driver-incidents/${id}`);
      if (res.ok) {
        const j = await res.json();
        setIncident(j.data);
        setStatus(j.data.status);
        if (j.data.resolutionNotes) setResolutionNotes(j.data.resolutionNotes);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionNotes || resolutionNotes.length < 5) {
      alert('Resolution notes must be at least 5 characters.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/driver-incidents/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionNotes }),
      });

      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error?.message || 'Failed to resolve incident.');
      }

      fetchIncident();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/v1/driver-incidents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status.');
      fetchIncident();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-mono text-graphite-500 bg-white rounded-2xl border border-graphite-100">
        Loading safety incident investigation...
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-graphite-100 space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <p className="text-xs text-rose-600 font-mono">Incident not found</p>
        <Link href="/driver-incidents" className="text-xs text-navy-900 font-bold underline">
          Back to Incident Register
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/driver-incidents"
          className="inline-flex items-center gap-2 text-xs font-mono text-graphite-600 hover:text-navy-900 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Incident Register</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
                {incident.incidentNumber}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  incident.severity === 'CRITICAL'
                    ? 'bg-rose-100 text-rose-800'
                    : incident.severity === 'HIGH'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {incident.severity} SEVERITY
              </span>
            </div>
            <p className="text-xs text-graphite-600 mt-1 font-mono">
              Category: {incident.category} • Reported on{' '}
              {new Date(incident.incidentDate).toISOString().split('T')[0]}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-graphite-500">Investigation State:</span>
            <select
              value={incident.status}
              onChange={(e) => handleStatusUpdate(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-graphite-200 bg-white font-medium text-navy-900"
            >
              <option value="OPEN">OPEN</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Description Card */}
          <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-3">
            <h2 className="text-xs font-bold text-navy-900 uppercase font-mono tracking-wider">
              Objective Incident Narrative
            </h2>
            <p className="text-xs text-navy-900 leading-relaxed whitespace-pre-wrap">
              {incident.description}
            </p>
          </div>

          {/* Investigation & Resolution Form */}
          <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-4">
            <h2 className="text-xs font-bold text-navy-900 uppercase font-mono tracking-wider flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Resolution & Remediation Assessment</span>
            </h2>

            {incident.status === 'RESOLVED' || incident.status === 'CLOSED' ? (
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                <p className="text-xs text-emerald-900 font-bold">Incident Marked Resolved</p>
                <p className="text-xs text-emerald-800 whitespace-pre-wrap">
                  {incident.resolutionNotes || 'No notes entered.'}
                </p>
                <p className="text-[11px] font-mono text-emerald-600 pt-2 border-t border-emerald-100">
                  Resolved at: {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : 'N/A'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleResolve} className="space-y-3">
                <textarea
                  required
                  rows={4}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Record formal findings, driver corrective action, insurance claims, or corrective coaching..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 text-navy-900"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Formally Mark Resolved'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Info Box */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-3 font-mono text-xs">
            <h3 className="font-bold text-navy-900 uppercase tracking-wider">Involved Driver</h3>
            <p className="text-navy-900 font-bold">{incident.driverId?.fullName || 'Driver'}</p>
            <p className="text-graphite-600">License: {incident.driverId?.licenseNumber}</p>
            <p className="text-graphite-600">Phone: {incident.driverId?.phone}</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-3 font-mono text-xs">
            <h3 className="font-bold text-navy-900 uppercase tracking-wider">Asset Context</h3>
            <p className="text-navy-900 font-bold">
              {incident.vehicleId?.plateNumber || 'No vehicle associated'}
            </p>
            {incident.vehicleId && (
              <p className="text-graphite-600">
                {incident.vehicleId?.make} {incident.vehicleId?.modelName}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
