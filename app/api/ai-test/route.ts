import { NextResponse } from 'next/server';
import {
  analyzeJobDescription,
  analyzeCandidateJobMatch,
  tailorResumeForJob,
  generateCareerInsights
} from '@/lib/ai/agents';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sampleJD = `
      Senior Product Manager, Developer Platform
      Acme SaaS Corp - Bengaluru (Hybrid)
      We are seeking a Senior Product Manager with 5+ years experience in B2B SaaS, API integrations, and developer platforms.
      Responsibilities:
      - Lead partner ecosystem integration strategy and API developer experience.
      - Streamline partner portal workflows and reduce onboarding friction.
      Requirements:
      - Proven problem discovery, PRD writing, and metrics-driven execution.
      - Hands-on experience with REST APIs and cloud platforms.
      Compensation: 24-28 LPA.
    `;

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

    // 1. Run JD Analysis
    const jobAnalysis = await analyzeJobDescription(sampleJD, {
      title: 'Senior Product Manager, Developer Platform',
      company: 'Acme SaaS Corp'
    });

    // 2. Run Candidate-Job Matching
    const jobMatch = await analyzeCandidateJobMatch({
      profile: mockProfile,
      verifiedFacts: mockVerifiedFacts,
      job: jobAnalysis
    });

    // 3. Run Resume Tailoring
    const tailoredResume = await tailorResumeForJob({
      resumeText: '9+ years experience. Led 23 members at Sonata. Reduced backlog 40%. Built PMCoach.ai.',
      jobDescription: sampleJD,
      verifiedFacts: mockVerifiedFacts
    });

    // 4. Run Career Insights
    const careerInsights = await generateCareerInsights({
      profile: mockProfile,
      verifiedFacts: mockVerifiedFacts,
      recentMatches: [
        {
          title: jobAnalysis.title,
          company: jobAnalysis.company,
          fit_score: jobMatch.fit_score,
          gaps: jobMatch.gaps
        }
      ]
    });

    return NextResponse.json({
      status: 'success',
      provider: 'Google Gemini (@google/genai)',
      target_model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      results: {
        job_description_analysis: jobAnalysis,
        candidate_job_match: jobMatch,
        tailored_resume: tailoredResume,
        career_insights: careerInsights
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}
