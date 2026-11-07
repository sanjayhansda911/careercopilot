import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CareerFactCreateSchema } from '@/lib/schemas/profile';
import seedData from '@/docs/profile-seed.json';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: facts, error } = await supabase
        .from('career_facts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ facts: facts || [] });
    }

    // Local dev fallback returning seeded facts with mock IDs
    const mockFacts = seedData.career_facts_to_verify.map((f, i) => ({
      id: `fact-seed-${i + 1}`,
      user_id: 'local-dev-user',
      category: f.category,
      fact: f.fact,
      metric_value: null,
      evidence_source: 'Initial PM Resume Seed',
      verification_status: f.verification_status,
      allowed_resume_tracks: ['product_management'],
      created_at: new Date().toISOString()
    }));

    return NextResponse.json({ facts: mockFacts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = CareerFactCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: newFact, error } = await supabase
        .from('career_facts')
        .insert({
          user_id: user.id,
          ...parsed.data
        })
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ fact: newFact }, { status: 201 });
    }

    // Local dev mock response
    return NextResponse.json(
      {
        fact: {
          id: `fact-local-${Date.now()}`,
          user_id: 'local-dev-user',
          ...parsed.data,
          created_at: new Date().toISOString()
        }
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
