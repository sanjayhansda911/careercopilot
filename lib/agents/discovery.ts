import { getSupabaseAdmin } from '@/lib/supabase/server';
import { JobRecord } from '@/lib/schemas/job';
import {
  RawATSJob,
  fetchGreenhouseJobs,
  fetchLeverJobs,
  fetchAshbyJobs,
  normalizeJobUrl,
  validateJobUrl
} from '@/lib/adapters/ats';

export interface DiscoveryOptions {
  userId?: string;
  searchRunId?: string;
  sources?: Array<{
    id?: string;
    name: string;
    type: 'greenhouse' | 'lever' | 'ashby' | 'tinyfish' | 'manual';
    identifier: string; // e.g. 'stripe', 'figma'
  }>;
  targetRoleKeywords?: string[];
  locationKeywords?: string[];
}

export interface DiscoveryResult {
  runId: string;
  jobsScanned: number;
  jobsAdded: number;
  jobsUpdated: number;
  jobsSkippedDuplicates: number;
  jobIds: string[];
  errors: string[];
  summary: string;
}

// Default verified high-yield tech sources targeting Product Management & Engineering
const DEFAULT_TECH_SOURCES = [
  { name: 'GitLab', type: 'greenhouse' as const, identifier: 'gitlab' },
  { name: 'Figma', type: 'lever' as const, identifier: 'figma' },
  { name: 'Postman', type: 'greenhouse' as const, identifier: 'postman' },
  { name: 'Linear', type: 'ashby' as const, identifier: 'linear' }
];

const DEFAULT_TARGET_KEYWORDS = [
  'product manager',
  'product operations',
  'platform product',
  'partner experience',
  'associate product manager',
  'technical product manager',
  'lead product manager',
  'director of product'
];

/**
 * Discovery Agent: searches configured sources, normalizes, deduplicates,
 * validates, detects expired listings, and stores jobs in Supabase.
 */
export async function runDiscoveryAgent(options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const runId = options.searchRunId || crypto.randomUUID();
  const db = getSupabaseAdmin();
  const errors: string[] = [];

  const sourcesToScan = options.sources && options.sources.length > 0 ? options.sources : DEFAULT_TECH_SOURCES;
  const roleKeywords = (options.targetRoleKeywords || DEFAULT_TARGET_KEYWORDS).map(k => k.toLowerCase());

  let totalScanned = 0;
  let totalAdded = 0;
  let totalUpdated = 0;
  let totalDuplicates = 0;
  const discoveredJobIds: string[] = [];

  for (const source of sourcesToScan) {
    let rawJobs: RawATSJob[] = [];
    try {
      if (source.type === 'greenhouse') {
        rawJobs = await fetchGreenhouseJobs(source.identifier, source.name);
      } else if (source.type === 'lever') {
        rawJobs = await fetchLeverJobs(source.identifier, source.name);
      } else if (source.type === 'ashby') {
        rawJobs = await fetchAshbyJobs(source.identifier, source.name);
      }
    } catch (err: any) {
      const msg = `Source ${source.name} error: ${err.message || String(err)}`;
      errors.push(msg);
      console.warn(`[Discovery Agent] ${msg}`);
      continue;
    }

    totalScanned += rawJobs.length;

    // Filter relevant jobs by title keywords
    const relevantJobs = rawJobs.filter(j => {
      const titleLower = j.title.toLowerCase();
      return roleKeywords.some(kw => titleLower.includes(kw));
    });

    for (const job of relevantJobs) {
      try {
        const canonicalUrl = normalizeJobUrl(job.job_url);

        // Check if job already exists by canonical URL
        const { data: existing } = await db
          .from('jobs')
          .select('id, status, description')
          .eq('canonical_url', canonicalUrl)
          .maybeSingle();

        if (existing) {
          // If existing and open, count as duplicate; if description changed, update
          totalDuplicates++;
          if (existing.description !== job.description && job.description) {
            await db
              .from('jobs')
              .update({
                description: job.description,
                status: 'open',
                is_active: true
              })
              .eq('id', existing.id);
            totalUpdated++;
          }
          discoveredJobIds.push(existing.id);
          continue;
        }

        // Validate URL before inserting
        const isValid = await validateJobUrl(canonicalUrl);

        const { data: inserted, error: insertErr } = await db
          .from('jobs')
          .insert({
            canonical_url: canonicalUrl,
            title: job.title,
            company: job.company,
            location: job.location || 'India Remote / Hybrid',
            work_mode: job.work_mode || 'unspecified',
            employment_type: job.employment_type || 'full_time',
            job_url: canonicalUrl,
            description: job.description,
            salary_min_lpa: job.salary_min_lpa || null,
            salary_max_lpa: job.salary_max_lpa || null,
            salary_currency: 'INR',
            salary_confidence: 'undisclosed',
            status: isValid ? 'open' : 'unverified',
            is_active: isValid,
            posted_at: job.posted_at || new Date().toISOString()
          })
          .select('id')
          .single();

        if (insertErr) {
          errors.push(`Failed to insert job ${job.title} at ${job.company}: ${insertErr.message}`);
        } else if (inserted) {
          totalAdded++;
          discoveredJobIds.push(inserted.id);
        }
      } catch (err: any) {
        errors.push(`Error processing job ${job.title}: ${err.message || String(err)}`);
      }
    }
  }

  // Record discovery run in agent_runs if userId is provided
  if (options.userId) {
    try {
      await db.from('agent_runs').insert({
        search_run_id: options.searchRunId || null,
        user_id: options.userId,
        agent_name: 'discovery',
        status: errors.length > 0 && totalAdded === 0 ? 'failed' : 'completed',
        input_summary: { sourcesCount: sourcesToScan.length, keywordsCount: roleKeywords.length },
        output_summary: {
          jobsScanned: totalScanned,
          jobsAdded: totalAdded,
          jobsUpdated: totalUpdated,
          jobsDuplicates: totalDuplicates
        },
        error_message: errors.length > 0 ? errors.join('; ') : null,
        duration_ms: Date.now() - startTime
      });
    } catch (logErr) {
      console.warn('[Discovery Agent] Failed to write agent_run log:', logErr);
    }
  }

  const summary = `Scanned ${totalScanned} listings across ${sourcesToScan.length} sources. Discovered ${totalAdded} new jobs, updated ${totalUpdated}, and deduplicated ${totalDuplicates}.`;

  return {
    runId,
    jobsScanned: totalScanned,
    jobsAdded: totalAdded,
    jobsUpdated: totalUpdated,
    jobsSkippedDuplicates: totalDuplicates,
    jobIds: discoveredJobIds,
    errors,
    summary
  };
}

