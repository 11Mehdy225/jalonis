-- Collaboration, activity feed and in-app notifications.
alter table public.comments add column if not exists author_name text;

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  title text not null,
  description text,
  actor_name text,
  actor_id uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  recipient_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activities_project_created_idx on public.activities(project_id,created_at desc);
create index if not exists notifications_recipient_read_idx on public.notifications(recipient_id,is_read,created_at desc);
create index if not exists comments_entity_idx on public.comments(project_id,entity_type,entity_id,created_at);

alter table public.activities enable row level security;
alter table public.notifications enable row level security;

create policy activities_project_access on public.activities for all
using (public.can_access_project(project_id))
with check (public.can_access_project(project_id));

create policy notifications_recipient_select on public.notifications for select
using (recipient_id=auth.uid() and public.can_access_project(project_id));
create policy notifications_project_insert on public.notifications for insert
with check (public.can_access_project(project_id));
create policy notifications_recipient_update on public.notifications for update
using (recipient_id=auth.uid()) with check (recipient_id=auth.uid());
create policy notifications_recipient_delete on public.notifications for delete
using (recipient_id=auth.uid());

create trigger activities_updated_at before update on public.activities
for each row execute function public.set_updated_at();
create trigger notifications_updated_at before update on public.notifications
for each row execute function public.set_updated_at();

alter publication supabase_realtime add table public.activities;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.comments;
