import fs from 'fs';
import path from 'path';

// 1. Manually load .env.local if present
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

console.log('--- CareerPilot Gemini AI Agent Test Suite ---');
console.log('Target Model (from GEMINI_MODEL):', process.env.GEMINI_MODEL || 'gemini-3.8-flash');
console.log('API Key Detected:', Boolean(process.env.GEMINI_API_KEY));

import {
  analyzeJobDescription,
  analyzeCandidateJobMatch,
  tailorResumeForJob,
  generateCareerInsights
} from '../lib/ai/agents';

async function runTests() {
  console.log('\n[1/4] Testing Job Description Analysis Agent...');
  const sampleJD = `
    Senior Product Manager, Developer Platform
    Acme SaaS Corp - Bengaluru (Hybrid)
    We are seeking a Senior Product Manager with 5+ years experience in B2B SaaS, API integrations, and partner developer platforms.
    Responsibilities:
    - Lead partner ecosystem integration strategy and API developer experience.
    - Reduce developer onboarding friction and streamline partner portal workflows.
    - Partner with engineering, solutions architecture, and customer success.
    Requirements:
    - Proven problem discovery, PRD writing, and metrics-driven execution.
    - Hands-on experience with REST APIs, webhooks, and cloud platforms.
    - Bachelor's degree in CS or equivalent.
    Compensation: 24-28 LPA.
  `;

  try {
    const parsedJob = await analyzeJobDescription(sampleJD, {
      title: 'Senior Product Manager, Developer Platform',
      company: 'Acme SaaS Corp'
    });
    console.log('✓ Successfully parsed job description:');
    console.log(`  - Title: ${parsedJob.title}`);
    console.log(`  - Seniority: ${parsedJob.seniority_level}`);
    console.log(`  - Work Mode: ${parsedJob.work_mode}`);
    console.log(`  - Salary Range: ${parsedJob.salary_min_lpa} - ${parsedJob.salary_max_lpa} LPA (${parsedJob.salary_confidence})`);
    console.log(`  - Required Skills (${parsedJob.required_skills.length}):`, parsedJob.required_skills.slice(0, 5));

    console.log('\n[2/4] Testing Candidate-Job Matching Agent...');
    const mockProfile = {
      target_track: 'product_management',
      total_experience_years: 9,
      current_title: 'Digital Project Manager',
      current_company: 'Sonata Software',
      target_roles: ['Product Manager', 'Platform Product Manager'],
      skills: ['Problem framing', 'PRDs', 'API workflows', 'Partner ecosystems']
    };

    const mockVerifiedFacts = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        category: 'experience',
        fact: 'Digital Project Manager at Sonata Software supporting Microsoft Partner Center Technical Support across APAC and NA.',
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
        fact: 'PMCoach.ai: built solo 0-to-1 AI PM interview coach with voice mocks using Next.js and Supabase.',
        metric_value: null
      }
    ];

    const matchResult = await analyzeCandidateJobMatch({
      profile: mockProfile,
      verifiedFacts: mockVerifiedFacts,
      job: parsedJob
    });
    console.log('✓ Successfully evaluated match:');
    console.log(`  - Fit Score: ${matchResult.fit_score}/100`);
    console.log(`  - Recommendation: ${matchResult.recommendation}`);
    console.log(`  - Strengths (${matchResult.strengths.length}):`, matchResult.strengths.slice(0, 3));
    console.log(`  - Gaps (${matchResult.gaps.length}):`, matchResult.gaps.slice(0, 3));
    console.log(`  - Score breakdown:`, matchResult.score_breakdown);

    console.log('\n[3/4] Testing Fact-Grounded Resume Tailoring Agent...');
    const tailoredResume = await tailorResumeForJob({
      resumeText: '9+ years experience. Led 23 members at Sonata. Reduced backlog 40%. Built PMCoach.ai.',
      jobDescription: sampleJD,
      verifiedFacts: mockVerifiedFacts
    });
    console.log('✓ Successfully generated fact-grounded resume:');
    console.log(`  - Tailored Summary: "${tailoredResume.tailored_summary.slice(0, 90)}..."`);
    console.log(`  - Experience Bullets (${tailoredResume.experience_bullets.length}):`);
    tailoredResume.experience_bullets.forEach((b, i) => {
      console.log(`    ${i + 1}. [Fact ID: ${b.fact_id}] ${b.bullet.slice(0, 80)}...`);
    });
    console.log(`  - Project Bullets (${tailoredResume.project_bullets.length}):`);
    tailoredResume.project_bullets.forEach((b, i) => {
      console.log(`    ${i + 1}. [Fact ID: ${b.fact_id}] ${b.bullet.slice(0, 80)}...`);
    });
    console.log(`  - Unverified claims prevented:`, tailoredResume.unverified_claims_prevented);

    console.log('\n[4/4] Testing Career Insights Agent...');
    const insights = await generateCareerInsights({
      profile: mockProfile,
      verifiedFacts: mockVerifiedFacts,
      recentMatches: [
        {
          title: parsedJob.title,
          company: parsedJob.company,
          fit_score: matchResult.fit_score,
          gaps: matchResult.gaps
        }
      ]
    });
    console.log('✓ Successfully generated career insights:');
    console.log(`  - Market Readiness Score: ${insights.overall_market_readiness_score}/100`);
    console.log(`  - Strategic Positioning: "${insights.strategic_positioning.slice(0, 90)}..."`);
    console.log(`  - Actionable Next Steps (${insights.actionable_next_steps.length}):`, insights.actionable_next_steps.slice(0, 3));

    console.log('\n======================================================');
    console.log('🎉 ALL 4 GOOGLE GEMINI AI AGENTS VERIFIED SUCCESSFULLY!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  }
}

runTests();
