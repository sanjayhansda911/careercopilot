-- ============================================================================
-- CAREERPILOT COMPLETE DATABASE SCHEMA & POLICIES
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ============================================================================

-- 1. Enable required extensions
create extension if not exists pgcrypto;

-- 2. Core Tables
create table if not exists public.career_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  total_experience_years numeric,
  management_experience_years numeric,
  current_title text,
  current_company text,
  current_ctc_lpa numeric,
  target_ctc_min_lpa numeric,
  target_ctc_max_lpa numeric,
  notice_period_days integer,
  preferred_locations text[] not null default '{}',
  preferred_work_modes text[] not null default '{hybrid,remote,on-site}',
  target_roles text[] not null default '{}',
  target_domains text[] not null default '{}',
  skills text[] not null default '{}',
  profile_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  fact text not null,
  metric_value text,
  evidence_source text,
  verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
  allowed_resume_tracks text[] not null default '{product_management}',
  created_at timestamptz not null default now()
);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track text not null default 'product_management',
  version integer not null default 1,
  file_path text,
  content jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, track, version)
);

create table if not exists public.job_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null,
  base_url text,
  enabled boolean not null default true,
  terms_reviewed boolean not null default false,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.job_sources(id) on delete set null,
  external_job_id text,
  canonical_url text not null unique,
  title text not null,
  company text not null,
  location text,
  work_mode text,
  employment_type text default 'full_time',
  job_url text not null,
  description text,
  salary_min_lpa numeric,
  salary_max_lpa numeric,
  experience_years_min numeric,
  experience_years_max numeric,
  is_active boolean not null default true,
  salary_currency text default 'INR',
  salary_evidence text,
  salary_confidence text check(salary_confidence in ('verified','advertised','estimated','undisclosed')),
  posted_at timestamptz,
  discovered_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'open' check(status in ('open','closed','unverified')),
  unique(source_id, external_job_id)
);

create table if not exists public.job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  total_score integer not null check(total_score between 0 and 100),
  confidence_level text not null default 'high' check(confidence_level in ('high', 'medium', 'low')),
  transferable_skills text[] not null default '{}',
  matching_evidence jsonb not null default '{}',
  score_breakdown jsonb not null default '{}',
  strengths text[] not null default '{}',
  gaps text[] not null default '{}',
  recommendation text not null check(recommendation in ('apply_now','review','stretch','ignore')),
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, job_id)
);

create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  resume_id uuid references public.resumes(id) on delete set null,
  tailored_content jsonb,
  cover_letter text,
  fact_references text[] not null default '{}',
  approval_status text not null default 'draft' check(approval_status in ('draft','pending_review','approved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  document_id uuid references public.application_documents(id) on delete set null,
  application_status text not null default 'prepared' check(application_status in (
    'prepared',
    'approved',
    'submitted',
    'interviewing',
    'rejected',
    'offered',
    'withdrawn',
    'applied',
    'screening',
    'interview',
    'offer',
    'pending_review'
  )),
  applied_at timestamptz,
  next_action text,
  next_action_date date,
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, job_id)
);

create table if not exists public.search_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  jobs_found integer not null default 0,
  jobs_matched integer not null default 0,
  errors jsonb not null default '[]',
  run_status text not null default 'running' check(run_status in ('running','completed','partial','failed'))
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check(type in ('daily_digest', 'high_match', 'application_status', 'follow_up', 'system')),
  title text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  email_sent boolean not null default false,
  delivery_status text not null default 'delivered' check(delivery_status in ('pending', 'delivered', 'failed', 'skipped')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  search_run_id uuid references public.search_runs(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade,
  agent_name text not null check(agent_name in ('discovery', 'intelligence', 'resume', 'application', 'analytics', 'notification', 'orchestrator')),
  status text not null default 'running' check(status in ('running', 'completed', 'failed', 'skipped')),
  input_summary jsonb not null default '{}',
  output_summary jsonb not null default '{}',
  error_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_enabled boolean not null default true,
  email_enabled boolean not null default true,
  digest_time time not null default '07:00',
  timezone text not null default 'Asia/Kolkata',
  email_address text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- 3. Enable Row Level Security (RLS) on all tables
alter table public.career_profiles enable row level security;
alter table public.career_facts enable row level security;
alter table public.resumes enable row level security;
alter table public.jobs enable row level security;
alter table public.job_sources enable row level security;
alter table public.job_matches enable row level security;
alter table public.application_documents enable row level security;
alter table public.applications enable row level security;
alter table public.search_runs enable row level security;
alter table public.notifications enable row level security;
alter table public.agent_runs enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.audit_logs enable row level security;

-- 4. RLS Policies (Safe drop and recreate)
drop policy if exists "own profile read" on public.career_profiles;
create policy "own profile read" on public.career_profiles for select using (auth.uid() = user_id);
drop policy if exists "own profile insert" on public.career_profiles;
create policy "own profile insert" on public.career_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "own profile update" on public.career_profiles;
create policy "own profile update" on public.career_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own facts all" on public.career_facts;
create policy "own facts all" on public.career_facts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own resumes all" on public.resumes;
create policy "own resumes all" on public.resumes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own matches all" on public.job_matches;
create policy "own matches all" on public.job_matches for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own docs all" on public.application_documents;
create policy "own docs all" on public.application_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own applications all" on public.applications;
create policy "own applications all" on public.applications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own runs all" on public.search_runs;
create policy "own runs all" on public.search_runs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own notifications all" on public.notifications;
create policy "own notifications all" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own agent runs all" on public.agent_runs;
create policy "own agent runs all" on public.agent_runs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own preferences all" on public.notification_preferences;
create policy "own preferences all" on public.notification_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own audit read" on public.audit_logs;
create policy "own audit read" on public.audit_logs for select using (auth.uid() = user_id);

drop policy if exists "jobs read authenticated" on public.jobs;
create policy "jobs read authenticated" on public.jobs for select using (auth.role() = 'authenticated');

drop policy if exists "sources read authenticated" on public.job_sources;
create policy "sources read authenticated" on public.job_sources for select using (auth.role() = 'authenticated');

-- 5. High-Performance Indexes
create index if not exists idx_jobs_canonical_url on public.jobs(canonical_url);
create index if not exists idx_job_matches_user_score on public.job_matches(user_id, total_score desc);
create index if not exists idx_applications_user_status on public.applications(user_id, application_status);
create index if not exists idx_notifications_user_read on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_agent_runs_search_run on public.agent_runs(search_run_id, created_at desc);
