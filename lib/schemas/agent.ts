import { z } from 'zod';

export const AgentNameSchema = z.enum([
  'discovery',
  'intelligence',
  'resume',
  'application',
  'analytics',
  'notification',
  'orchestrator'
]);

export type AgentName = z.infer<typeof AgentNameSchema>;

export const AgentRunStatusSchema = z.enum(['running', 'completed', 'failed', 'skipped']);

export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;

export const AgentRunRecordSchema = z.object({
  id: z.string().uuid().optional(),
  search_run_id: z.string().uuid().nullable().optional(),
  user_id: z.string().uuid().optional(),
  agent_name: AgentNameSchema,
  status: AgentRunStatusSchema.default('running'),
  input_summary: z.record(z.unknown()).default({}),
  output_summary: z.record(z.unknown()).default({}),
  error_message: z.string().nullable().optional(),
  duration_ms: z.number().nullable().optional(),
  created_at: z.string().optional()
});

export type AgentRunRecord = z.infer<typeof AgentRunRecordSchema>;

export const NotificationTypeSchema = z.enum([
  'daily_digest',
  'high_match',
  'application_status',
  'follow_up',
  'system'
]);

export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationRecordSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  type: NotificationTypeSchema,
  title: z.string(),
  message: z.string(),
  link: z.string().nullable().optional(),
  is_read: z.boolean().default(false),
  email_sent: z.boolean().default(false),
  delivery_status: z.enum(['pending', 'delivered', 'failed', 'skipped']).default('delivered'),
  metadata: z.record(z.unknown()).default({}),
  created_at: z.string().optional()
});

export type NotificationRecord = z.infer<typeof NotificationRecordSchema>;
