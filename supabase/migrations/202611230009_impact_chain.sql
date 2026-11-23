-- Cross-domain links used by the Jalonis impact chain.
create table if not exists public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_type text not null check(source_type in ('tasks','backlog_items','sprints','risks','suppliers','procurements','supplier_quotes','supplier_contracts','cost_entries','issues','change_requests','decisions','meetings','conflicts','team')),
  source_id uuid not null,
  target_type text not null check(target_type in ('tasks','backlog_items','sprints','risks','suppliers','procurements','supplier_quotes','supplier_contracts','cost_entries','issues','change_requests','decisions','meetings','conflicts','team')),
  target_id uuid not null,
  relationship text not null default 'impacte',
  impact_area text not null default 'Délai' check(impact_area in ('Délai','Coût','Périmètre','Qualité','Ressource','Fournisseur','Risque','Valeur')),
  severity text not null default 'Moyenne' check(severity in ('Faible','Moyenne','Haute','Critique')),
  lag_days numeric not null default 0,
  notes text,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(source_id<>target_id or source_type<>target_type),
  unique(project_id,source_type,source_id,target_type,target_id,relationship)
);

create index if not exists project_links_source_idx on public.project_links(project_id,source_type,source_id);
create index if not exists project_links_target_idx on public.project_links(project_id,target_type,target_id);
alter table public.project_links enable row level security;
create policy project_links_member_select on public.project_links for select using(public.can_access_project(project_id));
create policy project_links_member_insert on public.project_links for insert with check(public.can_write_project(project_id));
create policy project_links_member_update on public.project_links for update using(public.can_write_project(project_id)) with check(public.can_write_project(project_id));
create policy project_links_manager_delete on public.project_links for delete using(public.can_manage_project(project_id));
create trigger project_links_updated_at before update on public.project_links for each row execute function public.set_updated_at();

grant select,insert,update,delete on public.project_links to authenticated;
alter publication supabase_realtime add table public.project_links;

drop trigger if exists subscription_write_access on public.project_links;
create trigger subscription_write_access before insert or update or delete on public.project_links
for each row execute function public.enforce_subscription_write_access();
