'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navigation/Navbar';

export default function JobDiscoveryPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [workMode, setWorkMode] = useState('all');
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
      let url = '/api/discovery/jobs?status=all';
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

  const filteredJobs = jobs.filter((j: any) => {
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
            <h1 className="text-2xl font-bold text-slate-900">Job Discovery Hub (Agent 1)</h1>
            <p className="mt-1 text-sm text-slate-500">
              Normalized job pipeline from configured public ATS adapters and manual ingestion.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowIngestModal(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              + Add Job Manually
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Search by title, company, or city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none sm:max-w-xs"
          />

          <div className="flex items-center space-x-2">
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

        {/* Jobs List */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading discovered jobs...</div>
        ) : filteredJobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No jobs match your filter</p>
            <p className="mt-1 text-xs text-slate-400">Try broadening your search or ingest a job posting manually.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredJobs.map((j: any) => (
              <div key={j.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{j.title}</h3>
                      <p className="text-xs font-semibold text-slate-600">{j.company} • {j.location || 'India'}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold capitalize text-slate-700">
                      {j.work_mode || 'unspecified'}
                    </span>
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
                    href={j.job_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    View Source Listing ↗
                  </a>
                  <Link
                    href={`/dashboard/intelligence`}
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                  >
                    Evaluate Match →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Manual Ingest Modal */}
        {showIngestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold text-slate-900">Add Job Listing (Manual Ingest)</h3>
                <button onClick={() => setShowIngestModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

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
                      placeholder="e.g. Acme Tech"
                      value={ingestForm.company}
                      onChange={e => setIngestForm({ ...ingestForm, company: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Bengaluru / Remote"
                      value={ingestForm.location}
                      onChange={e => setIngestForm({ ...ingestForm, location: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Application URL *</label>
                  <input
                    type="url"
                    required
                    placeholder="https://careers.acme.com/jobs/..."
                    value={ingestForm.job_url}
                    onChange={e => setIngestForm({ ...ingestForm, job_url: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Min Salary (LPA)</label>
                    <input
                      type="number"
                      placeholder="e.g. 24"
                      value={ingestForm.salary_min_lpa}
                      onChange={e => setIngestForm({ ...ingestForm, salary_min_lpa: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Max Salary (LPA)</label>
                    <input
                      type="number"
                      placeholder="e.g. 28"
                      value={ingestForm.salary_max_lpa}
                      onChange={e => setIngestForm({ ...ingestForm, salary_max_lpa: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Job Description (JD) *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Paste job description, responsibilities, and qualifications..."
                    value={ingestForm.description}
                    onChange={e => setIngestForm({ ...ingestForm, description: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t">
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
                    {submitting ? 'Ingesting...' : 'Ingest Job Record'}
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
