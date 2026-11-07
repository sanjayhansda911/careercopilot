'use client';

import { useState, useEffect } from 'react';

interface ProfileData {
  target_track: string;
  total_experience_years: number | null;
  current_title: string | null;
  current_company: string | null;
  target_ctc_min_lpa: number | null;
  target_ctc_max_lpa: number | null;
  notice_period_days: number | null;
  preferred_locations: string[];
  preferred_work_modes: string[];
  target_roles: string[];
  target_domains: string[];
  skills: string[];
  profile_summary: string | null;
}

export function ProfileForm() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // New tag inputs
  const [newSkill, setNewSkill] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newDomain, setNewDomain] = useState('');

  useEffect(() => {
    fetch('/api/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) setProfile(data.profile);
      })
      .catch((err) => console.error('Failed to load profile:', err))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage('✓ Profile successfully saved.');
      } else {
        setStatusMessage(`Error: ${data.error || 'Failed to update profile.'}`);
      }
    } catch (err: unknown) {
      setStatusMessage(`Error: ${err instanceof Error ? err.message : 'Save failed'}`);
    } finally {
      setSaving(false);
    }
  }

  function addTag(field: 'skills' | 'target_roles' | 'target_domains', value: string, setter: (v: string) => void) {
    const trimmed = value.trim();
    if (trimmed && profile && !profile[field].includes(trimmed)) {
      setProfile({ ...profile, [field]: [...profile[field], trimmed] });
      setter('');
    }
  }

  function removeTag(field: 'skills' | 'target_roles' | 'target_domains', tag: string) {
    if (!profile) return;
    setProfile({ ...profile, [field]: profile[field].filter((t) => t !== tag) });
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading candidate profile...</div>;
  }

  if (!profile) {
    return <div className="p-8 text-center text-sm text-red-500">Failed to load profile data.</div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {statusMessage && (
        <div
          className={`rounded-lg p-3 text-xs font-semibold ${
            statusMessage.startsWith('✓')
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {statusMessage}
        </div>
      )}

      {/* Row 1: Current Title & Company */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase">Current Title</label>
          <input
            type="text"
            value={profile.current_title || ''}
            onChange={(e) => setProfile({ ...profile, current_title: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase">Current Company</label>
          <input
            type="text"
            value={profile.current_company || ''}
            onChange={(e) => setProfile({ ...profile, current_company: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Row 2: Experience, CTC Range, Notice Period */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase">Total Experience (Years)</label>
          <input
            type="number"
            value={profile.total_experience_years ?? ''}
            onChange={(e) => setProfile({ ...profile, total_experience_years: Number(e.target.value) || null })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase">Target CTC Min (LPA)</label>
          <input
            type="number"
            value={profile.target_ctc_min_lpa ?? ''}
            onChange={(e) => setProfile({ ...profile, target_ctc_min_lpa: Number(e.target.value) || null })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase">Target CTC Max (LPA)</label>
          <input
            type="number"
            value={profile.target_ctc_max_lpa ?? ''}
            onChange={(e) => setProfile({ ...profile, target_ctc_max_lpa: Number(e.target.value) || null })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase">Notice Period (Days)</label>
          <input
            type="number"
            value={profile.notice_period_days ?? ''}
            onChange={(e) => setProfile({ ...profile, notice_period_days: Number(e.target.value) || null })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Target Roles */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase">Target Roles</label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {profile.target_roles.map((role) => (
            <span key={role} className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
              {role}
              <button type="button" onClick={() => removeTag('target_roles', role)} className="ml-1.5 text-blue-500 hover:text-blue-900">×</button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            placeholder="Add target role (e.g. Platform Product Manager)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag('target_roles', newRole, setNewRole); }}}
          />
          <button
            type="button"
            onClick={() => addTag('target_roles', newRole, setNewRole)}
            className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-300"
          >
            Add Role
          </button>
        </div>
      </div>

      {/* Target Domains */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase">Target Domains</label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {profile.target_domains.map((dom) => (
            <span key={dom} className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800">
              {dom}
              <button type="button" onClick={() => removeTag('target_domains', dom)} className="ml-1.5 text-indigo-500 hover:text-indigo-900">×</button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="Add domain (e.g. B2B SaaS, Partner Ecosystems)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag('target_domains', newDomain, setNewDomain); }}}
          />
          <button
            type="button"
            onClick={() => addTag('target_domains', newDomain, setNewDomain)}
            className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-300"
          >
            Add Domain
          </button>
        </div>
      </div>

      {/* Skills */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase">Core Skills</label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {profile.skills.map((skill) => (
            <span key={skill} className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {skill}
              <button type="button" onClick={() => removeTag('skills', skill)} className="ml-1.5 text-slate-400 hover:text-slate-800">×</button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder="Add skill (e.g. PRD Writing, API Workflows, RICE)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag('skills', newSkill, setNewSkill); }}}
          />
          <button
            type="button"
            onClick={() => addTag('skills', newSkill, setNewSkill)}
            className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-300"
          >
            Add Skill
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving Profile...' : 'Save Career Profile'}
        </button>
      </div>
    </form>
  );
}
