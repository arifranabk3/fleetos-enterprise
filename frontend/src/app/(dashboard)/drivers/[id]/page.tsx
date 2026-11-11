'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Shield,
  FileText,
  Clock,
  AlertTriangle,
  Award,
  Truck,
  CheckCircle,
  AlertCircle,
  Plus,
  Calendar,
} from 'lucide-react';

export default function DriverDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchDriver();
  }, [id]);

  const fetchDriver = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/drivers/${id}`);
      if (!res.ok) throw new Error('Failed to load driver profile.');
      const json = await res.json();
      setDriver(json.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/v1/drivers/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error?.message || 'Failed to update status.');
      }
      fetchDriver();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-mono text-graphite-500 bg-white rounded-2xl border border-graphite-100">
        Loading driver operational record...
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-graphite-100 space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <p className="text-xs text-rose-600 font-mono">{error || 'Driver not found'}</p>
        <Link href="/drivers" className="text-xs text-navy-900 font-bold underline">
          Back to Roster
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/drivers"
          className="inline-flex items-center gap-2 text-xs font-mono text-graphite-600 hover:text-navy-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Driver Directory</span>
        </Link>
      </div>

      {/* Header Profile Bar */}
      <div className="p-6 rounded-2xl bg-white border border-graphite-100 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-navy-900 text-white font-extrabold flex items-center justify-center font-mono text-base shadow-sm">
            {driver.fullName
              .split(' ')
              .map((n: string) => n[0])
              .join('')}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-navy-900">{driver.fullName}</h1>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  driver.status === 'AVAILABLE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : driver.status === 'ON_DUTY' || driver.status === 'ASSIGNED'
                    ? 'bg-blue-100 text-blue-800'
                    : driver.status === 'ON_LEAVE'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                ● {driver.status}
              </span>
            </div>
            <p className="text-xs font-mono text-graphite-500 mt-0.5">
              {driver.employeeNumber ? `EMP: ${driver.employeeNumber} • ` : ''}
              {driver.licenseClass || 'CDL-A'} • {driver.email} • {driver.phone}
            </p>
          </div>
        </div>

        {/* Status Actions */}
        <div className="flex items-center gap-2">
          <select
            value={driver.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-graphite-200 bg-white font-medium text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/10"
          >
            <option value="AVAILABLE">Mark AVAILABLE</option>
            <option value="ASSIGNED" disabled>ASSIGNED (Auto)</option>
            <option value="ON_DUTY">Mark ON_DUTY</option>
            <option value="OFF_DUTY">Mark OFF_DUTY</option>
            <option value="ON_LEAVE">Mark ON_LEAVE</option>
            <option value="SUSPENDED">Mark SUSPENDED</option>
            <option value="INACTIVE">Mark INACTIVE</option>
          </select>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-graphite-200 pb-2">
        <Link
          href={`/drivers/${id}`}
          className="px-3 py-1.5 rounded-lg bg-navy-900 text-white font-semibold text-xs shadow-sm"
        >
          Profile & Overview
        </Link>
        <Link
          href={`/drivers/${id}/documents`}
          className="px-3 py-1.5 rounded-lg text-graphite-600 hover:text-navy-900 font-semibold text-xs"
        >
          Compliance Documents ({driver.documents?.length || 0})
        </Link>
        <Link
          href={`/drivers/${id}/assignments`}
          className="px-3 py-1.5 rounded-lg text-graphite-600 hover:text-navy-900 font-semibold text-xs"
        >
          Vehicle Assignments
        </Link>
        <Link
          href={`/drivers/${id}/performance`}
          className="px-3 py-1.5 rounded-lg text-graphite-600 hover:text-navy-900 font-semibold text-xs"
        >
          Performance Scorecard
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: License & Personal */}
        <div className="space-y-6 lg:col-span-2">
          {/* Active Assignment Card */}
          <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-3">
            <h2 className="text-xs font-bold text-navy-900 uppercase font-mono tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-fleet-orange" />
              <span>Current Vehicle Assignment</span>
            </h2>

            {driver.activeAssignment ? (
              <div className="flex items-center justify-between p-4 rounded-xl bg-navy-50/50 border border-navy-100">
                <div>
                  <p className="text-sm font-extrabold text-navy-900">
                    {driver.activeAssignment.vehicleId?.plateNumber}
                  </p>
                  <p className="text-xs text-graphite-600">
                    {driver.activeAssignment.vehicleId?.make} {driver.activeAssignment.vehicleId?.modelName}
                  </p>
                  <p className="text-[11px] font-mono text-graphite-500 mt-1">
                    Assigned on: {new Date(driver.activeAssignment.assignedAt).toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/drivers/${id}/assignments`}
                  className="px-3 py-1.5 rounded-xl bg-white border border-graphite-200 text-navy-900 font-semibold text-xs shadow-sm hover:bg-graphite-50"
                >
                  Manage Assignment
                </Link>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-graphite-50 border border-dashed border-graphite-200 text-center space-y-2">
                <p className="text-xs text-graphite-500">No active vehicle currently assigned to this driver.</p>
                <Link
                  href={`/drivers/${id}/assignments`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-fleet-orange text-white font-semibold text-xs shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign Vehicle</span>
                </Link>
              </div>
            )}
          </div>

          {/* Credentials Card */}
          <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-4">
            <h2 className="text-xs font-bold text-navy-900 uppercase font-mono tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-navy-600" />
              <span>Commercial License & Credentials</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 rounded-xl bg-graphite-50 border border-graphite-100">
                <p className="text-[11px] text-graphite-500">License Number</p>
                <p className="text-sm font-bold text-navy-900 mt-0.5">{driver.licenseNumber}</p>
              </div>
              <div className="p-3 rounded-xl bg-graphite-50 border border-graphite-100">
                <p className="text-[11px] text-graphite-500">License Class</p>
                <p className="text-sm font-bold text-navy-900 mt-0.5">{driver.licenseClass || 'CDL-A'}</p>
              </div>
              <div className="p-3 rounded-xl bg-graphite-50 border border-graphite-100">
                <p className="text-[11px] text-graphite-500">License Expiry</p>
                <p
                  className={`text-sm font-bold mt-0.5 ${
                    new Date(driver.licenseExpiry) < new Date() ? 'text-rose-600' : 'text-navy-900'
                  }`}
                >
                  {new Date(driver.licenseExpiry).toISOString().split('T')[0]}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-graphite-50 border border-graphite-100">
                <p className="text-[11px] text-graphite-500">Employment Status</p>
                <p className="text-sm font-bold text-navy-900 mt-0.5">{driver.employmentStatus}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Emergency & Audit */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-3">
            <h2 className="text-xs font-bold text-navy-900 uppercase font-mono tracking-wider">
              Emergency Contact
            </h2>
            <div className="text-xs space-y-1.5 font-mono">
              <p className="text-navy-900 font-bold">{driver.emergencyContact?.name || 'Dispatch Center'}</p>
              <p className="text-graphite-600">{driver.emergencyContact?.phone || 'N/A'}</p>
              <p className="text-graphite-500 text-[11px]">
                Relationship: {driver.emergencyContact?.relationship || 'Employer'}
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-3">
            <h2 className="text-xs font-bold text-navy-900 uppercase font-mono tracking-wider">
              Workforce Meta
            </h2>
            <div className="text-xs space-y-2 font-mono text-graphite-600">
              <div className="flex justify-between">
                <span>Joining Date:</span>
                <span className="text-navy-900 font-bold">
                  {driver.joiningDate ? new Date(driver.joiningDate).toISOString().split('T')[0] : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Depot Location:</span>
                <span className="text-navy-900 font-bold">{driver.assignedDepot || 'HQ'}</span>
              </div>
              <div className="flex justify-between">
                <span>Open Incidents:</span>
                <span className="text-rose-600 font-bold">{driver.openIncidentsCount || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
