create table if not exists public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  predecessor_task_id uuid not null references public.tasks(id) on delete cascade,
  dependency_type text not null default 'FS' check (dependency_type in ('FS','SS','FF','SF')),
  lag_days integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_dependency_not_self check (task_id <> predecessor_task_id),
  constraint task_dependency_unique unique (task_id, predecessor_task_id)
);

create table if not exists public.work_calendars (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default 'Calendrier du projet',
  working_days text not null default '1,2,3,4,5',
  hours_per_day numeric not null default 8 check (hours_per_day > 0 and hours_per_day <= 24),
  holidays text,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.task_dependencies enable row level security;
alter table public.work_calendars enable row level security;
create policy task_dependencies_project_access on public.task_dependencies for all using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy work_calendars_project_access on public.work_calendars for all using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create trigger task_dependencies_updated_at before update on public.task_dependencies for each row execute function public.set_updated_at();
create trigger work_calendars_updated_at before update on public.work_calendars for each row execute function public.set_updated_at();
create index if not exists task_dependencies_task_idx on public.task_dependencies(project_id,task_id);
create index if not exists task_dependencies_predecessor_idx on public.task_dependencies(project_id,predecessor_task_id);
create index if not exists work_calendars_project_idx on public.work_calendars(project_id,is_default desc);
