'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Truck, 
  LayoutDashboard, 
  Boxes, 
  MapPin, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut, 
  Bell, 
  Search, 
  Menu, 
  X,
  ChevronRight,
  ShieldCheck,
  Receipt,
  DollarSign
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Main Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Fleet Overview', href: '/fleet', icon: Truck },
  { label: 'Shipment Overview', href: '/shipments', icon: Boxes },
  { label: 'Live Operations', href: '/operations', icon: MapPin },
  { label: 'Driver Overview', href: '/drivers', icon: Users },
  { label: 'Billing & Invoicing', href: '/billing', icon: Receipt },
  { label: 'Driver Settlements', href: '/settlements', icon: DollarSign },
  { label: 'Analytics Preview', href: '/analytics', icon: BarChart3 },
  { label: 'Settings Preview', href: '/settings', icon: Settings },
];

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-graphite-50 flex flex-col lg:flex-row">
      
      {/* =========================================================================
          DESKTOP SIDEBAR — Deep Navy Theme (#17263C)
      ========================================================================= */}
      <aside className="hidden lg:flex w-64 bg-navy-sidebar text-white flex-col justify-between flex-shrink-0 z-30 shadow-xl">
        <div className="p-6 space-y-8">
          
          {/* Logo / Monogram */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-800 border border-white/10 flex items-center justify-center text-white shadow-sm">
              <Truck className="w-5 h-5 text-fleet-orange" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-white">Fleet<span className="text-fleet-orange">OS</span></span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-fleet-orange font-semibold">SaaS</span>
              </div>
              <p className="text-[11px] font-mono text-graphite-300">Apex Global Logistics</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1 text-sm font-medium">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href === '/dashboard' && pathname === '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                    isActive
                      ? 'bg-fleet-orange text-white font-semibold shadow-md'
                      : 'text-graphite-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-graphite-300'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

        </div>

        {/* User Card & Tenant Badge */}
        <div className="p-4 m-4 rounded-2xl bg-navy-800/80 border border-white/10 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-graphite-300 font-mono text-[11px]">Tenant Status</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>ACTIVE</span>
            </span>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-white/10">
            <div className="w-9 h-9 rounded-xl bg-fleet-orange/20 border border-fleet-orange/40 text-fleet-orange font-extrabold flex items-center justify-center text-xs">
              AM
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">Arif Mahmood</p>
              <p className="text-[10px] font-mono text-graphite-300 truncate">Enterprise Admin</p>
            </div>
            <Link href="/login" aria-label="Sign out" className="text-graphite-300 hover:text-white">
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </aside>

      {/* =========================================================================
          MOBILE TOP NAVBAR
      ========================================================================= */}
      <div className="lg:hidden bg-navy-sidebar text-white p-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center">
            <Truck className="w-4 h-4 text-fleet-orange" />
          </div>
          <span className="font-extrabold tracking-tight">Fleet<span className="text-fleet-orange">OS</span></span>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-white/10 text-white"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-navy-sidebar text-white p-6 space-y-4 border-b border-white/10">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    isActive ? 'bg-fleet-orange text-white font-bold' : 'text-graphite-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* =========================================================================
          MAIN WORKSPACE LAYOUT
      ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-graphite-100 px-6 flex items-center justify-between sticky top-0 z-20">
          
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-graphite-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search shipments, vehicles, driver CDL, or locations..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-graphite-50 border border-graphite-100 text-xs text-graphite-900 focus:outline-none focus:ring-2 focus:ring-fleet-orange/20 focus:border-fleet-orange"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-navy-50 text-navy-900 border border-navy-100 text-xs font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-fleet-orange" />
              <span>Multi-Tenant Node: Apex-US-East</span>
            </div>

            <button className="p-2 rounded-xl text-graphite-600 hover:text-graphite-900 hover:bg-graphite-50 relative" aria-label="Notifications">
              <Bell className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-fleet-orange absolute top-1.5 right-1.5" />
            </button>
          </div>

        </header>

        {/* Prototype Content Canvas */}
        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </main>

      </div>

    </div>
  );
}

