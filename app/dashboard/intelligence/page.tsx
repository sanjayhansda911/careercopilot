'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navigation/Navbar';

export default function JobIntelligencePage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRec, setFilterRec] = useState('all');
  const [filterTrack, setFilterTrack] = useState('all');
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  useEffect(() => {
    fetchMatches();
  }, [filterRec, filterTrack]);

  async function fetchMatches() {
    setLoading(true);
    try {
      let url = '/api/intelligence';
      const params = new URLSearchParams();
      if (filterRec !== 'all') params.append('recommendation', filterRec);
      if (filterTrack !== 'all') params.append('track', filterTrack);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'success') {
        const list = data.matches || [];
        setMatches(list);
        if (list.length > 0) {
          const stillThere = list.find((m: any) => m.id === selectedMatch?.id);
          setSelectedMatch(stillThere || list[0]);
        } else {
          setSelectedMatch(null);
        }
      }
    } catch (err) {
      console.warn('Failed to load matches:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(feedback: string) {
    if (!selectedMatch) return;
    setFeedbackLoading(true);
    try {
      const res = await fetch('/api/intelligence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: selectedMatch.id, feedback })
      });
      const data = await res.json();
      if (data.status === 'success') {
        const updated = { ...selectedMatch, user_feedback: feedback };
        setSelectedMatch(updated);
        setMatches(prev => prev.map(m => (m.id === selectedMatch.id ? updated : m)));
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setFeedbackLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center space-x-2">
              <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">Agent 2</span>
              <h1 className="text-2xl font-bold text-slate-900">Career Opportunity Intelligence</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Executive recruiter evaluation across Direct PM, Product-Adjacent, and Senior Tech Ops Leadership tracks.
            </p>
          </div>

          {/* Track Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Tracks' },
              { id: 'track_a', label: 'Track A: Direct PM' },
              { id: 'track_b', label: 'Track B: Product-Adjacent' },
              { id: 'track_c', label: 'Track C: Senior Ops' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setFilterTrack(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filterTrack === t.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recommendation Score Filter Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            {[
              { id: 'all', label: 'All Scores' },
              { id: 'apply_now', label: 'Strong Match (80-100)' },
              { id: 'review', label: 'Worth Reviewing (65-79)' },
              { id: 'stretch', label: 'Stretch (50-64)' }
            ].map(r => (
              <button
                key={r.id}
                onClick={() => setFilterRec(r.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filterRec === r.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-slate-200/70 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <span className="text-xs font-medium text-slate-500">
            {matches.length} qualified opportunit{matches.length === 1 ? 'y' : 'ies'}
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-xs text-slate-400">Loading intelligence evaluations...</div>
        ) : matches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No matches found for selected filters</p>
            <p className="mt-1 text-xs text-slate-400">
              Try adjusting the Track or Score filter, or trigger a discovery scan from the Discovery Hub.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column: Match Roster */}
            <div className="space-y-3 lg:col-span-1 max-h-[820px] overflow-y-auto pr-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Opportunities ({matches.length})</h2>
              {matches.map((m: any) => {
                const isSelected = selectedMatch?.id === m.id;
                const isHyd = /hyderabad/i.test(m.jobs?.location || '');
                const isRem = /remote/i.test(m.jobs?.work_mode || '') || /remote/i.test(m.jobs?.location || '');

                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMatch(m)}
                    className={`cursor-pointer rounded-xl border p-4 transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{m.jobs?.title || 'Product Manager'}</p>
                        <p className="text-[11px] font-medium text-slate-600 truncate">{m.jobs?.company}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-black shrink-0 ${
                        m.total_score >= 80 ? 'bg-emerald-100 text-emerald-800' :
                        m.total_score >= 65 ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {m.total_score}
                      </span>
                    </div>

                    {/* Location & Track Pills */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className={`px-2 py-0.5 rounded font-semibold ${
                        m.track === 'track_a' ? 'bg-purple-100 text-purple-800' :
                        m.track === 'track_b' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {m.track === 'track_a' ? 'Track A: Direct PM' : m.track === 'track_b' ? 'Track B: Product-Adjacent' : 'Track C: Senior Ops'}
                      </span>
                      {isHyd ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                          📍 Hyderabad
                        </span>
                      ) : isRem ? (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-medium">
                          🌐 Remote
                        </span>
                      ) : (
                        <span className="text-slate-500 truncate max-w-[120px]">
                          {m.jobs?.location || 'India'}
                        </span>
                      )}
                    </div>

                    {m.user_feedback && (
                      <div className="mt-2 text-[10px] font-semibold text-slate-600">
                        Feedback: <span className="capitalize text-blue-700 font-bold">{m.user_feedback.replace('_', ' ')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right Column: Deep-Dive Analysis for Selected Match */}
            {selectedMatch && (
              <div className="space-y-5 lg:col-span-2">
                {/* Score & Header Banner */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          selectedMatch.track === 'track_a' ? 'bg-purple-100 text-purple-800' :
                          selectedMatch.track === 'track_b' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {selectedMatch.track === 'track_a' ? 'Track A: Direct Product Management' :
                           selectedMatch.track === 'track_b' ? 'Track B: Product-Adjacent Role' :
                           'Track C: Senior Technology & Partner Operations'}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          {selectedMatch.recommendation?.replace('_', ' ')}
                        </span>
                      </div>
                      <h2 className="mt-2 text-xl font-bold text-slate-900">{selectedMatch.jobs?.title || 'Product Manager'}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <strong className="text-slate-700">{selectedMatch.jobs?.company}</strong> • 📍 {selectedMatch.jobs?.location || 'India Remote / Hybrid'} • {selectedMatch.jobs?.work_mode || 'unspecified'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-3xl font-black text-blue-600">
                        {selectedMatch.total_score}<span className="text-sm font-normal text-slate-400">/100</span>
                      </div>
                      <div className="mt-2 flex items-center space-x-2">
                        <Link
                          href={`/dashboard/resume?jobId=${selectedMatch.job_id}`}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                        >
                          Tailor Resume →
                        </Link>
                        {selectedMatch.jobs?.job_url && (
                          <a
                            href={selectedMatch.jobs.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Apply Link ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recruiter Verdict Card */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">🎯</span>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">Executive Recruiter Verdict</h3>
                    </div>
                    <p className="text-xs font-medium text-blue-950 leading-relaxed">
                      {selectedMatch.matching_evidence?.verdict || selectedMatch.summary || 'Strong candidate-job fit.'}
                    </p>
                    {selectedMatch.matching_evidence?.compensation_attractiveness && (
                      <p className="text-[11px] text-blue-800 font-semibold pt-1 border-t border-blue-200/60">
                        💰 Compensation Fit: {selectedMatch.matching_evidence.compensation_attractiveness}
                      </p>
                    )}
                  </div>

                  {/* 7-Factor Weighted Breakdown */}
                  {selectedMatch.score_breakdown && (
                    <div className="border-t border-slate-100 pt-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">7-Criterion Deterministic Scoreboard</h3>
                      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7 text-xs">
                        <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                          <p className="text-[11px] text-slate-500">Skills (25%)</p>
                          <p className="font-bold text-slate-800 mt-0.5">{selectedMatch.score_breakdown.experience_skills ?? 0} / 25</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                          <p className="text-[11px] text-slate-500">Seniority (20%)</p>
                          <p className="font-bold text-slate-800 mt-0.5">{selectedMatch.score_breakdown.role_seniority ?? 0} / 20</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                          <p className="text-[11px] text-slate-500">Domain (15%)</p>
                          <p className="font-bold text-slate-800 mt-0.5">{selectedMatch.score_breakdown.domain_relevance ?? 0} / 15</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                          <p className="text-[11px] text-slate-500">Salary (15%)</p>
                          <p className="font-bold text-slate-800 mt-0.5">{selectedMatch.score_breakdown.compensation ?? 0} / 15</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                          <p className="text-[11px] text-slate-500">Leadership (10%)</p>
                          <p className="font-bold text-slate-800 mt-0.5">{selectedMatch.score_breakdown.leadership_scope ?? 0} / 10</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                          <p className="text-[11px] text-slate-500">Location (10%)</p>
                          <p className="font-bold text-slate-800 mt-0.5">{selectedMatch.score_breakdown.location_work_mode ?? 0} / 10</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                          <p className="text-[11px] text-slate-500">Notice (5%)</p>
                          <p className="font-bold text-slate-800 mt-0.5">{selectedMatch.score_breakdown.notice_period ?? 0} / 5</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Evidence & Transferable Skills */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm space-y-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-sm">✅</span>
                      <h3 className="text-xs font-bold uppercase text-emerald-800">Verified Candidate Supporting Facts</h3>
                    </div>
                    <ul className="list-disc space-y-1.5 pl-4 text-xs text-emerald-950">
                      {((selectedMatch.matching_evidence?.verified_supporting_facts?.length
                        ? selectedMatch.matching_evidence.verified_supporting_facts
                        : selectedMatch.strengths) || []).map((s: string, idx: number) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-sky-200 bg-white p-5 shadow-sm space-y-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-sm">🔄</span>
                      <h3 className="text-xs font-bold uppercase text-sky-800">Transferable Operations Capabilities</h3>
                    </div>
                    <ul className="list-disc space-y-1.5 pl-4 text-xs text-sky-950">
                      {(selectedMatch.transferable_skills || []).map((t: string, idx: number) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Unmet Requirements & Strategic Gaps */}
                <div className="rounded-xl border border-rose-200 bg-white p-5 shadow-sm space-y-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-sm">⚠️</span>
                    <h3 className="text-xs font-bold uppercase text-rose-800">Unmet Requirements & Candidate Gaps (Honest Recruiter Audit)</h3>
                  </div>
                  <ul className="list-disc space-y-1.5 pl-4 text-xs text-rose-950">
                    {((selectedMatch.matching_evidence?.unmet_requirements?.length
                      ? selectedMatch.matching_evidence.unmet_requirements
                      : selectedMatch.gaps) || []).map((g: string, idx: number) => (
                      <li key={idx}>{g}</li>
                    ))}
                  </ul>
                </div>

                {/* Targeted Interview Questions */}
                {selectedMatch.interview_topics && selectedMatch.interview_topics.length > 0 && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-sm space-y-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-sm">💡</span>
                      <h3 className="text-xs font-bold uppercase text-indigo-900">Anticipated Interview Questions & Probing Topics</h3>
                    </div>
                    <ul className="list-disc space-y-1.5 pl-4 text-xs text-indigo-950">
                      {selectedMatch.interview_topics.map((q: string, idx: number) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Continuous Learning: User Feedback */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Continuous Learning: Your Feedback</h3>
                      <p className="text-[11px] text-slate-400">Help CareerPilot tune recommendations to your career preferences.</p>
                    </div>
                    {selectedMatch.user_feedback && (
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 capitalize">
                        Status: {selectedMatch.user_feedback.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {[
                      { id: 'interested', label: '⭐ Interested', color: 'hover:bg-emerald-50 hover:border-emerald-400' },
                      { id: 'not_interested', label: '👎 Not Interested', color: 'hover:bg-slate-100 hover:border-slate-400' },
                      { id: 'applied', label: '🚀 Applied', color: 'hover:bg-blue-50 hover:border-blue-400' },
                      { id: 'interviewed', label: '🗣️ Interviewed', color: 'hover:bg-purple-50 hover:border-purple-400' },
                      { id: 'offered', label: '🎉 Offered', color: 'hover:bg-emerald-100 hover:border-emerald-500' },
                      { id: 'rejected', label: '❌ Rejected', color: 'hover:bg-rose-50 hover:border-rose-400' },
                      { id: 'not_relevant', label: '🚫 Not Relevant', color: 'hover:bg-amber-50 hover:border-amber-400' }
                    ].map(btn => (
                      <button
                        key={btn.id}
                        disabled={feedbackLoading}
                        onClick={() => handleFeedback(btn.id)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          selectedMatch.user_feedback === btn.id
                            ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                            : `border-slate-200 bg-white text-slate-700 ${btn.color}`
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
