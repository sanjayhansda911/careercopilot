import { z } from 'zod';

export interface ScoringWeights {
  experience_skills: number; // default 25
  role_seniority: number;    // default 20
  domain_relevance: number;  // default 15
  compensation: number;      // default 15
  leadership_scope: number;  // default 10
  location_work_mode: number;// default 10
  notice_period: number;     // default 5
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  experience_skills: 25,
  role_seniority: 20,
  domain_relevance: 15,
  compensation: 15,
  leadership_scope: 10,
  location_work_mode: 10,
  notice_period: 5
};

export const ScoreBreakdownSchema = z.object({
  experience_skills: z.number().min(0).max(25),
  role_seniority: z.number().min(0).max(20),
  domain_relevance: z.number().min(0).max(15),
  compensation: z.number().min(0).max(15),
  leadership_scope: z.number().min(0).max(10),
  location_work_mode: z.number().min(0).max(10),
  notice_period: z.number().min(0).max(5)
});

export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const RecommendationCategorySchema = z.enum([
  'apply_now',  // 80-100 Strong match
  'review',     // 65-79 Worth reviewing
  'stretch',    // 50-64 Stretch opportunity
  'ignore'      // <50 Low priority
]);

export type RecommendationCategory = z.infer<typeof RecommendationCategorySchema>;

export const IntelligenceMatchResultSchema = z.object({
  job_id: z.string().optional(),
  user_id: z.string().optional(),
  total_score: z.number().min(0).max(100),
  recommendation: RecommendationCategorySchema,
  confidence_level: z.enum(['high', 'medium', 'low']).default('high'),
  score_breakdown: ScoreBreakdownSchema,
  summary: z.string(),
  strengths: z.array(z.string()),
  transferable_skills: z.array(z.string()),
  missing_skills: z.array(z.string()),
  gaps: z.array(z.string()),
  interview_topics: z.array(z.string()),
  compensation_note: z.string(),
  matching_evidence: z.record(z.unknown()).default({})
});

export type IntelligenceMatchResult = z.infer<typeof IntelligenceMatchResultSchema>;
