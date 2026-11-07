-- CareerPilot Application Workflow States Migration
-- Canonical states: prepared -> approved -> submitted -> interviewing -> offered / rejected / withdrawn

alter table public.applications drop constraint if exists applications_application_status_check;

alter table public.applications add constraint applications_application_status_check
  check(application_status in (
    'prepared',
    'approved',
    'submitted',
    'interviewing',
    'rejected',
    'offered',
    'withdrawn',
    -- Legacy aliases for backwards compatibility
    'applied',
    'screening',
    'interview',
    'offer',
    'pending_review'
  ));

create index if not exists idx_applications_user_status on public.applications(user_id, application_status);
create index if not exists idx_applications_next_action on public.applications(user_id, next_action_date);
