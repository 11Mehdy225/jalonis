alter table public.projects add column if not exists currency text not null default 'XOF';
alter table public.team add column if not exists hourly_cost numeric not null default 0;
alter table public.team add column if not exists billing_rate numeric not null default 0;

create table if not exists public.cost_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null,
  category text,
  cost_type text not null default 'Ponctuel',
  planned_amount numeric not null default 0 check(planned_amount >= 0),
  committed_amount numeric not null default 0 check(committed_amount >= 0),
  actual_amount numeric not null default 0 check(actual_amount >= 0),
  entry_date date,
  status text not null default 'Prévu',
  supplier_id uuid references public.suppliers(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cost_entries enable row level security;
create policy cost_entries_project_access on public.cost_entries for all
using (public.can_access_project(project_id))
with check (public.can_access_project(project_id));

create trigger cost_entries_updated_at before update on public.cost_entries
for each row execute function public.set_updated_at();

create index if not exists cost_entries_project_date_idx
on public.cost_entries(project_id,entry_date);
