import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runOrchestrator } from '@/lib/agents/orchestrator';

export const maxDuration = 60; // Support up to 60s for background orchestration on Vercel Pro

export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CAREERPILOT_CRON_SECRET;
    const headerSecret = req.headers.get('x-careerpilot-cron-secret');
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    let isAuthorized = false;
    let triggerSource: 'cron' | 'manual' = 'manual';
    let userId: string | undefined;
    let userEmail: string | undefined;

    // 1. Verify CRON Secret (Vercel Cron standard Bearer token or custom header)
    if (cronSecret && (headerSecret === cronSecret || bearerToken === cronSecret)) {
      isAuthorized = true;
      triggerSource = 'cron';
    } else {
      // 2. Check authenticated user session
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        isAuthorized = true;
        userId = user.id;
        userEmail = user.email;
        triggerSource = 'manual';
      } else {
        const isMock = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('dummy') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
        const testUserId = req.headers.get('x-test-user-id');
        if (isMock) {
          isAuthorized = true;
          userId = testUserId || '00000000-0000-0000-0000-000000000001';
          triggerSource = 'manual';
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Valid CRON secret or user session required.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const summary = await runOrchestrator({
      userId,
      userEmail,
      triggerSource,
      maxJobsToAnalyze: body.maxJobsToAnalyze || 3
    });

    return NextResponse.json({
      status: 'success',
      summary
    });
  } catch (err: any) {
    console.error('[API orchestrator run error]:', err);
    return NextResponse.json(
      { status: 'error', message: err.message || 'Orchestrator execution failed' },
      { status: 500 }
    );
  }
}
