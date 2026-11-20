alter table public.profiles add column if not exists notify_in_app boolean not null default true;
alter table public.profiles add column if not exists notify_assignments boolean not null default true;
alter table public.profiles add column if not exists notify_status_changes boolean not null default true;
alter table public.profiles add column if not exists notify_comments boolean not null default true;
alter table public.profiles add column if not exists daily_digest boolean not null default true;
alter table public.profiles add column if not exists quiet_start time not null default '20:00';
alter table public.profiles add column if not exists quiet_end time not null default '07:00';
