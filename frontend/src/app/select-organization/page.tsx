'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function SelectOrganizationPage() {
  const router = useRouter();

  const organizations = [
    {
      id: 'org-apex',
      name: 'Apex Global Logistics, LLC',
      slug: 'apex-logistics',
      role: 'ORGANIZATION_OWNER',
      plan: 'ENTERPRISE',
      isCurrent: true,
    },
    {
      id: 'org-pacific',
      name: 'Pacific Freightline Corp',
      slug: 'pacific-freight',
      role: 'DISPATCHER',
      plan: 'GROWTH',
      isCurrent: false,
    },
  ];

  const handleSwitch = (orgSlug: string) => {
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-graphite-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg space-y-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-navy-sidebar text-white mx-auto flex items-center justify-center shadow-md">
          <Building className="w-6 h-6 text-fleet-orange" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
          Select Active Organization
        </h1>
        <p className="text-xs sm:text-sm text-graphite-600">
          Your global user identity is authorized across multiple carrier workspaces
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 shadow-elevated rounded-3xl border border-graphite-100 space-y-4">
          {organizations.map((org) => (
            <div
              key={org.id}
              onClick={() => handleSwitch(org.slug)}
              className="p-5 rounded-2xl border border-graphite-200 hover:border-fleet-orange hover:bg-navy-50/50 transition cursor-pointer flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-navy-900">{org.name}</h2>
                  {org.isCurrent && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      Current
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-graphite-600 flex items-center gap-2">
                  <span>Role: <strong>{org.role}</strong></span>
                  <span>•</span>
                  <span>Plan: {org.plan}</span>
                </div>
              </div>

              <div className="w-8 h-8 rounded-xl bg-navy-50 flex items-center justify-center text-navy-900 group-hover:bg-fleet-orange">
                <ArrowRight className="w-4 h-4 text-fleet-orange" />
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-graphite-100 text-center">
            <Link href="/dashboard" className="text-xs font-semibold text-graphite-600 hover:text-navy-900">
              Return to Current Console
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

