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
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          isAuthorized = true;
          userId = user.id;
          userEmail = user.email;
          triggerSource = 'manual';
        }
      } catch (authErr) {
        console.warn('[Orchestrator Auth Session Check]:', authErr);
      }

      // 3. Fallback for dashboard single-candidate deployment or mock/test headers
      if (!isAuthorized) {
        const testUserId = req.headers.get('x-test-user-id');
        // Default to the seeded candidate profile for dashboard execution
        userId = testUserId || '070f26eb-1210-4a72-9fb7-4ec5edf05a13';
        isAuthorized = true;
        triggerSource = 'manual';
      }
    }

    const body = await req.json().catch(() => ({}));
    const summary = await runOrchestrator({
      userId,
      userEmail,
      triggerSource,
      maxJobsToAnalyze: body.maxJobsToAnalyze || (triggerSource === 'manual' ? 1 : 5),
      quickScan: body.quickScan ?? (triggerSource === 'manual')
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
