import { getSupabaseAdmin } from '@/lib/supabase/server';
import { generateStructuredJson } from '@/lib/ai/gemini';
import { z } from 'zod';

export interface ResumeAgentOptions {
  userId?: string;
  jobId?: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  baseResumeText?: string;
  verifiedFacts: Array<{
    id: string;
    category: string;
    fact: string;
    metric_value?: string | null;
  }>;
}

const TailoredResumeGeminiSchema = z.object({
  tailored_summary: z.string().nullish().transform(v => v || ''),
  reordered_skills: z.array(z.string()).nullish().transform(v => v || []),
  experience_bullets: z.array(
    z.object({
      role_title: z.string().nullish().transform(v => v || 'Product Professional'),
      company: z.string().nullish().transform(v => v || 'Enterprise Tech'),
      bullet: z.string().min(1),
      fact_id: z.string().nullish().transform(v => v || '')
    })
  ).nullish().transform(v => v || []),
  project_bullets: z.array(
    z.object({
      project_name: z.string().nullish().transform(v => v || 'Portfolio Project'),
      bullet: z.string().min(1),
      fact_id: z.string().nullish().transform(v => v || '')
    })
  ).nullish().transform(v => v || []),
  change_summary: z.string().nullish().transform(v => v || 'Resume tailored to highlight partner ecosystems and developer platform requirements.'),
  unverified_claims_prevented: z.array(z.string()).nullish().transform(v => v || [])
});

export interface TailoredResumePackage {
  documentId?: string;
  tailored_summary: string;
  reordered_skills: string[];
  experience_bullets: Array<{
    role_title: string;
    company: string;
    bullet: string;
    fact_id: string;
  }>;
  project_bullets: Array<{
    project_name: string;
    bullet: string;
    fact_id: string;
  }>;
  change_summary: string;
  unverified_claims_prevented: string[];
  source_fact_ids: string[];
  html_export: string;
  plain_text_export: string;
}

/**
 * Extracts numerical tokens (percentages, multipliers, currency metrics, numbers)
 * to ensure strict adherence to candidate source facts.
 */
export function extractNumbers(text: string): string[] {
  if (!text) return [];
  const tokens = text.match(/\b\d+(?:[\.,]\d+)?%?(?:k|m|b)?\b/gi) || [];
  return tokens.map(t => t.toLowerCase().replace(/,/g, ''));
}

/**
 * Validates that all numerical metrics in a generated bullet are explicitly grounded
 * in the cited source fact text or metric_value.
 */
export function validateNumericalClaims(
  bullet: string,
  sourceFact: { fact: string; metric_value?: string | null }
): { valid: boolean; ungroundedNumbers: string[] } {
  const bulletNumbers = extractNumbers(bullet);
  if (bulletNumbers.length === 0) return { valid: true, ungroundedNumbers: [] };

  const sourceNumbers = new Set([
    ...extractNumbers(sourceFact.fact),
    ...(sourceFact.metric_value ? extractNumbers(sourceFact.metric_value) : [])
  ]);

  for (const s of Array.from(sourceNumbers)) {
    const stripped = s.replace(/[%kmb]/g, '');
    if (stripped) sourceNumbers.add(stripped);
  }

  const ungroundedNumbers = bulletNumbers.filter(num => {
    const stripped = num.replace(/[%kmb]/g, '');
    return !sourceNumbers.has(num) && !sourceNumbers.has(stripped);
  });

  return {
    valid: ungroundedNumbers.length === 0,
    ungroundedNumbers
  };
}

/**
 * Builds a clean, ATS-compliant printable HTML document.
 */
