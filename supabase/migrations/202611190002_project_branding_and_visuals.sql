alter table public.projects add column if not exists theme_color text not null default '#4f46e5';
alter table public.projects add column if not exists logo_path text;

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  entity_type text not null check (entity_type in ('tasks','backlog_items')),
  entity_id uuid not null,
  file_name text not null,
  mime_type text not null,
  stored_path text not null,
  size_bytes bigint not null default 0,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attachments_project_entity_idx on public.attachments(project_id,entity_type,entity_id);
alter table public.attachments enable row level security;

create policy attachments_project_access on public.attachments for all
using (public.can_access_project(project_id))
with check (public.can_access_project(project_id));

create trigger attachments_updated_at before update on public.attachments
for each row execute function public.set_updated_at();
