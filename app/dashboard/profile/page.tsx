'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navigation/Navbar';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { FactBank } from '@/components/profile/FactBank';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'facts' | 'profile'>('facts');

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-5xl p-6 sm:p-8">
        <div className="border-b border-slate-200 pb-5">
          <Link href="/dashboard" className="text-xs font-semibold text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
          <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Career Profile & Fact Bank</h1>
              <p className="mt-1 text-sm text-slate-500">
                Ground truth data center. Only verified facts are permitted in AI-tailored applications.
              </p>
            </div>
            <div className="flex rounded-lg border border-slate-200 bg-white p-1">
              <button
                onClick={() => setActiveTab('facts')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'facts'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Verified Fact Bank
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'profile'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Profile & Preferences
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          {activeTab === 'facts' ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <FactBank />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <ProfileForm />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
