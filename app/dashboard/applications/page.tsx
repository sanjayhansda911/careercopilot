'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/navigation/Navbar';

export default function ApplicationTrackerPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [approving, setApproving] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');

  useEffect(() => {
    fetchApplications();
  }, []);

  async function fetchApplications() {
    setLoading(true);
    try {
      const res = await fetch('/api/applications');
      const data = await res.json();
      if (data.status === 'success') {
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.warn('Failed to load applications:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!selectedApp) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/applications/${selectedApp.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: approvalNotes })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSelectedApp(null);
        setApprovalNotes('');
        await fetchApplications();
      } else {
        alert(data.message || 'Approval failed');
      }
    } catch (err: any) {
      alert(err.message || String(err));
    } finally {
      setApproving(false);
    }
  }

  async function handleConfirmSubmission() {
    if (!selectedApp) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/applications/${selectedApp.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionChannel: 'company_portal',
          notes: approvalNotes
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSelectedApp(null);
        setApprovalNotes('');
        await fetchApplications();
      } else {
        alert(data.message || 'Submission confirmation failed');
      }
    } catch (err: any) {
      alert(err.message || String(err));
    } finally {
      setApproving(false);
    }
  }

  const stages = [
    { key: 'prepared', label: 'Prepared', bg: 'bg-amber-50 text-amber-800' },
    { key: 'approved', label: 'Approved (Ready)', bg: 'bg-blue-50 text-blue-800' },
    { key: 'submitted', label: 'Submitted', bg: 'bg-indigo-50 text-indigo-800' },
    { key: 'interviewing', label: 'Interviewing', bg: 'bg-purple-50 text-purple-800' },
    { key: 'offered', label: 'Offered', bg: 'bg-emerald-50 text-emerald-800' }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Application Tracker (Agent 4)</h1>
            <p className="mt-1 text-sm text-slate-500">
              Human-in-the-loop pipeline: explicit user review is required before marking any application as applied.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800">
            ✓ Human Gate Enforced
          </div>
        </div>

        {/* Applications List */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading applications...</div>
        ) : applications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No applications tracked yet</p>
            <p className="mt-1 text-xs text-slate-400">Tailor a resume in Resume Studio or trigger an application package to populate this pipeline.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app: any) => (
              <div
                key={app.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
                      app.application_status === 'applied' ? 'bg-indigo-100 text-indigo-800' :
                      app.application_status === 'prepared' ? 'bg-amber-100 text-amber-800' :
                      app.application_status === 'interview' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {app.application_status}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">{app.jobs?.title || 'Product Manager'}</h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {app.jobs?.company} • {app.jobs?.location || 'Remote/Hybrid'} • Discovered {new Date(app.created_at).toLocaleDateString()}
                  </p>
                  {app.next_action && (
                    <p className="mt-1.5 text-xs text-slate-600">
                      <strong>Next Action:</strong> {app.next_action} {app.next_action_date ? `(Due: ${app.next_action_date})` : ''}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedApp(app)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    {app.application_status === 'prepared' ? 'Review & Approve Application →' : 'View Application Details'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Human Approval Review Modal */}
        {selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Application Approval Review Gate</h3>
                  <p className="text-xs text-slate-500">{selectedApp.jobs?.title} at {selectedApp.jobs?.company}</p>
                </div>
                <button onClick={() => setSelectedApp(null)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              {/* Status Notice */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                <p className="font-bold">Human Approval Protocol (Requirement 9):</p>
                <p className="mt-0.5">
                  CareerPilot requires you to explicitly review cover letters, answers, and disclosures before submission. No application is ever submitted autonomously.
                </p>
              </div>

              {/* Cover Letter Review */}
              {selectedApp.application_documents?.cover_letter && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Drafted Cover Letter</h4>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                    {selectedApp.application_documents.cover_letter}
                  </div>
                </div>
              )}

              {/* Approval Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-700">Approval Notes or Submission Confirmation</label>
                <input
                  type="text"
                  placeholder="e.g. Reviewed and verified fact references; ready for submission."
                  value={approvalNotes}
                  onChange={e => setApprovalNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <a
                  href={selectedApp.jobs?.job_url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Open Employer Application Link ↗
                </a>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedApp(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Close
                  </button>
                  {selectedApp.application_status === 'prepared' && (
                    <button
                      onClick={handleApprove}
                      disabled={approving}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {approving ? 'Recording Approval...' : 'Approve Application Package ✓'}
                    </button>
                  )}
                  {selectedApp.application_status === 'approved' && (
                    <button
                      onClick={handleConfirmSubmission}
                      disabled={approving}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {approving ? 'Confirming...' : 'Confirm Submission to Employer Portal 🚀'}
                    </button>
                  )}
                  {(selectedApp.application_status === 'submitted' || selectedApp.application_status === 'applied') && (
                    <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800">
                      ✓ Submitted & Confirmed
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
