import { getSupabaseAdmin } from '@/lib/supabase/server';
import { NotificationRecord, NotificationType } from '@/lib/schemas/agent';

export interface DailyDigestJobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  total_score: number;
  recommendation: string;
  strengths: string[];
  job_url: string;
}

export interface NotificationAgentOptions {
  userId: string;
  userEmail?: string;
  triggerType: 'daily_digest' | 'high_match' | 'application_status' | 'follow_up';
  customTitle?: string;
  customMessage?: string;
  customLink?: string;
  minScoreThreshold?: number; // default 65
}

export interface NotificationResult {
  notificationsCreated: number;
  emailSent: boolean;
  emailStatus: 'delivered' | 'skipped' | 'failed';
  digestItemsCount: number;
  notificationIds: string[];
}

/**
 * Sends an email via Resend API (or logs in dev mode if API key is not set).
 */
export async function sendEmailViaResend(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey.trim().length === 0 || apiKey.includes('dummy')) {
    console.log(`[Notification Agent] RESEND_API_KEY not configured. Simulated email dispatch to ${params.to}: "${params.subject}"`);
    return { success: true, id: `simulated-${Date.now()}` };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'CareerPilot <digest@careerpilot.app>',
        to: [params.to],
        subject: params.subject,
        html: params.html
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = `Resend API returned ${res.status}: ${JSON.stringify(errJson)}`;
      console.warn(`[Notification Agent] ${msg}`);
      return { success: false, error: msg };
    }

    const data = await res.json();
    return { success: true, id: data.id };
  } catch (err: any) {
    console.warn('[Notification Agent] Email dispatch exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Builds HTML template for the Daily Job Digest email.
 */
export function buildDailyDigestHtml(jobs: DailyDigestJobItem[], candidateName: string = 'Candidate'): string {
  const topJobsHtml = jobs.map(j => `
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; background-color: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: baseline;">
        <h3 style="margin: 0; font-size: 16px; color: #0f172a;">${j.title}</h3>
        <span style="background-color: ${j.total_score >= 80 ? '#dcfce7' : '#e0e7ff'}; color: ${j.total_score >= 80 ? '#166534' : '#3730a3'}; padding: 4px 8px; border-radius: 9999px; font-size: 12px; font-weight: bold;">
          Score: ${j.total_score}/100
        </span>
      </div>
      <p style="margin: 4px 0 8px 0; font-size: 13px; color: #475569;">
        <strong>${j.company}</strong> • ${j.location || 'Remote / Hybrid'}
      </p>
      ${j.strengths.length > 0 ? `
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #166534;">
          <strong>Key Match:</strong> ${j.strengths[0]}
        </p>
      ` : ''}
      <a href="${j.job_url}" style="display: inline-block; font-size: 12px; font-weight: 600; color: #2563eb; text-decoration: none;">
        View Job Posting →
      </a>
    </div>
  `).join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc;">
      <div style="background-color: #1e3a8a; border-radius: 12px 12px 0 0; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800;">CareerPilot Daily Job Digest</h1>
        <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Top product management opportunities matched to your verified career facts.</p>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">Hello ${candidateName},</p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #334155;">
          Here are your top qualified job matches discovered today (scores 65+):
        </p>
        ${topJobsHtml}
        <div style="margin-top: 24px; text-align: center;">
          <a href="http://localhost:3000/dashboard" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: bold; text-decoration: none; display: inline-block;">
            Open CareerPilot Workspace →
          </a>
        </div>
      </div>
      <p style="margin-top: 16px; text-align: center; font-size: 11px; color: #94a3b8;">
        CareerPilot • Zero fabrication career intelligence • Never submits applications automatically.
      </p>
    </div>
  `;
}

/**
 * Agent 6: Notification Agent
 * Prepares daily digests, dispatches Resend email, and creates in-app notifications.
 */
export async function runNotificationAgent(options: NotificationAgentOptions): Promise<NotificationResult> {
  const startTime = Date.now();
  const db = getSupabaseAdmin();
  const createdNotificationIds: string[] = [];
  const minScore = options.minScoreThreshold || 65;

  let emailSent = false;
  let emailStatus: 'delivered' | 'skipped' | 'failed' = 'skipped';
  let digestItems: DailyDigestJobItem[] = [];

  if (options.triggerType === 'daily_digest') {
    // 0. Query user notification preferences
    const { data: pref } = await db
      .from('notification_preferences')
      .select('daily_enabled, email_enabled, email_address')
      .eq('user_id', options.userId)
      .maybeSingle();

    const isDailyEnabled = pref ? pref.daily_enabled !== false : true;
    const isEmailEnabled = pref ? pref.email_enabled !== false : true;
    const recipientEmail = options.userEmail || pref?.email_address;

    if (!isDailyEnabled) {
      console.info(`[Notification Agent] Daily digest skipped for user ${options.userId} (daily_enabled=false)`);
      return {
        notificationsCreated: 0,
        emailSent: false,
        emailStatus: 'skipped',
        digestItemsCount: 0,
        notificationIds: []
      };
    }

    // 1. Fetch top qualified job matches for user
    const { data: topMatches } = await db
      .from('job_matches')
      .select('job_id, total_score, recommendation, strengths, jobs(id, title, company, location, job_url)')
      .eq('user_id', options.userId)
      .gte('total_score', minScore)
      .order('total_score', { ascending: false })
      .limit(5);

    if (topMatches && topMatches.length > 0) {
      digestItems = topMatches.map((m: any) => ({
        id: m.job_id,
        title: m.jobs?.title || 'Product Manager',
        company: m.jobs?.company || 'Technology Company',
        location: m.jobs?.location || 'India',
        total_score: m.total_score,
        recommendation: m.recommendation,
        strengths: m.strengths || [],
        job_url: m.jobs?.job_url || 'http://localhost:3000/dashboard'
      }));
    }

    // 2. Avoid duplicate notifications: check if daily_digest notification was already sent today
    const todayIso = new Date().toISOString().slice(0, 10);
    const { data: existingToday } = await db
      .from('notifications')
      .select('id')
      .eq('user_id', options.userId)
      .eq('type', 'daily_digest')
      .gte('created_at', `${todayIso}T00:00:00.000Z`)
      .limit(1);

    if (existingToday && existingToday.length > 0) {
      console.info(`[Notification Agent] Suppressed duplicate daily digest for user ${options.userId} (already sent today)`);
      emailStatus = 'skipped';
    } else {
      const digestCount = digestItems.length;
      const title = `Daily Digest: ${digestCount} new qualified match${digestCount === 1 ? '' : 'es'}`;
      const message = digestCount > 0
        ? `Top match: ${digestItems[0].title} at ${digestItems[0].company} (Score ${digestItems[0].total_score}/100)`
        : `No new matches met the score threshold (65+) today. Discovery continues.`;

      const { data: notif } = await db
        .from('notifications')
        .insert({
          user_id: options.userId,
          type: 'daily_digest',
          title,
          message,
          link: '/dashboard/intelligence',
          is_read: false,
          delivery_status: 'delivered',
          metadata: { matchesCount: digestCount, topJobId: digestItems[0]?.id }
        })
        .select('id')
        .single();

      if (notif) {
        createdNotificationIds.push(notif.id);
      }

      // 3. Dispatch Email if email is available and enabled in preferences
      if (recipientEmail && digestItems.length > 0) {
        if (!isEmailEnabled) {
          console.info(`[Notification Agent] Email delivery skipped for user ${options.userId} (email_enabled=false)`);
          emailStatus = 'skipped';
        } else {
          const html = buildDailyDigestHtml(digestItems);
          const emailRes = await sendEmailViaResend({
            to: recipientEmail,
            subject: `CareerPilot Daily Digest: ${digestItems.length} High-Match PM Opportunities`,
            html
          });
          emailSent = emailRes.success;
          emailStatus = emailRes.success ? 'delivered' : 'failed';

          if (notif) {
            await db
              .from('notifications')
              .update({
                email_sent: emailRes.success,
                delivery_status: emailRes.success ? 'delivered' : 'failed',
                metadata: {
                  matchesCount: digestCount,
                  topJobId: digestItems[0]?.id,
                  emailError: emailRes.error || null
                }
              })
              .eq('id', notif.id);
          }
        }
      }
    }
  } else if (options.triggerType === 'application_status') {
    // Single status-change notification
    const { data: notif } = await db
      .from('notifications')
      .insert({
        user_id: options.userId,
        type: 'application_status',
        title: options.customTitle || 'Application Status Updated',
        message: options.customMessage || 'An application status transition was recorded.',
        link: options.customLink || '/dashboard/applications',
        is_read: false,
        delivery_status: 'delivered'
      })
      .select('id')
      .single();

    if (notif) {
      createdNotificationIds.push(notif.id);
    }
  }

  // Record agent run
  try {
    await db.from('agent_runs').insert({
      user_id: options.userId,
      agent_name: 'notification',
      status: 'completed',
      input_summary: { triggerType: options.triggerType, emailProvided: Boolean(options.userEmail) },
      output_summary: {
        createdCount: createdNotificationIds.length,
        digestItemsCount: digestItems.length,
        emailSent
      },
      duration_ms: Date.now() - startTime
    });
  } catch (err) {
    console.warn('[Notification Agent] Agent run logging error:', err);
  }

  return {
    notificationsCreated: createdNotificationIds.length,
    emailSent,
    emailStatus,
    digestItemsCount: digestItems.length,
    notificationIds: createdNotificationIds
  };
}
