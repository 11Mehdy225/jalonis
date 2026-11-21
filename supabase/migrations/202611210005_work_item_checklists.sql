create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  entity_type text not null check(entity_type in ('tasks','backlog_items')),
  entity_id uuid not null,
  title text not null,
  is_done boolean not null default false,
  rank integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.checklist_items enable row level security;
create policy checklist_items_project_access on public.checklist_items for all
using (public.can_access_project(project_id))
with check (public.can_access_project(project_id));

create trigger checklist_items_updated_at before update on public.checklist_items
for each row execute function public.set_updated_at();

create index if not exists checklist_items_entity_idx
on public.checklist_items(project_id,entity_type,entity_id,rank);
