-- Operational console for notifications, accounts and subscriptions.
create table if not exists public.notification_channel_settings (
  channel text primary key check(channel in ('email','whatsapp')),
  provider text not null,
  enabled boolean not null default false,
  configured boolean not null default false,
  sender_name text,
  sender_address text,
  schedule_label text,
  last_checked_at timestamptz,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.notification_channel_settings(channel,provider,enabled,configured,sender_name,schedule_label)
values
  ('email','Resend',false,false,'Jalonis','Toutes les 5 minutes'),
  ('whatsapp','Meta Cloud API',false,false,'Jalonis','Toutes les 5 minutes')
on conflict(channel) do nothing;

alter table public.notification_channel_settings enable row level security;
create policy notification_settings_platform_read on public.notification_channel_settings for select
  using(public.is_platform_admin());
create policy notification_settings_platform_manage on public.notification_channel_settings for all
  using(public.is_platform_admin()) with check(public.is_platform_admin());
create trigger notification_channel_settings_updated_at before update on public.notification_channel_settings
  for each row execute function public.set_updated_at();

-- The first real workspace owner becomes the initial Jalonis operator.
-- This only runs when no platform administrator exists yet.
insert into public.platform_admins(user_id,active)
select w.created_by,true from public.workspaces w
where not exists(select 1 from public.platform_admins)
order by w.created_at asc limit 1
on conflict(user_id) do update set active=true;

create or replace function public.platform_admin_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'Administrateur Jalonis requis.'; end if;
  select jsonb_build_object(
    'metrics',jsonb_build_object(
      'accounts',(select count(*) from public.profiles),
      'workspaces',(select count(*) from public.workspaces),
      'active_subscriptions',(select count(*) from public.subscriptions where status='active'),
      'trials',(select count(*) from public.subscriptions where status='trialing'),
      'pending_payments',(select count(*) from public.manual_payment_requests where status='pending'),
      'failed_payments',(select count(*) from public.billing_transactions where status='failed'),
      'pending_emails',(select count(*) from public.email_deliveries where status='pending'),
      'failed_emails',(select count(*) from public.email_deliveries where status='failed'),
      'pending_whatsapp',(select count(*) from public.whatsapp_deliveries where status='pending'),
      'failed_whatsapp',(select count(*) from public.whatsapp_deliveries where status='failed')
    ),
    'workspaces',coalesce((select jsonb_agg(row_to_json(items)::jsonb order by items.created_at desc) from (
      select w.id,w.name,w.account_type,w.subscription_plan,w.subscription_status,w.seat_limit,w.trial_ends_at,w.created_at,
        p.full_name as owner_name,p.email as owner_email,
        s.plan_code,s.status as subscription_status_code,s.seats,s.current_period_end,
        (select count(*) from public.workspace_members m where m.workspace_id=w.id and m.status='Actif') as member_count,
        (select count(*) from public.projects pr where pr.workspace_id=w.id) as project_count
      from public.workspaces w
      left join public.profiles p on p.id=w.created_by
      left join public.subscriptions s on s.workspace_id=w.id
      order by w.created_at desc limit 250
    ) items),'[]'::jsonb),
    'channels',coalesce((select jsonb_agg(row_to_json(c)::jsonb order by c.channel) from public.notification_channel_settings c),'[]'::jsonb),
    'recent_failures',coalesce((select jsonb_agg(row_to_json(f)::jsonb order by f.created_at desc) from (
      select id,workspace_id,provider,plan_code,amount,currency,status,created_at from public.billing_transactions
      where status='failed' order by created_at desc limit 50
    ) f),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.platform_admin_manage_subscription(
  target_workspace_id uuid,
  admin_action text,
  target_plan_code text default null,
  target_seats integer default null,
  extension_days integer default 30
) returns jsonb language plpgsql security definer set search_path=public as $$
declare sub public.subscriptions%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'Administrateur Jalonis requis.'; end if;
  if admin_action not in ('activate','suspend','extend','reactivate') then raise exception 'Action invalide.'; end if;
  select * into sub from public.subscriptions where workspace_id=target_workspace_id for update;
  if sub.id is null then raise exception 'Abonnement introuvable.'; end if;
  if target_plan_code is not null and not exists(select 1 from public.plan_catalog where code=target_plan_code and active=true) then raise exception 'Offre invalide.'; end if;

  update public.subscriptions set
    plan_code=coalesce(target_plan_code,plan_code),
    seats=greatest(1,coalesce(target_seats,seats)),
    status=case when admin_action in ('activate','reactivate') then 'active' when admin_action='suspend' then 'past_due' else status end,
    current_period_start=case when admin_action='activate' then now() else current_period_start end,
    current_period_end=case
      when admin_action='activate' then now()+make_interval(days=>greatest(1,extension_days))
      when admin_action='extend' then greatest(coalesce(current_period_end,now()),now())+make_interval(days=>greatest(1,extension_days))
      else current_period_end end,
    updated_at=now()
  where workspace_id=target_workspace_id returning * into sub;

  insert into public.audit_log(workspace_id,actor_id,action,entity_type,entity_id,metadata)
  values(target_workspace_id,auth.uid(),'platform.subscription.'||admin_action,'subscription',sub.id,
    jsonb_build_object('plan_code',sub.plan_code,'seats',sub.seats,'status',sub.status,'period_end',sub.current_period_end));
  return to_jsonb(sub);
end;
$$;

create or replace function public.platform_admin_retry_delivery(delivery_channel text,delivery_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_admin() then raise exception 'Administrateur Jalonis requis.'; end if;
  if delivery_channel='email' then
    update public.email_deliveries set status='pending',attempts=0,last_error=null,scheduled_for=now() where id=delivery_id and status='failed';
  elsif delivery_channel='whatsapp' then
    update public.whatsapp_deliveries set status='pending',attempts=0,last_error=null,scheduled_for=now() where id=delivery_id and status='failed';
  else raise exception 'Canal invalide.';
  end if;
  return found;
end;
$$;

grant select,insert,update on public.notification_channel_settings to authenticated;
revoke all on function public.platform_admin_dashboard() from public,anon;
revoke all on function public.platform_admin_manage_subscription(uuid,text,text,integer,integer) from public,anon;
revoke all on function public.platform_admin_retry_delivery(text,uuid) from public,anon;
grant execute on function public.platform_admin_dashboard() to authenticated;
grant execute on function public.platform_admin_manage_subscription(uuid,text,text,integer,integer) to authenticated;
grant execute on function public.platform_admin_retry_delivery(text,uuid) to authenticated;
