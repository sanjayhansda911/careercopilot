import { getSupabaseAdmin } from '@/lib/supabase/server';
import { runDiscoveryAgent, DiscoveryResult } from './discovery';
import { runIntelligenceAgent } from './intelligence';
import { runNotificationAgent, NotificationResult } from './notification';
import { runAnalyticsAgent, AnalyticsDashboardData } from './analytics';

export interface OrchestratorRunOptions {
  userId?: string;
  userEmail?: string;
  triggerSource?: 'cron' | 'manual' | 'test';
  targetRoleKeywords?: string[];
  maxJobsToAnalyze?: number; // default 5
}

export interface OrchestratorRunSummary {
  runId: string;
  status: 'completed' | 'partial' | 'failed';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  discovery: {
    jobsScanned: number;
    jobsAdded: number;
    jobsUpdated: number;
    jobsDuplicates: number;
  };
  intelligence: {
    jobsAnalyzed: number;
    strongMatches: number;
    reviewMatches: number;
  };
  notification: {
    notificationsCreated: number;
    emailSent: boolean;
  };
  errors: string[];
}

/**
 * Central Orchestrator
 * Coordinates execution order, dependencies, retries, idempotency, and run logs.
 */
export async function runOrchestrator(
  options: OrchestratorRunOptions = {}
): Promise<OrchestratorRunSummary> {
  const startTime = Date.now();
  const db = getSupabaseAdmin();
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  // 1. Resolve User & Career Profile
  let userId = options.userId;
  let userEmail = options.userEmail;
  let candidateProfile: any = null;
  let verifiedFacts: any[] = [];

  try {
    if (userId) {
      const { data: profile } = await db
        .from('career_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      candidateProfile = profile;
    } else {
      // Find the primary profile or demo profile
      const { data: profile } = await db
        .from('career_profiles')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (profile) {
        candidateProfile = profile;
        userId = profile.user_id;
      }
    }

    if (userId) {
      const { data: facts } = await db
        .from('career_facts')
        .select('id, category, fact, metric_value')
        .eq('user_id', userId)
        .eq('verification_status', 'verified');
      verifiedFacts = facts || [];

      // Check notification preferences for email
      if (!userEmail) {
        const { data: notifPref } = await db
          .from('notification_preferences')
          .select('email_address')
          .eq('user_id', userId)
          .maybeSingle();
        userEmail = notifPref?.email_address;
      }
    }
  } catch (err: any) {
    errors.push(`Profile resolution warning: ${err.message || String(err)}`);
  }

  // 2. Initialize search_runs record for idempotency and auditability
  let runId = crypto.randomUUID();
  try {
    const { data: searchRun } = await db
      .from('search_runs')
      .insert({
        user_id: userId || null,
        run_status: 'running',
        started_at: startedAt
      })
      .select('id')
      .single();

    if (searchRun) {
      runId = searchRun.id;
    }
  } catch (err: any) {
    console.warn('[Orchestrator] Failed to insert initial search_run record:', err);
  }

  // 3. Step 1: Execute Discovery Agent
  let discoveryResult: DiscoveryResult = {
    runId,
    jobsScanned: 0,
    jobsAdded: 0,
    jobsUpdated: 0,
    jobsSkippedDuplicates: 0,
    jobIds: [],
    errors: [],
    summary: ''
  };

  try {
    discoveryResult = await runDiscoveryAgent({
      userId,
      searchRunId: runId,
      targetRoleKeywords: options.targetRoleKeywords || candidateProfile?.target_roles
    });
    if (discoveryResult.errors.length > 0) {
      errors.push(...discoveryResult.errors);
    }
  } catch (err: any) {
    const msg = `Discovery Agent failure: ${err.message || String(err)}`;
    errors.push(msg);
    console.error(`[Orchestrator] ${msg}`);
  }

  // 4. Step 2: Execute Intelligence Agent on new/materially changed jobs
  let jobsAnalyzed = 0;
  let strongMatches = 0;
  let reviewMatches = 0;

  if (candidateProfile && verifiedFacts.length > 0) {
    try {
      // Find jobs that need intelligence analysis (unmatched or recently added)
      const maxToAnalyze = options.maxJobsToAnalyze || 5;
      let targetJobIds = discoveryResult.jobIds.slice(0, maxToAnalyze);

      // If discovery didn't add new jobs, pick existing open jobs lacking match evaluation
      if (targetJobIds.length === 0) {
        const { data: existingJobs } = await db
          .from('jobs')
          .select('id')
          .eq('status', 'open')
          .order('discovered_at', { ascending: false })
          .limit(maxToAnalyze);
        targetJobIds = (existingJobs || []).map((j: { id: string }) => j.id);
      }

      for (const jobId of targetJobIds) {
        const { data: job } = await db
          .from('jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (job) {
          try {
            const match = await runIntelligenceAgent({
              job: {
                id: job.id,
                title: job.title,
                company: job.company,
                description: job.description || '',
                location: job.location,
                work_mode: job.work_mode,
                salary_min_lpa: job.salary_min_lpa,
                salary_max_lpa: job.salary_max_lpa
              },
              profile: {
                user_id: userId,
                total_experience_years: candidateProfile.total_experience_years,
                current_title: candidateProfile.current_title,
                current_company: candidateProfile.current_company,
                target_ctc_min_lpa: candidateProfile.target_ctc_min_lpa,
                target_ctc_max_lpa: candidateProfile.target_ctc_max_lpa,
                notice_period_days: candidateProfile.notice_period_days,
                preferred_locations: candidateProfile.preferred_locations,
                preferred_work_modes: candidateProfile.preferred_work_modes,
                target_roles: candidateProfile.target_roles,
                target_domains: candidateProfile.target_domains,
                skills: candidateProfile.skills
              },
              verifiedFacts,
              searchRunId: runId
            });

            jobsAnalyzed++;
            if (match.total_score >= 80) strongMatches++;
            else if (match.total_score >= 65) reviewMatches++;
          } catch (jobMatchErr: any) {
            errors.push(`Intelligence error for job ${job.title}: ${jobMatchErr.message || String(jobMatchErr)}`);
          }
        }
      }
    } catch (err: any) {
      errors.push(`Intelligence step error: ${err.message || String(err)}`);
    }
  }

  // 5. Step 3: Execute Notification Agent (Daily Digest & Notifications)
  let notifResult: NotificationResult = {
    notificationsCreated: 0,
    emailSent: false,
    emailStatus: 'skipped',
    digestItemsCount: 0,
    notificationIds: []
  };

  if (userId) {
    try {
      notifResult = await runNotificationAgent({
        userId,
        userEmail,
        triggerType: 'daily_digest',
        minScoreThreshold: 65
      });
    } catch (err: any) {
      errors.push(`Notification step error: ${err.message || String(err)}`);
    }
  }

  // Note on Resume & Application Agents:
  // As specified in Section 3 of Architecture Specification:
  // "Resume and Application Agents should not run for every discovered job.
  // They should run only when the user selects a suitable opportunity or explicitly requests document preparation."
  // Hence, they are invoked on-demand via the candidate's dashboard actions.

  // 6. Finalize search_runs record
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;
  const finalStatus = errors.length === 0 ? 'completed' : jobsAnalyzed > 0 ? 'partial' : 'failed';

  try {
    await db
      .from('search_runs')
      .update({
        completed_at: completedAt,
        jobs_found: discoveryResult.jobsAdded,
        jobs_matched: jobsAnalyzed,
        run_status: finalStatus,
        errors
      })
      .eq('id', runId);

    // Record orchestrator run in agent_runs
    if (userId) {
      await db.from('agent_runs').insert({
        search_run_id: runId,
        user_id: userId,
        agent_name: 'orchestrator',
        status: finalStatus,
        input_summary: { triggerSource: options.triggerSource || 'manual' },
        output_summary: {
          jobsAdded: discoveryResult.jobsAdded,
          jobsAnalyzed,
          strongMatches,
          notificationsCreated: notifResult.notificationsCreated
        },
        error_message: errors.length > 0 ? errors.join('; ') : null,
        duration_ms: durationMs
      });
    }
  } catch (saveErr) {
    console.warn('[Orchestrator] Error updating final run status:', saveErr);
  }

  return {
    runId,
    status: finalStatus,
    startedAt,
    completedAt,
    durationMs,
    discovery: {
      jobsScanned: discoveryResult.jobsScanned,
      jobsAdded: discoveryResult.jobsAdded,
      jobsUpdated: discoveryResult.jobsUpdated,
      jobsDuplicates: discoveryResult.jobsSkippedDuplicates
    },
    intelligence: {
      jobsAnalyzed,
      strongMatches,
      reviewMatches
    },
    notification: {
      notificationsCreated: notifResult.notificationsCreated,
      emailSent: notifResult.emailSent
    },
    errors
  };
}
