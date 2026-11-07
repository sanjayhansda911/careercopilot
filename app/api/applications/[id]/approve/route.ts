import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { approveApplication } from '@/lib/agents/application';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const isMock = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('dummy') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
    const testUserIdHeader = req.headers.get('x-test-user-id');
    const userId = user?.id || (isMock ? testUserIdHeader || '00000000-0000-0000-0000-000000000001' : null);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { notes } = body;

    const result = await approveApplication({
      applicationId: id,
      userId,
      notes: typeof notes === 'string' ? notes : undefined
    });

    return NextResponse.json({
      status: 'success',
      applicationId: id,
      newStatus: result.newStatus,
      auditId: result.auditId
    });
  } catch (err: any) {
    console.error('[API application approve error]:', err);
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to approve application' },
      { status: err.message?.includes('Unauthorized') ? 403 : 400 }
    );
  }
}
