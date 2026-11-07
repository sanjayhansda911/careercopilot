/**
 * Compatibility adapter for legacy references to openai.ts.
 * All AI capabilities have migrated to Google Gemini via lib/ai/gemini.ts and lib/ai/agents.ts.
 */
import {
  analyzeCandidateJobMatch,
  tailorResumeForJob,
  type CandidateJobMatch,
  type TailoredResume
} from '@/lib/ai/agents';

export async function analyzeJobFit(input: {
  profile: Record<string, unknown>;
  job: Record<string, unknown>;
  verifiedFacts: Array<{ id: string; category: string; fact: string; metric_value?: string | null }>;
}): Promise<CandidateJobMatch> {
  return analyzeCandidateJobMatch(input);
}

export async function tailorPmResume(input: {
  resumeText: string;
  jobDescription: string;
  verifiedFacts: Array<{ id: string; category: string; fact: string; metric_value?: string | null }>;
}): Promise<TailoredResume> {
  return tailorResumeForJob(input);
}
