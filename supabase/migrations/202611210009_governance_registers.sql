create table if not exists public.change_requests (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  title text not null, description text, reason text, impact_scope text, impact_schedule_days numeric not null default 0,
  impact_cost numeric not null default 0, priority text not null default 'Moyenne', requested_by text, owner text,
  status text not null default 'Soumise', decision text, decision_date date,
  linked_task_id uuid references public.tasks(id) on delete set null,
  linked_risk_id uuid references public.risks(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  title text not null, description text, severity text not null default 'Moyenne', owner text, due_date date,
  status text not null default 'Ouvert', resolution text,
  linked_task_id uuid references public.tasks(id) on delete set null,
  linked_risk_id uuid references public.risks(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  title text not null, decision_date date, context text, decision text, rationale text, owner text,
  status text not null default 'Décidée',
  linked_meeting_id uuid references public.meetings(id) on delete set null,
  linked_task_id uuid references public.tasks(id) on delete set null,
  linked_change_id uuid references public.change_requests(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.change_requests enable row level security;
alter table public.issues enable row level security;
alter table public.decisions enable row level security;

create policy change_requests_project_access on public.change_requests for all using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy issues_project_access on public.issues for all using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy decisions_project_access on public.decisions for all using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));

create trigger change_requests_updated_at before update on public.change_requests for each row execute function public.set_updated_at();
create trigger issues_updated_at before update on public.issues for each row execute function public.set_updated_at();
create trigger decisions_updated_at before update on public.decisions for each row execute function public.set_updated_at();

create index if not exists change_requests_project_status_idx on public.change_requests(project_id,status);
create index if not exists issues_project_status_due_idx on public.issues(project_id,status,due_date);
create index if not exists decisions_project_date_idx on public.decisions(project_id,decision_date desc);
