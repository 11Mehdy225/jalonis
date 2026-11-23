-- First-class Scrum ceremonies and their participant updates.
create table if not exists public.scrum_events (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  event_type text not null check(event_type in ('Sprint Planning','Backlog Refinement','Daily Scrum','Sprint Review','Sprint Retrospective')),
  title text not null, scheduled_at timestamptz not null,
  duration_minutes integer not null default 30 check(duration_minutes between 5 and 480),
  status text not null default 'Planifié' check(status in ('Planifié','Réalisé','Non réalisé','Annulé')),
  facilitator_id uuid references public.profiles(id) on delete set null, facilitator_name text,
  participants jsonb not null default '[]'::jsonb, agenda text, notes text, decisions text,
  action_items jsonb not null default '[]'::jsonb,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.scrum_event_entries (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references public.scrum_events(id) on delete cascade,
  member_id uuid references public.profiles(id) on delete set null, member_name text not null,
  yesterday text, today text, blockers text, confidence integer check(confidence between 1 and 5),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(event_id,member_name)
);

create index if not exists scrum_events_sprint_date_idx on public.scrum_events(sprint_id,scheduled_at);
create index if not exists scrum_event_entries_event_idx on public.scrum_event_entries(event_id);
alter table public.scrum_events enable row level security;
alter table public.scrum_event_entries enable row level security;
create policy scrum_events_select on public.scrum_events for select using(public.can_access_project(project_id));
create policy scrum_events_insert on public.scrum_events for insert with check(public.can_write_project(project_id));
create policy scrum_events_update on public.scrum_events for update using(public.can_write_project(project_id)) with check(public.can_write_project(project_id));
create policy scrum_events_delete on public.scrum_events for delete using(public.can_manage_project(project_id));
create policy scrum_event_entries_select on public.scrum_event_entries for select using(public.can_access_project(project_id));
create policy scrum_event_entries_insert on public.scrum_event_entries for insert with check(public.can_write_project(project_id));
create policy scrum_event_entries_update on public.scrum_event_entries for update using(public.can_write_project(project_id)) with check(public.can_write_project(project_id));
create policy scrum_event_entries_delete on public.scrum_event_entries for delete using(public.can_manage_project(project_id));
create trigger scrum_events_updated_at before update on public.scrum_events for each row execute function public.set_updated_at();
create trigger scrum_event_entries_updated_at before update on public.scrum_event_entries for each row execute function public.set_updated_at();
create trigger subscription_write_access before insert or update or delete on public.scrum_events for each row execute function public.enforce_subscription_write_access();
create trigger subscription_write_access before insert or update or delete on public.scrum_event_entries for each row execute function public.enforce_subscription_write_access();
grant select,insert,update,delete on public.scrum_events,public.scrum_event_entries to authenticated;
alter publication supabase_realtime add table public.scrum_events;
alter publication supabase_realtime add table public.scrum_event_entries;

alter table public.project_links drop constraint if exists project_links_source_type_check;
alter table public.project_links drop constraint if exists project_links_target_type_check;
alter table public.project_links add constraint project_links_source_type_check check(source_type in ('tasks','backlog_items','sprints','scrum_events','risks','suppliers','procurements','supplier_quotes','supplier_contracts','cost_entries','issues','change_requests','decisions','meetings','conflicts','team'));
alter table public.project_links add constraint project_links_target_type_check check(target_type in ('tasks','backlog_items','sprints','scrum_events','risks','suppliers','procurements','supplier_quotes','supplier_contracts','cost_entries','issues','change_requests','decisions','meetings','conflicts','team'));
