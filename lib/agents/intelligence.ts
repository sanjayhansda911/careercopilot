import { getSupabaseAdmin } from '@/lib/supabase/server';
import { JobRecord } from '@/lib/schemas/job';
import {
  DEFAULT_SCORING_WEIGHTS,
  ScoringWeights,
  ScoreBreakdown,
  RecommendationCategory,
  OpportunityClassification,
  OpportunityClassificationSchema,
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
  classification: OpportunityClassificationSchema.catch('direct_pm').default('direct_pm'),
  summary: z.string().nullish().transform(v => v || ''),
  executive_summary: z.string().nullish(),
  why_apply: z.string().nullish().transform(v => v || ''),
  why_not_shortlisted: z.string().nullish().transform(v => v || ''),
  competitive_evidence: z.array(z.string()).nullish().transform(v => v || []),
  gaps_to_address: z.array(z.string()).nullish().transform(v => v || []),
  long_term_strategy_fit: z.string().nullish().transform(v => v || ''),
  actual_responsibilities: z.array(z.string()).nullish().transform(v => v || []),
  mandatory_requirements: z.array(z.string()).nullish().transform(v => v || []),
  preferred_requirements: z.array(z.string()).nullish().transform(v => v || []),
  deal_breakers_or_missing_info: z.array(z.string()).nullish().transform(v => v || []),
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
 * Agent 2: Job Intelligence Agent
 * Independently evaluates whether a discovered job is genuinely suitable for the candidate.
 * Follows the 10-step evaluation protocol, assigns one of 4 Opportunity Classifications,
 * and answers the 5 explicit recruiter explanation dimensions with zero score inflation.
 */
export async function runIntelligenceAgent(
  options: IntelligenceAgentOptions
): Promise<IntelligenceMatchResult> {
  const startTime = Date.now();
  const db = getSupabaseAdmin();

  // 1. Determine Track
  const assignedTrack: JobTrack = options.job.track || classifyJobTrack(options.job.title, options.job.description);

  // 2. Calculate baseline deterministic score
  let scoreResult = calculateWeightedScore(
    options.job,
    options.profile,
    options.verifiedFacts,
    options.weights
  );

  // 3. Run Gemini under the strict Job Intelligence Agent Charter
  const prompt = `You are CareerPilot's Job Intelligence Agent.

Your responsibility is to independently evaluate whether a discovered job is genuinely suitable for the candidate.
Do not simply repeat the Discovery Agent's assessment.

FOR EVERY JOB, EXECUTE THIS 10-STEP EVALUATION PROTOCOL:
1. Read the full job description.
2. Identify the actual responsibilities rather than relying on the job title.
3. Identify mandatory versus preferred requirements.
4. Compare requirements with verified candidate facts.
5. Distinguish formal Product Management experience from transferable product-adjacent experience.
6. Evaluate seniority and scope realistically.
7. Identify whether the role provides a credible transition into Product Management.
8. Assess compensation and location compatibility.
9. Identify deal-breakers and missing information.
10. Provide an evidence-backed recommendation.

TARGET JOB DETAILS:
Title: ${options.job.title}
Company: ${options.job.company}
Location: ${options.job.location || 'Unspecified'}
Track Hint: ${assignedTrack}
Full Description:
${options.job.description.slice(0, 3800)}

CANDIDATE SOURCE OF TRUTH (VERIFIED FACTS):
- Current Role: ${options.profile.current_title || 'Team Manager / Digital Project Manager'} at ${options.profile.current_company || 'Sonata Software'}
- Total Experience: ${options.profile.total_experience_years || 10} years total, 4 years people/operations management
- Primary Domain: Microsoft Partner Center Technical Support, Cloud Solution Provider (CSP) ecosystem, REST APIs, GDAP security workspace, partner sandboxes, partner enablement.
- Team Leadership: Directly manages 20-23 technical support specialists; SLA compliance, CSAT, 40% backlog reduction, quarterly business reviews (QBRs).
- Product Management Foundation: Completed HelloPM AI Product Management programme; independently built AI product prototypes (PMCoach.ai, Nagrik). PRDs, user problem definitions (JTBD), MVP scoping.
- Compensation Target: ₹22–28 LPA (current ₹14.55 LPA, target take-home ~₹2L/month).
- Notice Period: 90 days.
- Location Priorities: Hyderabad primary, India Remote, Bengaluru/Pune secondary.

CRITICAL RECRUITER RULES:
- Never inflate match scores.
- A role with "Product Manager" in the title may be a POOR FIT if it mandates 5+ years of dedicated commercial SaaS P&L and roadmap ownership.
- A role with "Operations" or "Program" in the title may be a HIGH-VALUE STEPPING STONE into PM.
- The candidate has NOT held a formal full-time PM title in corporate employment. Never fabricate or conflate operational leadership with commercial product roadmap ownership.
- Value honesty, realism, and strategic career transition judgment.

CLASSIFY OPPORTUNITIES INTO EXACTLY ONE OF:
- "direct_pm" (Direct PM opportunity - credible direct entry leveraging domain/API depth)
- "product_adjacent_stepping_stone" (Product-adjacent stepping stone - Product Ops, TPM, Enablement with direct product proximity)
- "tech_ops_leadership" (Technology/operations leadership alternative - high-compensation CSP/partner operations delivery leadership)
- "poor_fit" (Poor fit - requires heavy formal PM tenure, wrong domain, mismatch, or low leverage)

EXPLAIN THE 5 STRATEGIC DIMENSIONS:
- why_apply: Why the candidate should apply
- why_not_shortlisted: Why the candidate might not be shortlisted (unvarnished recruiter realism)
- competitive_evidence: What concrete candidate evidence makes them competitive
- gaps_to_address: What gaps the candidate must address in their positioning or interview
- long_term_strategy_fit: Whether the role supports the long-term career trajectory towards Senior PM / Product Leadership

Return a JSON object adhering to this schema:
{
  "classification": "direct_pm" | "product_adjacent_stepping_stone" | "tech_ops_leadership" | "poor_fit",
  "summary": "Crisp 2-3 sentence executive recruiter verdict",
  "why_apply": "Specific reason why this opportunity warrants candidate application",
  "why_not_shortlisted": "Honest recruiter perspective on why resume might be rejected or screened out",
  "competitive_evidence": ["Verified fact/evidence 1", "Verified fact/evidence 2"],
  "gaps_to_address": ["Critical gap 1 to address", "Critical gap 2"],
  "long_term_strategy_fit": "Assessment of how this role accelerates or diverts the path to PM leadership",
  "actual_responsibilities": ["Actual responsibility 1 deduced from JD", "Actual responsibility 2"],
  "mandatory_requirements": ["Mandatory requirement 1", "Mandatory requirement 2"],
  "preferred_requirements": ["Preferred requirement 1"],
  "deal_breakers_or_missing_info": ["Missing salary / location mismatch / strict PM tenure requirement"],
  "strengths": ["Key strength 1", "Key strength 2"],
  "verified_supporting_facts": ["Specific verified candidate fact matched"],
  "transferable_skills": ["Transferable skill from CSP/API operations"],
  "missing_skills": ["Missing capability"],
  "unmet_requirements": ["Unmet JD requirement"],
  "gaps": ["Interview gap"],
  "transition_type": "Track A – Direct Product Management" | "Track B – Product-Adjacent Role (Product Ops/TPM)" | "Track C – Senior Technology & Partner Operations",
  "compensation_attractiveness": "Assessment against ₹22-28 LPA target CTC",
  "verdict": "Clear, actionable recommendation verdict",
  "interview_topics": ["Specific interview probe 1", "Specific interview probe 2"]
}`;

  let semanticResult;
  try {
    semanticResult = await generateStructuredJson({
      prompt,
      schema: SemanticIntelligenceSchema,
      systemInstruction: 'You are CareerPilot Job Intelligence Agent: an elite, honest, and skeptical executive recruiter who evaluates career transition viability without confirmation bias or score inflation.',
      temperature: 0.15
    });
  } catch (err) {
    console.warn('[Intelligence Agent] Semantic analysis fallback to heuristic:', err);
    const isPoorFit = /5\+|7\+|10\+/i.test(options.job.description) && /principal|staff|director|head/i.test(options.job.title);
    const classification: OpportunityClassification = isPoorFit
      ? 'poor_fit'
      : assignedTrack === 'track_b'
      ? 'product_adjacent_stepping_stone'
      : assignedTrack === 'track_c'
      ? 'tech_ops_leadership'
      : 'direct_pm';

    semanticResult = {
      classification,
      summary: `Evaluated ${options.job.title} at ${options.job.company}. Fit score: ${scoreResult.total}/100 (${scoreResult.recommendation}).`,
      why_apply: `Leverage strong Microsoft CSP ecosystem and API operations background for ${options.job.company}.`,
      why_not_shortlisted: 'Candidate lacks formal, titled B2B SaaS commercial PM roadmap ownership.',
      competitive_evidence: options.verifiedFacts.slice(0, 3).map(f => f.fact),
      gaps_to_address: ['Positioning digital project management and HelloPM AI prototypes as PM evidence'],
      long_term_strategy_fit: classification === 'poor_fit'
        ? 'Diverts focus or risks immediate rejection due to heavy prerequisite PM tenure.'
        : 'Provides viable stepping stone into full product ownership.',
      actual_responsibilities: ['Cross-functional stakeholder coordination', 'Technical requirements definition'],
      mandatory_requirements: ['Experience with enterprise software platforms'],
      preferred_requirements: ['Cloud platform and API knowledge'],
      deal_breakers_or_missing_info: ['Compensation not explicitly listed in posting'],
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

  // 4. Strict scoring rule: Never inflate match scores for poor fits
  let finalScore = scoreResult.total;
  let finalRec = scoreResult.recommendation;
  if (semanticResult.classification === 'poor_fit') {
    finalScore = Math.min(finalScore, 44);
    finalRec = 'ignore';
  }

  const result: IntelligenceMatchResult = {
    job_id: options.job.id,
    user_id: options.profile.user_id,
    total_score: finalScore,
    recommendation: finalRec,
    confidence_level: scoreResult.confidence,
    score_breakdown: scoreResult.breakdown,
    track: assignedTrack,
    classification: (semanticResult.classification as OpportunityClassification) || 'direct_pm',
    transition_type: semanticResult.transition_type,
    verdict: semanticResult.verdict,
    summary: semanticResult.summary,
    why_apply: semanticResult.why_apply,
    why_not_shortlisted: semanticResult.why_not_shortlisted,
    competitive_evidence: semanticResult.competitive_evidence,
    gaps_to_address: semanticResult.gaps_to_address,
    long_term_strategy_fit: semanticResult.long_term_strategy_fit,
    actual_responsibilities: semanticResult.actual_responsibilities,
    mandatory_requirements: semanticResult.mandatory_requirements,
    preferred_requirements: semanticResult.preferred_requirements,
    deal_breakers_or_missing_info: semanticResult.deal_breakers_or_missing_info,
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
      classification: semanticResult.classification,
      why_apply: semanticResult.why_apply,
      why_not_shortlisted: semanticResult.why_not_shortlisted,
      competitive_evidence: semanticResult.competitive_evidence,
      gaps_to_address: semanticResult.gaps_to_address,
      long_term_strategy_fit: semanticResult.long_term_strategy_fit,
      actual_responsibilities: semanticResult.actual_responsibilities,
      mandatory_requirements: semanticResult.mandatory_requirements,
      preferred_requirements: semanticResult.preferred_requirements,
      deal_breakers_or_missing_info: semanticResult.deal_breakers_or_missing_info,
      transition_type: semanticResult.transition_type,
      verdict: semanticResult.verdict,
      verified_supporting_facts: semanticResult.verified_supporting_facts,
      unmet_requirements: semanticResult.unmet_requirements,
      compensation_attractiveness: semanticResult.compensation_attractiveness
    }
  };

  // 5. Persist match in database if job_id and user_id are present
  if (options.job.id && options.profile.user_id) {
    try {
      await db.from('job_matches').upsert({
        job_id: options.job.id,
        user_id: options.profile.user_id,
        total_score: result.total_score,
        score_breakdown: result.score_breakdown,
        track: assignedTrack,
        classification: result.classification,
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
        input_summary: {
          jobId: options.job.id,
          jobTitle: options.job.title,
          track: assignedTrack,
          classification: result.classification
        },
        output_summary: {
          score: result.total_score,
          recommendation: result.recommendation,
          classification: result.classification,
          verdict: result.verdict
        },
        duration_ms: Date.now() - startTime
      });
    } catch (saveErr) {
      console.warn('[Intelligence Agent] Failed to save match record:', saveErr);
    }
  }

  return result;
}

