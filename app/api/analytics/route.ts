import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runAnalyticsAgent } from '@/lib/agents/analytics';

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || '00000000-0000-0000-0000-000000000001';

    const analytics = await runAnalyticsAgent({ userId });

    return NextResponse.json({
      status: 'success',
      analytics
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
