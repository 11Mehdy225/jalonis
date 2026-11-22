-- Auditable, plan-limited runs for the server-side project assistant.
update public.plan_catalog set features=features||'{"assistant":true,"assistant_monthly_runs":100}'::jsonb where code='business';
update public.plan_catalog set features=features||'{"assistant":true,"assistant_monthly_runs":-1}'::jsonb where code='enterprise';

create table if not exists public.assistant_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question text not null,
  analysis text,
  model text,
  status text not null default 'completed' check(status in ('completed','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists assistant_runs_workspace_month_idx on public.assistant_runs(workspace_id,created_at desc);
alter table public.assistant_runs enable row level security;
create policy assistant_runs_member_read on public.assistant_runs for select using(
  user_id=auth.uid() or public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur'])
);
revoke all on public.assistant_runs from anon,authenticated;
grant select on public.assistant_runs to authenticated;
