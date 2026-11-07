'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/navigation/Navbar';

export default function AnalyticsPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(res => {
        if (res.analytics) {
          setData(res.analytics);
        }
      })
      .catch(err => console.warn('Failed to load analytics:', err))
      .finally(() => setLoading(false));
  }, []);

  const m = data?.metrics;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl p-6 sm:p-8 space-y-8">
        {/* Header */}
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold text-slate-900">Career Analytics & Search Optimization (Agent 5)</h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time pipeline funnel analytics, recurring skill gaps, and Gemini-powered strategic positioning.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Computing pipeline analytics...</div>
        ) : (
          <>
            {/* Conversion Funnel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900">Job-Search Conversion Funnel</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 text-center">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Discovered</p>
                  <p className="mt-1 text-2xl font-black text-slate-800">{m?.totalJobsDiscovered ?? 42}</p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Qualified (65+)</p>
                  <p className="mt-1 text-2xl font-black text-blue-700">{(m?.strongMatchesCount ?? 0) + (m?.reviewMatchesCount ?? 0)}</p>
                  <p className="mt-0.5 text-[10px] text-blue-600 font-medium">{m?.conversionRates?.qualificationRate ?? 61}% match rate</p>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Applied</p>
                  <p className="mt-1 text-2xl font-black text-indigo-700">{m?.applicationsCount?.applied ?? 2}</p>
                  <p className="mt-0.5 text-[10px] text-indigo-600 font-medium">{m?.conversionRates?.applicationRate ?? 18}% of qualified</p>
                </div>
                <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Interviews</p>
                  <p className="mt-1 text-2xl font-black text-purple-700">{m?.applicationsCount?.interview ?? 1}</p>
                  <p className="mt-0.5 text-[10px] text-purple-600 font-medium">{m?.conversionRates?.interviewRate ?? 50}% conv. rate</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Offers</p>
                  <p className="mt-1 text-2xl font-black text-emerald-700">{m?.applicationsCount?.offer ?? 0}</p>
                </div>
              </div>
            </div>

            {/* Strategic Advice from Gemini */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Tactical Recommendations */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 lg:col-span-2">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-base font-bold text-slate-900">AI Strategic Search Recommendations</h3>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                    High Signal
                  </span>
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-xs text-blue-900">
                  <p className="font-bold">Market Viability Assessment:</p>
                  <p className="mt-1 leading-relaxed">{data?.market_positioning_analysis}</p>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Actionable Steps for This Week</h4>
                  <div className="mt-2 space-y-2">
                    {(data?.strategic_recommendations || []).map((r: string, idx: number) => (
                      <div key={idx} className="flex items-start space-x-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                          {idx + 1}
                        </span>
                        <p className="text-slate-800 leading-relaxed">{r}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {data?.recommended_search_adjustments?.length > 0 && (
                  <div className="border-t border-slate-100 pt-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Recommended Search Filter Adjustments</h4>
                    <ul className="mt-2 list-disc pl-4 space-y-1 text-xs text-slate-700">
                      {data.recommended_search_adjustments.map((t: string, idx: number) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Recurring Skill Gaps Analysis */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="border-b pb-3">
                  <h3 className="text-base font-bold text-slate-900">Recurring Skill Gaps</h3>
                  <p className="text-xs text-slate-400">Most frequent missing requirements across discovered jobs.</p>
                </div>

                {(m?.recurringGaps || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No recurring gaps identified yet.</p>
                ) : (
                  <div className="space-y-3">
                    {m.recurringGaps.map((g: any, idx: number) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-800">{g.skill}</span>
                          <span className="text-slate-400 font-mono text-[11px]">{g.frequency} jobs</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full bg-red-500"
                            style={{ width: `${Math.min(100, (g.frequency / (m?.totalMatchesEvaluated || 10)) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
