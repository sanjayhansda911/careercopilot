'use client';

import { useState, useEffect } from 'react';

interface CareerFact {
  id: string;
  category: string;
  fact: string;
  metric_value: string | null;
  evidence_source: string | null;
  verification_status: 'pending' | 'verified' | 'rejected';
  created_at?: string;
}

export function FactBank() {
  const [facts, setFacts] = useState<CareerFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');

  // New fact modal / form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState('experience');
  const [newFactText, setNewFactText] = useState('');
  const [newMetric, setNewMetric] = useState('');
  const [newEvidence, setNewEvidence] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadFacts();
  }, []);

  function loadFacts() {
    setLoading(true);
    fetch('/api/facts')
      .then((res) => res.json())
      .then((data) => {
        if (data.facts) setFacts(data.facts);
      })
      .catch((err) => console.error('Failed to load facts:', err))
      .finally(() => setLoading(false));
  }

  async function handleStatusChange(factId: string, newStatus: 'pending' | 'verified' | 'rejected') {
    try {
      const res = await fetch(`/api/facts/${factId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verification_status: newStatus }),
      });
      if (res.ok) {
        setFacts((prev) =>
          prev.map((f) => (f.id === factId ? { ...f, verification_status: newStatus } : f))
        );
      }
    } catch (err) {
      console.error('Failed to update fact status:', err);
    }
  }

  async function handleAddFact(e: React.FormEvent) {
    e.preventDefault();
    if (!newFactText.trim()) return;
    setActionLoading(true);

    try {
      const res = await fetch('/api/facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newCategory,
          fact: newFactText.trim(),
          metric_value: newMetric.trim() || null,
          evidence_source: newEvidence.trim() || null,
          verification_status: 'pending'
        }),
      });
      const data = await res.json();
      if (res.ok && data.fact) {
        setFacts((prev) => [data.fact, ...prev]);
        setNewFactText('');
        setNewMetric('');
        setNewEvidence('');
        setShowAddForm(false);
      }
    } catch (err) {
      console.error('Failed to add fact:', err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSeedProfile() {
    setActionLoading(true);
    try {
      const res = await fetch('/api/profile/seed', { method: 'POST' });
      if (res.ok) {
        loadFacts();
      }
    } catch (err) {
      console.error('Failed to seed:', err);
    } finally {
      setActionLoading(false);
    }
  }

  const counts = {
    all: facts.length,
    pending: facts.filter((f) => f.verification_status === 'pending').length,
    verified: facts.filter((f) => f.verification_status === 'verified').length,
    rejected: facts.filter((f) => f.verification_status === 'rejected').length,
  };

  const filteredFacts = facts.filter((f) => {
    if (filter === 'all') return true;
    return f.verification_status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Verified Achievement Bank</h2>
          <p className="mt-1 text-xs text-slate-500">
            Every metric and claim in tailored resumes must link to a verified fact. Review and verify candidate facts below.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {facts.length === 0 && (
            <button
              onClick={handleSeedProfile}
              disabled={actionLoading}
              className="rounded-lg border border-blue-600 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              Seed PM Facts (11)
            </button>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            {showAddForm ? 'Cancel' : '+ Add Career Fact'}
          </button>
        </div>
      </div>

      {/* Add Fact Form */}
      {showAddForm && (
        <form onSubmit={handleAddFact} className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
          <p className="text-xs font-bold text-blue-900 uppercase">Add New Fact for Verification</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600"
              >
                <option value="experience">Experience / Role</option>
                <option value="leadership">Leadership & Team</option>
                <option value="impact">Business Impact & Metrics</option>
                <option value="product_discovery">Product Discovery / Insights</option>
                <option value="project">0-to-1 Project / Portfolio</option>
                <option value="education">Education & Certification</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase">Key Metric (Optional)</label>
              <input
                type="text"
                value={newMetric}
                onChange={(e) => setNewMetric(e.target.value)}
                placeholder="e.g. 40% reduction, 23 members"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase">Evidence Source</label>
              <input
                type="text"
                value={newEvidence}
                onChange={(e) => setNewEvidence(e.target.value)}
                placeholder="e.g. Performance appraisal, Jira report"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase">Fact Statement</label>
            <textarea
              required
              rows={2}
              value={newFactText}
              onChange={(e) => setNewFactText(e.target.value)}
              placeholder="State the verifiable career achievement or responsibility..."
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 outline-none focus:border-blue-600"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading ? 'Saving...' : 'Save as Pending Fact'}
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200">
        {(['all', 'pending', 'verified', 'rejected'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`border-b-2 px-4 py-2 text-xs font-semibold capitalize transition ${
              filter === tab
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab} ({counts[tab]})
          </button>
        ))}
      </div>

      {/* Facts Table */}
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading facts...</div>
      ) : filteredFacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
          No facts found in this tab.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFacts.map((fact) => {
            const isVerified = fact.verification_status === 'verified';
            const isPending = fact.verification_status === 'pending';
            const isRejected = fact.verification_status === 'rejected';

            return (
              <div
                key={fact.id}
                className={`flex flex-col justify-between gap-3 rounded-xl border p-4 shadow-sm transition sm:flex-row sm:items-center ${
                  isVerified
                    ? 'border-emerald-200 bg-white'
                    : isRejected
                    ? 'border-red-200 bg-red-50/20 opacity-70'
                    : 'border-amber-200 bg-amber-50/20'
                }`}
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center space-x-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                      {fact.category.replace('_', ' ')}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        isVerified
                          ? 'bg-emerald-100 text-emerald-800'
                          : isRejected
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {fact.verification_status}
                    </span>
                    {fact.metric_value && (
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        Metric: {fact.metric_value}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium text-slate-800">{fact.fact}</p>

                  {fact.evidence_source && (
                    <p className="text-xs text-slate-400">
                      Evidence source: <span className="text-slate-600">{fact.evidence_source}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {isPending && (
                    <>
                      <button
                        onClick={() => handleStatusChange(fact.id, 'verified')}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                      >
                        ✓ Verify
                      </button>
                      <button
                        onClick={() => handleStatusChange(fact.id, 'rejected')}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        ✕ Reject
                      </button>
                    </>
                  )}
                  {isVerified && (
                    <button
                      onClick={() => handleStatusChange(fact.id, 'pending')}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Re-review
                    </button>
                  )}
                  {isRejected && (
                    <button
                      onClick={() => handleStatusChange(fact.id, 'pending')}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Restore to Pending
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
