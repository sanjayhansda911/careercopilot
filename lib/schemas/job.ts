import { z } from 'zod';

export const JobRecordSchema = z.object({
  id: z.string().uuid().optional(),
  source_id: z.string().uuid().nullable().optional(),
  external_job_id: z.string().nullable().optional(),
  canonical_url: z.string().url(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().nullable().optional(),
  work_mode: z.enum(['remote', 'hybrid', 'on-site', 'unspecified']).default('unspecified'),
  employment_type: z.enum(['full_time', 'contract', 'part_time', 'internship']).default('full_time'),
  job_url: z.string().url(),
  description: z.string().default(''),
  salary_min_lpa: z.number().nullable().optional(),
  salary_max_lpa: z.number().nullable().optional(),
  salary_currency: z.string().default('INR'),
  salary_evidence: z.string().nullable().optional(),
  salary_confidence: z.enum(['verified', 'advertised', 'estimated', 'undisclosed']).default('undisclosed'),
  experience_years_min: z.number().nullable().optional(),
  experience_years_max: z.number().nullable().optional(),
  posted_at: z.string().nullable().optional(),
  discovered_at: z.string().optional(),
  expires_at: z.string().nullable().optional(),
  status: z.enum(['open', 'closed', 'unverified']).default('open'),
  track: z.enum(['track_a', 'track_b', 'track_c']).default('track_a').optional(),
  is_active: z.boolean().default(true)
});

export type JobRecord = z.infer<typeof JobRecordSchema>;

export const JobIngestInputSchema = z.object({
  title: z.string().min(2, 'Job title is required'),
  company: z.string().min(1, 'Company name is required'),
  job_url: z.string().url('A valid job application URL is required'),
  location: z.string().optional(),
  work_mode: z.enum(['remote', 'hybrid', 'on-site', 'unspecified']).optional().default('unspecified'),
  employment_type: z.enum(['full_time', 'contract', 'part_time', 'internship']).optional().default('full_time'),
  description: z.string().min(20, 'Please provide the job description (at least 20 characters)'),
  salary_min_lpa: z.number().optional().nullable(),
  salary_max_lpa: z.number().optional().nullable(),
  salary_confidence: z.enum(['verified', 'advertised', 'estimated', 'undisclosed']).optional().default('undisclosed'),
  track: z.enum(['track_a', 'track_b', 'track_c']).optional().default('track_a'),
  source_name: z.string().optional().default('Manual Entry')
});

export type JobIngestInput = z.infer<typeof JobIngestInputSchema>;

export interface DiscoverySummary {
  runId: string;
  source: string;
  jobsScanned: number;
  jobsAdded: number;
  jobsUpdated: number;
  jobsSkippedDuplicates: number;
  errors: string[];
}
