'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, UserPlus, CheckCircle, AlertCircle } from 'lucide-react';

export default function RegisterDriverPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    employeeNumber: '',
    fullName: '',
    email: '',
    phone: '',
    address: '',
    licenseNumber: '',
    licenseClass: 'CDL-A',
    licenseExpiry: '',
    licenseIssueDate: '',
    employmentStatus: 'FULL_TIME',
    assignedDepot: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRel: '',
    notes: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        employeeNumber: formData.employeeNumber || undefined,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address || undefined,
        licenseNumber: formData.licenseNumber,
        licenseClass: formData.licenseClass,
        licenseExpiry: formData.licenseExpiry ? new Date(formData.licenseExpiry).toISOString() : undefined,
        licenseIssueDate: formData.licenseIssueDate ? new Date(formData.licenseIssueDate).toISOString() : undefined,
        employmentStatus: formData.employmentStatus,
        assignedDepot: formData.assignedDepot || undefined,
        notes: formData.notes || undefined,
      };

      if (formData.emergencyContactName && formData.emergencyContactPhone) {
        payload.emergencyContact = {
          name: formData.emergencyContactName,
          phone: formData.emergencyContactPhone,
          relationship: formData.emergencyContactRel || undefined,
        };
      }

      const res = await fetch('/api/v1/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to register driver.');
      }

      router.push(`/drivers/${json.data._id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/drivers"
          className="inline-flex items-center gap-2 text-xs font-mono text-graphite-600 hover:text-navy-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Driver Roster</span>
        </Link>
      </div>

      {/* Header */}
      <div className="border-b border-graphite-100 pb-4">
        <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Register Commercial Driver</h1>
        <p className="text-xs text-graphite-600 mt-1">
          Enroll a licensed operator into your organization. Strict multi-tenant isolation and CDL tracking apply.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-6">
        {/* Personal Details */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-navy-900 uppercase font-mono tracking-wider border-b border-graphite-100 pb-2">
            1. Identity & Contact Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Full Legal Name *</label>
              <input
                type="text"
                name="fullName"
                required
                value={formData.fullName}
                onChange={handleChange}
                placeholder="e.g. Johnathan Vance"
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 focus:outline-none focus:ring-2 focus:ring-navy-900/10 text-navy-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Employee Reference Number</label>
              <input
                type="text"
                name="employeeNumber"
                value={formData.employeeNumber}
                onChange={handleChange}
                placeholder="e.g. EMP-9042"
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 focus:outline-none focus:ring-2 focus:ring-navy-900/10 text-navy-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Corporate Email Address *</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="john.vance@logistics.com"
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 focus:outline-none focus:ring-2 focus:ring-navy-900/10 text-navy-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Phone Number *</label>
              <input
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1-555-019-2831"
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 focus:outline-none focus:ring-2 focus:ring-navy-900/10 text-navy-900"
              />
            </div>
          </div>
        </div>

        {/* License Details */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-navy-900 uppercase font-mono tracking-wider border-b border-graphite-100 pb-2">
            2. Commercial Driver License (CDL)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">License Number *</label>
              <input
                type="text"
                name="licenseNumber"
                required
                value={formData.licenseNumber}
                onChange={handleChange}
                placeholder="e.g. DL-8849201"
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 focus:outline-none focus:ring-2 focus:ring-navy-900/10 text-navy-900 uppercase font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">License Classification</label>
              <select
                name="licenseClass"
                value={formData.licenseClass}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/10 text-navy-900 font-mono"
              >
                <option value="CDL-A">Class A CDL (Heavy Tractor-Trailer)</option>
                <option value="CDL-B">Class B CDL (Straight Truck, Heavy Box)</option>
                <option value="CDL-C">Class C CDL (HazMat, Passenger 16+)</option>
                <option value="NON_COMMERCIAL">Class D / Standard Driver License</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Issue Date</label>
              <input
                type="date"
                name="licenseIssueDate"
                value={formData.licenseIssueDate}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 focus:outline-none focus:ring-2 focus:ring-navy-900/10 text-navy-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">License Expiry Date *</label>
              <input
                type="date"
                name="licenseExpiry"
                required
                value={formData.licenseExpiry}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 focus:outline-none focus:ring-2 focus:ring-navy-900/10 text-navy-900"
              />
            </div>
          </div>
        </div>

        {/* Employment & Depot */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-navy-900 uppercase font-mono tracking-wider border-b border-graphite-100 pb-2">
            3. Employment & Operations
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Employment Type</label>
              <select
                name="employmentStatus"
                value={formData.employmentStatus}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/10 text-navy-900"
              >
                <option value="FULL_TIME">Full-Time Permanent</option>
                <option value="PART_TIME">Part-Time</option>
                <option value="CONTRACTOR">Owner-Operator / Independent Contractor</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Operational Depot / Base Hub</label>
              <input
                type="text"
                name="assignedDepot"
                value={formData.assignedDepot}
                onChange={handleChange}
                placeholder="e.g. Midwest Logistics Terminal #4"
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 focus:outline-none focus:ring-2 focus:ring-navy-900/10 text-navy-900"
              />
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-navy-900 uppercase font-mono tracking-wider border-b border-graphite-100 pb-2">
            4. Emergency Contact
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Contact Name</label>
              <input
                type="text"
                name="emergencyContactName"
                value={formData.emergencyContactName}
                onChange={handleChange}
                placeholder="e.g. Sarah Vance"
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 focus:outline-none focus:ring-2 focus:ring-navy-900/10 text-navy-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Contact Phone</label>
              <input
                type="tel"
                name="emergencyContactPhone"
                value={formData.emergencyContactPhone}
                onChange={handleChange}
                placeholder="+1-555-019-9944"
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 focus:outline-none focus:ring-2 focus:ring-navy-900/10 text-navy-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Relationship</label>
              <input
                type="text"
                name="emergencyContactRel"
                value={formData.emergencyContactRel}
                onChange={handleChange}
                placeholder="Spouse / Parent / Next of Kin"
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 focus:outline-none focus:ring-2 focus:ring-navy-900/10 text-navy-900"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-graphite-100">
          <Link
            href="/drivers"
            className="px-4 py-2 text-xs font-semibold text-graphite-600 hover:text-navy-900"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-fleet-orange hover:bg-fleet-orangeHover text-white font-semibold text-xs shadow-sm disabled:opacity-50 transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>{loading ? 'Registering...' : 'Register Driver'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
