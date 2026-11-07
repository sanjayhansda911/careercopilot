import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, createClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || '00000000-0000-0000-0000-000000000001';

    const db = getSupabaseAdmin();
    const { data: notifs } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    const unreadCount = (notifs || []).filter((n: any) => !n.is_read).length;

    return NextResponse.json({
      status: 'success',
      unreadCount,
      notifications: notifs || []
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, markAllRead } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || '00000000-0000-0000-0000-000000000001';

    const db = getSupabaseAdmin();

    if (markAllRead) {
      await db
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId);
    } else if (id) {
      await db
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId);
    }

    return NextResponse.json({ status: 'success' });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to update notification status' },
      { status: 500 }
    );
  }
}
