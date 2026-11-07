import { getSupabaseAdmin } from '@/lib/supabase/server';
import { JobRecord } from '@/lib/schemas/job';
import {
  RawATSJob,
  fetchGreenhouseJobs,
  fetchLeverJobs,
  fetchAshbyJobs,
  fetchLinkedInJobs,
  normalizeJobUrl,
  validateJobUrl
} from '@/lib/adapters/ats';

export interface DiscoveryOptions {
  userId?: string;
  searchRunId?: string;
  sources?: Array<{
    id?: string;
    name: string;
    type: 'greenhouse' | 'lever' | 'ashby' | 'linkedin' | 'tinyfish' | 'manual';
    identifier: string; // e.g. 'stripe', 'cloudflare', 'Product Manager India'
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

// Three Career Search Tracks
export type JobTrack = 'track_a' | 'track_b' | 'track_c';

export const TRACK_A_DIRECT_PM = [
  'associate product manager',
  'product manager',
  'product manager ii',
  'technical product manager',
  'platform product manager',
  'api product manager',
  'b2b saas product manager',
  'product manager - cloud',
  'product manager - integrations',
  'product manager - partner ecosystem',
  'product manager - developer platform',
  'product manager - ai products',
  'product owner',
  'product management specialist'
];

export const TRACK_B_PRODUCT_ADJACENT = [
  'product operations manager',
  'product operations lead',
  'product operations',
  'product enablement manager',
  'technical program manager',
  'platform operations manager',
  'partner product manager',
  'product strategy and operations',
  'product strategy & operations',
  'product implementation manager',
  'product experience manager',
  'technical product specialist',
  'platform program manager',
  'product analyst'
];

export const TRACK_C_SENIOR_TECH_OPS = [
  'senior operations manager',
  'technical operations manager',
  'partner operations manager',
  'senior manager - partner experience',
  'partner experience manager',
  'customer experience manager',
  'customer success operations manager',
  'service delivery manager',
  'senior service delivery manager',
  'support operations manager',
  'cloud operations manager',
  'microsoft partner ecosystem manager',
  'partner enablement manager',
  'technical account operations manager',
  'business operations manager',
  'senior manager - managed services',
  'global operations manager'
];

export const ALL_TRACK_KEYWORDS = [
  ...TRACK_A_DIRECT_PM,
  ...TRACK_B_PRODUCT_ADJACENT,
  ...TRACK_C_SENIOR_TECH_OPS
];

/**
 * Classifies a job into one of the 3 career search tracks:
 * - Track A: Direct Product Management
 * - Track B: Product-Adjacent Roles
 * - Track C: Senior Technology & Partner Operations
 */
export function classifyJobTrack(title: string, description: string = ''): JobTrack {
  const t = title.toLowerCase();

  for (const kw of TRACK_A_DIRECT_PM) {
    if (t.includes(kw)) return 'track_a';
  }
  for (const kw of TRACK_B_PRODUCT_ADJACENT) {
    if (t.includes(kw)) return 'track_b';
  }
  for (const kw of TRACK_C_SENIOR_TECH_OPS) {
    if (t.includes(kw)) return 'track_c';
  }

  // Heuristic fallbacks
  if (t.includes('product manager') || t.includes('apm') || t.includes('tpm') || t.includes('product owner')) {
    return 'track_a';
  }
  if (t.includes('product') || t.includes('program') || t.includes('enablement')) {
    return 'track_b';
  }
  return 'track_c';
}

// Default verified high-yield tech sources with Hyderabad & India Remote priority
export const DEFAULT_TECH_SOURCES = [
  // 1. LinkedIn Targeted Streams - Hyderabad, India Remote & Microsoft Ecosystem
  { name: 'LinkedIn Hyderabad (Product Management)', type: 'linkedin' as const, identifier: 'Product Manager in Hyderabad' },
  { name: 'LinkedIn Hyderabad (Product Ops & Platform)', type: 'linkedin' as const, identifier: 'Product Operations in Hyderabad' },
  { name: 'LinkedIn Hyderabad (Partner & Tech Ops)', type: 'linkedin' as const, identifier: 'Operations Manager in Hyderabad' },
  { name: 'LinkedIn Remote (Platform & PM)', type: 'linkedin' as const, identifier: 'Platform Product Manager in Remote' },
  { name: 'LinkedIn India (Microsoft CSP & Partner Ops)', type: 'linkedin' as const, identifier: 'Partner Experience Manager in India' },

  // 2. Tier 1 – Cloud Ecosystem & Microsoft Partners
  { name: 'Stripe', type: 'greenhouse' as const, identifier: 'stripe' },
  { name: 'GitLab', type: 'greenhouse' as const, identifier: 'gitlab' },
  { name: 'Cloudflare', type: 'greenhouse' as const, identifier: 'cloudflare' },
  { name: 'Elastic', type: 'greenhouse' as const, identifier: 'elastic' },

  // 3. Tier 2 – B2B SaaS & Enterprise Platforms
  { name: 'Spotify', type: 'lever' as const, identifier: 'spotify' },
  { name: 'Linear', type: 'ashby' as const, identifier: 'linear' },
  { name: 'Ramp', type: 'ashby' as const, identifier: 'ramp' }
];

/**
 * Discovery Agent: searches configured sources (LinkedIn & Company Career Portals),
 * normalizes, deduplicates, validates, detects expired listings, and stores jobs in Supabase.
 */
export async function runDiscoveryAgent(options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const runId = options.searchRunId || crypto.randomUUID();
  const db = getSupabaseAdmin();
  const errors: string[] = [];

  const sourcesToScan = options.sources && options.sources.length > 0 ? options.sources : DEFAULT_TECH_SOURCES;
  const roleKeywords = (options.targetRoleKeywords || ALL_TRACK_KEYWORDS).map(k => k.toLowerCase());

  let totalScanned = 0;
  let totalAdded = 0;
  let totalUpdated = 0;
  let totalDuplicates = 0;
  const discoveredJobIds: string[] = [];
  const candidateJobsMap = new Map<string, { job: RawATSJob; source: any }>();

  const fetchResults = await Promise.allSettled(
    sourcesToScan.map(async (source) => {
      let rawJobs: RawATSJob[] = [];
      if (source.type === 'greenhouse') {
        rawJobs = await fetchGreenhouseJobs(source.identifier, source.name);
      } else if (source.type === 'lever') {
        rawJobs = await fetchLeverJobs(source.identifier, source.name);
      } else if (source.type === 'ashby') {
        rawJobs = await fetchAshbyJobs(source.identifier, source.name);
      } else if (source.type === 'linkedin') {
        const parts = source.identifier.split(' in ');
        const keywords = parts[0] || 'Product Manager';
        const location = parts[1] || (source.identifier.includes('Hyderabad') ? 'Hyderabad' : 'Remote');
        rawJobs = await fetchLinkedInJobs(keywords, location, 1);
      }
      return { source, rawJobs };
    })
  );

  for (const res of fetchResults) {
    if (res.status === 'rejected') {
      const msg = `Source fetch error: ${res.reason?.message || String(res.reason)}`;
      errors.push(msg);
      console.warn(`[Discovery Agent] ${msg}`);
      continue;
    }

    const { source, rawJobs } = res.value;
    totalScanned += rawJobs.length;

    // Filter relevant jobs by title keywords across all 3 tracks
    for (const j of rawJobs) {
      const titleLower = j.title.toLowerCase();
      const isRelevant = source.type === 'linkedin'
        ? (titleLower.includes('product') || titleLower.includes('pm') || titleLower.includes('operation') || titleLower.includes('partner') || roleKeywords.some(kw => titleLower.includes(kw)))
        : roleKeywords.some(kw => titleLower.includes(kw));

      if (isRelevant) {
        const canonicalUrl = normalizeJobUrl(j.job_url);
        if (!candidateJobsMap.has(canonicalUrl)) {
          candidateJobsMap.set(canonicalUrl, { job: j, source });
        }
      }
    }
  }

  // Batch query existing jobs by canonical_url
  const allUrls = Array.from(candidateJobsMap.keys());
  const existingMap = new Map<string, any>();

  if (allUrls.length > 0) {
    try {
      const { data: existingRecords } = await db
        .from('jobs')
        .select('id, canonical_url, status, description, track')
        .in('canonical_url', allUrls);

      for (const rec of existingRecords || []) {
        existingMap.set(rec.canonical_url, rec);
      }
    } catch (err: any) {
      console.warn('[Discovery Agent] Batch check error:', err);
    }
  }

  for (const [canonicalUrl, { job, source }] of candidateJobsMap.entries()) {
    try {
      const assignedTrack = classifyJobTrack(job.title, job.description);
      const existing = existingMap.get(canonicalUrl);

      if (existing) {
        totalDuplicates++;
        if ((existing.description !== job.description && job.description) || !existing.track) {
          await db
            .from('jobs')
            .update({
              description: job.description,
              track: assignedTrack,
              status: 'open',
              is_active: true
            })
            .eq('id', existing.id);
          totalUpdated++;
        }
        discoveredJobIds.push(existing.id);
        continue;
      }

      const isValid = await validateJobUrl(canonicalUrl);
      const { data: inserted, error: insertErr } = await db
        .from('jobs')
        .insert({
          canonical_url: canonicalUrl,
          title: job.title,
          company: job.company,
          location: job.location || (source.identifier.includes('Hyderabad') ? 'Hyderabad, Telangana' : 'India Remote / Hybrid'),
          work_mode: job.work_mode || 'unspecified',
          employment_type: job.employment_type || 'full_time',
          job_url: canonicalUrl,
          description: job.description,
          salary_min_lpa: job.salary_min_lpa || null,
          salary_max_lpa: job.salary_max_lpa || null,
          salary_currency: 'INR',
          salary_confidence: 'undisclosed',
          track: assignedTrack,
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
