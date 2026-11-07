import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, createClient } from '@/lib/supabase/server';
import { runResumeAgent } from '@/lib/agents/resume';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || '00000000-0000-0000-0000-000000000001';

    const db = getSupabaseAdmin();
    const { data: docs } = await db
      .from('application_documents')
      .select('*, jobs(id, title, company)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      status: 'success',
      documents: docs || []
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to fetch resume documents' },
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
    const { data: job } = await db.from('jobs').select('*').eq('id', jobId).single();
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const { data: facts } = await db
      .from('career_facts')
      .select('id, category, fact, metric_value')
      .eq('user_id', userId)
      .eq('verification_status', 'verified');

    const tailoredPackage = await runResumeAgent({
      userId,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      jobDescription: job.description || '',
      verifiedFacts: facts || []
    });

    return NextResponse.json({
      status: 'success',
      tailoredResume: tailoredPackage
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to tailor resume' },
      { status: 500 }
    );
  }
}
