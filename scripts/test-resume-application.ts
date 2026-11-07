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

import { runResumeAgent, generateAtsResumeHtml } from '../lib/agents/resume';
import { runApplicationAgent } from '../lib/agents/application';

async function main() {
  console.log('=== CareerPilot Milestone 3 Test: Resume & Application Agents ===\n');

  const mockVerifiedFacts = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      category: 'experience',
      fact: 'Digital Project Manager at Sonata Software supporting Microsoft Partner Center Technical Support across APAC and NA.'
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      category: 'leadership',
      fact: 'Led a 23-member technical operations team.'
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      category: 'impact',
      fact: 'Reduced open backlog by 40% through operational improvements and dependency management.'
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      category: 'project',
      fact: 'Built solo 0-to-1 AI PM interview coach (PMCoach.ai) with voice mocks using Next.js and Supabase.'
    }
  ];

  const sampleJob = {
    title: 'Senior Product Manager, Developer Platform',
    company: 'Acme SaaS Corp',
    description: `We are seeking a Senior Product Manager to lead our developer platform and API partner ecosystem.
Responsibilities:
- Streamline partner integrations and reduce developer friction.
- Prioritize product roadmaps and conduct customer problem discovery.
Requirements: 5+ years B2B SaaS, strong technical and operational background.`
  };

  // Test 1: Resume Agent Execution & Zero-Fabrication Enforcement
  console.log('[1/3] Testing Resume Agent & Fact-Grounding Verification...');
  const resumeResult = await runResumeAgent({
    jobTitle: sampleJob.title,
    company: sampleJob.company,
    jobDescription: sampleJob.description,
    verifiedFacts: mockVerifiedFacts
  });

  console.log('  - Tailored Summary:', `"${resumeResult.tailored_summary.slice(0, 90)}..."`);
  console.log(`  - Reordered Skills (${resumeResult.reordered_skills.length}):`, resumeResult.reordered_skills.slice(0, 5));
  console.log(`  - Experience Bullets Anchored to Fact IDs (${resumeResult.experience_bullets.length}):`);
  resumeResult.experience_bullets.forEach((b, i) => {
    console.log(`    ${i + 1}. [Fact ID: ${b.fact_id.slice(0, 8)}...] ${b.bullet.slice(0, 75)}...`);
  });
  console.log(`  - Project Bullets Anchored to Fact IDs (${resumeResult.project_bullets.length}):`);
  resumeResult.project_bullets.forEach((b, i) => {
    console.log(`    ${i + 1}. [Fact ID: ${b.fact_id.slice(0, 8)}...] ${b.bullet.slice(0, 75)}...`);
  });
  console.log(`  - Unverified Claims Prevented (${resumeResult.unverified_claims_prevented.length}):`, resumeResult.unverified_claims_prevented);

  // Assert all bullets cite verified IDs
  const validIds = new Set(mockVerifiedFacts.map(f => f.id));
  for (const b of [...resumeResult.experience_bullets, ...resumeResult.project_bullets]) {
    if (!validIds.has(b.fact_id)) {
      throw new Error(`Hallucinated fact ID escaped verification guard: ${b.fact_id}`);
    }
  }
  console.log('  ✓ Anti-hallucination fact grounding strictly verified.');

  // Test 2: ATS HTML Document Generation
  console.log('\n[2/3] Testing ATS HTML & Plain-Text Formatter...');
  if (!resumeResult.html_export.includes('<!DOCTYPE html>') || !resumeResult.html_export.includes('Professional Summary')) {
    throw new Error('ATS HTML export format invalid');
  }
  if (!resumeResult.plain_text_export.includes('SUMMARY:')) {
    throw new Error('Plain text export format invalid');
  }
  console.log('  - HTML Export length:', resumeResult.html_export.length, 'characters');
  console.log('  - Plain Text Export length:', resumeResult.plain_text_export.length, 'characters');
  console.log('  ✓ ATS document exports generated cleanly.');

  // Test 3: Application Agent & Human Gate Check
  console.log('\n[3/3] Testing Application Agent & Human Gate Policy...');
  const appResult = await runApplicationAgent({
    jobId: '10000000-0000-0000-0000-000000000001',
    jobTitle: sampleJob.title,
    company: sampleJob.company,
    jobUrl: 'https://careers.acme.com/jobs/spm',
    jobDescription: sampleJob.description,
    verifiedFacts: mockVerifiedFacts,
    profile: {
      notice_period_days: 90,
      target_ctc_min_lpa: 24,
      target_ctc_max_lpa: 28,
      preferred_locations: ['Bengaluru', 'Hyderabad']
    }
  });

  console.log('  - Application Initial Status:', appResult.status);
  console.log('  - Approved by User:', appResult.approved_by_user);
  console.log('  - Next Action:', appResult.next_action);
  console.log('  - Cover Letter Preview:', `"${appResult.cover_letter.slice(0, 100)}..."`);
  console.log(`  - Drafted Questions (${appResult.answers.length}):`);
  appResult.answers.forEach((a, i) => {
    console.log(`    Q${i + 1}: ${a.question.slice(0, 50)}...`);
    console.log(`    A${i + 1}: ${a.answer.slice(0, 75)}...`);
  });

  // Verify Requirement 9: Never submit an application automatically without explicit user approval
  if (appResult.status === 'applied' || appResult.approved_by_user === true) {
    throw new Error('VIOLATION: Application marked as applied or approved without user action!');
  }
  console.log('  ✓ Human gate verified: Application is strictly kept in "prepared" status awaiting approval.');

  console.log('\n======================================================');
  console.log('🎉 RESUME & APPLICATION AGENTS VERIFIED SUCCESSFULLY!');
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
