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
  transferable_skills: z.array(z.string()).nullish().transform(v => v || []),
  missing_skills: z.array(z.string()).nullish().transform(v => v || []),
  gaps: z.array(z.string()).nullish().transform(v => v || []),
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

  // 6. Location & Work Mode (10%)
  const prefLocations = profile.preferred_locations || [];
  const locationMatches = prefLocations.some(l => normText.includes(normalize(l)) || normalize(job.location || '').includes(normalize(l)));
  const isRemote = /remote/i.test(job.work_mode || '') || /remote/i.test(job.description);
  const locationScore = (locationMatches || isRemote) ? weights.location_work_mode : Math.round(weights.location_work_mode * 0.4);

  // 7. Notice Period (5%)
  const candidateNotice = profile.notice_period_days || 90;
  // Notice period compatibility: 5 if notice fits standard hiring cycles or flexible, 3 if tight
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
 * Combines deterministic 7-factor scoring with Gemini semantic analysis.
 */
export async function runIntelligenceAgent(
  options: IntelligenceAgentOptions
): Promise<IntelligenceMatchResult> {
  const startTime = Date.now();
  const db = getSupabaseAdmin();

  // 1. Calculate deterministic numerical score
  const scoreResult = calculateWeightedScore(
    options.job,
    options.profile,
    options.verifiedFacts,
    options.weights
  );

  // 2. Run Gemini for semantic analysis, transferable skills, missing skills, and interview prep
  const prompt = `Analyze this candidate-to-job match for a Product Management career transition.
Target Job:
Title: ${options.job.title}
Company: ${options.job.company}
Location: ${options.job.location || 'Unspecified'}
Description:
${options.job.description.slice(0, 3500)}

Candidate Profile:
Current: ${options.profile.current_title} at ${options.profile.current_company} (${options.profile.total_experience_years || 9} years)
Target Roles: ${(options.profile.target_roles || []).join(', ')}
Skills: ${(options.profile.skills || []).join(', ')}

Verified Candidate Facts:
${JSON.stringify(options.verifiedFacts, null, 2)}

Numerical Score Calculated: ${scoreResult.total}/100 (${scoreResult.recommendation})

Instructions:
Return a JSON object with this exact structure:
{
  "summary": "Crisp 2-sentence executive summary of fit",
  "strengths": ["fact-grounded strength 1", "strength 2"],
  "transferable_skills": ["transferable skill 1", "transferable skill 2"],
  "missing_skills": ["missing skill 1"],
  "gaps": ["critical gap 1"],
  "interview_topics": ["targeted interview question 1", "targeted interview question 2"],
  "matching_evidence": {}
}
1. Explain genuine strengths based ONLY on the verified facts.
2. Identify transferable skills (e.g. enterprise support operations to Product Ops / Platform PM).
3. Identify exact missing skills and experience gaps that could hurt candidate in interviews.
4. Provide 3-5 technical / product interview questions the interviewer will likely probe on.
5. Provide a crisp 2-sentence executive summary of the recommendation.`;

  let semanticResult;
  try {
    semanticResult = await generateStructuredJson({
      prompt,
      schema: SemanticIntelligenceSchema,
      systemInstruction: 'You are an elite, skeptical talent analyst. Distinguish direct product experience from transferable operations experience. Never flatter or fabricate evidence.',
      temperature: 0.15
    });
  } catch (err) {
    console.warn('[Intelligence Agent] Semantic analysis fallback to heuristic:', err);
    semanticResult = {
      summary: `Evaluated ${options.job.title} at ${options.job.company}. Fit score: ${scoreResult.total}/100 (${scoreResult.recommendation}).`,
      strengths: options.verifiedFacts.slice(0, 3).map(f => f.fact),
      transferable_skills: ['Enterprise operations', 'Incident lifecycle', 'Partner communication'],
      missing_skills: ['Direct roadmap ownership in B2B SaaS'],
      gaps: ['Transitioning from digital project management to dedicated product manager title'],
      interview_topics: ['How do you prioritize features using RICE?', 'Describe your experience writing PRDs.'],
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
    summary: semanticResult.summary,
    strengths: semanticResult.strengths,
    transferable_skills: semanticResult.transferable_skills,
    missing_skills: semanticResult.missing_skills,
    gaps: semanticResult.gaps,
    interview_topics: semanticResult.interview_topics,
    compensation_note: scoreResult.compensationNote,
    matching_evidence: semanticResult.matching_evidence
  };

  // 3. Persist match in database if job_id and user_id are present
  if (options.job.id && options.profile.user_id) {
    try {
      await db.from('job_matches').upsert({
        job_id: options.job.id,
        user_id: options.profile.user_id,
        total_score: result.total_score,
        score_breakdown: result.score_breakdown,
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
        input_summary: { jobId: options.job.id, jobTitle: options.job.title },
        output_summary: { score: result.total_score, recommendation: result.recommendation },
        duration_ms: Date.now() - startTime
      });
    } catch (saveErr) {
      console.warn('[Intelligence Agent] Failed to save match record:', saveErr);
    }
  }

  return result;
}
