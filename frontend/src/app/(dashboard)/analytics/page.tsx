import React from 'react';
import { BarChart3, TrendingUp, DollarSign, Wrench, Fuel, ShieldCheck, Download } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-graphite-600 uppercase">
            <span>Executive Insights</span> • <span>Cost & Fleet Metrics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
            Operational Analytics Preview
          </h1>
        </div>

        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-graphite-200 bg-white text-navy-900 font-semibold text-xs shadow-sm hover:bg-graphite-50">
          <Download className="w-3.5 h-3.5" />
          <span>Export Analytics PDF</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-2">
          <p className="text-xs font-medium text-graphite-600">On-Time Delivery Rate</p>
          <p className="text-3xl font-extrabold text-navy-900">98.4%</p>
          <p className="text-[11px] text-emerald-600 font-bold">+1.2% over Q3 target</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-2">
          <p className="text-xs font-medium text-graphite-600">Fleet Utilization Index</p>
          <p className="text-3xl font-extrabold text-navy-900">84.2%</p>
          <p className="text-[11px] text-graphite-600">3 of 4 active vehicles dispatched</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-2">
          <p className="text-xs font-medium text-graphite-600">Fuel Expenditure (MTD)</p>
          <p className="text-3xl font-extrabold text-navy-900">$18,420</p>
          <p className="text-[11px] text-emerald-600 font-bold">-4.5% vs budget allocation</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-graphite-100 shadow-card space-y-2">
          <p className="text-xs font-medium text-graphite-600">Preventative Maintenance</p>
          <p className="text-3xl font-extrabold text-navy-900">100%</p>
          <p className="text-[11px] text-graphite-600">Zero overdue DOT compliance checks</p>
        </div>
      </div>

      {/* Simulated Chart Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Chart (Span 7) */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-white border border-graphite-100 shadow-card space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-navy-900">Freight Volume vs Delivery Cadence</h2>
              <p className="text-xs text-graphite-600">Weekly tonnage dispatched across interstate lanes</p>
            </div>
            <span className="text-xs font-mono font-bold text-navy-900 bg-graphite-50 px-2.5 py-1 rounded-lg border border-graphite-200">
              Last 4 Weeks
            </span>
          </div>

          {/* Bar Chart Simulation */}
          <div className="space-y-4 pt-2">
            {[
              { lane: 'I-80 Midwest Corridor (Chicago — Dallas)', metric: '142 MT', percent: 85 },
              { lane: 'I-35 North-South (Minneapolis — Kansas City)', metric: '98 MT', percent: 62 },
              { lane: 'I-70 Mountain Gateway (St. Louis — Denver)', metric: '116 MT', percent: 74 },
              { lane: 'Regional Cross-Dock Shuttle Lines', metric: '64 MT', percent: 45 },
            ].map((lane, idx) => (
              <div key={idx} className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-graphite-900">
                  <span className="font-semibold">{lane.lane}</span>
                  <span className="font-bold text-navy-900">{lane.metric}</span>
                </div>
                <div className="w-full bg-graphite-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-navy-sidebar h-full rounded-full transition-all"
                    style={{ width: `${lane.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Chart (Span 5) */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-white border border-graphite-100 shadow-card space-y-6">
          <div>
            <h2 className="text-base font-bold text-navy-900">Operating Cost Distribution</h2>
            <p className="text-xs text-graphite-600">Breakdown of operational carrier expenses</p>
          </div>

          <div className="space-y-3.5 pt-2 text-xs font-mono">
            <div className="p-3.5 rounded-2xl bg-navy-50 border border-navy-100 flex items-center justify-between">
              <span className="text-navy-900 font-bold flex items-center gap-2">
                <Fuel className="w-4 h-4 text-fleet-orange" />
                <span>Diesel Fuel Fleet Costs</span>
              </span>
              <span className="font-extrabold text-navy-950">54%</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-graphite-50 border border-graphite-100 flex items-center justify-between">
              <span className="text-graphite-900 font-bold flex items-center gap-2">
                <Wrench className="w-4 h-4 text-graphite-600" />
                <span>Maintenance & Tires</span>
              </span>
              <span className="font-extrabold text-navy-950">26%</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-graphite-50 border border-graphite-100 flex items-center justify-between">
              <span className="text-graphite-900 font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-graphite-600" />
                <span>Cargo Insurance & DOT Fees</span>
              </span>
              <span className="font-extrabold text-navy-950">20%</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

