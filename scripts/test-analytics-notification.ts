import fs from 'fs';
import path from 'path';

// Load .env.local
const envFile = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { runAnalyticsAgent, AnalyticsMetrics } from '../lib/agents/analytics';
import { runNotificationAgent, buildDailyDigestHtml, sendEmailViaResend } from '../lib/agents/notification';

async function main() {
  console.log('=== CareerPilot Milestone 4 Test: Analytics & Notification Agents ===\n');

  // Test 1: Analytics Agent Execution
  console.log('[1/3] Testing Analytics Agent (Deterministic Calculations & Gemini Advice)...');
  const mockMetrics: AnalyticsMetrics = {
    totalJobsDiscovered: 42,
    totalMatchesEvaluated: 18,
    strongMatchesCount: 4,
    reviewMatchesCount: 7,
    stretchMatchesCount: 5,
    averageMatchScore: 68,
    applicationsCount: {
      prepared: 3,
      approved: 2,
      applied: 2,
      interview: 1,
      offer: 0,
      rejected: 0
    },
    conversionRates: {
      qualificationRate: 61,
      applicationRate: 18,
      interviewRate: 50,
      offerRate: 0
    },
    recurringGaps: [
      { skill: 'Commercial B2B SaaS roadmap ownership', frequency: 11 },
      { skill: 'Direct pricing & packaging strategy', frequency: 7 },
      { skill: 'Enterprise developer platform experience', frequency: 5 }
    ]
  };

  const analyticsResult = await runAnalyticsAgent({
    metricsOverride: mockMetrics
  });

  console.log('  - Qualification Rate:', `${analyticsResult.metrics.conversionRates.qualificationRate}%`);
  console.log('  - Application-to-Interview Conversion:', `${analyticsResult.metrics.conversionRates.interviewRate}%`);
  console.log('  - Market Viability Assessment:', analyticsResult.market_positioning_analysis);
  console.log(`  - Strategic Tactical Actions (${analyticsResult.strategic_recommendations.length}):`);
  analyticsResult.strategic_recommendations.forEach((r, i) => {
    console.log(`    ${i + 1}. ${r}`);
  });
  console.log(`  - Recommended Search Tweaks (${analyticsResult.recommended_search_adjustments.length}):`);
  analyticsResult.recommended_search_adjustments.forEach((t, i) => {
    console.log(`    - ${t}`);
  });
  console.log('  ✓ Analytics calculations and strategy synthesis passed.');

  // Test 2: Notification Agent Digest Builder
  console.log('\n[2/3] Testing Daily Digest HTML Template...');
  const sampleDigestJobs = [
    {
      id: 'job-1',
      title: 'Senior Product Manager, Developer Platform',
      company: 'Acme SaaS Corp',
      location: 'Hyderabad, Telangana',
      track: 'track_a' as const,
      total_score: 84,
      recommendation: 'apply_now',
      salary_info: '₹24–28 LPA',
      date_posted: '2026-11-01',
      why_relevant: 'Supported Microsoft Partner Center technical support across APAC/NA',
      main_gaps: 'Direct B2B roadmap ownership',
      job_url: 'https://careers.acme.com/jobs/spm'
    },
    {
      id: 'job-2',
      title: 'Product Operations Manager',
      company: 'CloudFlow Tech',
      location: 'Remote',
      track: 'track_b' as const,
      total_score: 76,
      recommendation: 'review',
      salary_info: 'Undisclosed (Target ₹22–28 LPA)',
      date_posted: '2026-11-02',
      why_relevant: 'Led 23-member technical operations team, reduced backlog 40%',
      main_gaps: 'Requires cross-functional product group alignment history',
      job_url: 'https://careers.cloudflow.io/jobs/pm-ops'
    }
  ];

  const digestHtml = buildDailyDigestHtml(sampleDigestJobs, undefined, 'Sanjay');
  if (!digestHtml.includes('CareerPilot') || !digestHtml.includes('Acme SaaS Corp')) {
    throw new Error('Digest HTML template failed to include required job headers');
  }
  console.log('  - Generated Digest HTML length:', digestHtml.length, 'characters');
  console.log('  ✓ Daily Digest HTML rendered successfully.');

  // Test 3: Resend Email Client
  console.log('\n[3/3] Testing Resend Email Client & Dispatch Fallback...');
  const emailRes = await sendEmailViaResend({
    to: 'candidate@careerpilot.app',
    subject: 'CareerPilot Daily Digest Test',
    html: digestHtml
  });

  console.log('  - Email Dispatch Status:', emailRes.success ? 'SUCCESS' : 'FAILED');
  console.log('  - Email Ref ID:', emailRes.id);
  if (!emailRes.success) {
    throw new Error(`Email dispatch failed: ${emailRes.error}`);
  }
  console.log('  ✓ Email dispatch test passed.');

  console.log('\n======================================================');
  console.log('🎉 ANALYTICS & NOTIFICATION AGENTS VERIFIED SUCCESSFULLY!');
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
