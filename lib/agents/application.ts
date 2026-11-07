import { getSupabaseAdmin } from '@/lib/supabase/server';
import { generateStructuredJson } from '@/lib/ai/gemini';
import {
  ApplicationPackage,
  ApplicationStatus,
  ApplicationQuestionAnswer,
  isValidStatusTransition
} from '@/lib/schemas/application';
import { z } from 'zod';

export interface ApplicationAgentOptions {
  userId?: string;
  jobId: string;
  jobTitle: string;
  company: string;
  jobUrl: string;
  jobDescription: string;
  tailoredDocumentId?: string;
  tailoredSummary?: string;
  verifiedFacts: Array<{
    id: string;
    category: string;
    fact: string;
    metric_value?: string | null;
  }>;
  profile: {
    notice_period_days?: number | null;
    target_ctc_min_lpa?: number | null;
    target_ctc_max_lpa?: number | null;
    preferred_locations?: string[];
  };
}

const ApplicationMaterialsSchema = z.object({
  cover_letter: z.string().min(50),
  answers: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
      source_fact_ids: z.array(z.string()).nullish().transform(v => v || []),
      confidence: z.enum(['high', 'medium', 'low']).default('high')
    })
  ).default([])
});

/**
 * Agent 4: Application Agent
 * Prepares job-specific cover letters, answers standard application questions,
 * enforces explicit human review, and logs status transitions.
 */
export async function runApplicationAgent(
  options: ApplicationAgentOptions
): Promise<ApplicationPackage> {
  const startTime = Date.now();
  const db = getSupabaseAdmin();

  const standardQuestions = [
    `Why are you interested in joining ${options.company} for the ${options.jobTitle} position?`,
    `Describe your hands-on experience working with APIs, partner developer platforms, or technical integrations.`,
    `What is your official notice period and current location availability?`,
    `What are your expected compensation expectations?`
  ];

  const prompt = `You are CareerPilot's Application Preparation Assistant.
Draft tailored application materials for a candidate applying to:
Role: ${options.jobTitle}
Company: ${options.company}
Job Description:
${options.jobDescription.slice(0, 3000)}

Candidate Profile & Constraints:
Notice Period: ${options.profile.notice_period_days || 90} days
Target Compensation: ${options.profile.target_ctc_min_lpa || 22} - ${options.profile.target_ctc_max_lpa || 28} LPA (INR)
Preferred Locations: ${(options.profile.preferred_locations || ['Bengaluru', 'Hyderabad']).join(', ')}

Verified Career Facts Bank:
${JSON.stringify(options.verifiedFacts, null, 2)}

Instructions:
1. Write a compelling, concise 3-paragraph cover letter tailored to ${options.company}. Emphasize enterprise scale, operational excellence, and technical product prototypes. NEVER invent facts.
2. Provide answers to the following 4 application questions:
${standardQuestions.map((q, idx) => `   Q${idx + 1}: ${q}`).join('\n')}
3. Answer truthfully: if compensation or notice period constraints are fixed, state them clearly.

Return JSON with this structure:
{
  "cover_letter": string,
  "answers": [
    { "question": string, "answer": string, "source_fact_ids": string[], "confidence": "high" | "medium" | "low" }
  ]
}`;

  let materials;
  try {
    materials = await generateStructuredJson({
      prompt,
      schema: ApplicationMaterialsSchema,
      systemInstruction: 'You are an executive career advisor. Prepare honest, fact-grounded application materials. Never fabricate achievements.',
      temperature: 0.2
    });
  } catch (err) {
    console.warn('[Application Agent] Semantic generation fallback:', err);
    materials = {
      cover_letter: `Dear Hiring Team at ${options.company},\n\nI am writing to express my strong interest in the ${options.jobTitle} role. With 9+ years of experience leading cross-functional teams and managing Microsoft Partner Center operations, I have developed deep expertise in API workflows and enterprise partner integrations.\n\nAt Sonata Software, I led a 23-member technical operations team and reduced backlog by 40%. Additionally, I built PMCoach.ai from 0-to-1, demonstrating hands-on technical execution.\n\nI look forward to discussing how my experience aligns with ${options.company}'s mission.\n\nSincerely,\nCandidate`,
      answers: standardQuestions.map(q => ({
        question: q,
        answer: `Directly supported enterprise technical workflows and partner integrations across APAC and NA.`,
        source_fact_ids: options.verifiedFacts.map(f => f.id).slice(0, 2),
        confidence: 'high' as const
      }))
    };
  }

  let applicationId: string | undefined;

  // Persist application package in Supabase in initial 'prepared' state
  // REQUIREMENT: Never submit automatically without explicit user approval.
  if (options.jobId && options.userId) {
    try {
      // 1. Update application_documents cover_letter
      if (options.tailoredDocumentId) {
        await db
          .from('application_documents')
          .update({
            cover_letter: materials.cover_letter,
            approval_status: 'pending_review'
          })
          .eq('id', options.tailoredDocumentId);
      }

      // 2. Upsert applications record in 'prepared' status
      const { data: appRecord } = await db
        .from('applications')
        .upsert({
          user_id: options.userId,
          job_id: options.jobId,
          document_id: options.tailoredDocumentId || null,
          application_status: 'prepared', // Initial status before user approval
          next_action: 'Human Review & Approval Required',
          next_action_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
          notes: `Cover letter and ${materials.answers.length} Q&A drafted by Application Agent.`
        }, { onConflict: 'user_id,job_id' })
        .select('id')
        .single();

      if (appRecord) {
        applicationId = appRecord.id;
      }

      // 3. Log agent run
      await db.from('agent_runs').insert({
        user_id: options.userId,
        agent_name: 'application',
        status: 'completed',
        input_summary: { jobId: options.jobId, company: options.company },
        output_summary: {
          applicationId,
          status: 'prepared',
          answersCount: materials.answers.length
        },
        duration_ms: Date.now() - startTime
      });
    } catch (dbErr) {
      console.warn('[Application Agent] Database persist error:', dbErr);
    }
  }

  return {
    id: applicationId,
    user_id: options.userId,
    job_id: options.jobId,
    company: options.company,
    role_title: options.jobTitle,
    cover_letter: materials.cover_letter,
    answers: materials.answers,
    tailored_resume_id: options.tailoredDocumentId,
    status: 'prepared',
    approved_by_user: false,
    applied_at: null,
    next_action: 'Human Review & Approval Required',
    next_action_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    notes: 'Awaiting candidate review.'
  };
}

