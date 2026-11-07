import { JobRecord } from '@/lib/schemas/job';

export interface RawATSJob {
  external_id: string;
  title: string;
  company: string;
  location?: string | null;
  work_mode?: 'remote' | 'hybrid' | 'on-site' | 'unspecified';
  employment_type?: 'full_time' | 'contract' | 'part_time' | 'internship';
  job_url: string;
  description: string;
  posted_at?: string | null;
  salary_min_lpa?: number | null;
  salary_max_lpa?: number | null;
}

/**
 * Normalizes a URL to ensure clean deduplication.
 * Removes tracking parameters (utm_*, ref, etc.) and trailing slashes.
 */
export function normalizeJobUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    url.hash = '';
    const cleanParams = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
      if (!key.startsWith('utm_') && !['ref', 'source', 'gh_src', 'lever-source'].includes(key)) {
        cleanParams.append(key, value);
      }
    }
    url.search = cleanParams.toString();
    let normalized = url.toString();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return rawUrl.trim();
  }
}

/**
 * Detects work mode from job title and description text.
 */
export function detectWorkMode(text: string): 'remote' | 'hybrid' | 'on-site' | 'unspecified' {
  const lower = text.toLowerCase();
  if (lower.includes('hybrid')) return 'hybrid';
  if (lower.includes('remote') || lower.includes('work from home') || lower.includes('telecommute')) return 'remote';
  if (lower.includes('on-site') || lower.includes('onsite') || lower.includes('in office') || lower.includes('in-office')) return 'on-site';
  return 'unspecified';
}

/**
 * Validates a job URL syntax and protocol.
 */
export async function validateJobUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url.trim());
    return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname && parsed.hostname.includes('.'));
  } catch {
    return false;
  }
}

/**
 * Adapter for Greenhouse Job Boards API
 * Endpoint format: https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true
 */
export async function fetchGreenhouseJobs(boardToken: string, companyName: string): Promise<RawATSJob[]> {
  try {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 3600 }
    });
    if (!res.ok) {
      if (res.status === 404) console.info(`[ATS Adapter] Greenhouse board '${boardToken}' not found or inactive.`);
      if (res.status === 429) console.warn(`[ATS Adapter] Greenhouse rate limited for board '${boardToken}'.`);
      return [];
    }
    const data = await res.json();
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];

    return jobs.map((j: any) => ({
      external_id: String(j.id),
      title: j.title || 'Untitled',
      company: companyName,
      location: j.location?.name || null,
      work_mode: detectWorkMode(`${j.title} ${j.location?.name || ''} ${j.content || ''}`),
      employment_type: 'full_time',
      job_url: normalizeJobUrl(j.absolute_url || `https://boards.greenhouse.io/${boardToken}/jobs/${j.id}`),
      description: j.content ? String(j.content).replace(/<[^>]+>/g, ' ') : '',
      posted_at: j.updated_at || null,
      salary_min_lpa: null,
      salary_max_lpa: null
    }));
  } catch (err) {
    console.warn(`[ATS Adapter] Failed to fetch Greenhouse jobs for ${boardToken}:`, err);
    return [];
  }
}

/**
 * Adapter for Lever Postings API
 * Endpoint format: https://api.lever.co/v0/postings/{site}?mode=json
 */
export async function fetchLeverJobs(site: string, companyName: string): Promise<RawATSJob[]> {
  try {
    const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 3600 }
    });
    if (!res.ok) {
      if (res.status === 404) console.info(`[ATS Adapter] Lever site '${site}' not found or inactive.`);
      if (res.status === 429) console.warn(`[ATS Adapter] Lever rate limited for site '${site}'.`);
      return [];
    }
    const jobs = await res.json();
    if (!Array.isArray(jobs)) return [];

    return jobs.map((j: any) => ({
      external_id: String(j.id),
      title: j.text || 'Untitled',
      company: companyName,
      location: j.categories?.location || null,
      work_mode: detectWorkMode(`${j.text} ${j.categories?.location || ''} ${j.descriptionPlain || ''}`),
      employment_type: 'full_time',
      job_url: normalizeJobUrl(j.hostedUrl || `https://jobs.lever.co/${site}/${j.id}`),
      description: j.descriptionPlain || j.description || '',
      posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      salary_min_lpa: null,
      salary_max_lpa: null
    }));
  } catch (err) {
    console.warn(`[ATS Adapter] Failed to fetch Lever jobs for ${site}:`, err);
    return [];
  }
}

/**
 * Adapter for Ashby Job Board API
 * Endpoint format: https://api.ashbyhq.com/posting-api/job-board/{board_token}
 */
export async function fetchAshbyJobs(boardToken: string, companyName: string): Promise<RawATSJob[]> {
  try {
    const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardToken)}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 3600 }
    });
    if (!res.ok) {
      if (res.status === 404) console.info(`[ATS Adapter] Ashby board '${boardToken}' not found or inactive.`);
      if (res.status === 429) console.warn(`[ATS Adapter] Ashby rate limited for board '${boardToken}'.`);
      return [];
    }
    const data = await res.json();
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];

    return jobs.map((j: any) => ({
      external_id: String(j.id),
      title: j.title || 'Untitled',
      company: companyName,
      location: j.location || null,
      work_mode: detectWorkMode(`${j.title} ${j.location || ''} ${j.descriptionHtml || ''}`),
      employment_type: 'full_time',
      job_url: normalizeJobUrl(j.jobUrl || `https://jobs.ashbyhq.com/${boardToken}/${j.id}`),
      description: j.descriptionPlain || (j.descriptionHtml ? String(j.descriptionHtml).replace(/<[^>]+>/g, ' ') : ''),
      posted_at: j.publishedAt || null,
      salary_min_lpa: null,
      salary_max_lpa: null
    }));
  } catch (err) {
    console.warn(`[ATS Adapter] Failed to fetch Ashby jobs for ${boardToken}:`, err);
    return [];
  }
}
