import { z } from 'zod';
import { generateStructuredJson } from './gemini';

// ============================================================================
// 1. JOB DESCRIPTION ANALYSIS AGENT
// ============================================================================

export const JobAnalysisSchema = z.object({
  title: z.string().nullish().transform(v => v || 'Untitled Position'),
  company: z.string().nullish().transform(v => v || 'Unknown Company'),
  seniority_level: z.string().nullish().transform(val => {
    if (!val) return 'mid' as const;
    const v = val.toLowerCase();
    if (v.includes('senior')) return 'senior' as const;
    if (v.includes('lead')) return 'lead' as const;
    if (v.includes('principal')) return 'principal' as const;
    if (v.includes('director')) return 'director' as const;
    if (v.includes('exec') || v.includes('vp') || v.includes('head')) return 'executive' as const;
    if (v.includes('entry') || v.includes('junior') || v.includes('associate')) return 'entry' as const;
    if (v.includes('intern')) return 'intern' as const;
    return 'mid' as const;
  }),
  department: z.string().nullish().transform(v => v || 'Product'),
  work_mode: z.string().nullish().transform(val => {
    if (!val) return 'unspecified' as const;
    const v = val.toLowerCase();
    if (v.includes('remote')) return 'remote' as const;
    if (v.includes('hybrid')) return 'hybrid' as const;
    if (v.includes('site') || v.includes('office')) return 'on-site' as const;
    return 'unspecified' as const;
  }),
  location: z.union([
    z.string(),
    z.record(z.unknown()).transform(o => Object.values(o).filter(v => typeof v === 'string').join(', '))
  ]).nullish().transform(v => v || null),
  salary_min_lpa: z.number().nullish().default(null),
  salary_max_lpa: z.number().nullish().default(null),
  salary_currency: z.string().nullish().transform(v => v || 'INR'),
  salary_confidence: z.string().nullish().transform(val => {
    if (!val) return 'undisclosed' as const;
    const v = val.toLowerCase();
    if (v.includes('adv')) return 'advertised' as const;
    if (v.includes('est')) return 'estimated' as const;
    if (v.includes('verif')) return 'verified' as const;
    return 'undisclosed' as const;
  }),
  required_skills: z.array(z.string()).nullish().transform(v => v || []),
  preferred_skills: z.array(z.string()).nullish().transform(v => v || []),
  responsibilities: z.array(z.string()).nullish().transform(v => v || []),
  qualifications: z.array(z.string()).nullish().transform(v => v || []),
  domain_keywords: z.array(z.string()).nullish().transform(v => v || []),
  key_challenges: z.array(z.string()).nullish().transform(v => v || []),
  raw_summary: z.string().nullish(),
  summary: z.string().nullish()
}).transform(data => ({
  ...data,
  raw_summary: data.raw_summary || data.summary || `${data.title} at ${data.company}`
}));

export type JobAnalysis = z.output<typeof JobAnalysisSchema>;

export async function analyzeJobDescription(
  jobDescriptionText: string,
  hints?: { title?: string; company?: string; url?: string }
): Promise<JobAnalysis> {
  const prompt = `Analyze the following job posting text and return a JSON object with this exact structure:
{
  "title": string,
  "company": string,
  "seniority_level": "entry" | "mid" | "senior" | "lead" | "principal" | "director",
  "department": "Product",
  "work_mode": "remote" | "hybrid" | "on-site" | "unspecified",
  "location": string (e.g. "Bengaluru, India") or null,
  "salary_min_lpa": number or null,
  "salary_max_lpa": number or null,
  "salary_currency": "INR",
  "salary_confidence": "advertised" | "estimated" | "undisclosed",
  "required_skills": string[],
  "preferred_skills": string[],
  "responsibilities": string[],
  "qualifications": string[],
  "domain_keywords": string[],
  "key_challenges": string[],
  "raw_summary": string
}

Hints provided:
${JSON.stringify(hints || {}, null, 2)}

Job Posting Content:
${jobDescriptionText}`;

  const systemInstruction = `You are an expert technical talent analyst. Parse job postings into structured JSON. Extract genuine qualifications, skills, and constraints. Do not invent compensation numbers if not present in the text.`;

  return generateStructuredJson({
    prompt,
    schema: JobAnalysisSchema,
    systemInstruction,
    temperature: 0.1
  });
}

