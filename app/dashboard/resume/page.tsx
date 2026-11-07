'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/navigation/Navbar';

function ResumeStudioContent() {
  const searchParams = useSearchParams();
  const preselectedJobId = searchParams.get('jobId');

  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(preselectedJobId || '');
  const [tailoredResume, setTailoredResume] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/discovery/jobs?status=all')
      .then(r => r.json())
      .then(d => {
        if (d.jobs && d.jobs.length > 0) {
          setJobs(d.jobs);
          if (!selectedJobId) {
            setSelectedJobId(d.jobs[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  async function handleTailorResume() {
    if (!selectedJobId) return;
    setLoading(true);
    setError(null);
    setTailoredResume(null);

    try {
      const res = await fetch('/api/resumes/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: selectedJobId })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setTailoredResume(data.tailoredResume);
      } else {
        setError(data.message || 'Failed to tailor resume.');
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleCopyText() {
    if (tailoredResume?.plain_text_export) {
      navigator.clipboard.writeText(tailoredResume.plain_text_export);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handlePrintResume() {
    if (!tailoredResume?.html_export) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(tailoredResume.html_export);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Resume Studio (Agent 3)</h1>
            <p className="mt-1 text-sm text-slate-500">
              Fact-grounded resume tailoring. Every bullet is anchored to a verified fact ID with zero fabrication.
            </p>
          </div>
          {tailoredResume && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopyText}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copied ? '✓ Copied Text' : 'Copy Plain Text'}
              </button>
              <button
                onClick={handlePrintResume}
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Print / Save PDF ↗
              </button>
            </div>
          )}
        </div>

        {/* Job Selection Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Target Opportunity</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedJobId}
              onChange={e => setSelectedJobId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900"
            >
              {jobs.map(j => (
                <option key={j.id} value={j.id}>
                  {j.title} — {j.company} ({j.location || 'Remote/Hybrid'})
                </option>
              ))}
            </select>
            <button
              onClick={handleTailorResume}
              disabled={loading || !selectedJobId}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? 'Tailoring Resume...' : 'Tailor for this Job →'}
            </button>
          </div>

          {selectedJob && (
            <p className="text-xs text-slate-500 line-clamp-2">
              <strong>Job context:</strong> {selectedJob.description}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Tailored Resume Output */}
        {tailoredResume && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: Summary, Skills, and Fact Badges */}
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h2 className="text-base font-bold text-slate-900">Fact-Grounded Resume Draft</h2>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    Zero Fabrication Verified
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Tailored Summary</h3>
                  <p className="mt-1 text-sm italic text-slate-700">&ldquo;{tailoredResume.tailored_summary}&rdquo;</p>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Reordered Competencies</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tailoredResume.reordered_skills.map((s: string, idx: number) => (
                      <span key={idx} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Experience Bullets (Anchored to Fact IDs)</h3>
                  <div className="mt-2 space-y-3">
                    {tailoredResume.experience_bullets.map((b: any, idx: number) => (
                      <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{b.role_title} • {b.company}</span>
                          <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            Fact ID: {b.fact_id.slice(0, 8)}...
                          </span>
                        </div>
                        <p className="mt-1.5 text-slate-700">{b.bullet}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {tailoredResume.project_bullets.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Key Product Projects</h3>
                    <div className="mt-2 space-y-3">
                      {tailoredResume.project_bullets.map((p: any, idx: number) => (
                        <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{p.project_name}</span>
                            <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                              Fact ID: {p.fact_id.slice(0, 8)}...
                            </span>
                          </div>
                          <p className="mt-1.5 text-slate-700">{p.bullet}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Anti-Hallucination & Audit Guard */}
            <div className="space-y-6 lg:col-span-1">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Strategy Rationale</h3>
                <p className="text-xs text-slate-600">{tailoredResume.change_summary}</p>
              </div>

              {tailoredResume.unverified_claims_prevented?.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm space-y-2">
                  <h3 className="text-xs font-bold uppercase text-amber-900">Anti-Hallucination Interceptions</h3>
                  <p className="text-[11px] text-amber-800">
                    The following claims were stripped because they did not map to a verified fact ID:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-xs text-amber-900">
                    {tailoredResume.unverified_claims_prevented.map((c: string, idx: number) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ResumeStudioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-slate-500 font-medium">
          Loading Resume Studio...
        </div>
      </div>
    }>
      <ResumeStudioContent />
    </Suspense>
  );
}
