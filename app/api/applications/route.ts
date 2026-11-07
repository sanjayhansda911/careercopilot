import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, createClient } from '@/lib/supabase/server';
import { runApplicationAgent } from '@/lib/agents/application';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || '00000000-0000-0000-0000-000000000001';

    const db = getSupabaseAdmin();
    const { data: apps } = await db
      .from('applications')
      .select('*, jobs(id, title, company, location, job_url), application_documents(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      status: 'success',
      applications: apps || []
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to fetch applications' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, tailoredDocumentId } = body;
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || '00000000-0000-0000-0000-000000000001';

    const db = getSupabaseAdmin();
    const { data: job } = await db.from('jobs').select('*').eq('id', jobId).single();
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const { data: profile } = await db.from('career_profiles').select('*').eq('user_id', userId).maybeSingle();
    const { data: facts } = await db.from('career_facts').select('id, category, fact, metric_value').eq('user_id', userId).eq('verification_status', 'verified');

    const appPackage = await runApplicationAgent({
      userId,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      jobUrl: job.job_url,
      jobDescription: job.description || '',
      tailoredDocumentId,
      verifiedFacts: facts || [],
      profile: {
        notice_period_days: profile?.notice_period_days || 90,
        target_ctc_min_lpa: profile?.target_ctc_min_lpa || 22,
        target_ctc_max_lpa: profile?.target_ctc_max_lpa || 28,
        preferred_locations: profile?.preferred_locations || ['Bengaluru', 'Hyderabad']
      }
    });

    return NextResponse.json({
      status: 'success',
      application: appPackage
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to prepare application package' },
      { status: 500 }
    );
  }
}
