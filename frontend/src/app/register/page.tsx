'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Truck, Lock, Mail, User, Building, ArrowRight, ShieldCheck } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-graphite-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-navy-sidebar text-white mx-auto flex items-center justify-center shadow-md">
          <Truck className="w-6 h-6 text-fleet-orange" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
          Create Carrier Account
        </h1>
        <p className="text-xs sm:text-sm text-graphite-600">
          Provision an isolated FleetOS multi-tenant enterprise organization
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-elevated rounded-3xl border border-graphite-100 sm:px-10 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-navy-900">First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Arif"
                  className="w-full px-3 py-2.5 rounded-xl border border-graphite-200 text-xs text-graphite-900 focus:outline-none focus:border-fleet-orange"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-navy-900">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Mahmood"
                  className="w-full px-3 py-2.5 rounded-xl border border-graphite-200 text-xs text-graphite-900 focus:outline-none focus:border-fleet-orange"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-navy-900">Work Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@logistics.com"
                className="w-full px-3 py-2.5 rounded-xl border border-graphite-200 text-xs text-graphite-900 focus:outline-none focus:border-fleet-orange font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-navy-900">Company / Organization Name</label>
              <input
                type="text"
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Apex Logistics LLC"
                className="w-full px-3 py-2.5 rounded-xl border border-graphite-200 text-xs text-graphite-900 focus:outline-none focus:border-fleet-orange"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-navy-900">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2.5 rounded-xl border border-graphite-200 text-xs text-graphite-900 focus:outline-none focus:border-fleet-orange font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-navy-sidebar hover:bg-navy-800 text-white font-bold text-xs transition shadow-md mt-2"
            >
              <span>Provision Organization & Register</span>
              <ArrowRight className="w-4 h-4 text-fleet-orange" />
            </button>
          </form>

          <div className="text-center text-xs text-graphite-600 pt-2 border-t border-graphite-100">
            <span>Already have an account? </span>
            <Link href="/login" className="text-fleet-orange font-bold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

