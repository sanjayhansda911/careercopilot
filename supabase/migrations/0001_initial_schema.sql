create extension if not exists pgcrypto;

create table if not exists public.career_profiles (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
 total_experience_years numeric, management_experience_years numeric, current_title text, current_company text,
 current_ctc_lpa numeric, target_ctc_min_lpa numeric, target_ctc_max_lpa numeric, notice_period_days integer,
 preferred_locations text[] not null default '{}', preferred_work_modes text[] not null default '{hybrid,remote,on-site}',
 target_roles text[] not null default '{}', target_domains text[] not null default '{}', skills text[] not null default '{}',
 profile_summary text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.career_facts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 category text not null, fact text not null, metric_value text, evidence_source text, verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
 allowed_resume_tracks text[] not null default '{product_management}', created_at timestamptz not null default now()
);
create table if not exists public.resumes (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 track text not null default 'product_management', version integer not null default 1, file_path text, content jsonb,
 is_active boolean not null default false, created_at timestamptz not null default now(), unique(user_id,track,version)
);
create table if not exists public.job_sources (
 id uuid primary key default gen_random_uuid(), name text not null, source_type text not null, base_url text,
 enabled boolean not null default true, terms_reviewed boolean not null default false, last_checked_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.jobs (
 id uuid primary key default gen_random_uuid(), source_id uuid references public.job_sources(id) on delete set null,
 external_job_id text, canonical_url text not null unique, title text not null, company text not null, location text,
 work_mode text, job_url text not null, description text, salary_min_lpa numeric, salary_max_lpa numeric,
 salary_currency text default 'INR', salary_evidence text, salary_confidence text check(salary_confidence in ('verified','advertised','estimated','undisclosed')),
 posted_at timestamptz, discovered_at timestamptz not null default now(), expires_at timestamptz,
 status text not null default 'open' check(status in ('open','closed','unverified')),
 unique(source_id,external_job_id)
);
create table if not exists public.job_matches (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 job_id uuid not null references public.jobs(id) on delete cascade, total_score integer not null check(total_score between 0 and 100),
 score_breakdown jsonb not null default '{}', strengths text[] not null default '{}', gaps text[] not null default '{}',
 recommendation text not null check(recommendation in ('apply_now','review','stretch','ignore')),
 reviewed boolean not null default false, created_at timestamptz not null default now(), unique(user_id,job_id)
);
create table if not exists public.application_documents (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 job_id uuid not null references public.jobs(id) on delete cascade, resume_id uuid references public.resumes(id) on delete set null,
 tailored_content jsonb, cover_letter text, fact_references uuid[] not null default '{}',
 approval_status text not null default 'draft' check(approval_status in ('draft','pending_review','approved','rejected')),
 created_at timestamptz not null default now()
);
create table if not exists public.applications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 job_id uuid not null references public.jobs(id) on delete cascade, document_id uuid references public.application_documents(id) on delete set null,
 application_status text not null default 'prepared' check(application_status in ('prepared','approved','applied','screening','interview','rejected','offer','withdrawn')),
 applied_at timestamptz, next_action text, next_action_date date, notes text,
 created_at timestamptz not null default now(), unique(user_id,job_id)
);
create table if not exists public.search_runs (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
 started_at timestamptz not null default now(), completed_at timestamptz, jobs_found integer not null default 0,
 jobs_matched integer not null default 0, errors jsonb not null default '[]', run_status text not null default 'running'
 check(run_status in ('running','completed','partial','failed'))
);
create table if not exists public.notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade, daily_enabled boolean not null default true,
 email_enabled boolean not null default true, digest_time time not null default '07:00', timezone text not null default 'Asia/Kolkata',
 email_address text, created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
 action text not null, entity_type text, entity_id uuid, details jsonb not null default '{}', created_at timestamptz not null default now()
);

alter table public.career_profiles enable row level security;
alter table public.career_facts enable row level security;
alter table public.resumes enable row level security;
alter table public.job_matches enable row level security;
alter table public.application_documents enable row level security;
alter table public.applications enable row level security;
alter table public.search_runs enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.audit_logs enable row level security;
-- Jobs and job_sources are shared catalog data; only service-role backend writes them.
alter table public.jobs enable row level security;
alter table public.job_sources enable row level security;

create policy "own profile read" on public.career_profiles for select using (auth.uid()=user_id);
create policy "own profile insert" on public.career_profiles for insert with check (auth.uid()=user_id);
create policy "own profile update" on public.career_profiles for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own facts all" on public.career_facts for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own resumes all" on public.resumes for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own matches all" on public.job_matches for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own docs all" on public.application_documents for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own applications all" on public.applications for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own runs all" on public.search_runs for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own notifications all" on public.notification_preferences for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own audit read" on public.audit_logs for select using (auth.uid()=user_id);
create policy "own jobs read" on public.jobs for select using (auth.role()='authenticated');
create policy "sources read" on public.job_sources for select using (auth.role()='authenticated');
