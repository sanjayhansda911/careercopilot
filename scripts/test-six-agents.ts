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

console.log('================================================================');
console.log('🚀 CAREERPILOT SIX-AGENT SYSTEM FULL END-TO-END VERIFICATION');
console.log('================================================================\n');

import { ingestManualJob } from '../lib/agents/discovery';
import { runIntelligenceAgent } from '../lib/agents/intelligence';
import { runResumeAgent } from '../lib/agents/resume';
import { runApplicationAgent, approveAndSubmitApplication } from '../lib/agents/application';
import { runAnalyticsAgent } from '../lib/agents/analytics';
import { runNotificationAgent } from '../lib/agents/notification';
import { runOrchestrator } from '../lib/agents/orchestrator';

async function runEndToEndVerification() {
  const testUserId = '00000000-0000-0000-0000-000000000001';

  const verifiedFacts = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      category: 'experience',
      fact: 'Digital Project Manager at Sonata Software Ltd, supporting Microsoft Partner Center Technical Support across APAC and North America.',
      metric_value: null
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      category: 'leadership',
      fact: 'Led a 23-member technical operations team.',
      metric_value: '23'
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      category: 'impact',
      fact: 'Reduced open backlog by 40% through operational improvements and dependency management.',
      metric_value: '40%'
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      category: 'project',
      fact: 'Built solo 0-to-1 AI PM interview coach (PMCoach.ai) with voice mocks using Next.js and Supabase.',
      metric_value: null
    }
  ];

  const candidateProfile = {
    user_id: testUserId,
    total_experience_years: 9,
    current_title: 'Digital Project Manager',
    current_company: 'Sonata Software Ltd',
    target_ctc_min_lpa: 24,
    target_ctc_max_lpa: 28,
    notice_period_days: 90,
    preferred_locations: ['Bengaluru', 'Hyderabad'],
    preferred_work_modes: ['hybrid', 'remote'],
    target_roles: ['Product Manager', 'Platform Product Manager', 'Product Operations Manager'],
    target_domains: ['B2B SaaS', 'Cloud platforms', 'Partner ecosystems'],
    skills: ['Customer problem discovery', 'PRDs', 'API workflows', 'Prompt engineering']
  };

  // -------------------------------------------------------------------------
  // Agent 1: Discovery Agent
  // -------------------------------------------------------------------------
  console.log('>>> [Agent 1/6: Discovery Agent]');
  const samplePosting = {
    title: 'Senior Product Manager - Developer Platform',
    company: 'Stripe SaaS Ecosystem',
    job_url: 'https://careers.stripe.com/jobs/spm-platform?utm_source=linkedin&ref=partner#apply',
    location: 'Bengaluru / Hybrid',
    work_mode: 'hybrid' as const,
    description: `Stripe is hiring a Senior Product Manager to lead our partner developer platform.
Responsibilities:
- Streamline partner integrations and reduce developer friction across API workflows.
- Partner with solutions architects and cross-functional teams to eliminate operational backlogs.
- Prioritize product roadmaps and author PRDs based on developer feedback.
Requirements:
- 5+ years experience in B2B SaaS, developer platforms, or technical operations.
- Strong leadership skills managing cross-functional initiatives.
Compensation: 26 - 30 LPA.`,
    salary_min_lpa: 26,
    salary_max_lpa: 30,
    salary_confidence: 'advertised' as const,
    userId: testUserId
  };

  const discovery = await ingestManualJob(samplePosting);
  console.log('  ✓ Ingested Job ID:', discovery.job.id);
  console.log('  ✓ Normalized Canonical URL:', discovery.job.canonical_url);
  console.log('  ✓ Is New Record:', discovery.isNew);
  console.log('  ✓ Status:', discovery.job.status);

  // -------------------------------------------------------------------------
  // Agent 2: Intelligence Agent
  // -------------------------------------------------------------------------
  console.log('\n>>> [Agent 2/6: Intelligence Agent]');
  const intelligence = await runIntelligenceAgent({
    job: discovery.job,
    profile: candidateProfile,
    verifiedFacts
  });
  console.log(`  ✓ 7-Factor Fit Score: ${intelligence.total_score}/100 (${intelligence.recommendation})`);
  console.log('  ✓ Confidence Level:', intelligence.confidence_level);
  console.log('  ✓ Score Breakdown (Max 100):', intelligence.score_breakdown);
  console.log('  ✓ Fact-Grounded Strengths:', intelligence.strengths.slice(0, 2));
  console.log('  ✓ Transferable Skills:', intelligence.transferable_skills.slice(0, 2));
  console.log('  ✓ Missing Skills / Gaps:', intelligence.missing_skills.slice(0, 2));

  // -------------------------------------------------------------------------
  // Agent 3: Resume Agent
  // -------------------------------------------------------------------------
  console.log('\n>>> [Agent 3/6: Resume Agent]');
  const resume = await runResumeAgent({
    userId: testUserId,
    jobId: discovery.job.id,
    jobTitle: discovery.job.title,
    company: discovery.job.company,
    jobDescription: discovery.job.description,
    verifiedFacts
  });
  console.log('  ✓ Tailored Summary:', `"${resume.tailored_summary.slice(0, 80)}..."`);
  console.log(`  ✓ Experience Bullets Anchored to Fact IDs (${resume.experience_bullets.length}):`);
  resume.experience_bullets.forEach((b, i) => {
    console.log(`    ${i + 1}. [Fact ID: ${b.fact_id.slice(0, 8)}...] ${b.bullet.slice(0, 70)}...`);
  });
  console.log(`  ✓ Unverified Claims Prevented by Guard (${resume.unverified_claims_prevented.length}):`, resume.unverified_claims_prevented);
  console.log('  ✓ ATS HTML Export Length:', resume.html_export.length, 'chars');

  // Strict anti-hallucination validation check
  const factIdSet = new Set(verifiedFacts.map(f => f.id));
  for (const b of [...resume.experience_bullets, ...resume.project_bullets]) {
    if (!factIdSet.has(b.fact_id)) {
      throw new Error(`Fabrication violation: Bullet references non-existent fact ID (${b.fact_id})`);
    }
  }

  // -------------------------------------------------------------------------
  // Agent 4: Application Agent & Human Gate
  // -------------------------------------------------------------------------
  console.log('\n>>> [Agent 4/6: Application Agent]');
  const application = await runApplicationAgent({
    userId: testUserId,
    jobId: discovery.job.id!,
    jobTitle: discovery.job.title,
    company: discovery.job.company,
    jobUrl: discovery.job.job_url,
    jobDescription: discovery.job.description,
    tailoredDocumentId: resume.documentId,
    verifiedFacts,
    profile: candidateProfile
  });
  console.log('  ✓ Initial Status (Human Gate Enforced):', application.status);
  console.log('  ✓ Approved by User:', application.approved_by_user);
  console.log('  ✓ Next Required Action:', application.next_action);
  console.log(`  ✓ Application Questions Drafted (${application.answers.length})`);

  if (application.status === 'applied') {
    throw new Error('VIOLATION: Application auto-submitted without explicit human approval!');
  }

  // Simulate explicit human approval
  if (application.id) {
    const approval = await approveAndSubmitApplication({
      applicationId: application.id,
      userId: testUserId,
      markAsApplied: true,
      notes: 'Explicit candidate verification completed via UI modal.'
    });
    console.log('  ✓ Human Approval Confirmed! New Status:', approval.newStatus);
    console.log('  ✓ Audit Log ID:', approval.auditId);
  }

  // -------------------------------------------------------------------------
  // Agent 5: Analytics Agent
  // -------------------------------------------------------------------------
  console.log('\n>>> [Agent 5/6: Analytics Agent]');
  const analytics = await runAnalyticsAgent({ userId: testUserId });
  console.log('  ✓ Conversion Metrics:');
  console.log(`    Total Discovered: ${analytics.metrics.totalJobsDiscovered}`);
  console.log(`    Evaluated Matches: ${analytics.metrics.totalMatchesEvaluated}`);
  console.log(`    Qualification Rate: ${analytics.metrics.conversionRates.qualificationRate}%`);
  console.log('  ✓ Strategic Recommendations:');
  analytics.strategic_recommendations.slice(0, 2).forEach((r, i) => {
    console.log(`    ${i + 1}. ${r}`);
  });

  // -------------------------------------------------------------------------
  // Agent 6: Notification Agent
  // -------------------------------------------------------------------------
  console.log('\n>>> [Agent 6/6: Notification Agent]');
  const notif = await runNotificationAgent({
    userId: testUserId,
    userEmail: 'candidate@careerpilot.app',
    triggerType: 'daily_digest'
  });
  console.log('  ✓ In-App Notifications Created:', notif.notificationsCreated);
  console.log('  ✓ Email Dispatch Status:', notif.emailStatus);
  console.log('  ✓ Digest Items Included:', notif.digestItemsCount);

  // -------------------------------------------------------------------------
  // Central Orchestrator
  // -------------------------------------------------------------------------
  console.log('\n>>> [Central Orchestrator Coordination Check]');
  const orchSummary = await runOrchestrator({
    userId: testUserId,
    triggerSource: 'test',
    maxJobsToAnalyze: 2
  });
  console.log('  ✓ Orchestrator Run ID:', orchSummary.runId);
  console.log('  ✓ Orchestrator Status:', orchSummary.status);
  console.log('  ✓ Duration:', `${orchSummary.durationMs}ms`);

  console.log('\n================================================================');
  console.log('🎉 ALL SIX AGENTS & ORCHESTRATOR VERIFIED WITH ZERO ERRORS!');
  console.log('================================================================\n');
}

runEndToEndVerification().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
