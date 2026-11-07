import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { scoreJob } from '@/lib/scoring';
const JobSchema=z.object({source_id:z.string().uuid().optional().nullable(),external_job_id:z.string().optional().nullable(),title:z.string().min(2),company:z.string().min(1),location:z.string().optional().nullable(),work_mode:z.string().optional().nullable(),job_url:z.string().url(),description:z.string().optional().nullable(),salary_min_lpa:z.number().optional().nullable(),salary_max_lpa:z.number().optional().nullable(),posted_at:z.string().datetime().optional().nullable()});
export async function POST(req:Request){
 const secret=process.env.CAREERPILOT_CRON_SECRET;
 if(!secret || req.headers.get('x-careerpilot-cron-secret')!==secret) return NextResponse.json({error:'Unauthorized'},{status:401});
 const parsed=JobSchema.safeParse(await req.json()); if(!parsed.success) return NextResponse.json({error:parsed.error.flatten()},{status:400});
 const db=getSupabaseAdmin();
 const {data:profile,error:pErr}=await db.from('career_profiles').select('*').limit(1).single();
 if(pErr || !profile) return NextResponse.json({error:'Create a career profile first'},{status:409});
 const job=parsed.data;
 const {data:saved,error}=await db.from('jobs').upsert({...job,canonical_url:job.job_url,status:'open'},{onConflict:'canonical_url'}).select('*').single();
 if(error) return NextResponse.json({error:error.message},{status:500});
 const {data:facts}=await db.from('career_facts').select('fact').eq('verification_status','verified');
 const profileForScore={...profile,skills:[...(profile.skills??[]),...(facts??[]).map((x: { fact: string })=>x.fact)],target_roles:profile.target_roles??[],target_domains:profile.target_domains??[],preferred_locations:profile.preferred_locations??[],preferred_work_modes:profile.preferred_work_modes??[]};
 const result=scoreJob({...job, description: job.description ?? ''},profileForScore);
 const {error:matchErr}=await db.from('job_matches').upsert({job_id:saved.id,user_id:profile.user_id,total_score:result.total,score_breakdown:result.breakdown,strengths:result.strengths,gaps:result.gaps,recommendation:result.recommendation},{onConflict:'user_id,job_id'});
 if(matchErr) return NextResponse.json({error:matchErr.message},{status:500});
 return NextResponse.json({job:saved,match:result});
}