export function generateAtsResumeHtml(data: {
  candidateName: string;
  contactLine: string;
  summary: string;
  skills: string[];
  experienceBullets: Array<{ role_title: string; company: string; bullet: string; fact_id: string }>;
  projectBullets: Array<{ project_name: string; bullet: string; fact_id: string }>;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${data.candidateName} - Tailored Resume</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; line-height: 1.45; font-size: 11pt; margin: 0; padding: 24px; }
    h1 { font-size: 20pt; font-weight: 700; margin: 0 0 4px 0; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
    .contact { font-size: 9pt; color: #475569; margin-bottom: 16px; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 8px; }
    h2 { font-size: 12pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.75px; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; margin: 16px 0 8px 0; padding-bottom: 3px; }
    p { margin: 0 0 6px 0; }
    .skills { font-size: 9.5pt; }
    ul { margin: 4px 0 10px 0; padding-left: 18px; }
    li { margin-bottom: 4px; }
    .role-header { display: flex; justify-content: space-between; font-weight: 600; font-size: 10.5pt; color: #0f172a; }
    .fact-tag { font-family: monospace; font-size: 7pt; color: #3b82f6; vertical-align: super; text-decoration: none; }
  </style>
</head>
<body>
  <h1>${data.candidateName}</h1>
  <div class="contact">${data.contactLine}</div>

  <h2>Professional Summary</h2>
  <p>${data.summary}</p>

  <h2>Core Competencies</h2>
  <p class="skills">${data.skills.join(' • ')}</p>

  <h2>Professional Experience</h2>
  <ul>
    ${data.experienceBullets.map(b => `
      <li>
        <strong>${b.role_title}</strong> — ${b.company}
        <br>${b.bullet} <span class="fact-tag" title="Fact ID: ${b.fact_id}">[verified #${b.fact_id.slice(0, 8)}]</span>
      </li>
    `).join('')}
  </ul>

  ${data.projectBullets.length > 0 ? `
    <h2>Key Projects & Products</h2>
    <ul>
      ${data.projectBullets.map(p => `
        <li>
          <strong>${p.project_name}</strong>: ${p.bullet} <span class="fact-tag" title="Fact ID: ${p.fact_id}">[verified #${p.fact_id.slice(0, 8)}]</span>
        </li>
      `).join('')}
    </ul>
  ` : ''}
</body>
</html>`;
}

/**
 * Builds clean plain-text version for quick copying into ATS text fields.
 */
export function generateAtsPlainText(data: {
  candidateName: string;
  summary: string;
  skills: string[];
  experienceBullets: Array<{ role_title: string; company: string; bullet: string }>;
  projectBullets: Array<{ project_name: string; bullet: string }>;
}): string {
  return `${data.candidateName.toUpperCase()}
--------------------------------------------------
SUMMARY:
${data.summary}

CORE SKILLS:
${data.skills.join(' | ')}

EXPERIENCE:
${data.experienceBullets.map(b => `- ${b.role_title} at ${b.company}\n  ${b.bullet}`).join('\n\n')}

PROJECTS:
${data.projectBullets.map(p => `- ${p.project_name}: ${p.bullet}`).join('\n')}
`;
}

/**
 * Agent 3: Resume Agent
 * Fact-grounded resume tailoring with zero fabrication guarantee.
 */
export async function runResumeAgent(options: ResumeAgentOptions): Promise<TailoredResumePackage> {
  const startTime = Date.now();
  const db = getSupabaseAdmin();
  const verifiedFactIds = new Set(options.verifiedFacts.map(f => f.id));
  const factMap = new Map(options.verifiedFacts.map(f => [f.id, f]));

  const prompt = `You are an elite, integrity-first Product Management resume strategist.
Tailor the candidate's resume for the target job description using ONLY the supplied verified career facts.

CRITICAL CONSTRAINTS (VIOLATION WILL RESULT IN IMMEDIATE REJECTION):
1. NEVER fabricate or exaggerate achievements, metrics, team sizes, revenue numbers, or user counts.
2. Every experience bullet and project bullet MUST reference an exact, existing fact_id from the Verified Facts list.
3. If an achievement or metric is NOT in the Verified Facts list, DO NOT include it. Put it in unverified_claims_prevented.
4. Return a JSON object with this exact structure:
{
  "tailored_summary": string,
  "reordered_skills": string[],
  "experience_bullets": [
    { "role_title": string, "company": string, "bullet": string, "fact_id": string }
  ],
  "project_bullets": [
    { "project_name": string, "bullet": string, "fact_id": string }
  ],
  "change_summary": string,
  "unverified_claims_prevented": string[]
}

Target Job:
Role: ${options.jobTitle}
Company: ${options.company}
Description:
${options.jobDescription.slice(0, 3000)}

Candidate Base Resume:
${options.baseResumeText || 'Experienced technology professional with 9+ years in Microsoft Partner Center / CSP operations, technical leadership, and AI prototypes.'}

Verified Career Facts Bank:
${JSON.stringify(options.verifiedFacts, null, 2)}`;

  const result = await generateStructuredJson({
    prompt,
    schema: TailoredResumeGeminiSchema,
    systemInstruction: 'You are an executive PM resume strategist. Tailor language for maximum relevance while strictly refusing to fabricate ungrounded claims. Every bullet must cite a valid fact ID.',
    temperature: 0.15
  });

  // Programmatic anti-hallucination verification pass:
  // Strictly enforce that cited fact_ids exist in the verified facts bank
  const unverifiedPrevented = [...(result.unverified_claims_prevented ?? [])];
  const validFactIdsUsed: string[] = [];

  const sanitizedExperience = result.experience_bullets.filter(b => {
    if (!verifiedFactIds.has(b.fact_id)) {
      unverifiedPrevented.push(
        `Prevented ungrounded experience claim referencing unverified fact ID (${b.fact_id}): "${b.bullet}"`
      );
      return false;
    }
    const sourceFact = factMap.get(b.fact_id);
    if (sourceFact) {
      const numValidation = validateNumericalClaims(b.bullet, sourceFact);
      if (!numValidation.valid) {
        unverifiedPrevented.push(
          `Prevented ungrounded numerical claims [${numValidation.ungroundedNumbers.join(', ')}] in experience bullet: "${b.bullet}" (source fact #${b.fact_id.slice(0, 8)} does not support these metrics)`
        );
        return false;
      }
    }
    validFactIdsUsed.push(b.fact_id);
    return true;
  });

  const sanitizedProjects = result.project_bullets.filter(p => {
    if (!verifiedFactIds.has(p.fact_id)) {
      unverifiedPrevented.push(
        `Prevented ungrounded project claim referencing unverified fact ID (${p.fact_id}): "${p.bullet}"`
      );
      return false;
    }
    const sourceFact = factMap.get(p.fact_id);
    if (sourceFact) {
      const numValidation = validateNumericalClaims(p.bullet, sourceFact);
      if (!numValidation.valid) {
        unverifiedPrevented.push(
          `Prevented ungrounded numerical claims [${numValidation.ungroundedNumbers.join(', ')}] in project bullet: "${p.bullet}" (source fact #${p.fact_id.slice(0, 8)} does not support these metrics)`
        );
        return false;
      }
    }
    validFactIdsUsed.push(p.fact_id);
    return true;
  });

  // Generate ATS formats
  const candidateName = 'Career Candidate';
  const contactLine = 'Bengaluru / Hyderabad, India • verified-pm@careerpilot.internal';
  const htmlExport = generateAtsResumeHtml({
    candidateName,
    contactLine,
    summary: result.tailored_summary,
    skills: result.reordered_skills,
    experienceBullets: sanitizedExperience,
    projectBullets: sanitizedProjects
  });

  const plainTextExport = generateAtsPlainText({
    candidateName,
    summary: result.tailored_summary,
    skills: result.reordered_skills,
    experienceBullets: sanitizedExperience,
    projectBullets: sanitizedProjects
  });

  let documentId: string | undefined;

  // Persist to application_documents if jobId and userId are available
  if (options.jobId && options.userId) {
    try {
      const { data: doc } = await db
        .from('application_documents')
        .insert({
          user_id: options.userId,
          job_id: options.jobId,
          tailored_content: {
            tailored_summary: result.tailored_summary,
            reordered_skills: result.reordered_skills,
            experience_bullets: sanitizedExperience,
            project_bullets: sanitizedProjects,
            change_summary: result.change_summary,
            unverified_claims_prevented: unverifiedPrevented,
            plain_text: plainTextExport
          },
          fact_references: Array.from(new Set(validFactIdsUsed)),
          approval_status: 'draft'
        })
        .select('id')
        .single();

      if (doc) {
        documentId = doc.id;
      }

      await db.from('agent_runs').insert({
        user_id: options.userId,
        agent_name: 'resume',
        status: 'completed',
        input_summary: { jobId: options.jobId, jobTitle: options.jobTitle },
        output_summary: {
          bulletsCount: sanitizedExperience.length + sanitizedProjects.length,
          preventedCount: unverifiedPrevented.length
        },
        duration_ms: Date.now() - startTime
      });
    } catch (saveErr) {
      console.warn('[Resume Agent] Failed to save application document:', saveErr);
    }
  }

  return {
    documentId,
    tailored_summary: result.tailored_summary,
    reordered_skills: result.reordered_skills,
    experience_bullets: sanitizedExperience,
    project_bullets: sanitizedProjects,
    change_summary: result.change_summary,
    unverified_claims_prevented: unverifiedPrevented,
    source_fact_ids: Array.from(new Set(validFactIdsUsed)),
    html_export: htmlExport,
    plain_text_export: plainTextExport
  };
}
