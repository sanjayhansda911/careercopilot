import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import seedData from '@/docs/profile-seed.json';
import { initialCareerProfile } from '@/lib/career-profile';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'You must be logged in to seed your profile in Supabase.' },
        { status: 401 }
      );
    }

    // 1. Seed or update profile
    const { data: profile, error: pErr } = await supabase
      .from('career_profiles')
      .upsert(
        {
          user_id: user.id,
          target_track: seedData.profile.target_track,
          total_experience_years: seedData.profile.total_experience_years,
          current_title: seedData.profile.current_title,
          current_company: seedData.profile.current_company,
          target_roles: seedData.profile.target_roles,
          target_domains: seedData.profile.target_domains,
          preferred_locations: seedData.profile.preferred_locations,
          target_ctc_min_lpa: seedData.profile.target_ctc_min_lpa,
          target_ctc_max_lpa: seedData.profile.target_ctc_max_lpa,
          notice_period_days: seedData.profile.notice_period_days,
          skills: [...initialCareerProfile.skills],
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      )
      .select('*')
      .single();

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    // 2. Seed the 11 facts marked as 'pending'
    const factsToInsert = seedData.career_facts_to_verify.map(f => ({
      user_id: user.id,
      category: f.category,
      fact: f.fact,
      verification_status: f.verification_status,
      evidence_source: 'Candidate PM Resume Seed',
      allowed_resume_tracks: ['product_management']
    }));

    const { data: insertedFacts, error: fErr } = await supabase
      .from('career_facts')
      .insert(factsToInsert)
      .select('*');

    if (fErr) {
      return NextResponse.json({ error: fErr.message }, { status: 500 });
    }

    return NextResponse.json({
      status: 'success',
      profile,
      facts_seeded_count: insertedFacts?.length || 0
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
