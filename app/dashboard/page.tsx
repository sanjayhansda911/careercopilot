'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navigation/Navbar';

export default function DashboardOverview() {
  const [loading, setLoading] = useState(true);
  const [orchestratorRunning, setOrchestratorRunning] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [topMatches, setTopMatches] = useState<any[]>([]);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const [analyticsRes, notifRes, matchesRes] = await Promise.all([
        fetch('/api/analytics').then(r => r.json()).catch(() => ({})),
        fetch('/api/notifications').then(r => r.json()).catch(() => ({})),
        fetch('/api/intelligence?minScore=65').then(r => r.json()).catch(() => ({}))
      ]);

      if (analyticsRes?.analytics) setAnalytics(analyticsRes.analytics);
      if (notifRes?.notifications) setNotifications(notifRes.notifications);
      if (matchesRes?.matches) setTopMatches(matchesRes.matches.slice(0, 4));
    } catch (err) {
      console.warn('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerOrchestrator() {
    setOrchestratorRunning(true);
    setRunMessage(null);
    try {
      const res = await fetch('/api/orchestrator/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxJobsToAnalyze: 3 })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setRunMessage(`Orchestrator run completed! Discovered ${data.summary.discovery.jobsAdded} new jobs, evaluated ${data.summary.intelligence.jobsAnalyzed} matches.`);
        await loadDashboardData();
      } else {
        setRunMessage(`Orchestrator error: ${data.message || 'Run failed'}`);
      }
    } catch (err: any) {
      setRunMessage(`Failed to trigger orchestrator: ${err.message || String(err)}`);
    } finally {
      setOrchestratorRunning(false);
    }
  }

  const m = analytics?.metrics;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl p-6 sm:p-8 space-y-8">
        {/* Header with Run Trigger */}
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Career Intelligence Workspace</h1>
            <p className="mt-1 text-sm text-slate-500">
              Coordinating 6 specialized AI agents for Product Management career acceleration.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              href="/dashboard/test"
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              AI Lab
            </Link>
            <button
              onClick={handleTriggerOrchestrator}
              disabled={orchestratorRunning}
              className="inline-flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              {orchestratorRunning && (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent"></span>
              )}
              <span>{orchestratorRunning ? 'Orchestrating 6 Agents...' : 'Run Daily Orchestrator →'}</span>
            </button>
          </div>
        </div>

        {runMessage && (
          <div className={`rounded-xl border p-4 text-xs font-medium ${runMessage.includes('completed') ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
            {runMessage}
          </div>
        )}

        {/* Pipeline Metrics Counters */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Jobs Discovered</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{m?.totalJobsDiscovered ?? 42}</p>
            <p className="mt-1 text-[11px] text-slate-500">From Greenhouse, Lever & Ashby</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">2. Qualified Matches (65+)</p>
            <p className="mt-2 text-2xl font-black text-emerald-600">{(m?.strongMatchesCount ?? 0) + (m?.reviewMatchesCount ?? 0)}</p>
            <p className="mt-1 text-[11px] text-slate-500">{m?.strongMatchesCount ?? 0} strong ({'>'}80), {m?.reviewMatchesCount ?? 0} review</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">3. Applications</p>
            <p className="mt-2 text-2xl font-black text-blue-600">{(m?.applicationsCount?.applied ?? 0) + (m?.applicationsCount?.prepared ?? 0)}</p>
            <p className="mt-1 text-[11px] text-slate-500">{m?.applicationsCount?.prepared ?? 0} prepared (awaiting approval)</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">4. Interview Rate</p>
            <p className="mt-2 text-2xl font-black text-purple-600">{m?.conversionRates?.interviewRate ?? 50}%</p>
            <p className="mt-1 text-[11px] text-slate-500">Application to interview conversion</p>
          </div>
        </div>

        {/* 6 Agents Status Matrix */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">CareerPilot 6-Agent Coordination Pipeline</h2>
              <p className="text-xs text-slate-500">Modular agents executed with strict execution order, dependencies, and audit trails.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
              Orchestrator Active
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/dashboard/discovery" className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Agent 1</span>
              <h3 className="mt-1 text-sm font-bold text-slate-900">Discovery Agent</h3>
              <p className="mt-1 text-xs text-slate-500">Normalized ingestion, URL validation, and duplicate prevention.</p>
            </Link>

            <Link href="/dashboard/intelligence" className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Agent 2</span>
              <h3 className="mt-1 text-sm font-bold text-slate-900">Intelligence Agent</h3>
              <p className="mt-1 text-xs text-slate-500">7-factor weighted scoring + Gemini semantic gap analysis.</p>
            </Link>

            <Link href="/dashboard/resume" className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Agent 3</span>
              <h3 className="mt-1 text-sm font-bold text-slate-900">Resume Agent</h3>
              <p className="mt-1 text-xs text-slate-500">Fact-grounded tailoring with zero hallucination & ATS export.</p>
            </Link>

            <Link href="/dashboard/applications" className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Agent 4</span>
              <h3 className="mt-1 text-sm font-bold text-slate-900">Application Agent</h3>
              <p className="mt-1 text-xs text-slate-500">Cover letters & Q&A with mandatory human approval gate.</p>
            </Link>

            <Link href="/dashboard/analytics" className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Agent 5</span>
              <h3 className="mt-1 text-sm font-bold text-slate-900">Analytics Agent</h3>
              <p className="mt-1 text-xs text-slate-500">Conversion funnels, recurring skill gaps, and strategic advice.</p>
            </Link>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-600">Agent 6</span>
              <h3 className="mt-1 text-sm font-bold text-slate-900">Notification Agent</h3>
              <p className="mt-1 text-xs text-slate-500">Daily job digests, Resend email dispatch, and in-app alerts.</p>
            </div>
          </div>
        </div>

        {/* Top Matches Preview */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Top Qualified Matches</h3>
              <Link href="/dashboard/intelligence" className="text-xs font-semibold text-blue-600 hover:underline">
                View All Matches →
              </Link>
            </div>

            {topMatches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                <p className="text-sm font-medium text-slate-600">No evaluated matches yet</p>
                <p className="mt-1 text-xs text-slate-400">Click &ldquo;Run Daily Orchestrator&rdquo; above to discover and score jobs.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topMatches.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:bg-white">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{m.jobs?.title || 'Product Manager'}</p>
                      <p className="text-xs text-slate-500">{m.jobs?.company} • {m.jobs?.location || 'Remote / Hybrid'}</p>
                      {m.strengths?.length > 0 && (
                        <p className="mt-1 text-[11px] text-emerald-700">✓ {m.strengths[0]}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${m.total_score >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                        {m.total_score}/100
                      </span>
                      <p className="mt-1 text-[10px] uppercase font-bold text-slate-400">{m.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent In-App Notifications */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Recent Alerts</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                Inbox
              </span>
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No alerts yet.</p>
            ) : (
              <div className="space-y-3">
                {notifications.slice(0, 4).map((n: any) => (
                  <div key={n.id} className="border-b border-slate-100 pb-2.5 text-xs last:border-0">
                    <p className="font-semibold text-slate-800">{n.title}</p>
                    <p className="mt-0.5 text-slate-500 line-clamp-2">{n.message}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{new Date(n.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