// ============================================================================
// 2. CANDIDATE-JOB MATCHING AGENT
// ============================================================================

export const CandidateJobMatchSchema = z.object({
  fit_score: z.number().nullish().transform(v => (v != null ? Math.min(100, Math.max(0, Math.round(v))) : 65)),
  recommendation: z.string().nullish().transform(val => {
    if (!val) return 'review' as const;
    const v = val.toLowerCase();
    if (v.includes('apply')) return 'apply_now' as const;
    if (v.includes('stretch')) return 'stretch' as const;
    if (v.includes('ignore') || v.includes('pass')) return 'ignore' as const;
    return 'review' as const;
  }),
  summary: z.string().nullish().transform(v => v || 'Candidate fit analysis complete.'),
  strengths: z.array(z.string()).nullish().transform(v => v || []),
  gaps: z.array(z.string()).nullish().transform(v => v || []),
  direct_experience_assessment: z.string().nullish().transform(v => v || ''),
  transferable_experience_assessment: z.string().nullish().transform(v => v || ''),
  seniority_assessment: z.string().nullish().transform(v => v || ''),
  compensation_assessment: z.string().nullish().transform(v => v || ''),
  location_assessment: z.string().nullish().transform(v => v || ''),
  notice_period_risk: z.string().nullish().transform(v => v || ''),
  interview_topics: z.array(z.string()).nullish().transform(v => v || []),
  score_breakdown: z.object({
    skills: z.number().nullish().transform(v => v ?? 15),
    seniority: z.number().nullish().transform(v => v ?? 15),
    domain: z.number().nullish().transform(v => v ?? 10),
    compensation: z.number().nullish().transform(v => v ?? 10),
    leadership: z.number().nullish().transform(v => v ?? 8),
    location: z.number().nullish().transform(v => v ?? 8),
    notice_period: z.number().nullish().transform(v => v ?? 4)
  }).nullish().transform(b => b || {
    skills: 15,
    seniority: 15,
    domain: 10,
    compensation: 10,
    leadership: 8,
    location: 8,
    notice_period: 4
  })
});

export type CandidateJobMatch = z.output<typeof CandidateJobMatchSchema>;

export async function analyzeCandidateJobMatch(input: {
  profile: Record<string, unknown>;
  verifiedFacts: Array<{ id: string; category: string; fact: string; metric_value?: string | null }>;
  job: Record<string, unknown>;
}): Promise<CandidateJobMatch> {
  const prompt = `Perform a skeptical, evidence-grounded candidate-to-job match analysis.
Return JSON with this structure:
{
  "fit_score": number (0-100),
  "recommendation": "apply_now" | "review" | "stretch" | "ignore",
  "summary": string,
  "strengths": string[],
  "gaps": string[],
  "direct_experience_assessment": string,
  "transferable_experience_assessment": string,
  "seniority_assessment": string,
  "compensation_assessment": string,
  "location_assessment": string,
  "notice_period_risk": string,
  "interview_topics": string[],
  "score_breakdown": {
    "skills": number (0-25),
    "seniority": number (0-20),
    "domain": number (0-15),
    "compensation": number (0-15),
    "leadership": number (0-10),
    "location": number (0-10),
    "notice_period": number (0-5)
  }
}

Candidate Profile & Experience:
${JSON.stringify(input.profile, null, 2)}

Verified Facts & Proven Achievements:
${JSON.stringify(input.verifiedFacts, null, 2)}

Job Details:
${JSON.stringify(input.job, null, 2)}

Instructions:
1. Distinguish direct product management experience from transferable operations / project management experience.
2. Only count claims that are backed by the provided verified facts.
3. Be candid about missing qualifications or steep learning curves in 'gaps'.
4. Provide 4-6 targeted interview questions the candidate must be prepared to answer.`;

  const systemInstruction = `You are a skeptical executive career-fit analyst evaluating Product Management alignment. Maintain rigorous standards. Do not flatter the candidate or fabricate overlap where none exists.`;

  return generateStructuredJson({
    prompt,
    schema: CandidateJobMatchSchema,
    systemInstruction,
    temperature: 0.1
  });
}

