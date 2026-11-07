import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { ingestManualJob } from '@/lib/agents/discovery';
import { JobIngestInputSchema } from '@/lib/schemas/job';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q')?.toLowerCase();
    const workMode = searchParams.get('work_mode');
    const status = searchParams.get('status') || 'open';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const db = getSupabaseAdmin();
    let query = db.from('jobs').select('*');

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (workMode && workMode !== 'all') {
      query = query.eq('work_mode', workMode);
    }

    query = query.order('discovered_at', { ascending: false }).limit(limit);

    const { data: jobs, error } = await query;
    if (error) throw new Error(error.message);

    let filtered = jobs || [];
    if (search) {
      filtered = filtered.filter((j: any) =>
        j.title.toLowerCase().includes(search) ||
        j.company.toLowerCase().includes(search) ||
        (j.location && j.location.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({
      status: 'success',
      count: filtered.length,
      jobs: filtered
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = JobIngestInputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ status: 'error', error: parsed.error.flatten() }, { status: 400 });
    }

    const { job, isNew } = await ingestManualJob(parsed.data);

    return NextResponse.json({
      status: 'success',
      isNew,
      job
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to ingest job' },
      { status: 500 }
    );
  }
}
