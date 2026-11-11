'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Truck, Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight, Building } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('arif.mahmood@apexlogistics.com');
  const [password, setPassword] = useState('demo-password-2026');
  const [orgSlug, setOrgSlug] = useState('apex-logistics');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Prototype client-side transition
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-graphite-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-navy-sidebar text-white mx-auto flex items-center justify-center shadow-md">
          <Truck className="w-6 h-6 text-fleet-orange" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
            Fleet<span className="text-fleet-orange">OS</span> Console
          </h1>
          <p className="text-xs sm:text-sm text-graphite-600 mt-1">
            Sign in to your isolated enterprise logistics workspace
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-elevated rounded-3xl border border-graphite-100 sm:px-10 space-y-6">
          
          {/* Demo Account Instructions Callout */}
          <div className="p-4 rounded-2xl bg-navy-50 border border-navy-100 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-navy-900">
              <ShieldCheck className="w-4 h-4 text-fleet-orange" />
              <span>Pre-Configured Demo Credentials</span>
            </div>
            <p className="text-[11px] text-graphite-600 leading-relaxed">
              Pre-filled with Phase 01 demo credentials for <strong>Apex Global Logistics</strong>. Click &ldquo;Sign In to Console&rdquo; to test prototype routes.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Organization Identifier */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-navy-900">
                Organization Tenant Slug
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-graphite-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  required
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-graphite-200 text-xs text-graphite-900 focus:outline-none focus:ring-2 focus:ring-fleet-orange/20 focus:border-fleet-orange font-mono"
                  placeholder="e.g. apex-logistics"
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-navy-900">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-graphite-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-graphite-200 text-xs text-graphite-900 focus:outline-none focus:ring-2 focus:ring-fleet-orange/20 focus:border-fleet-orange font-mono"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            {/* Password with Visibility Control */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-navy-900">Password</label>
                <span className="text-graphite-600 hover:text-navy-900 text-[11px] cursor-pointer">
                  Forgot?
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-graphite-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-graphite-200 text-xs text-graphite-900 focus:outline-none focus:ring-2 focus:ring-fleet-orange/20 focus:border-fleet-orange font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-graphite-600 hover:text-navy-900"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-navy-sidebar hover:bg-navy-800 text-white font-bold text-xs tracking-tight transition shadow-md hover:scale-[1.01]"
              >
                <span>Sign In to Console</span>
                <ArrowRight className="w-4 h-4 text-fleet-orange" />
              </button>
            </div>

          </form>

          <div className="pt-2 text-center text-xs text-graphite-600 border-t border-graphite-100">
            <span>Customer looking for cargo? </span>
            <Link href="/operations" className="text-fleet-orange font-bold hover:underline">
              Track Public Shipment
            </Link>
          </div>

        </div>
      </div>

    </div>
  );
}