// ============================================================================
// 3. PM RESUME TAILORING AGENT (FACT-GROUNDED, ZERO FABRICATION)
// ============================================================================

export const TailoredResumeSchema = z.object({
  tailored_summary: z.string().nullish().transform(v => v || ''),
  reordered_skills: z.array(z.string()).nullish().transform(v => v || []),
  experience_bullets: z.array(
    z.object({
      role_title: z.string().nullish().transform(v => v || 'Product Professional'),
      company: z.string().nullish().transform(v => v || 'Technology Company'),
      bullet: z.string().min(1),
      fact_id: z.string().nullish().transform(v => v || '')
    })
  ).nullish().transform(v => v || []),
  project_bullets: z.array(
    z.object({
      project_name: z.string().nullish().transform(v => v || 'Portfolio Project'),
      bullet: z.string().min(1),
      fact_id: z.string().nullish().transform(v => v || '')
    })
  ).nullish().transform(v => v || []),
  keyword_coverage: z.array(
    z.object({
      keyword: z.string(),
      addressed: z.boolean().nullish().transform(v => v ?? true),
      context: z.string().nullish().transform(v => v || '')
    })
  ).nullish().transform(v => v || []),
  evidence_map: z.record(z.union([z.string(), z.array(z.string())])).nullish().transform(v => {
    if (!v) return {};
    const normalized: Record<string, string[]> = {};
    for (const [k, val] of Object.entries(v)) {
      normalized[k] = Array.isArray(val) ? val : [val];
    }
    return normalized;
  }),
  gaps_to_disclose: z.array(z.string()).nullish().transform(v => v || []),
  unverified_claims_prevented: z.array(z.string()).nullish().transform(v => v || [])
});

export type TailoredResume = z.output<typeof TailoredResumeSchema>;

export async function tailorResumeForJob(input: {
  resumeText: string;
  jobDescription: string;
  verifiedFacts: Array<{ id: string; category: string; fact: string; metric_value?: string | null }>;
}): Promise<TailoredResume> {
  const verifiedFactIds = new Set(input.verifiedFacts.map(f => f.id));

  const prompt = `You are an executive product-management resume strategist.
Tailor the candidate's resume for the target job description USING ONLY the supplied verified career facts.

CRITICAL CONSTRAINTS (VIOLATION WILL RESULT IN SYSTEM REJECTION):
1. NEVER fabricate metrics, percentages, team sizes, revenue numbers, or user counts.
2. Every experience bullet and project bullet MUST reference a valid fact_id from the Verified Facts list.
3. If an achievement or metric is NOT in the Verified Facts list, DO NOT include it. Instead, note it in unverified_claims_prevented.
4. Return JSON with:
{
  "tailored_summary": string,
  "reordered_skills": string[],
  "experience_bullets": [
    { "role_title": string, "company": string, "bullet": string, "fact_id": string }
  ],
  "project_bullets": [
    { "project_name": string, "bullet": string, "fact_id": string }
  ],
  "keyword_coverage": [
    { "keyword": string, "addressed": boolean, "context": string }
  ],
  "evidence_map": { "claim_or_skill": ["fact_id_1"] },
  "gaps_to_disclose": string[],
  "unverified_claims_prevented": string[]
}

Target Job Description:
${input.jobDescription}

Candidate Base Resume:
${input.resumeText}

Verified Career Facts Bank:
${JSON.stringify(input.verifiedFacts, null, 2)}`;

  const systemInstruction = `You are an elite, integrity-first PM resume strategist. You tailor resumes with maximum impact while strictly refusing to fabricate ungrounded achievements or metrics. Every bullet must be anchored in a verified fact ID.`;

  const result = await generateStructuredJson({
    prompt,
    schema: TailoredResumeSchema,
    systemInstruction,
    temperature: 0.15
  });

  // Programmatic verification pass: ensure fact_id is actually in input.verifiedFacts
  // Sanitize any hallucinations if any fact_id does not exist
  const unverifiedPrevented = [...(result.unverified_claims_prevented ?? [])];

  const sanitizedExperience = result.experience_bullets.filter(b => {
    if (!verifiedFactIds.has(b.fact_id)) {
      unverifiedPrevented.push(
        `Prevented ungrounded bullet referencing non-existent fact ID (${b.fact_id}): "${b.bullet}"`
      );
      return false;
    }
    return true;
  });

  const sanitizedProjects = result.project_bullets.filter(b => {
    if (!verifiedFactIds.has(b.fact_id)) {
      unverifiedPrevented.push(
        `Prevented ungrounded project bullet referencing non-existent fact ID (${b.fact_id}): "${b.bullet}"`
      );
      return false;
    }
    return true;
  });

  return {
    ...result,
    experience_bullets: sanitizedExperience,
    project_bullets: sanitizedProjects,
    unverified_claims_prevented: unverifiedPrevented
  };
}

