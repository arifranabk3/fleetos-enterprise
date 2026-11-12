import React from 'react';
import dynamic from 'next/dynamic';

const OperationsMapClient = dynamic(
  () => import('@/components/maps/OperationsMapClient'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] flex items-center justify-center bg-white border border-graphite-100 rounded-2xl shadow-card">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-navy-900 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-graphite-600 uppercase tracking-wider">
            Loading Operations & Telemetry Map...
          </span>
        </div>
      </div>
    ),
  }
);

export default function OperationsPage() {
  return <OperationsMapClient />;
}
