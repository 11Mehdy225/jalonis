-- Privacy requests, self-service export and operational backup evidence.
create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  requester_email text not null,
  request_type text not null check(request_type in ('export','deletion','rectification','objection')),
  status text not null default 'submitted' check(status in ('submitted','in_review','approved','completed','rejected','cancelled')),
  details text,
  admin_notes text,
  requested_at timestamptz not null default now(),
  due_at timestamptz not null default (now() + interval '30 days'),
  processed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists privacy_requests_user_idx on public.privacy_requests(user_id,requested_at desc);
create index if not exists privacy_requests_status_idx on public.privacy_requests(status,due_at);
alter table public.privacy_requests enable row level security;
create policy privacy_requests_self_read on public.privacy_requests for select to authenticated using(user_id=auth.uid());
create policy privacy_requests_admin_read on public.privacy_requests for select to authenticated using(public.is_platform_admin());
create policy privacy_requests_admin_update on public.privacy_requests for update to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create trigger privacy_requests_updated_at before update on public.privacy_requests for each row execute function public.set_updated_at();

create or replace function public.submit_privacy_request(p_request_type text,p_details text default null)
returns public.privacy_requests language plpgsql security definer set search_path=public as $$
declare result public.privacy_requests; email_value text;
begin
  if auth.uid() is null then raise exception 'Session requise.'; end if;
  if p_request_type not in ('export','deletion','rectification','objection') then raise exception 'Type de demande invalide.'; end if;
  if exists(select 1 from public.privacy_requests where user_id=auth.uid() and request_type=p_request_type and status in ('submitted','in_review','approved')) then
    raise exception 'Une demande identique est déjà en cours.';
  end if;
  select email into email_value from public.profiles where id=auth.uid();
  insert into public.privacy_requests(user_id,requester_email,request_type,details)
  values(auth.uid(),email_value,p_request_type,left(coalesce(p_details,''),2000)) returning * into result;
  return result;
end;
$$;

create or replace function public.cancel_privacy_request(p_request_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.privacy_requests set status='cancelled' where id=p_request_id and user_id=auth.uid() and status='submitted';
  return found;
end;
$$;

create or replace function public.export_my_personal_data()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Session requise.'; end if;
  return jsonb_build_object(
    'generated_at',now(),
    'profile',(select to_jsonb(p) from public.profiles p where p.id=auth.uid()),
    'workspace_memberships',coalesce((select jsonb_agg(to_jsonb(m)) from public.workspace_members m where m.user_id=auth.uid()),'[]'::jsonb),
    'owned_workspaces',coalesce((select jsonb_agg(to_jsonb(w)) from public.workspaces w where w.created_by=auth.uid()),'[]'::jsonb),
    'legal_acceptances',coalesce((select jsonb_agg(to_jsonb(a)) from public.legal_acceptances a where a.user_id=auth.uid()),'[]'::jsonb),
    'notifications',coalesce((select jsonb_agg(to_jsonb(n)) from public.notifications n where n.recipient_id=auth.uid()),'[]'::jsonb),
    'comments',coalesce((select jsonb_agg(to_jsonb(c)) from public.comments c where c.author_id=auth.uid()),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(to_jsonb(a)) from public.activities a where a.actor_id=auth.uid()),'[]'::jsonb),
    'privacy_requests',coalesce((select jsonb_agg(to_jsonb(r)) from public.privacy_requests r where r.user_id=auth.uid()),'[]'::jsonb)
  );
end;
$$;

create table if not exists public.backup_verifications (
  id uuid primary key default gen_random_uuid(),
  scope text not null check(scope in ('database','storage','project_export')),
  status text not null check(status in ('passed','failed','pending')),
  restore_tested boolean not null default false,
  details text,
  checked_at timestamptz not null default now(),
  checked_by uuid references public.profiles(id) on delete set null,
  next_due_at timestamptz not null default (now() + interval '30 days')
);
alter table public.backup_verifications enable row level security;
create policy backup_verifications_admin_all on public.backup_verifications for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());

revoke all on function public.submit_privacy_request(text,text),public.cancel_privacy_request(uuid),public.export_my_personal_data() from public;
grant execute on function public.submit_privacy_request(text,text),public.cancel_privacy_request(uuid),public.export_my_personal_data() to authenticated;
grant select on public.privacy_requests to authenticated;
grant select,insert,update on public.privacy_requests,public.backup_verifications to service_role;
