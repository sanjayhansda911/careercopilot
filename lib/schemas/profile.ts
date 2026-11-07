import { z } from 'zod';

export const CareerProfileUpdateSchema = z.object({
  target_track: z.string().default('product_management'),
  total_experience_years: z.number().min(0).max(60).nullable().optional(),
  management_experience_years: z.number().min(0).max(60).nullable().optional(),
  current_title: z.string().min(1).nullable().optional(),
  current_company: z.string().min(1).nullable().optional(),
  current_ctc_lpa: z.number().min(0).nullable().optional(),
  target_ctc_min_lpa: z.number().min(0).nullable().optional(),
  target_ctc_max_lpa: z.number().min(0).nullable().optional(),
  notice_period_days: z.number().min(0).max(365).nullable().optional(),
  preferred_locations: z.array(z.string()).default([]),
  preferred_work_modes: z.array(z.string()).default(['hybrid', 'remote', 'on-site']),
  target_roles: z.array(z.string()).default([]),
  target_domains: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  profile_summary: z.string().nullable().optional()
});

export type CareerProfileUpdate = z.infer<typeof CareerProfileUpdateSchema>;

export const CareerFactCreateSchema = z.object({
  category: z.string().min(1).default('experience'),
  fact: z.string().min(3),
  metric_value: z.string().nullable().optional(),
  evidence_source: z.string().nullable().optional(),
  verification_status: z.enum(['pending', 'verified', 'rejected']).default('pending'),
  allowed_resume_tracks: z.array(z.string()).default(['product_management'])
});

export type CareerFactCreate = z.infer<typeof CareerFactCreateSchema>;

export const CareerFactUpdateSchema = z.object({
  category: z.string().min(1).optional(),
  fact: z.string().min(3).optional(),
  metric_value: z.string().nullable().optional(),
  evidence_source: z.string().nullable().optional(),
  verification_status: z.enum(['pending', 'verified', 'rejected']).optional(),
  allowed_resume_tracks: z.array(z.string()).optional()
});

export type CareerFactUpdate = z.infer<typeof CareerFactUpdateSchema>;
