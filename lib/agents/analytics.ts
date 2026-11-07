import { getSupabaseAdmin } from '@/lib/supabase/server';
import { generateStructuredJson } from '@/lib/ai/gemini';
import { z } from 'zod';

export interface AnalyticsMetrics {
  totalJobsDiscovered: number;
  totalMatchesEvaluated: number;
  strongMatchesCount: number; // 80+
  reviewMatchesCount: number; // 65-79
  stretchMatchesCount: number; // 50-64
  averageMatchScore: number;
  applicationsCount: {
    prepared: number;
    approved: number;
    applied: number;
    interview: number;
    offer: number;
    rejected: number;
  };
  conversionRates: {
    qualificationRate: number; // % of evaluated that are >= 65
    applicationRate: number;   // % of qualified that became applied
    interviewRate: number;     // % of applied that reached interview
    offerRate: number;         // % of interviews that converted to offer
  };
  recurringGaps: Array<{ skill: string; frequency: number }>;
}

export interface AnalyticsDashboardData {
  metrics: AnalyticsMetrics;
  strategic_recommendations: string[];
  market_positioning_analysis: string;
  recommended_search_adjustments: string[];
}

const StrategicAdviceSchema = z.object({
  strategic_recommendations: z.array(z.string()).nullish().transform(v => v || []),
  market_positioning_analysis: z.string().nullish().transform(v => v || ''),
  recommended_search_adjustments: z.array(z.string()).nullish().transform(v => v || [])
});

/**
 * Computes deterministic statistics over jobs, matches, and applications.
 */
