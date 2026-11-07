import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, createClient } from '@/lib/supabase/server';
import { runIntelligenceAgent } from '@/lib/agents/intelligence';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const minScore = parseInt(searchParams.get('minScore') || '0', 10);
    const recommendation = searchParams.get('recommendation');
    const track = searchParams.get('track');
    const classification = searchParams.get('classification');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || '070f26eb-1210-4a72-9fb7-4ec5edf05a13';

    const db = getSupabaseAdmin();
    let query = db
      .from('job_matches')
      .select('*, jobs(*)')
      .eq('user_id', userId);

    if (minScore > 0) {
      query = query.gte('total_score', minScore);
    }

    if (recommendation && recommendation !== 'all') {
      query = query.eq('recommendation', recommendation);
    }

    if (track && track !== 'all') {
      query = query.eq('track', track);
    }

    if (classification && classification !== 'all') {
      query = query.eq('classification', classification);
    }

    query = query.order('total_score', { ascending: false });

    const { data: matches, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({
      status: 'success',
      count: (matches || []).length,
      matches: matches || []
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to fetch intelligence matches' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId } = body;
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || '00000000-0000-0000-0000-000000000001';

    const db = getSupabaseAdmin();

    // Fetch job, profile, verified facts
    const { data: job } = await db.from('jobs').select('*').eq('id', jobId).single();
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const { data: profile } = await db.from('career_profiles').select('*').eq('user_id', userId).maybeSingle();
    const { data: facts } = await db.from('career_facts').select('id, category, fact, metric_value').eq('user_id', userId).eq('verification_status', 'verified');

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
        total_experience_years: profile?.total_experience_years || 9,
        current_title: profile?.current_title || 'Digital Project Manager',
        current_company: profile?.current_company || 'Sonata Software',
        target_ctc_min_lpa: profile?.target_ctc_min_lpa || 22,
        target_ctc_max_lpa: profile?.target_ctc_max_lpa || 28,
        notice_period_days: profile?.notice_period_days || 90,
        preferred_locations: profile?.preferred_locations || ['Bengaluru', 'Hyderabad'],
        preferred_work_modes: profile?.preferred_work_modes || ['hybrid', 'remote'],
        target_roles: profile?.target_roles || ['Product Manager', 'Platform Product Manager'],
        target_domains: profile?.target_domains || ['B2B SaaS', 'Cloud platforms'],
        skills: profile?.skills || []
      },
      verifiedFacts: facts || []
    });

    return NextResponse.json({
      status: 'success',
      match
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to analyze candidate-job fit' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { matchId, feedback } = body;
    if (!matchId || !feedback) {
      return NextResponse.json({ error: 'matchId and feedback are required' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { data: updated, error } = await db
      .from('job_matches')
      .update({ user_feedback: feedback })
      .eq('id', matchId)
      .select('id, user_feedback')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      status: 'success',
      match: updated
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to update match feedback' },
      { status: 500 }
    );
  }
}
