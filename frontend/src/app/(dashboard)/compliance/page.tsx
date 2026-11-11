'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Truck,
} from 'lucide-react';
import { DEMO_VEHICLES } from '@/lib/demoData';

interface DemoDocument {
  id: string;
  vehiclePlate: string;
  documentType: string;
  documentNumber: string;
  issuingAuthority: string;
  expiryDate: string;
  daysRemaining: number;
  status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
}

const DEMO_COMPLIANCE_DOCS: DemoDocument[] = [
  {
    id: 'doc-1',
    vehiclePlate: 'FLT-8890',
    documentType: 'REGISTRATION',
    documentNumber: 'TX-REG-98124',
    issuingAuthority: 'Texas DMV',
    expiryDate: '2027-04-15',
    daysRemaining: 520,
    status: 'VALID',
  },
  {
    id: 'doc-2',
    vehiclePlate: 'FLT-8890',
    documentType: 'INSURANCE',
    documentNumber: 'POL-COMM-449102',
    issuingAuthority: 'Progressive Commercial',
    expiryDate: '2026-11-28',
    daysRemaining: 17,
    status: 'EXPIRING_SOON',
  },
  {
    id: 'doc-3',
    vehiclePlate: 'FLT-4021',
    documentType: 'INSPECTION_CERTIFICATE',
    documentNumber: 'DOT-INSP-2025-10',
    issuingAuthority: 'Federal Motor Carrier Safety',
    expiryDate: '2026-10-31',
    daysRemaining: -11,
    status: 'EXPIRED',
  },
  {
    id: 'doc-4',
    vehiclePlate: 'FLT-9902',
    documentType: 'FITNESS_CERTIFICATE',
    documentNumber: 'FIT-CERT-8819',
    issuingAuthority: 'National Highway Transport',
    expiryDate: '2027-01-10',
    daysRemaining: 60,
    status: 'VALID',
  },
];

export default function ComplianceOverviewPage() {
  const [docs, setDocs] = useState<DemoDocument[]>(DEMO_COMPLIANCE_DOCS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredDocs = docs.filter((d) => {
    const matchSearch =
      d.documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.documentType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const validCount = docs.filter((d) => d.status === 'VALID').length;
  const expiringSoonCount = docs.filter((d) => d.status === 'EXPIRING_SOON').length;
  const expiredCount = docs.filter((d) => d.status === 'EXPIRED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-graphite-600 uppercase flex items-center gap-1.5">
            <span>Regulatory Assurance</span> • <span>Vehicle Compliance Vault</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
            Vehicle Document Compliance
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/maintenance"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-graphite-200 bg-white text-navy-900 font-semibold text-xs shadow-sm hover:bg-graphite-50"
          >
            <span>Maintenance Hub</span>
          </Link>
          <button
            onClick={() => alert('New document upload drawer initialized.')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-fleet-orange hover:bg-fleet-orangeHover text-white font-semibold text-xs shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-graphite-100 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-graphite-500 uppercase">Valid & Compliant</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">{validCount} Documents</div>
          <div className="text-[11px] text-graphite-600 mt-1">Ready for highway operations</div>
        </div>

        <div className="bg-white border border-graphite-100 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-graphite-500 uppercase">Expiring in 30 Days</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-2">{expiringSoonCount} Documents</div>
          <div className="text-[11px] text-graphite-600 mt-1">Renewal notifications dispatched</div>
        </div>

        <div className="bg-white border border-graphite-100 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-graphite-500 uppercase">Expired / Non-Compliant</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-600 mt-2">{expiredCount} Documents</div>
          <div className="text-[11px] text-graphite-600 mt-1">Grounding alert triggered</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-graphite-100 rounded-2xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-graphite-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-96">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-graphite-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search document #, plate, or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 border border-graphite-200 rounded-xl focus:outline-none focus:border-navy-900 text-graphite-900 bg-graphite-50/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-mono text-graphite-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-1.5 border border-graphite-200 rounded-lg bg-white text-navy-900 font-semibold focus:outline-none"
            >
              <option value="ALL">All Documents</option>
              <option value="VALID">Valid</option>
              <option value="EXPIRING_SOON">Expiring Soon</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-graphite-50 text-graphite-600 uppercase font-mono text-[10px] border-b border-graphite-100">
              <tr>
                <th className="py-3.5 px-4">Document Type</th>
                <th className="py-3.5 px-4">Vehicle Plate</th>
                <th className="py-3.5 px-4">Document #</th>
                <th className="py-3.5 px-4">Issuing Authority</th>
                <th className="py-3.5 px-4">Expiry Date</th>
                <th className="py-3.5 px-4">Days Left</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100">
              {filteredDocs.map((d) => (
                <tr key={d.id} className="hover:bg-graphite-50/50 transition">
                  <td className="py-4 px-4 font-bold text-navy-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-navy-700" />
                    <span>{d.documentType.replace('_', ' ')}</span>
                  </td>
                  <td className="py-4 px-4 font-mono font-extrabold text-navy-900">{d.vehiclePlate}</td>
                  <td className="py-4 px-4 font-mono text-graphite-700">{d.documentNumber}</td>
                  <td className="py-4 px-4 text-graphite-600">{d.issuingAuthority}</td>
                  <td className="py-4 px-4 font-mono text-graphite-900">{d.expiryDate}</td>
                  <td className="py-4 px-4 font-mono">
                    <span
                      className={`font-bold ${
                        d.daysRemaining < 0
                          ? 'text-rose-600'
                          : d.daysRemaining <= 30
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {d.daysRemaining < 0 ? `${Math.abs(d.daysRemaining)} days ago` : `${d.daysRemaining} days`}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                        d.status === 'VALID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : d.status === 'EXPIRING_SOON'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {d.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