/**
 * Ingests a single manual job entry provided by the user.
 */
export async function ingestManualJob(input: {
  title: string;
  company: string;
  job_url: string;
  location?: string | null;
  work_mode?: 'remote' | 'hybrid' | 'on-site' | 'unspecified';
  employment_type?: 'full_time' | 'contract' | 'part_time' | 'internship';
  description: string;
  salary_min_lpa?: number | null;
  salary_max_lpa?: number | null;
  salary_confidence?: 'verified' | 'advertised' | 'estimated' | 'undisclosed';
  userId?: string;
}): Promise<{ job: JobRecord; isNew: boolean }> {
  const db = getSupabaseAdmin();
  const canonicalUrl = normalizeJobUrl(input.job_url);

  const { data: existing } = await db
    .from('jobs')
    .select('*')
    .eq('canonical_url', canonicalUrl)
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await db
      .from('jobs')
      .update({
        title: input.title,
        company: input.company,
        location: input.location || existing.location,
        work_mode: input.work_mode || existing.work_mode,
        description: input.description,
        salary_min_lpa: input.salary_min_lpa ?? existing.salary_min_lpa,
        salary_max_lpa: input.salary_max_lpa ?? existing.salary_max_lpa,
        status: 'open',
        is_active: true
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update existing job: ${error.message}`);
    return { job: updated as JobRecord, isNew: false };
  }

  const { data: created, error } = await db
    .from('jobs')
    .insert({
      canonical_url: canonicalUrl,
      title: input.title,
      company: input.company,
      location: input.location || 'India Remote / Hybrid',
      work_mode: input.work_mode || 'unspecified',
      employment_type: input.employment_type || 'full_time',
      job_url: canonicalUrl,
      description: input.description,
      salary_min_lpa: input.salary_min_lpa ?? null,
      salary_max_lpa: input.salary_max_lpa ?? null,
      salary_confidence: input.salary_confidence || (input.salary_max_lpa ? 'advertised' : 'undisclosed'),
      status: 'open',
      is_active: true,
      posted_at: new Date().toISOString()
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to ingest manual job: ${error.message}`);
  return { job: created as JobRecord, isNew: true };
}
