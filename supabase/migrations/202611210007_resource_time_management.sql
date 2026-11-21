alter table public.team add column if not exists weekly_capacity numeric not null default 40;

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  member_id uuid references public.team(id) on delete set null,
  member_name text not null,
  task_id uuid references public.tasks(id) on delete set null,
  entry_date date not null default current_date,
  hours numeric not null default 0 check(hours > 0 and hours <= 24),
  billable boolean not null default false,
  description text,
  status text not null default 'Brouillon',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.time_entries enable row level security;
create policy time_entries_project_access on public.time_entries for all
using (public.can_access_project(project_id))
with check (public.can_access_project(project_id));

create trigger time_entries_updated_at before update on public.time_entries
for each row execute function public.set_updated_at();

create index if not exists time_entries_project_member_date_idx
on public.time_entries(project_id,member_id,entry_date);
