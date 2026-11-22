create table if not exists public.stakeholders (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  name text not null, organization text, role text, category text not null default 'Externe',
  influence integer not null default 3 check(influence between 1 and 5), interest integer not null default 3 check(interest between 1 and 5),
  current_engagement text not null default 'Neutre', desired_engagement text not null default 'Soutien', sentiment text not null default 'Neutre',
  owner text, communication_needs text, email text, phone text, status text not null default 'Actif',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.raci_assignments (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  activity_label text not null, task_id uuid references public.tasks(id) on delete set null,
  responsible_member_id uuid references public.team(id) on delete set null, accountable_member_id uuid references public.team(id) on delete set null,
  consulted_member_ids text, informed_member_ids text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.conflicts (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  title text not null, parties text, category text, severity text not null default 'Moyenne', detected_date date,
  owner text, status text not null default 'Ouvert', resolution_strategy text, resolution text,
  linked_task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.communication_plans (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  audience text not null, objective text, content text, channel text not null default 'Réunion', frequency text,
  owner text, next_date date, status text not null default 'Actif', stakeholder_id uuid references public.stakeholders(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.stakeholders enable row level security;
alter table public.raci_assignments enable row level security;
alter table public.conflicts enable row level security;
alter table public.communication_plans enable row level security;
create policy stakeholders_project_access on public.stakeholders for all using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy raci_assignments_project_access on public.raci_assignments for all using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy conflicts_project_access on public.conflicts for all using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy communication_plans_project_access on public.communication_plans for all using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create trigger stakeholders_updated_at before update on public.stakeholders for each row execute function public.set_updated_at();
create trigger raci_assignments_updated_at before update on public.raci_assignments for each row execute function public.set_updated_at();
create trigger conflicts_updated_at before update on public.conflicts for each row execute function public.set_updated_at();
create trigger communication_plans_updated_at before update on public.communication_plans for each row execute function public.set_updated_at();
create index if not exists stakeholders_project_influence_idx on public.stakeholders(project_id,influence desc,interest desc);
create index if not exists conflicts_project_status_idx on public.conflicts(project_id,status);
create index if not exists communication_plans_project_next_idx on public.communication_plans(project_id,next_date);
