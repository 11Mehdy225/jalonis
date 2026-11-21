create table if not exists public.sprint_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  snapshot_date date not null default current_date,
  total_points numeric not null default 0,
  remaining_points numeric not null default 0,
  completed_points numeric not null default 0,
  item_count integer not null default 0,
  completed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sprint_snapshots enable row level security;
create policy sprint_snapshots_project_access on public.sprint_snapshots for all
using (public.can_access_project(project_id))
with check (public.can_access_project(project_id));

create trigger sprint_snapshots_updated_at before update on public.sprint_snapshots
for each row execute function public.set_updated_at();

create index if not exists sprint_snapshots_sprint_date_idx
on public.sprint_snapshots(sprint_id,snapshot_date,created_at);