export async function computePipelineMetrics(userId?: string): Promise<AnalyticsMetrics> {
  const db = getSupabaseAdmin();

  // 1. Total jobs discovered
  const { count: totalJobs } = await db.from('jobs').select('*', { count: 'exact', head: true });

  // 2. Job Matches
  let matchQuery = db.from('job_matches').select('total_score, recommendation, gaps');
  if (userId) {
    matchQuery = matchQuery.eq('user_id', userId);
  }
  const { data: matches } = await matchQuery;
  const matchList = matches || [];

  let strongCount = 0;
  let reviewCount = 0;
  let stretchCount = 0;
  let scoreSum = 0;
  const gapFreqMap: Record<string, number> = {};

  for (const m of matchList) {
    scoreSum += m.total_score || 0;
    if (m.total_score >= 80) strongCount++;
    else if (m.total_score >= 65) reviewCount++;
    else if (m.total_score >= 50) stretchCount++;

    if (Array.isArray(m.gaps)) {
      for (const g of m.gaps) {
        const cleanGap = String(g).trim();
        if (cleanGap.length > 2) {
          gapFreqMap[cleanGap] = (gapFreqMap[cleanGap] || 0) + 1;
        }
      }
    }
  }

  const avgScore = matchList.length > 0 ? Math.round(scoreSum / matchList.length) : 0;
  const recurringGaps = Object.entries(gapFreqMap)
    .map(([skill, frequency]) => ({ skill, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 6);

  // 3. Applications
  let appQuery = db.from('applications').select('application_status');
  if (userId) {
    appQuery = appQuery.eq('user_id', userId);
  }
  const { data: apps } = await appQuery;
  const appList = apps || [];

  const appCounts = {
    prepared: 0,
    approved: 0,
    applied: 0,
    interview: 0,
    offer: 0,
    rejected: 0
  };

  for (const a of appList) {
    const st = a.application_status as keyof typeof appCounts;
    if (st && appCounts[st] !== undefined) {
      appCounts[st]++;
    }
  }

  // 4. Conversion ratios
  const qualifiedMatches = strongCount + reviewCount;
  const totalApplied = appCounts.applied + appCounts.interview + appCounts.offer + appCounts.rejected;
  const totalInterviewed = appCounts.interview + appCounts.offer;

  const qualificationRate = matchList.length > 0 ? Math.round((qualifiedMatches / matchList.length) * 100) : 0;
  const applicationRate = qualifiedMatches > 0 ? Math.round((totalApplied / qualifiedMatches) * 100) : 0;
  const interviewRate = totalApplied > 0 ? Math.round((totalInterviewed / totalApplied) * 100) : 0;
  const offerRate = totalInterviewed > 0 ? Math.round((appCounts.offer / totalInterviewed) * 100) : 0;

  return {
    totalJobsDiscovered: totalJobs || 0,
    totalMatchesEvaluated: matchList.length,
    strongMatchesCount: strongCount,
    reviewMatchesCount: reviewCount,
    stretchMatchesCount: stretchCount,
    averageMatchScore: avgScore,
    applicationsCount: appCounts,
    conversionRates: {
      qualificationRate,
      applicationRate,
      interviewRate,
      offerRate
    },
    recurringGaps
  };
}

/**
 * Agent 5: Analytics Agent
 * Combines deterministic SQL/TS metrics with Gemini strategic advice.
 */
export async function runAnalyticsAgent(options: {
  userId?: string;
  candidateTrack?: string;
  metricsOverride?: AnalyticsMetrics;
}): Promise<AnalyticsDashboardData> {
  const startTime = Date.now();
  const db = getSupabaseAdmin();

  // 1. Deterministic calculation
  const metrics = options.metricsOverride || (await computePipelineMetrics(options.userId));

  // 2. Synthesize strategic advice via Gemini
  const prompt = `You are CareerPilot's Executive Career Analytics Agent.
Analyze these real-time career search metrics for a candidate targeting Product Management roles:

Pipeline Metrics:
- Total Jobs Discovered: ${metrics.totalJobsDiscovered}
- Total Evaluated Matches: ${metrics.totalMatchesEvaluated}
- Strong Matches (80+): ${metrics.strongMatchesCount}
- Review Matches (65-79): ${metrics.reviewMatchesCount}
- Stretch Opportunities (50-64): ${metrics.stretchMatchesCount}
- Average Match Score: ${metrics.averageMatchScore}/100
- Applications: Prepared: ${metrics.applicationsCount.prepared}, Applied: ${metrics.applicationsCount.applied}, Interviews: ${metrics.applicationsCount.interview}, Offers: ${metrics.applicationsCount.offer}
- Conversion: Qualification: ${metrics.conversionRates.qualificationRate}%, Applied: ${metrics.conversionRates.applicationRate}%, Interview Rate: ${metrics.conversionRates.interviewRate}%

Top Recurring Skill Gaps Encountered in Job Matches:
${metrics.recurringGaps.map(g => `- ${g.skill} (seen in ${g.frequency} jobs)`).join('\n') || '- None recorded yet'}

Instructions:
Return a JSON object with this exact structure:
{
  "strategic_recommendations": [
    "3 high-impact, specific tactical actions candidate should take this week"
  ],
  "market_positioning_analysis": "Crisp 2-sentence market viability assessment",
  "recommended_search_adjustments": [
    "2 search filter tweaks (e.g. role titles, domain focus, or location)"
  ]
}`;

  let advice;
  try {
    advice = await generateStructuredJson({
      prompt,
      schema: StrategicAdviceSchema,
      systemInstruction: 'You are a Senior PM career strategist. Provide data-driven, actionable recommendations to improve application-to-interview conversion.',
      temperature: 0.15
    });
  } catch (err) {
    console.warn('[Analytics Agent] Semantic analysis fallback:', err);
    advice = {
      strategic_recommendations: [
        'Frame 9+ years of CSP technical operations as competitive advantage in Product Operations and Platform PM postings.',
        'Build a public case study for PMCoach.ai highlighting API design and user feedback loops.',
        'Target mid-to-senior B2B SaaS openings where developer experience and enterprise support knowledge are critical.'
      ],
      market_positioning_analysis: 'High operational leadership strength with strong technical prototype validation, but candidate faces competition against direct commercial PM title holders.',
      recommended_search_adjustments: [
        'Add "Platform Product Manager" and "Technical Product Manager" to active search keywords.',
        'Filter for B2B SaaS and cloud ecosystem companies with remote or hybrid flexibility.'
      ]
    };
  }

  // Log agent run if userId present
  if (options.userId) {
    try {
      await db.from('agent_runs').insert({
        user_id: options.userId,
        agent_name: 'analytics',
        status: 'completed',
        input_summary: { evaluatedMatches: metrics.totalMatchesEvaluated },
        output_summary: {
          avgScore: metrics.averageMatchScore,
          strongMatches: metrics.strongMatchesCount
        },
        duration_ms: Date.now() - startTime
      });
    } catch (saveErr) {
      console.warn('[Analytics Agent] Failed to save agent run:', saveErr);
    }
  }

  return {
    metrics,
    strategic_recommendations: advice.strategic_recommendations,
    market_positioning_analysis: advice.market_positioning_analysis,
    recommended_search_adjustments: advice.recommended_search_adjustments
  };
}
