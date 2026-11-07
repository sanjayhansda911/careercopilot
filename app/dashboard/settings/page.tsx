'use client';

import { useState } from 'react';
import { Navbar } from '@/components/navigation/Navbar';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { FactBank } from '@/components/profile/FactBank';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'facts' | 'notifications'>('profile');
  const [emailDigest, setEmailDigest] = useState(true);
  const [emailAddress, setEmailAddress] = useState('candidate@careerpilot.app');
  const [savedNotif, setSavedNotif] = useState(false);

  function handleSaveNotifPref(e: React.FormEvent) {
    e.preventDefault();
    setSavedNotif(true);
    setTimeout(() => setSavedNotif(false), 2500);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold text-slate-900">Career Settings & Preferences (Module 7)</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure your Product Management target profile, manage the verified Fact Bank, and customize daily digest alerts.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 space-x-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 text-xs font-bold transition border-b-2 ${
              activeTab === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Career Profile & Preferences
          </button>
          <button
            onClick={() => setActiveTab('facts')}
            className={`pb-3 text-xs font-bold transition border-b-2 ${
              activeTab === 'facts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Verified Fact Bank (Zero-Fabrication Anchor)
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`pb-3 text-xs font-bold transition border-b-2 ${
              activeTab === 'notifications' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Notification & Email Digest
          </button>
        </div>

        {/* Tab 1: Profile */}
        {activeTab === 'profile' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <ProfileForm />
          </div>
        )}

        {/* Tab 2: Facts */}
        {activeTab === 'facts' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <FactBank />
          </div>
        )}

        {/* Tab 3: Notifications */}
        {activeTab === 'notifications' && (
          <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Daily Digest & Alert Settings</h2>
              <p className="text-xs text-slate-500">Delivered through Resend email and in-app dashboard alerts.</p>
            </div>

            {savedNotif && (
              <div className="rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                ✓ Notification preferences saved.
              </div>
            )}

            <form onSubmit={handleSaveNotifPref} className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <p className="font-semibold text-slate-800">Daily Job Digest</p>
                  <p className="text-slate-500">Receive top qualified matches (score ≥ 65) every morning.</p>
                </div>
                <input
                  type="checkbox"
                  checked={emailDigest}
                  onChange={e => setEmailDigest(e.target.checked)}
                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Notification Email Address</label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={e => setEmailAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Save Notification Preferences
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
