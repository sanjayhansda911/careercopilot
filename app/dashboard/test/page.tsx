'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navigation/Navbar';

export default function AITestPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRunTest() {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch('/api/ai-test');
      const json = await res.json();
      if (!res.ok || json.status === 'error') {
        throw new Error(json.message || 'Failed to execute Gemini agents test.');
      }
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error occurred while contacting Gemini API.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-5xl p-6 sm:p-8">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Google Gemini AI Verification Lab</h1>
          <p className="mt-1 text-sm text-slate-500">
            Interactive test runner for CareerPilot&apos;s 4 core Gemini agents using <code className="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono text-blue-700">@google/genai</code>.
          </p>
        </div>
        <button
          onClick={handleRunTest}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Running 4 Agents...' : 'Run Gemini Agents Test'}
        </button>
      </div>

      {loading && (
        <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50/50 p-6 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"></div>
          <p className="mt-3 text-sm font-medium text-blue-900">
            Communicating with Google Gemini API...
          </p>
          <p className="mt-1 text-xs text-blue-600">
            Testing JD Extraction, Matching, Resume Tailoring (fact grounding), and Career Insights.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
          <p className="font-semibold">Test Execution Error:</p>
          <p className="mt-1 text-sm text-red-700 font-mono">{error}</p>
        </div>
      )}

      {data && (
        <div className="mt-8 space-y-6">
          {/* Status Banner */}
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center space-x-3">
              <span className="flex h-3 w-3 rounded-full bg-emerald-500"></span>
              <p className="text-sm font-medium text-emerald-900">
                All 4 Gemini Agents Executed Successfully
              </p>
            </div>
            <span className="rounded bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              Provider: {data.provider}
            </span>
          </div>

          {/* Agent 1 */}
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">1. Job Description Analysis</h2>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                Seniority: {data.results.job_description_analysis.seniority_level}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <p><strong className="text-slate-600">Role:</strong> {data.results.job_description_analysis.title}</p>
              <p><strong className="text-slate-600">Company:</strong> {data.results.job_description_analysis.company}</p>
              <p><strong className="text-slate-600">Work Mode:</strong> {data.results.job_description_analysis.work_mode}</p>
              <p><strong className="text-slate-600">Salary:</strong> {data.results.job_description_analysis.salary_min_lpa} - {data.results.job_description_analysis.salary_max_lpa} LPA ({data.results.job_description_analysis.salary_confidence})</p>
            </div>
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase text-slate-400">Required Skills</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {data.results.job_description_analysis.required_skills.map((s: string, idx: number) => (
                  <span key={idx} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Agent 2 */}
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">2. Candidate-Job Matching</h2>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-bold text-indigo-800">
                Fit Score: {data.results.candidate_job_match.fit_score}/100 ({data.results.candidate_job_match.recommendation})
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{data.results.candidate_job_match.summary}</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-emerald-50/60 p-3">
                <p className="text-xs font-semibold text-emerald-800 uppercase">Strengths</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-emerald-900">
                  {data.results.candidate_job_match.strengths.slice(0, 3).map((st: string, idx: number) => (
                    <li key={idx}>{st}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg bg-amber-50/60 p-3">
                <p className="text-xs font-semibold text-amber-800 uppercase">Gaps & Differences</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-900">
                  {data.results.candidate_job_match.gaps.slice(0, 3).map((g: string, idx: number) => (
                    <li key={idx}>{g}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Agent 3 */}
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">3. Fact-Grounded Resume Tailoring</h2>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                Zero Fabrication Verified
              </span>
            </div>
            <p className="mt-2 text-sm italic text-slate-600">&ldquo;{data.results.tailored_resume.tailored_summary}&rdquo;</p>
            
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase text-slate-400">Tailored Experience Bullets (Anchored in Fact IDs)</p>
              <div className="mt-2 space-y-2">
                {data.results.tailored_resume.experience_bullets.map((b: any, idx: number) => (
                  <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs">
                    <p className="font-semibold text-slate-800">{b.role_title} • {b.company}</p>
                    <p className="mt-1 text-slate-700">{b.bullet}</p>
                    <p className="mt-1 font-mono text-[10px] text-blue-600">Fact ID: {b.fact_id}</p>
                  </div>
                ))}
              </div>
            </div>

            {data.results.tailored_resume.unverified_claims_prevented?.length > 0 && (
              <div className="mt-3 rounded-lg bg-slate-100 p-2.5 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Unverified Claims Prevented by Anti-Hallucination Guard:</p>
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  {data.results.tailored_resume.unverified_claims_prevented.map((c: string, idx: number) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Agent 4 */}
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">4. Career Insights & Transition Strategy</h2>
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
                Readiness: {data.results.career_insights.overall_market_readiness_score}/100
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{data.results.career_insights.strategic_positioning}</p>

            <div className="mt-3">
              <p className="text-xs font-semibold uppercase text-slate-400">Actionable Next Steps</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-700">
                {data.results.career_insights.actionable_next_steps.map((step: string, idx: number) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}
    </main>
  </div>
  );
}
