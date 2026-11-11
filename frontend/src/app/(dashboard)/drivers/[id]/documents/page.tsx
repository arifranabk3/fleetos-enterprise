'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Plus,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export default function DriverDocumentsPage() {
  const params = useParams();
  const id = params?.id as string;

  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [formData, setFormData] = useState({
    documentType: 'DRIVING_LICENSE',
    documentNumber: '',
    issueDate: '',
    expiryDate: '',
    notes: '',
  });

  useEffect(() => {
    if (id) fetchDocuments();
  }, [id]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/drivers/${id}/documents`);
      if (res.ok) {
        const json = await res.json();
        setDocuments(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/v1/drivers/${id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: formData.documentType,
          documentNumber: formData.documentNumber,
          issueDate: formData.issueDate ? new Date(formData.issueDate).toISOString() : undefined,
          expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : undefined,
          notes: formData.notes || undefined,
        }),
      });

      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error?.message || 'Failed to add document.');
      }

      setShowAddForm(false);
      setFormData({
        documentType: 'DRIVING_LICENSE',
        documentNumber: '',
        issueDate: '',
        expiryDate: '',
        notes: '',
      });
      fetchDocuments();
    } catch (e: any) {
      alert(e.message);
    }
  };

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
              Compliance & Qualification Documents
            </h1>
            <p className="text-xs text-graphite-600 mt-0.5">
              Manage driving licenses, medical fitness, safety certifications, and background checks.
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-fleet-orange hover:bg-fleet-orangeHover text-white font-semibold text-xs shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showAddForm ? 'Cancel' : 'Upload Document'}</span>
          </button>
        </div>
      </div>

      {/* Add Document Form Modal / Inline Box */}
      {showAddForm && (
        <form
          onSubmit={handleAddSubmit}
          className="p-5 rounded-2xl bg-white border border-graphite-200 shadow-card space-y-4 max-w-xl"
        >
          <h2 className="text-xs font-bold text-navy-900 uppercase font-mono tracking-wider">
            Record New Driver Document
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Document Type *</label>
              <select
                value={formData.documentType}
                onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/10 text-navy-900"
              >
                <option value="DRIVING_LICENSE">DRIVING_LICENSE</option>
                <option value="MEDICAL_FITNESS_CERTIFICATE">MEDICAL_FITNESS_CERTIFICATE (DOT/FMCSA)</option>
                <option value="TRAINING_CERTIFICATE">TRAINING_CERTIFICATE</option>
                <option value="BACKGROUND_CHECK">BACKGROUND_CHECK</option>
                <option value="IDENTITY_DOCUMENT">IDENTITY_DOCUMENT</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Document Number *</label>
              <input
                type="text"
                required
                value={formData.documentNumber}
                onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                placeholder="e.g. MED-2024-889"
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 uppercase font-mono text-navy-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Issue Date</label>
              <input
                type="date"
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 text-navy-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Expiry Date</label>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-graphite-200 text-navy-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-graphite-600 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-navy-900 text-white font-semibold text-xs shadow-sm hover:bg-navy-800"
            >
              Save Document
            </button>
          </div>
        </form>
      )}

      {/* Documents Table */}
      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-graphite-500 bg-white rounded-2xl border border-graphite-100">
          Loading driver documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-graphite-100 shadow-sm space-y-3">
          <FileText className="w-10 h-10 text-graphite-400 mx-auto" />
          <h3 className="text-base font-bold text-navy-900">No Documents Uploaded</h3>
          <p className="text-xs text-graphite-500 max-w-sm mx-auto">
            This driver currently has no verified qualifications or medical records recorded in this organization.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-graphite-100 shadow-card overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-graphite-100 bg-graphite-50/50 text-graphite-500 font-mono uppercase text-[11px]">
                <th className="py-3 px-4 font-semibold">Document Type</th>
                <th className="py-3 px-4 font-semibold">Reference Number</th>
                <th className="py-3 px-4 font-semibold">Issue Date</th>
                <th className="py-3 px-4 font-semibold">Expiry Date</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100 font-mono">
              {documents.map((d) => (
                <tr key={d._id} className="hover:bg-graphite-50/50 transition">
                  <td className="py-3.5 px-4 font-bold text-navy-900">{d.documentType}</td>
                  <td className="py-3.5 px-4 font-semibold text-navy-800">{d.documentNumber}</td>
                  <td className="py-3.5 px-4 text-graphite-600">
                    {d.issueDate ? new Date(d.issueDate).toISOString().split('T')[0] : 'N/A'}
                  </td>
                  <td className="py-3.5 px-4">
                    {d.expiryDate ? (
                      <span
                        className={
                          new Date(d.expiryDate) < new Date()
                            ? 'text-rose-600 font-bold'
                            : 'text-navy-900'
                        }
                      >
                        {new Date(d.expiryDate).toISOString().split('T')[0]}
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.expiryStatus === 'VALID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : d.expiryStatus === 'EXPIRING_SOON'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {d.expiryStatus}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.verificationStatus === 'VERIFIED'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-graphite-100 text-graphite-600'
                      }`}
                    >
                      {d.verificationStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
