import { z } from 'zod';

export const CANONICAL_APPLICATION_STATUSES = [
  'prepared',
  'approved',
  'submitted',
  'interviewing',
  'rejected',
  'offered',
  'withdrawn'
] as const;

export const ApplicationStatusSchema = z.enum([
  'prepared',
  'approved',
  'submitted',
  'interviewing',
  'rejected',
  'offered',
  'withdrawn',
  // Backwards-compatible aliases
  'applied',
  'screening',
  'interview',
  'offer',
  'pending_review'
]);

export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

/**
 * Validates allowed application workflow transitions.
 * Strict human gate: Approval is mandatory prior to submission.
 */
export function isValidStatusTransition(
  fromStatus: ApplicationStatus,
  toStatus: ApplicationStatus
): { valid: boolean; reason?: string } {
  // Normalize aliases
  const from = fromStatus === 'applied' ? 'submitted' : fromStatus === 'interview' ? 'interviewing' : fromStatus === 'offer' ? 'offered' : fromStatus;
  const to = toStatus === 'applied' ? 'submitted' : toStatus === 'interview' ? 'interviewing' : toStatus === 'offer' ? 'offered' : toStatus;

  if (from === to) return { valid: true };

  const allowedTransitions: Record<string, string[]> = {
    prepared: ['approved', 'withdrawn'],
    approved: ['submitted', 'prepared', 'withdrawn'],
    submitted: ['interviewing', 'rejected', 'withdrawn'],
    interviewing: ['offered', 'rejected', 'withdrawn'],
    offered: ['withdrawn'],
    rejected: ['withdrawn', 'prepared'],
    withdrawn: ['prepared']
  };

  const validTargets = allowedTransitions[from] || [];
  if (!validTargets.includes(to)) {
    return {
      valid: false,
      reason: `Invalid state transition: Cannot move application directly from '${from}' to '${to}'. Allowed transitions from '${from}': [${validTargets.join(', ')}].`
    };
  }

  return { valid: true };
}

export const ApplicationQuestionAnswerSchema = z.object({
  question: z.string(),
  answer: z.string(),
  source_fact_ids: z.array(z.string()).default([]),
  confidence: z.enum(['high', 'medium', 'low']).default('high')
});

export type ApplicationQuestionAnswer = z.infer<typeof ApplicationQuestionAnswerSchema>;

export const ApplicationPackageSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().optional(),
  job_id: z.string(),
  company: z.string(),
  role_title: z.string(),
  cover_letter: z.string(),
  answers: z.array(ApplicationQuestionAnswerSchema),
  tailored_resume_id: z.string().optional().nullable(),
  status: ApplicationStatusSchema.default('prepared'),
  approved_by_user: z.boolean().default(false),
  approved_at: z.string().optional().nullable(),
  submitted_at: z.string().optional().nullable(),
  applied_at: z.string().optional().nullable(),
  next_action: z.string().optional().nullable(),
  next_action_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export type ApplicationPackage = z.infer<typeof ApplicationPackageSchema>;
