-- Real member mentions in project and work-item discussions.
alter table public.comments add column if not exists mentioned_user_ids jsonb not null default '[]'::jsonb;

create index if not exists comments_mentions_idx
on public.comments using gin (mentioned_user_ids);