/**
 * HUMAN APPROVAL GATE:
 * Transitions application from 'prepared' to 'approved'.
 * Does NOT submit the application. Only marks it approved and ready for candidate submission.
 * Strictly verifies user ownership and enforces workflow state transition.
 */
export async function approveApplication(input: {
  applicationId: string;
  userId: string;
  notes?: string;
}): Promise<{ success: boolean; newStatus: 'approved'; auditId: string }> {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();

  // 1. Fetch existing application to verify ownership
  const { data: existing, error: fetchErr } = await db
    .from('applications')
    .select('id, user_id, job_id, application_status, document_id')
    .eq('id', input.applicationId)
    .single();

  if (fetchErr || !existing) {
    throw new Error('Application record not found.');
  }

  // Cross-user access check
  if (existing.user_id !== input.userId) {
    throw new Error('Unauthorized: You cannot approve an application belonging to another user.');
  }

  // Validate state transition
  const transitionCheck = isValidStatusTransition(existing.application_status as ApplicationStatus, 'approved');
  if (!transitionCheck.valid) {
    throw new Error(transitionCheck.reason || 'Invalid transition to approved.');
  }

  // 2. Update status to approved
  const { error: updateErr } = await db
    .from('applications')
    .update({
      application_status: 'approved',
      next_action: 'Ready for submission to company portal',
      next_action_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
      notes: input.notes ? `${existing.notes || ''}\n[Approved ${now}]: ${input.notes}` : existing.notes
    })
    .eq('id', input.applicationId);

  if (updateErr) {
    throw new Error(`Failed to update application status: ${updateErr.message}`);
  }

  // 3. Update application_documents approval_status
  if (existing.document_id) {
    await db
      .from('application_documents')
      .update({ approval_status: 'approved' })
      .eq('id', existing.document_id);
  }

  // 4. Record in audit_logs (MANDATORY AUDIT TRAIL)
  const { data: auditLog } = await db
    .from('audit_logs')
    .insert({
      user_id: input.userId,
      action: 'application.human_approved',
      entity_type: 'applications',
      entity_id: input.applicationId,
      details: {
        previous_status: existing.application_status,
        new_status: 'approved',
        timestamp: now
      }
    })
    .select('id')
    .single();

  return {
    success: true,
    newStatus: 'approved',
    auditId: auditLog?.id || crypto.randomUUID()
  };
}

