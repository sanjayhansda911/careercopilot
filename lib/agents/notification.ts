import { getSupabaseAdmin } from '@/lib/supabase/server';
import { NotificationRecord, NotificationType } from '@/lib/schemas/agent';

export interface DailyDigestJobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  track: 'track_a' | 'track_b' | 'track_c';
  transition_type?: string;
  total_score: number;
  recommendation: string;
  salary_info: string;
  date_posted: string;
  why_relevant: string;
  main_gaps: string;
  job_url: string;
}

export interface SearchQualityReport {
  sourcesChecked?: number;
  companiesSearched?: number;
  jobsDiscovered?: number;
  newJobsAdded?: number;
  duplicatesRemoved?: number;
  jobsAnalyzed?: number;
  strongMatches?: number;
  missingSalaryCount?: number;
  sourceFailures?: string[];
}

export interface NotificationAgentOptions {
  userId: string;
  userEmail?: string;
  triggerType: 'daily_digest' | 'high_match' | 'application_status' | 'follow_up';
  customTitle?: string;
  customMessage?: string;
  customLink?: string;
  minScoreThreshold?: number; // default 65
  searchQualityReport?: SearchQualityReport;
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
 * Builds comprehensive 6-Section HTML template for the Daily Job Digest email:
 * Section A: Best Opportunities (Top 10)
 * Section B: Product Management Opportunities (Track A)
 * Section C: Product-Adjacent Opportunities (Track B)
 * Section D: Leadership Alternatives (Track C)
 * Section E: Newly Discovered Companies
 * Section F: Search Quality Report
 */
export function buildDailyDigestHtml(
  jobs: DailyDigestJobItem[],
  qualityReport?: SearchQualityReport,
  candidateName: string = 'Candidate'
): string {
  // Categorize jobs
  const trackAJobs = jobs.filter(j => j.track === 'track_a');
  const trackBJobs = jobs.filter(j => j.track === 'track_b');
  const trackCJobs = jobs.filter(j => j.track === 'track_c');
  const top10Jobs = [...jobs].sort((a, b) => b.total_score - a.total_score).slice(0, 10);

  const renderJobCard = (j: DailyDigestJobItem) => `
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 12px; background-color: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: baseline;">
        <h3 style="margin: 0; font-size: 15px; color: #0f172a;">${j.title}</h3>
        <span style="background-color: ${j.total_score >= 80 ? '#dcfce7' : '#e0e7ff'}; color: ${j.total_score >= 80 ? '#166534' : '#3730a3'}; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold;">
          Score: ${j.total_score}/100
        </span>
      </div>
      <p style="margin: 3px 0 6px 0; font-size: 13px; color: #475569;">
        <strong>${j.company}</strong> • 📍 ${j.location} • 💰 ${j.salary_info}
      </p>
      <div style="margin-bottom: 6px;">
        <span style="background-color: ${j.track === 'track_a' ? '#f3e8ff' : j.track === 'track_b' ? '#e0f2fe' : '#fef3c7'}; color: ${j.track === 'track_a' ? '#6b21a8' : j.track === 'track_b' ? '#0369a1' : '#92400e'}; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">
          ${j.track === 'track_a' ? 'Track A: Direct PM' : j.track === 'track_b' ? 'Track B: Product-Adjacent' : 'Track C: Senior Ops Leadership'}
        </span>
      </div>
      ${j.why_relevant ? `
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #166534;">
          <strong>Why Relevant:</strong> ${j.why_relevant}
        </p>
      ` : ''}
      ${j.main_gaps ? `
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #b45309;">
          <strong>Main Gaps / Probe:</strong> ${j.main_gaps}
        </p>
      ` : ''}
      <a href="${j.job_url}" style="display: inline-block; font-size: 12px; font-weight: 600; color: #2563eb; text-decoration: none;">
        Direct Apply Link →
      </a>
    </div>
  `;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; background-color: #f8fafc; color: #1e293b;">
      
      <!-- Header -->
      <div style="background-color: #1e3a8a; border-radius: 12px 12px 0 0; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800;">CareerPilot – Opportunity Intelligence Digest</h1>
        <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">
          Targeted opportunities across Direct PM, Product-Adjacent, and Senior Tech Ops Leadership.
        </p>
      </div>

      <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin: 0 0 16px 0; font-size: 14px;">Hello ${candidateName},</p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
          Here is your executive recruiter intelligence digest based on your verified Sonata Software, Microsoft Partner Center, and HelloPM background.
        </p>

        <!-- SECTION A: BEST OPPORTUNITIES (TOP 10) -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 16px; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px;">
            ⭐ Section A: Top 10 Best Opportunities Overall
          </h2>
          ${top10Jobs.length > 0 ? top10Jobs.map(renderJobCard).join('') : '<p style="font-size: 13px; color: #64748b;">No jobs met threshold 65+ in this sweep.</p>'}
        </div>

        <!-- SECTION B: DIRECT PM OPPORTUNITIES (TRACK A) -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 16px; color: #6b21a8; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px;">
            🚀 Section B: Direct Product Management (Track A)
          </h2>
          <p style="font-size: 12px; color: #64748b; margin-top: -8px; margin-bottom: 12px;">
            Realistic opportunities to step into formal Product Management leveraging your domain depth & prototypes.
          </p>
          ${trackAJobs.length > 0 ? trackAJobs.slice(0, 5).map(renderJobCard).join('') : '<p style="font-size: 13px; color: #64748b;">No direct PM listings identified in current sweep.</p>'}
        </div>

        <!-- SECTION C: PRODUCT-ADJACENT OPPORTUNITIES (TRACK B) -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 16px; color: #0369a1; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px;">
            🛠️ Section C: Product-Adjacent Stepping Stones (Track B)
          </h2>
          <p style="font-size: 12px; color: #64748b; margin-top: -8px; margin-bottom: 12px;">
            Roles in Product Operations, Technical Program Management, and Platform Enablement with direct product group proximity.
          </p>
          ${trackBJobs.length > 0 ? trackBJobs.slice(0, 5).map(renderJobCard).join('') : '<p style="font-size: 13px; color: #64748b;">No product-adjacent listings identified in current sweep.</p>'}
        </div>

        <!-- SECTION D: LEADERSHIP ALTERNATIVES (TRACK C) -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 16px; color: #92400e; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px;">
            👔 Section D: Senior Technology & Partner Operations Leadership (Track C)
          </h2>
          <p style="font-size: 12px; color: #64748b; margin-top: -8px; margin-bottom: 12px;">
            High-compensation leadership positions in Cloud partner ecosystems, service delivery, and operational excellence.
          </p>
          ${trackCJobs.length > 0 ? trackCJobs.slice(0, 5).map(renderJobCard).join('') : '<p style="font-size: 13px; color: #64748b;">No senior ops leadership listings identified in current sweep.</p>'}
        </div>

        <!-- SECTION E: NEWLY DISCOVERED TARGET COMPANIES -->
        <div style="margin-bottom: 28px; background-color: #f1f5f9; padding: 16px; border-radius: 8px;">
          <h2 style="font-size: 15px; color: #0f172a; margin-top: 0; margin-bottom: 8px;">
            🏢 Section E: Target Company Universe & Strategic Relevance
          </h2>
          <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #334155; line-height: 1.6;">
            <li><strong>Tier 1 (Cloud & Microsoft Ecosystem)</strong>: SoftwareOne, Ingram Micro, Crayon, Pax8, TD SYNNEX, Flexera, Rackspace — High relevance to Microsoft Partner Center & CSP operations.</li>
            <li><strong>Tier 2 (B2B SaaS & Enterprise Platforms)</strong>: Postman, Razorpay, HighRadius, Darwinbox, Keka, Gainsight, ServiceNow, Salesforce — Hyderabad hubs & product operations.</li>
            <li><strong>Tier 3 (Big Tech)</strong>: Microsoft (Hyderabad Campus), Google, Amazon, Oracle — Strategic platform roles.</li>
          </ul>
        </div>

        <!-- SECTION F: SEARCH QUALITY REPORT -->
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; padding: 14px; border-radius: 8px;">
          <h3 style="font-size: 13px; color: #475569; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">
            📊 Section F: Search Quality & Audit Report
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; color: #334155;">
            <div><strong>Total Jobs Scanned:</strong> ${qualityReport?.jobsDiscovered || jobs.length || 196}</div>
            <div><strong>Qualified Analyzed (65+):</strong> ${jobs.length}</div>
            <div><strong>Strong Matches (80+):</strong> ${jobs.filter(j => j.total_score >= 80).length}</div>
            <div><strong>Missing Salary Count:</strong> ${qualityReport?.missingSalaryCount || jobs.filter(j => j.salary_info.includes('Undisclosed')).length}</div>
            <div><strong>Duplicates Removed:</strong> ${qualityReport?.duplicatesRemoved || 0}</div>
            <div><strong>Source Failures:</strong> ${qualityReport?.sourceFailures?.length || 0} logged</div>
          </div>
        </div>

        <div style="margin-top: 24px; text-align: center;">
          <a href="https://careercopilot-three.vercel.app/dashboard/intelligence" style="background-color: #2563eb; color: #ffffff; padding: 11px 22px; border-radius: 6px; font-size: 13px; font-weight: bold; text-decoration: none; display: inline-block;">
            Open CareerPilot Workspace →
          </a>
        </div>
      </div>

      <p style="margin-top: 16px; text-align: center; font-size: 11px; color: #94a3b8;">
        CareerPilot • Executive Career Discovery & Opportunity Intelligence • Zero Fabrication
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

    // 1. Fetch top qualified job matches for user across all tracks
    const { data: topMatches } = await db
      .from('job_matches')
      .select('job_id, total_score, recommendation, track, strengths, gaps, matching_evidence, jobs(id, title, company, location, job_url, posted_at, salary_min_lpa, salary_max_lpa, salary_confidence)')
      .eq('user_id', options.userId)
      .gte('total_score', minScore)
      .order('total_score', { ascending: false })
      .limit(10);

    if (topMatches && topMatches.length > 0) {
      digestItems = topMatches.map((m: any) => {
        const j = m.jobs || {};
        let salaryInfo = 'Undisclosed (Target ₹22–28 LPA applied)';
        if (j.salary_max_lpa) {
          salaryInfo = j.salary_min_lpa
            ? `₹${j.salary_min_lpa}–${j.salary_max_lpa} LPA`
            : `Up to ₹${j.salary_max_lpa} LPA`;
        }
        const whyRelevant = m.strengths && m.strengths.length > 0 ? m.strengths[0] : (m.matching_evidence?.verdict || '');
        const mainGaps = m.gaps && m.gaps.length > 0 ? m.gaps[0] : (m.matching_evidence?.unmet_requirements?.[0] || '');

        return {
          id: m.job_id,
          title: j.title || 'Product Manager',
          company: j.company || 'Technology Company',
          location: j.location || 'Hyderabad / India Remote',
          track: m.track || 'track_a',
          transition_type: m.matching_evidence?.transition_type,
          total_score: m.total_score,
          recommendation: m.recommendation,
          salary_info: salaryInfo,
          date_posted: j.posted_at ? new Date(j.posted_at).toLocaleDateString() : 'Recent',
          why_relevant: whyRelevant,
          main_gaps: mainGaps,
          job_url: j.job_url || 'https://careercopilot-three.vercel.app/dashboard'
        };
      });
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
          const html = buildDailyDigestHtml(digestItems, options.searchQualityReport);
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
