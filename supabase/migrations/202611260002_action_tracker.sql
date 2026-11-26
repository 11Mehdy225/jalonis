create table if not exists public.action_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  source_type text not null default 'Manuel',
  source_label text,
  owner text,
  due_date date,
  priority text not null default 'Moyenne' check(priority in ('Faible','Moyenne','Haute','Critique')),
  status text not null default 'À faire' check(status in ('À faire','En cours','Bloquée','Terminée','Annulée')),
  progress integer not null default 0 check(progress between 0 and 100),
  linked_task_id uuid references public.tasks(id) on delete set null,
  linked_risk_id uuid references public.risks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists action_items_project_status_idx on public.action_items(project_id,status,due_date);
alter table public.action_items enable row level security;
create policy action_items_member_select on public.action_items for select using(public.can_access_project(project_id));
create policy action_items_member_insert on public.action_items for insert with check(public.can_write_project(project_id));
create policy action_items_member_update on public.action_items for update using(public.can_write_project(project_id)) with check(public.can_write_project(project_id));
create policy action_items_manager_delete on public.action_items for delete using(public.can_manage_project(project_id));
create trigger action_items_updated_at before update on public.action_items for each row execute function public.set_updated_at();
grant select,insert,update,delete on public.action_items to authenticated;
alter publication supabase_realtime add table public.action_items;
create trigger subscription_write_access before insert or update or delete on public.action_items
for each row execute function public.enforce_subscription_write_access();
