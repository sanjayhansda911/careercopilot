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

import { normalizeJobUrl, detectWorkMode } from '../lib/adapters/ats';
import { calculateWeightedScore, runIntelligenceAgent } from '../lib/agents/intelligence';

async function main() {
  console.log('=== CareerPilot Milestone 2 Test: Discovery & Intelligence Agents ===\n');

  // Test 1: ATS URL Normalization & Work Mode Detection
  console.log('[1/4] Testing URL Normalization & Work Mode Detection...');
  const testUrl = 'https://jobs.lever.co/figma/12345/?utm_source=linkedin&ref=talent#apply';
  const cleanUrl = normalizeJobUrl(testUrl);
  console.log(`  Raw URL:        ${testUrl}`);
  console.log(`  Normalized URL: ${cleanUrl}`);
  if (cleanUrl !== 'https://jobs.lever.co/figma/12345') {
    throw new Error('URL normalization failed to strip utm params or trailing hashes');
  }
  console.log('  ✓ URL Normalization passed.');

  const modeRemote = detectWorkMode('Senior Product Manager - 100% Remote (India)');
  const modeHybrid = detectWorkMode('Product Lead - Hybrid 3 days in office Bengaluru');
  console.log(`  Detected remote mode: ${modeRemote}`);
  console.log(`  Detected hybrid mode: ${modeHybrid}`);
  if (modeRemote !== 'remote' || modeHybrid !== 'hybrid') {
    throw new Error('Work mode detection failed');
  }
  console.log('  ✓ Work Mode detection passed.\n');

  // Test 2: Deterministic 7-Factor Weighted Scoring
  console.log('[2/4] Testing Deterministic 7-Factor Weighted Scoring (TypeScript)...');
  const mockProfile = {
    total_experience_years: 9,
    current_title: 'Digital Project Manager',
    current_company: 'Sonata Software',
    target_ctc_min_lpa: 22,
    target_ctc_max_lpa: 28,
    notice_period_days: 90,
    preferred_locations: ['Bengaluru', 'Hyderabad'],
    preferred_work_modes: ['hybrid', 'remote'],
    target_roles: ['Product Manager', 'Platform Product Manager'],
    target_domains: ['B2B SaaS', 'Cloud platforms', 'Partner ecosystems'],
    skills: ['PRDs', 'Customer problem discovery', 'API workflows', 'Prompt engineering']
  };

  const mockFacts = [
    {
      id: 'f1',
      category: 'experience',
      fact: 'Digital Project Manager supporting Microsoft Partner Center Technical Support across APAC and NA.'
    },
    {
      id: 'f2',
      category: 'leadership',
      fact: 'Led a 23-member technical operations team.'
    },
    {
      id: 'f3',
      category: 'impact',
      fact: 'Reduced open backlog by 40% through operational improvements.'
    }
  ];

  const sampleJobWithSalary = {
    title: 'Senior Product Manager, Developer Ecosystem',
    company: 'Acme SaaS',
    description: 'We are seeking a Senior Product Manager to lead our developer ecosystem, API integrations, and B2B SaaS platform. Responsibilities include customer problem discovery, writing PRDs, and roadmap execution.',
    location: 'Bengaluru',
    work_mode: 'hybrid',
    salary_min_lpa: 24,
    salary_max_lpa: 28
  };

  const scoreWithSalary = calculateWeightedScore(sampleJobWithSalary, mockProfile, mockFacts);
  console.log(`  - Overall Score: ${scoreWithSalary.total}/100`);
  console.log(`  - Recommendation: ${scoreWithSalary.recommendation}`);
  console.log(`  - Confidence: ${scoreWithSalary.confidence}`);
  console.log(`  - Criterion Breakdown:`, scoreWithSalary.breakdown);

  if (scoreWithSalary.total < 60 || scoreWithSalary.total > 100) {
    throw new Error(`Invalid total score: ${scoreWithSalary.total}`);
  }
  console.log('  ✓ 7-Factor scoring calculation passed.\n');

  // Test 3: Unknown Salary Handling (Requirement 5: Do not assume missing salary is a mismatch)
  console.log('[3/4] Testing Unknown Salary Handling Rule...');
  const sampleJobWithoutSalary = {
    ...sampleJobWithSalary,
    salary_min_lpa: null,
    salary_max_lpa: null
  };

  const scoreWithoutSalary = calculateWeightedScore(sampleJobWithoutSalary, mockProfile, mockFacts);
  console.log(`  - Score with undisclosed salary: ${scoreWithoutSalary.total}/100`);
  console.log(`  - Compensation Score: ${scoreWithoutSalary.breakdown.compensation}/15`);
  console.log(`  - Confidence Level: ${scoreWithoutSalary.confidence}`);
  console.log(`  - Note: ${scoreWithoutSalary.compensationNote}`);

  if (scoreWithoutSalary.confidence !== 'medium' || scoreWithoutSalary.breakdown.compensation === 0) {
    throw new Error('Missing salary was penalized as confirmed mismatch');
  }
  console.log('  ✓ Unknown salary rule properly implemented.\n');

  // Test 4: Full Intelligence Agent with Gemini Semantic Analysis
  console.log('[4/4] Testing Live Intelligence Agent (Gemini Semantic Analysis)...');
  const intelligenceResult = await runIntelligenceAgent({
    job: sampleJobWithSalary,
    profile: mockProfile,
    verifiedFacts: mockFacts
  });

  console.log('  - Fit Score:', `${intelligenceResult.total_score}/100 (${intelligenceResult.recommendation})`);
  console.log('  - Executive Summary:', intelligenceResult.summary);
  console.log('  - Strengths (Fact-Grounded):', intelligenceResult.strengths);
  console.log('  - Transferable Skills:', intelligenceResult.transferable_skills);
  console.log('  - Missing Skills:', intelligenceResult.missing_skills);
  console.log('  - Interview Topics:', intelligenceResult.interview_topics);
  console.log('\n======================================================');
  console.log('🎉 DISCOVERY & INTELLIGENCE AGENTS VERIFIED SUCCESSFULLY!');
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
