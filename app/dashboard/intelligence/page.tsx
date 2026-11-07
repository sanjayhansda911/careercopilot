'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navigation/Navbar';

export default function JobIntelligencePage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRec, setFilterRec] = useState('all');
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);

  useEffect(() => {
    fetchMatches();
  }, [filterRec]);

  async function fetchMatches() {
    setLoading(true);
    try {
      let url = '/api/intelligence';
      if (filterRec !== 'all') url += `?recommendation=${filterRec}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'success') {
        const list = data.matches || [];
        setMatches(list);
        if (list.length > 0 && !selectedMatch) {
          setSelectedMatch(list[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to load matches:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Job Intelligence (Agent 2)</h1>
            <p className="mt-1 text-sm text-slate-500">
              Deterministic 7-factor weighted scoring and Gemini semantic gap analysis.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {['all', 'apply_now', 'review', 'stretch'].map(rec => (
              <button
                key={rec}
                onClick={() => setFilterRec(rec)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase transition ${
                  filterRec === rec ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {rec.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading intelligence evaluations...</div>
        ) : matches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No matches evaluated yet</p>
            <p className="mt-1 text-xs text-slate-400">Run the Orchestrator from the Overview page or evaluate a job from Discovery.</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column: Match Roster */}
            <div className="space-y-3 lg:col-span-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Evaluated Opportunities</h2>
              {matches.map((m: any) => {
                const isSelected = selectedMatch?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMatch(m)}
                    className={`cursor-pointer rounded-xl border p-4 transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/40 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-900 line-clamp-1">{m.jobs?.title || 'Product Manager'}</p>
                        <p className="text-[11px] text-slate-500">{m.jobs?.company}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-black ${
                        m.total_score >= 80 ? 'bg-emerald-100 text-emerald-800' :
                        m.total_score >= 65 ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {m.total_score}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase">
                      <span>{m.recommendation?.replace('_', ' ')}</span>
                      <span>Confidence: {m.confidence_level || 'high'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Deep-Dive Analysis for Selected Match */}
            {selectedMatch && (
              <div className="space-y-6 lg:col-span-2">
                {/* Score Banner */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        Recommendation: {selectedMatch.recommendation?.replace('_', ' ')}
                      </span>
                      <h2 className="mt-2 text-xl font-bold text-slate-900">{selectedMatch.jobs?.title || 'Product Manager'}</h2>
                      <p className="text-xs text-slate-500">{selectedMatch.jobs?.company} • {selectedMatch.jobs?.location || 'India Remote / Hybrid'}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-blue-600">{selectedMatch.total_score}<span className="text-sm font-normal text-slate-400">/100</span></div>
                      <Link
                        href={`/dashboard/resume?jobId=${selectedMatch.job_id}`}
                        className="mt-2 inline-block rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                      >
                        Tailor Resume →
                      </Link>
                    </div>
                  </div>

                  {/* 7-Factor Weighted Breakdown */}
                  {selectedMatch.score_breakdown && (
                    <div className="border-t border-slate-100 pt-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">7-Criterion Weighted Model</h3>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <p className="text-slate-500">Skills (25%)</p>
                          <p className="font-bold text-slate-800">{selectedMatch.score_breakdown.experience_skills ?? 15} / 25</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <p className="text-slate-500">Seniority (20%)</p>
                          <p className="font-bold text-slate-800">{selectedMatch.score_breakdown.role_seniority ?? 15} / 20</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <p className="text-slate-500">Domain (15%)</p>
                          <p className="font-bold text-slate-800">{selectedMatch.score_breakdown.domain_relevance ?? 10} / 15</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <p className="text-slate-500">Salary (15%)</p>
                          <p className="font-bold text-slate-800">{selectedMatch.score_breakdown.compensation ?? 9} / 15</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <p className="text-slate-500">Leadership (10%)</p>
                          <p className="font-bold text-slate-800">{selectedMatch.score_breakdown.leadership_scope ?? 8} / 10</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <p className="text-slate-500">Location (10%)</p>
                          <p className="font-bold text-slate-800">{selectedMatch.score_breakdown.location_work_mode ?? 8} / 10</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <p className="text-slate-500">Notice (5%)</p>
                          <p className="font-bold text-slate-800">{selectedMatch.score_breakdown.notice_period ?? 4} / 5</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Evidence & Gaps Side-by-Side */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm space-y-2">
                    <h3 className="text-xs font-bold uppercase text-emerald-800">Verified Fact Strengths</h3>
                    <ul className="list-disc space-y-1 pl-4 text-xs text-emerald-950">
                      {(selectedMatch.strengths || []).map((s: string, idx: number) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm space-y-2">
                    <h3 className="text-xs font-bold uppercase text-amber-800">Transferable Skills</h3>
                    <ul className="list-disc space-y-1 pl-4 text-xs text-amber-950">
                      {(selectedMatch.transferable_skills || []).map((t: string, idx: number) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Missing Skills & Gaps */}
                <div className="rounded-xl border border-red-200 bg-white p-5 shadow-sm space-y-2">
                  <h3 className="text-xs font-bold uppercase text-red-800">Identified Gaps & Missing Qualifications</h3>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-red-950">
                    {(selectedMatch.gaps || []).map((g: string, idx: number) => (
                      <li key={idx}>{g}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