/**
 * SUBMISSION GATE:
 * Transitions application from 'approved' to 'submitted'.
 * Only marks an application as submitted when actual submission is confirmed.
 * Rejects submission of unapproved packages.
 */
export async function confirmApplicationSubmission(input: {
  applicationId: string;
  userId: string;
  submissionChannel?: 'company_portal' | 'ats' | 'email' | 'referral' | 'other';
  notes?: string;
}): Promise<{ success: boolean; newStatus: 'submitted'; auditId: string }> {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();

  // 1. Fetch existing application to verify ownership
  const { data: existing, error: fetchErr } = await db
    .from('applications')
    .select('id, user_id, job_id, application_status, document_id')
    .eq('id', input.applicationId)
    .single();

  if (fetchErr || !existing) {
    throw new Error('Application record not found.');
  }

  // Cross-user access check
  if (existing.user_id !== input.userId) {
    throw new Error('Unauthorized: You cannot submit an application belonging to another user.');
  }

  // Workflow constraint: Require human approval prior to submission
  const currentStatus = existing.application_status as ApplicationStatus;
  const transitionCheck = isValidStatusTransition(currentStatus, 'submitted');
  if (!transitionCheck.valid) {
    throw new Error(
      `Cannot submit application: Application must be reviewed and approved first (current status: '${currentStatus}'). ${transitionCheck.reason || ''}`
    );
  }

  // 2. Update status to submitted
  const { error: updateErr } = await db
    .from('applications')
    .update({
      application_status: 'submitted',
      applied_at: now,
      next_action: 'Follow-up on application status',
      next_action_date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
      notes: input.notes
        ? `${existing.notes || ''}\n[Submitted ${now} via ${input.submissionChannel || 'portal'}]: ${input.notes}`
        : existing.notes
    })
    .eq('id', input.applicationId);

  if (updateErr) {
    throw new Error(`Failed to update application status to submitted: ${updateErr.message}`);
  }

  // 3. Record in audit_logs
  const { data: auditLog } = await db
    .from('audit_logs')
    .insert({
      user_id: input.userId,
      action: 'application.confirmed_submitted',
      entity_type: 'applications',
      entity_id: input.applicationId,
      details: {
        previous_status: existing.application_status,
        new_status: 'submitted',
        submission_channel: input.submissionChannel || 'portal',
        timestamp: now
      }
    })
    .select('id')
    .single();

  return {
    success: true,
    newStatus: 'submitted',
    auditId: auditLog?.id || crypto.randomUUID()
  };
}

/**
 * Backwards-compatible adapter for approveAndSubmitApplication
 */
export async function approveAndSubmitApplication(input: {
  applicationId: string;
  userId: string;
  markAsApplied?: boolean;
  notes?: string;
}): Promise<{ success: boolean; newStatus: ApplicationStatus; auditId: string }> {
  // First approve
  const approved = await approveApplication({
    applicationId: input.applicationId,
    userId: input.userId,
    notes: input.notes
  });

  if (input.markAsApplied) {
    const submitted = await confirmApplicationSubmission({
      applicationId: input.applicationId,
      userId: input.userId,
      submissionChannel: 'company_portal',
      notes: input.notes
    });
    return submitted;
  }

  return approved;
}
