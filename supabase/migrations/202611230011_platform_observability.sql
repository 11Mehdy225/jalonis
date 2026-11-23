-- Privacy-conscious operational telemetry and incident register.
create table if not exists public.platform_telemetry (
  id bigint generated always as identity primary key,
  event_type text not null check(event_type in ('page_view','session','client_error','api_error','security','performance')),
  severity text not null default 'info' check(severity in ('info','warning','error','critical')),
  user_id uuid references public.profiles(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  source text not null default 'web', route text, message text, fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_incidents (
  id uuid primary key default gen_random_uuid(), fingerprint text not null unique,
  title text not null, source text not null, severity text not null default 'warning' check(severity in ('info','warning','error','critical')),
  status text not null default 'open' check(status in ('open','investigating','resolved','ignored')),
  occurrence_count integer not null default 1, first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  assigned_to uuid references public.profiles(id) on delete set null, resolution text,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index if not exists platform_telemetry_created_idx on public.platform_telemetry(created_at desc);
create index if not exists platform_telemetry_type_idx on public.platform_telemetry(event_type,created_at desc);
create index if not exists platform_telemetry_user_idx on public.platform_telemetry(user_id,created_at desc);
create index if not exists platform_incidents_status_idx on public.platform_incidents(status,severity,last_seen_at desc);
alter table public.platform_telemetry enable row level security;
alter table public.platform_incidents enable row level security;
create policy platform_telemetry_admin_read on public.platform_telemetry for select using(public.is_platform_admin());
create policy platform_incidents_admin_read on public.platform_incidents for select using(public.is_platform_admin());
revoke all on public.platform_telemetry,public.platform_incidents from anon,authenticated;
grant select on public.platform_telemetry,public.platform_incidents to authenticated;
grant select,insert,update,delete on public.platform_telemetry,public.platform_incidents to service_role;
create trigger platform_incidents_updated_at before update on public.platform_incidents for each row execute function public.set_updated_at();

create or replace function public.prune_platform_telemetry()
returns void language sql security definer set search_path=public as $$
  delete from public.platform_telemetry where created_at<now()-interval '90 days';
$$;
revoke all on function public.prune_platform_telemetry() from public,anon,authenticated;
grant execute on function public.prune_platform_telemetry() to service_role;
