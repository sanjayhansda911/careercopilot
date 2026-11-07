'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navigation/Navbar';

export default function JobDiscoveryPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [workMode, setWorkMode] = useState('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'linkedin' | 'portals'>('all');
  const [trackFilter, setTrackFilter] = useState('all');
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Manual ingest form state
  const [ingestForm, setIngestForm] = useState({
    title: '',
    company: '',
    job_url: '',
    location: '',
    work_mode: 'unspecified',
    description: '',
    salary_min_lpa: '',
    salary_max_lpa: ''
  });
  const [ingestError, setIngestError] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
  }, [workMode]);

  async function fetchJobs() {
    setLoading(true);
    try {
      let url = '/api/discovery/jobs?status=all&limit=100';
      if (workMode !== 'all') url += `&work_mode=${workMode}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'success') {
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.warn('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerScan() {
    setScanning(true);
    setScanMessage(null);
    try {
      const res = await fetch('/api/discovery/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.status === 'success') {
        setScanMessage(
          `✓ Scan complete: Scanned ${data.discovery.jobsScanned} listings across LinkedIn & Company Portals. Added ${data.discovery.jobsAdded} new jobs (${data.discovery.jobsSkippedDuplicates} deduplicated).`
        );
        await fetchJobs();
      } else {
        setScanMessage(`Scan completed with message: ${data.message || 'Done'}`);
      }
    } catch (err: any) {
      setScanMessage(`Scan error: ${err.message || String(err)}`);
    } finally {
      setScanning(false);
    }
  }

  async function handleIngestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setIngestError(null);

    try {
      const payload = {
        title: ingestForm.title,
        company: ingestForm.company,
        job_url: ingestForm.job_url,
        location: ingestForm.location || null,
        work_mode: ingestForm.work_mode,
        description: ingestForm.description,
        salary_min_lpa: ingestForm.salary_min_lpa ? parseFloat(ingestForm.salary_min_lpa) : null,
        salary_max_lpa: ingestForm.salary_max_lpa ? parseFloat(ingestForm.salary_max_lpa) : null
      };

      const res = await fetch('/api/discovery/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setShowIngestModal(false);
        setIngestForm({
          title: '',
          company: '',
          job_url: '',
          location: '',
          work_mode: 'unspecified',
          description: '',
          salary_min_lpa: '',
          salary_max_lpa: ''
        });
        await fetchJobs();
      } else {
        setIngestError(data.message || 'Failed to ingest job posting.');
      }
    } catch (err: any) {
      setIngestError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function getJobSourceBadge(url: string) {
    if (!url) return { label: 'Company Portal', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    const lower = url.toLowerCase();
    if (lower.includes('linkedin.com')) {
      return { label: 'LinkedIn', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    if (lower.includes('greenhouse.io')) {
      return { label: 'Greenhouse Portal', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (lower.includes('lever.co')) {
      return { label: 'Lever Portal', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }
    if (lower.includes('ashbyhq.com')) {
      return { label: 'Ashby Portal', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    }
    return { label: 'Company Portal', color: 'bg-slate-100 text-slate-700 border-slate-200' };
  }

  const linkedinJobsCount = jobs.filter(j => (j.job_url || j.canonical_url || '').includes('linkedin.com')).length;
  const portalJobsCount = jobs.length - linkedinJobsCount;

  const filteredJobs = jobs.filter((j: any) => {
    const url = j.job_url || j.canonical_url || '';
    if (sourceFilter === 'linkedin' && !url.includes('linkedin.com')) return false;
    if (sourceFilter === 'portals' && url.includes('linkedin.com')) return false;
    if (trackFilter !== 'all' && j.track !== trackFilter) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      j.title.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) ||
      (j.location && j.location.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900">Job Discovery Hub</h1>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                Agent 1
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Live automated job aggregation from <strong>LinkedIn</strong> and major <strong>Company Career Portals</strong> (Stripe, GitLab, Cloudflare, Elastic, Spotify, Linear, Ramp).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleTriggerScan}
              disabled={scanning}
              className={`inline-flex items-center rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm transition ${
                scanning ? 'bg-blue-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {scanning ? (
                <>
                  <svg className="mr-2 h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Scanning Portals & LinkedIn...
                </>
              ) : (
                '⚡ Scan LinkedIn & Company Portals'
              )}
            </button>
            <button
              onClick={() => setShowIngestModal(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              + Ingest URL / Job
            </button>
          </div>
        </div>

        {/* Scan Feedback Banner */}
        {scanMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 shadow-sm flex items-center justify-between">
            <span>{scanMessage}</span>
            <button onClick={() => setScanMessage(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-4">✕</button>
          </div>
        )}

        {/* Filters & Search */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="text"
              placeholder="Search by title, company, or city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none sm:max-w-xs"
            />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Source:</span>
              <button
                onClick={() => setSourceFilter('all')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  sourceFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Sources ({jobs.length})
              </button>
              <button
                onClick={() => setSourceFilter('linkedin')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  sourceFilter === 'linkedin' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                LinkedIn ({linkedinJobsCount})
              </button>
              <button
                onClick={() => setSourceFilter('portals')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  sourceFilter === 'portals' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Company Career Portals ({portalJobsCount})
              </button>
            </div>
          </div>

          {/* Track Filters */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
            <span className="text-xs font-semibold text-slate-500 mr-1">Search Track:</span>
            {[
              { id: 'all', label: 'All Tracks' },
              { id: 'track_a', label: 'Track A: Direct PM' },
              { id: 'track_b', label: 'Track B: Product-Adjacent' },
              { id: 'track_c', label: 'Track C: Senior Ops' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTrackFilter(t.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  trackFilter === t.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 border-t border-slate-100 pt-3">
            <span className="text-xs font-semibold text-slate-500">Work Mode:</span>
            {['all', 'remote', 'hybrid', 'on-site'].map(mode => (
              <button
                key={mode}
                onClick={() => setWorkMode(mode)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition ${
                  workMode === mode ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Jobs Grid */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading discovered jobs from Supabase...</div>
        ) : filteredJobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No jobs match your filter</p>
            <p className="mt-1 text-xs text-slate-400">Try running the Discovery Agent or broadening your filter criteria.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredJobs.map((j: any) => {
              const sourceBadge = getJobSourceBadge(j.job_url || j.canonical_url);
              const isHyd = /hyderabad/i.test(j.location || '');
              const isRem = /remote/i.test(j.work_mode || '') || /remote/i.test(j.location || '');

              return (
                <div key={j.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3 flex flex-col justify-between hover:border-slate-300 transition">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="pr-2">
                        <h3 className="text-base font-bold text-slate-900 leading-snug">{j.title}</h3>
                        <p className="text-xs font-semibold text-slate-600 mt-0.5">{j.company} • {j.location || 'India / Remote'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${sourceBadge.color}`}>
                          {sourceBadge.label}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold capitalize text-slate-700">
                          {j.work_mode || 'unspecified'}
                        </span>
                      </div>
                    </div>

                    {/* Track & Location Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        j.track === 'track_a' ? 'bg-purple-100 text-purple-800' :
                        j.track === 'track_b' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {j.track === 'track_a' ? 'Track A: Direct PM' : j.track === 'track_b' ? 'Track B: Product-Adjacent' : 'Track C: Senior Ops'}
                      </span>
                      {isHyd && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                          📍 Hyderabad
                        </span>
                      )}
                      {isRem && (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                          🌐 Remote
                        </span>
                      )}
                    </div>

                    {j.salary_min_lpa ? (
                      <p className="mt-2 text-xs font-semibold text-emerald-700">
                        ₹{j.salary_min_lpa} - {j.salary_max_lpa} LPA ({j.salary_confidence})
                      </p>
                    ) : (
                      <p className="mt-2 text-xs font-medium text-slate-400">
                        Salary undisclosed
                      </p>
                    )}

                    <p className="mt-2 text-xs text-slate-600 line-clamp-3">
                      {j.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <a
                      href={j.job_url || j.canonical_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                    >
                      View on {sourceBadge.label.split(' ')[0]} ↗
                    </a>
                    <Link
                      href={`/dashboard/intelligence?jobId=${j.id}`}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                    >
                      Evaluate Fit (Agent 2) →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Manual Ingest Modal */}
        {showIngestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold text-slate-900">Add / Ingest Job Listing</h3>
                <button onClick={() => setShowIngestModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <p className="text-xs text-slate-500">
                Paste any <strong>LinkedIn job URL</strong> (<code className="bg-slate-100 px-1 py-0.5 rounded">linkedin.com/jobs/view/...</code>) or company career portal link to automatically ingest and normalize it.
              </p>

              {ingestError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  {ingestError}
                </div>
              )}

              <form onSubmit={handleIngestSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Job Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Product Manager"
                    value={ingestForm.title}
                    onChange={e => setIngestForm({ ...ingestForm, title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Company *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Google, Stripe, PhonePe"
                      value={ingestForm.company}
                      onChange={e => setIngestForm({ ...ingestForm, company: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">Work Mode</label>
                    <select
                      value={ingestForm.work_mode}
                      onChange={e => setIngestForm({ ...ingestForm, work_mode: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    >
                      <option value="unspecified">Unspecified</option>
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="on-site">On-site</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Job Posting / Application URL *</label>
                  <input
                    type="url"
                    required
                    placeholder="https://www.linkedin.com/jobs/view/... or company portal"
                    value={ingestForm.job_url}
                    onChange={e => setIngestForm({ ...ingestForm, job_url: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru, Hyderabad, India Remote"
                    value={ingestForm.location}
                    onChange={e => setIngestForm({ ...ingestForm, location: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Job Description *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Paste job description text..."
                    value={ingestForm.description}
                    onChange={e => setIngestForm({ ...ingestForm, description: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Min Salary (INR LPA)</label>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="e.g. 25"
                      value={ingestForm.salary_min_lpa}
                      onChange={e => setIngestForm({ ...ingestForm, salary_min_lpa: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Max Salary (INR LPA)</label>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="e.g. 35"
                      value={ingestForm.salary_max_lpa}
                      onChange={e => setIngestForm({ ...ingestForm, salary_max_lpa: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowIngestModal(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Ingesting...' : 'Save & Ingest'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
