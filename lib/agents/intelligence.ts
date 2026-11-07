import { getSupabaseAdmin } from '@/lib/supabase/server';
import { JobRecord } from '@/lib/schemas/job';
import {
  DEFAULT_SCORING_WEIGHTS,
  ScoringWeights,
  ScoreBreakdown,
  RecommendationCategory,
  IntelligenceMatchResult
} from '@/lib/schemas/match';
import { analyzeJobDescription, JobAnalysis } from '@/lib/ai/agents';
import { generateStructuredJson } from '@/lib/ai/gemini';
import { z } from 'zod';

import { classifyJobTrack, JobTrack } from './discovery';

export interface IntelligenceAgentOptions {
  job: {
    id?: string;
    title: string;
    company: string;
    description: string;
    location?: string | null;
    work_mode?: string | null;
    salary_min_lpa?: number | null;
    salary_max_lpa?: number | null;
    track?: JobTrack;
  };
  profile: {
    user_id?: string;
    total_experience_years?: number | null;
    current_title?: string | null;
    current_company?: string | null;
    target_ctc_min_lpa?: number | null;
    target_ctc_max_lpa?: number | null;
    notice_period_days?: number | null;
    preferred_locations?: string[];
    preferred_work_modes?: string[];
    target_roles?: string[];
    target_domains?: string[];
    skills?: string[];
  };
  verifiedFacts: Array<{
    id: string;
    category: string;
    fact: string;
    metric_value?: string | null;
  }>;
  weights?: Partial<ScoringWeights>;
  searchRunId?: string;
}

const SemanticIntelligenceSchema = z.object({
  summary: z.string().nullish().transform(v => v || ''),
  executive_summary: z.string().nullish(),
  strengths: z.array(z.string()).nullish().transform(v => v || []),
  verified_supporting_facts: z.array(z.string()).nullish().transform(v => v || []),
  transferable_skills: z.array(z.string()).nullish().transform(v => v || []),
  missing_skills: z.array(z.string()).nullish().transform(v => v || []),
  unmet_requirements: z.array(z.string()).nullish().transform(v => v || []),
  gaps: z.array(z.string()).nullish().transform(v => v || []),
  transition_type: z.string().nullish().transform(v => v || 'Track A – Direct Product Management'),
  compensation_attractiveness: z.string().nullish().transform(v => v || 'Standard market compensation.'),
  verdict: z.string().nullish().transform(v => v || 'Recommended to review.'),
  interview_topics: z.array(z.string()).nullish().transform(v => v || []),
  matching_evidence: z.record(z.unknown()).nullish().transform(v => v || {})
}).transform(d => ({
  ...d,
  summary: d.summary || d.executive_summary || 'Candidate evaluation complete.'
}));

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#. ]/g, ' ').replace(/\s+/g, ' ').trim();

function phraseMatches(phrases: string[], text: string): string[] {
  const t = normalize(text);
  return [...new Set(phrases)].filter(p => p.trim().length > 2 && t.includes(normalize(p)));
}

/**
 * Deterministic 7-factor weighted scoring calculation in pure TypeScript.
 */
