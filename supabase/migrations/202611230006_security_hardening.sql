-- Server-side abuse protection for sensitive Edge Functions.
create table if not exists public.api_rate_limits (
  scope text not null check(length(scope) between 1 and 80),
  actor_id uuid not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check(request_count > 0),
  updated_at timestamptz not null default now(),
  primary key(scope,actor_id,window_start)
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from public,anon,authenticated;
grant select,insert,update,delete on public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_actor uuid,
  p_max_requests integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  current_window timestamptz;
  current_count integer;
begin
  if p_actor is null
     or length(p_scope) not between 1 and 80
     or p_max_requests not between 1 and 1000
     or p_window_seconds not between 1 and 86400 then
    return false;
  end if;

  current_window:=to_timestamp(
    floor(extract(epoch from clock_timestamp())/p_window_seconds)*p_window_seconds
  );

  insert into public.api_rate_limits(scope,actor_id,window_start,request_count)
  values(p_scope,p_actor,current_window,1)
  on conflict(scope,actor_id,window_start)
  do update set request_count=public.api_rate_limits.request_count+1,updated_at=now()
  returning request_count into current_count;

  delete from public.api_rate_limits
  where actor_id=p_actor
    and window_start<now()-interval '1 day';

  return current_count<=p_max_requests;
end;
$$;

revoke all on function public.consume_api_rate_limit(text,uuid,integer,integer)
  from public,anon,authenticated;
grant execute on function public.consume_api_rate_limit(text,uuid,integer,integer)
  to service_role;
