import { NextResponse } from 'next/server';
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server';
import { CareerProfileUpdateSchema } from '@/lib/schemas/profile';
import { initialCareerProfile } from '@/lib/career-profile';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // If authenticated, load from Supabase database
    if (user) {
      const { data: profile, error } = await supabase
        .from('career_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (profile) {
        return NextResponse.json({ profile, user_id: user.id });
      }

      // If no profile exists yet, return seed profile template for this user
      return NextResponse.json({
        profile: {
          ...initialCareerProfile,
          user_id: user.id,
          is_default: true
        },
        user_id: user.id
      });
    }

    // Local dev mode fallback if not logged in
    return NextResponse.json({
      profile: {
        ...initialCareerProfile,
        is_default: true,
        user_id: 'local-dev-user'
      },
      user_id: 'local-dev-user'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const json = await req.json();
    const parsed = CareerProfileUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: updated, error } = await supabase
        .from('career_profiles')
        .upsert(
          {
            user_id: user.id,
            ...parsed.data,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        )
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ profile: updated });
    }

    // If local dev without Supabase auth, return mock success
    return NextResponse.json({
      profile: {
        ...initialCareerProfile,
        ...parsed.data,
        user_id: 'local-dev-user'
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