export function calculateWeightedScore(
  job: IntelligenceAgentOptions['job'],
  profile: IntelligenceAgentOptions['profile'],
  verifiedFacts: IntelligenceAgentOptions['verifiedFacts'],
  customWeights?: Partial<ScoringWeights>
): {
  total: number;
  breakdown: ScoreBreakdown;
  recommendation: RecommendationCategory;
  confidence: 'high' | 'medium' | 'low';
  compensationNote: string;
} {
  const weights: ScoringWeights = { ...DEFAULT_SCORING_WEIGHTS, ...customWeights };
  const text = `${job.title} ${job.description}`;
  const normText = normalize(text);

  // 1. Experience & Skills (25%)
  const profileSkills = profile.skills || [];
  const factTexts = verifiedFacts.map(f => f.fact);
  const allCandidateSkills = [...profileSkills, ...factTexts];
  const skillHits = phraseMatches(allCandidateSkills, text);
  const baselineCount = Math.max(1, Math.min(profileSkills.length, 8));
  const skillRatio = Math.min(1, skillHits.length / baselineCount);
  const skillScore = Math.round(skillRatio * weights.experience_skills);

  // 2. Role Seniority (20%)
  const targetRoles = profile.target_roles || [];
  const roleHits = phraseMatches(targetRoles, job.title);
  const isSeniorJob = /senior|lead|principal|group|director|head|vp/i.test(job.title);
  const candidateYears = profile.total_experience_years || 0;
  let seniorityScore = 12;
  if (roleHits.length > 0) {
    seniorityScore = candidateYears >= 8 ? weights.role_seniority : Math.round(weights.role_seniority * 0.85);
  } else if (isSeniorJob) {
    seniorityScore = candidateYears >= 7 ? Math.round(weights.role_seniority * 0.75) : Math.round(weights.role_seniority * 0.5);
  } else {
    seniorityScore = Math.round(weights.role_seniority * 0.65);
  }

  // 3. Domain Relevance (15%)
  const targetDomains = profile.target_domains || [];
  const domainHits = phraseMatches(targetDomains, text);
  const domainRatio = Math.min(1, domainHits.length / Math.max(1, Math.min(targetDomains.length, 3)));
  const domainScore = Math.round(domainRatio * weights.domain_relevance);

  // 4. Compensation (15%)
  // Rule: Do not assume missing salary information is a confirmed mismatch. Mark salary as unknown and reflect in confidence.
  let compensationScore = 0;
  let compensationConfidence: 'high' | 'medium' | 'low' = 'high';
  let compensationNote = '';

  const maxSalary = job.salary_max_lpa;
  const targetMin = profile.target_ctc_min_lpa || 22;

  if (maxSalary == null || maxSalary === 0) {
    // Missing salary: award neutral baseline score, lower confidence
    compensationScore = Math.round(weights.compensation * 0.6); // e.g. 9 out of 15
    compensationConfidence = 'medium';
    compensationNote = 'Salary undisclosed in job posting; neutral baseline applied.';
  } else if (maxSalary >= targetMin) {
    compensationScore = weights.compensation; // full score 15
    compensationConfidence = 'high';
    compensationNote = `Advertised salary (${maxSalary} LPA) meets or exceeds candidate target (${targetMin} LPA).`;
  } else if (maxSalary >= targetMin * 0.85) {
    compensationScore = Math.round(weights.compensation * 0.6);
    compensationConfidence = 'high';
    compensationNote = `Advertised salary (${maxSalary} LPA) is within 15% of candidate minimum.`;
  } else {
    compensationScore = Math.round(weights.compensation * 0.2);
    compensationConfidence = 'high';
    compensationNote = `Advertised salary (${maxSalary} LPA) is below candidate target (${targetMin} LPA).`;
  }

  // 5. Leadership Scope (10%)
  const hasLeadershipKeywords = /lead|manage|head|stakeholder|roadmap|strategy|cross.functional|team|director/i.test(job.description);
  const hasLeadershipFacts = verifiedFacts.some(f => f.category === 'leadership' || /led|managed|team/i.test(f.fact));
  let leadershipScore = 5;
  if (hasLeadershipKeywords && hasLeadershipFacts) {
    leadershipScore = weights.leadership_scope;
  } else if (!hasLeadershipKeywords) {
    leadershipScore = Math.round(weights.leadership_scope * 0.8);
  }

  // 6. Location & Work Mode (10%) - Hyderabad & India Remote priority
  const isHyderabad = /hyderabad/i.test(job.location || '') || /hyderabad/i.test(text);
  const isRemote = /remote/i.test(job.work_mode || '') || /remote/i.test(job.location || '') || /remote/i.test(job.description);
  const isTier2Loc = /bengaluru|bangalore|pune/i.test(job.location || '') || /bengaluru|bangalore|pune/i.test(text);
  const isOtherIndiaLoc = /delhi|noida|gurgaon|gurugram|mumbai|chennai/i.test(job.location || '') || /delhi|noida|gurgaon|gurugram|mumbai|chennai/i.test(text);

  let locationScore = 4;
  if (isHyderabad || isRemote) {
    locationScore = weights.location_work_mode; // 10
  } else if (isTier2Loc) {
    locationScore = Math.round(weights.location_work_mode * 0.8); // 8
  } else if (isOtherIndiaLoc) {
    locationScore = Math.round(weights.location_work_mode * 0.6); // 6
  }

  // 7. Notice Period (5%)
  const candidateNotice = profile.notice_period_days || 90;
  // 90-day standard notice compatibility: 5 if notice fits standard enterprise cycles or flexible, 3 if tight
  const noticeScore = candidateNotice <= 60 ? weights.notice_period : Math.round(weights.notice_period * 0.7);

  const breakdown: ScoreBreakdown = {
    experience_skills: skillScore,
    role_seniority: seniorityScore,
    domain_relevance: domainScore,
    compensation: compensationScore,
    leadership_scope: leadershipScore,
    location_work_mode: locationScore,
    notice_period: noticeScore
  };

  const total = Math.min(100, Math.max(0, Object.values(breakdown).reduce((a, b) => a + b, 0)));

  let recommendation: RecommendationCategory = 'ignore';
  if (total >= 80) recommendation = 'apply_now';
  else if (total >= 65) recommendation = 'review';
  else if (total >= 50) recommendation = 'stretch';
  else recommendation = 'ignore';

  return {
    total,
    breakdown,
    recommendation,
    confidence: compensationConfidence,
    compensationNote
  };
}

