-- CareerPilot Six-Agent Architecture Migration
-- Adds notifications, agent_runs, and enhanced scoring/job attributes

-- 1. In-app & Email Notification Records
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

-- 2. Agent Execution Tracking & Idempotency Logs
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

-- 3. Enhance Jobs Table
alter table public.jobs add column if not exists employment_type text default 'full_time';
alter table public.jobs add column if not exists experience_years_min numeric;
alter table public.jobs add column if not exists experience_years_max numeric;
alter table public.jobs add column if not exists is_active boolean not null default true;

-- 4. Enhance Job Matches Table
alter table public.job_matches add column if not exists confidence_level text not null default 'high' check(confidence_level in ('high', 'medium', 'low'));
alter table public.job_matches add column if not exists transferable_skills text[] not null default '{}';
alter table public.job_matches add column if not exists matching_evidence jsonb not null default '{}';

-- 5. Row Level Security Policies
alter table public.notifications enable row level security;
alter table public.agent_runs enable row level security;

create policy "own notifications all" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own agent runs all" on public.agent_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. High-Performance Indexes
create index if not exists idx_notifications_user_read on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_agent_runs_search_run on public.agent_runs(search_run_id, created_at desc);
create index if not exists idx_jobs_canonical_url on public.jobs(canonical_url);
create index if not exists idx_job_matches_user_score on public.job_matches(user_id, total_score desc);