// ============================================================================
// 4. CAREER INSIGHTS AGENT
// ============================================================================

export const CareerInsightsSchema = z.object({
  target_track: z.string().nullish().transform(v => v || 'Product Management'),
  overall_market_readiness_score: z.number().nullish().transform(v => (v != null ? Math.min(100, Math.max(0, Math.round(v))) : 75)),
  strategic_positioning: z.string().nullish().transform(v => v || ''),
  key_differentiators: z.array(z.string()).nullish().transform(v => v || []),
  critical_skill_gaps: z.array(
    z.object({
      skill: z.string(),
      importance: z.string().nullish().transform(v => {
        const s = (v || '').toLowerCase();
        if (s.includes('high')) return 'high' as const;
        if (s.includes('low')) return 'low' as const;
        return 'medium' as const;
      }),
      recommendation: z.string().nullish().transform(v => v || '')
    })
  ).nullish().transform(v => v || []),
  portfolio_recommendations: z.array(
    z.object({
      project_name: z.string().nullish().transform(v => v || ''),
      focus_area: z.string().nullish().transform(v => v || ''),
      suggested_enhancement: z.string().nullish().transform(v => v || '')
    })
  ).nullish().transform(v => v || []),
  transition_narrative: z.string().nullish().transform(v => v || ''),
  actionable_next_steps: z.array(z.string()).nullish().transform(v => v || [])
});

export type CareerInsights = z.output<typeof CareerInsightsSchema>;

export async function generateCareerInsights(input: {
  profile: Record<string, unknown>;
  verifiedFacts: Array<{ id: string; category: string; fact: string }>;
  recentMatches?: Array<{ title: string; company: string; fit_score: number; gaps: string[] }>;
}): Promise<CareerInsights> {
  const prompt = `Analyze the candidate's career trajectory, target product management track, and current positioning.
Return JSON with this structure:
{
  "target_track": string,
  "overall_market_readiness_score": number (0-100),
  "strategic_positioning": string,
  "key_differentiators": string[],
  "critical_skill_gaps": [
    { "skill": string, "importance": "high" | "medium" | "low", "recommendation": string }
  ],
  "portfolio_recommendations": [
    { "project_name": string, "focus_area": string, "suggested_enhancement": string }
  ],
  "transition_narrative": string,
  "actionable_next_steps": string[]
}

Profile:
${JSON.stringify(input.profile, null, 2)}

Verified Career Facts:
${JSON.stringify(input.verifiedFacts, null, 2)}

Recent Job Matches & Observed Gaps:
${JSON.stringify(input.recentMatches || [], null, 2)}

Instructions:
1. Provide a realistic market readiness score (0-100).
2. Frame their 9+ years of CSP / Partner Center operations as a competitive advantage.
3. Recommend how to position portfolio projects (such as PMCoach.ai and Nagrik).
4. Identify high-leverage skill gaps and concrete action steps.`;

  const systemInstruction = `You are a career strategist specializing in Senior Product Management transitions. Provide high-signal, actionable, and non-generic career intelligence.`;

  return generateStructuredJson({
    prompt,
    schema: CareerInsightsSchema,
    systemInstruction,
    temperature: 0.2
  });
}