/**
 * Agent 2: Intelligence Agent
 * Combines deterministic 7-factor scoring with executive recruiter semantic analysis.
 */
export async function runIntelligenceAgent(
  options: IntelligenceAgentOptions
): Promise<IntelligenceMatchResult> {
  const startTime = Date.now();
  const db = getSupabaseAdmin();

  // 1. Determine Track
  const assignedTrack: JobTrack = options.job.track || classifyJobTrack(options.job.title, options.job.description);

  // 2. Calculate deterministic numerical score
  const scoreResult = calculateWeightedScore(
    options.job,
    options.profile,
    options.verifiedFacts,
    options.weights
  );

  // 3. Run Gemini for recruiter-level semantic analysis across the 6 dimensions
  const prompt = `You are CareerPilot's executive talent recruiter analyzing a job opportunity for a candidate's career transition.

Target Job:
Title: ${options.job.title}
Company: ${options.job.company}
Location: ${options.job.location || 'Unspecified'}
Classified Track: ${assignedTrack === 'track_a' ? 'Track A – Direct Product Management' : assignedTrack === 'track_b' ? 'Track B – Product-Adjacent' : 'Track C – Senior Technology & Partner Operations'}
Description:
${options.job.description.slice(0, 3500)}

Candidate Profile & Source of Truth:
Current: ${options.profile.current_title || 'Team Manager / Digital Project Manager'} at ${options.profile.current_company || 'Sonata Software'} (${options.profile.total_experience_years || 10} years total, 4 years management)
Core Domain: Microsoft Partner Center Technical Support, Microsoft Cloud Solution Provider (CSP) ecosystem, REST APIs, GDAP security workspace, partner sandboxes, partner enablement.
Leadership: Directly leads a 20-23 person technical operations team; SLA compliance, CSAT, 40% backlog reduction, QBRs.
Product Foundation: Completed HelloPM AI Product Management programme; independently built AI product prototypes (PMCoach.ai, Nagrik). PRDs, JTBD, MVP scoping.
Target CTC: ₹22–28 LPA (current ₹14.55 LPA, target take-home ~₹2L/month). Notice: 90 days. Primary location: Hyderabad & India Remote.

CRITICAL RULES:
- The candidate has strong product-adjacent experience but has NOT held a conventional full-time PM title.
- Do NOT represent operational experience as formal PM experience.
- Never flatter or fabricate evidence. Be selective, honest, and evidence-driven.
- Do not recommend senior PM roles requiring 5+ years of roadmap and commercial P&L ownership.

Instructions:
Return a JSON object with this exact structure:
{
  "summary": "Crisp 2-3 sentence executive recruiter assessment",
  "strengths": ["fact-grounded strength 1", "fact-grounded strength 2"],
  "verified_supporting_facts": ["exact candidate fact supporting this match"],
  "transferable_skills": ["transferable capability 1", "transferable capability 2"],
  "missing_skills": ["exact missing skill 1"],
  "unmet_requirements": ["unmet requirement 1 (e.g. 5+ yrs formal B2B SaaS roadmap ownership)"],
  "gaps": ["critical interview gap 1"],
  "transition_type": "Track A – Direct Product Management" | "Track B – Product-Adjacent Role (Product Ops/TPM)" | "Track C – Senior Technology & Partner Operations",
  "compensation_attractiveness": "Assessment against ₹22-28 LPA target CTC and ~₹2L take-home",
  "verdict": "High-conviction recruiter verdict: whether this opportunity is worth applying for and tactical positioning",
  "interview_topics": ["targeted technical/product interview question 1", "targeted interview question 2"],
  "matching_evidence": {}
}`;

  let semanticResult;
  try {
    semanticResult = await generateStructuredJson({
      prompt,
      schema: SemanticIntelligenceSchema,
      systemInstruction: 'You are an elite, skeptical executive recruiter. Evaluate transferable skills from Microsoft CSP operations and HelloPM prototypes. Never flatter or fabricate candidate qualifications.',
      temperature: 0.15
    });
  } catch (err) {
    console.warn('[Intelligence Agent] Semantic analysis fallback to heuristic:', err);
    semanticResult = {
      summary: `Evaluated ${options.job.title} at ${options.job.company}. Fit score: ${scoreResult.total}/100 (${scoreResult.recommendation}).`,
      strengths: options.verifiedFacts.slice(0, 3).map(f => f.fact),
      verified_supporting_facts: options.verifiedFacts.slice(0, 2).map(f => f.fact),
      transferable_skills: ['Microsoft Partner Center platform workflows', 'REST APIs & GDAP', 'Cross-functional stakeholder management'],
      missing_skills: ['Direct commercial roadmap & P&L ownership in B2B SaaS'],
      unmet_requirements: ['Formal 3+ years titled PM experience in enterprise software'],
      gaps: ['Transitioning from digital project management / technical support management to dedicated PM title'],
      transition_type: assignedTrack === 'track_a' ? 'Track A – Direct Product Management' : assignedTrack === 'track_b' ? 'Track B – Product-Adjacent Role (Product Ops/TPM)' : 'Track C – Senior Technology & Partner Operations',
      compensation_attractiveness: 'Salary undisclosed; target ₹22–28 LPA (~₹2L/mo) aligns with industry standard for 10-year technology leaders.',
      verdict: scoreResult.total >= 65 ? 'Worth applying: emphasize Partner Center APIs, 20+ team leadership, and HelloPM AI product prototypes.' : 'Low priority stretch: role demands deep standalone PM roadmap history.',
      interview_topics: ['How do you translate partner escalation patterns into prioritized product enhancements?', 'Walk through how you scoped and validated PMCoach.ai using JTBD.'],
      matching_evidence: {}
    };
  }

  const result: IntelligenceMatchResult = {
    job_id: options.job.id,
    user_id: options.profile.user_id,
    total_score: scoreResult.total,
    recommendation: scoreResult.recommendation,
    confidence_level: scoreResult.confidence,
    score_breakdown: scoreResult.breakdown,
    track: assignedTrack,
    transition_type: semanticResult.transition_type,
    verdict: semanticResult.verdict,
    summary: semanticResult.summary,
    strengths: semanticResult.strengths,
    verified_supporting_facts: semanticResult.verified_supporting_facts,
    transferable_skills: semanticResult.transferable_skills,
    missing_skills: semanticResult.missing_skills,
    unmet_requirements: semanticResult.unmet_requirements,
    gaps: semanticResult.gaps,
    interview_topics: semanticResult.interview_topics,
    compensation_note: scoreResult.compensationNote,
    matching_evidence: {
      ...semanticResult.matching_evidence,
      transition_type: semanticResult.transition_type,
      verdict: semanticResult.verdict,
      verified_supporting_facts: semanticResult.verified_supporting_facts,
      unmet_requirements: semanticResult.unmet_requirements,
      compensation_attractiveness: semanticResult.compensation_attractiveness
    }
  };

  // 4. Persist match in database if job_id and user_id are present
  if (options.job.id && options.profile.user_id) {
    try {
      await db.from('job_matches').upsert({
        job_id: options.job.id,
        user_id: options.profile.user_id,
        total_score: result.total_score,
        score_breakdown: result.score_breakdown,
        track: assignedTrack,
        strengths: result.strengths,
        gaps: result.gaps,
        recommendation: result.recommendation,
        confidence_level: result.confidence_level,
        transferable_skills: result.transferable_skills,
        matching_evidence: result.matching_evidence,
        reviewed: false
      }, { onConflict: 'user_id,job_id' });

      // Record agent run
      await db.from('agent_runs').insert({
        search_run_id: options.searchRunId || null,
        user_id: options.profile.user_id,
        agent_name: 'intelligence',
        status: 'completed',
        input_summary: { jobId: options.job.id, jobTitle: options.job.title, track: assignedTrack },
        output_summary: { score: result.total_score, recommendation: result.recommendation, verdict: result.verdict },
        duration_ms: Date.now() - startTime
      });
    } catch (saveErr) {
      console.warn('[Intelligence Agent] Failed to save match record:', saveErr);
    }
  }

  return result;
}
