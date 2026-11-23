-- Time-limited promotion codes and decision-grade SaaS administration metrics.
create table if not exists public.promotion_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,
  plan_code text not null references public.plan_catalog(code),
  duration_days integer not null check(duration_days between 1 and 730),
  max_redemptions integer check(max_redemptions is null or max_redemptions>0),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(valid_until is null or valid_until>valid_from)
);

create table if not exists public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_code_id uuid not null references public.promotion_codes(id),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  redeemed_by uuid not null references public.profiles(id),
  activated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(promotion_code_id,workspace_id)
);

create index if not exists promotion_codes_active_idx on public.promotion_codes(active,valid_until);
create index if not exists promotion_redemptions_code_idx on public.promotion_redemptions(promotion_code_id,activated_at desc);

alter table public.promotion_codes enable row level security;
alter table public.promotion_redemptions enable row level security;

create policy promotion_codes_platform_read on public.promotion_codes for select
using(public.is_platform_admin());
create policy promotion_redemptions_platform_read on public.promotion_redemptions for select
using(public.is_platform_admin());
create policy promotion_redemptions_workspace_read on public.promotion_redemptions for select
using(public.is_workspace_member(workspace_id));

create trigger promotion_codes_updated_at before update on public.promotion_codes
for each row execute function public.set_updated_at();

revoke all on public.promotion_codes,public.promotion_redemptions from anon,authenticated;
grant select on public.promotion_codes,public.promotion_redemptions to authenticated;

create or replace function public.platform_admin_create_promotion_code(
  p_code text,
  p_plan_code text,
  p_duration_days integer,
  p_max_redemptions integer default null,
  p_valid_until timestamptz default null,
  p_label text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  normalized_code text:=upper(trim(p_code));
  created_code public.promotion_codes%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'Administrateur Jalonis requis.'; end if;
  if normalized_code !~ '^[A-Z0-9][A-Z0-9_-]{3,31}$' then
    raise exception 'Le code doit contenir 4 à 32 caractères : lettres, chiffres, tiret ou soulignement.';
  end if;
  if p_duration_days not between 1 and 730 then raise exception 'Durée invalide.'; end if;
  if p_max_redemptions is not null and p_max_redemptions<1 then raise exception 'Nombre d’utilisations invalide.'; end if;
  if p_valid_until is not null and p_valid_until<=now() then raise exception 'La date de validité doit être future.'; end if;
  if not exists(select 1 from public.plan_catalog where code=p_plan_code and active=true and code<>'discovery') then
    raise exception 'Offre promotionnelle invalide.';
  end if;

  insert into public.promotion_codes(code,label,plan_code,duration_days,max_redemptions,valid_until,created_by)
  values(normalized_code,nullif(trim(p_label),''),p_plan_code,p_duration_days,p_max_redemptions,p_valid_until,auth.uid())
  returning * into created_code;
  return to_jsonb(created_code);
end;
$$;

create or replace function public.platform_admin_set_promotion_code_active(p_code_id uuid,p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare updated_code public.promotion_codes%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'Administrateur Jalonis requis.'; end if;
  update public.promotion_codes set active=p_active,updated_at=now() where id=p_code_id returning * into updated_code;
  if updated_code.id is null then raise exception 'Code promotionnel introuvable.'; end if;
  return to_jsonb(updated_code);
end;
$$;

create or replace function public.redeem_promotion_code(p_workspace_id uuid,p_code text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  promotion_record public.promotion_codes%rowtype;
  subscription_record public.subscriptions%rowtype;
  target_account_type text;
  plan_account_type text;
  plan_min_seats integer;
  redemption_count integer;
  promotion_end timestamptz;
begin
  if not public.has_workspace_role(p_workspace_id,array['Propriétaire','Administrateur']) then
    raise exception 'Seuls le propriétaire et les administrateurs peuvent utiliser un code promotionnel.';
  end if;
  if exists(select 1 from public.promotion_redemptions where workspace_id=p_workspace_id) then
    raise exception 'Cet espace a déjà bénéficié d’un code promotionnel.';
  end if;

  select * into promotion_record from public.promotion_codes
  where code=upper(trim(p_code)) for update;
  if promotion_record.id is null or not promotion_record.active then raise exception 'Code promotionnel invalide ou désactivé.'; end if;
  if promotion_record.valid_from>now() or (promotion_record.valid_until is not null and promotion_record.valid_until<now()) then
    raise exception 'Ce code promotionnel n’est plus valide.';
  end if;
  select count(*) into redemption_count from public.promotion_redemptions where promotion_code_id=promotion_record.id;
  if promotion_record.max_redemptions is not null and redemption_count>=promotion_record.max_redemptions then
    raise exception 'Le nombre maximal d’utilisations de ce code est atteint.';
  end if;

  select account_type into target_account_type from public.workspaces where id=p_workspace_id;
  select account_type,min_seats into plan_account_type,plan_min_seats from public.plan_catalog where code=promotion_record.plan_code;
  if target_account_type is null then raise exception 'Espace introuvable.'; end if;
  if plan_account_type<>target_account_type then
    raise exception 'Ce code n’est pas compatible avec le type de cet espace.';
  end if;

  select * into subscription_record from public.subscriptions where workspace_id=p_workspace_id for update;
  if subscription_record.id is null then raise exception 'Abonnement de l’espace introuvable.'; end if;
  if subscription_record.plan_code<>'discovery' and subscription_record.status='active'
    and coalesce(subscription_record.provider,'')<>'promotion'
    and (subscription_record.current_period_end is null or subscription_record.current_period_end>now()) then
    raise exception 'Un abonnement payant est déjà actif sur cet espace.';
  end if;

  promotion_end:=now()+make_interval(days=>promotion_record.duration_days);
  update public.subscriptions set
    plan_code=promotion_record.plan_code,
    status='active',
    seats=greatest(seats,coalesce(plan_min_seats,1)),
    provider='promotion',
    provider_customer_id=null,
    provider_subscription_id=promotion_record.id::text,
    current_period_start=now(),
    current_period_end=promotion_end,
    cancel_at_period_end=true,
    updated_at=now()
  where workspace_id=p_workspace_id returning * into subscription_record;

  insert into public.promotion_redemptions(promotion_code_id,workspace_id,redeemed_by,expires_at)
  values(promotion_record.id,p_workspace_id,auth.uid(),promotion_end);
  insert into public.audit_log(workspace_id,actor_id,action,entity_type,entity_id,metadata)
  values(p_workspace_id,auth.uid(),'promotion.redeemed','promotion_code',promotion_record.id,
    jsonb_build_object('code',promotion_record.code,'plan_code',promotion_record.plan_code,'duration_days',promotion_record.duration_days,'expires_at',promotion_end));

  return jsonb_build_object(
    'ok',true,'message','Code activé. Votre accès promotionnel commence aujourd’hui.',
    'code',promotion_record.code,'plan_code',promotion_record.plan_code,'expires_at',promotion_end,
    'subscription',to_jsonb(subscription_record)
  );
end;
$$;

revoke all on function public.platform_admin_create_promotion_code(text,text,integer,integer,timestamptz,text) from public,anon;
revoke all on function public.platform_admin_set_promotion_code_active(uuid,boolean) from public,anon;
revoke all on function public.redeem_promotion_code(uuid,text) from public,anon;
grant execute on function public.platform_admin_create_promotion_code(text,text,integer,integer,timestamptz,text) to authenticated;
grant execute on function public.platform_admin_set_promotion_code_active(uuid,boolean) to authenticated;
grant execute on function public.redeem_promotion_code(uuid,text) to authenticated;

-- Promotion access ends exactly on its configured date; paid subscriptions keep the usual grace period.
create or replace function public.workspace_subscription_write_allowed(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select case
      when s.plan_code='discovery' and s.status in ('trialing','active','preview') then true
      when s.provider='promotion' then
        s.status in ('active','trialing') and s.current_period_end is not null and now()<=s.current_period_end
      when s.status in ('active','trialing') then
        s.current_period_end is null or now()<=s.current_period_end+interval '3 days'
      when s.status='past_due' then
        s.current_period_end is not null and s.current_period_end<now()
        and now()<=s.current_period_end+interval '3 days'
      else false
    end
    from public.subscriptions s where s.workspace_id=target_workspace
  ),false)
$$;

-- Replace the dashboard payload with commercial, operational and adoption indicators.
create or replace function public.platform_admin_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'Administrateur Jalonis requis.'; end if;
  select jsonb_build_object(
    'metrics',jsonb_build_object(
      'accounts',(select count(*) from public.profiles),
      'new_accounts_30d',(select count(*) from public.profiles where created_at>=now()-interval '30 days'),
      'workspaces',(select count(*) from public.workspaces),
      'active_members',(select count(*) from public.workspace_members where status='Actif'),
      'projects',(select count(*) from public.projects),
      'active_subscriptions',(select count(*) from public.subscriptions where status='active'),
      'paid_subscriptions',(select count(*) from public.subscriptions where status='active' and plan_code<>'discovery' and coalesce(provider,'')<>'promotion'),
      'past_due',(select count(*) from public.subscriptions where status='past_due'),
      'expiring_7d',(select count(*) from public.subscriptions where status='active' and plan_code<>'discovery' and current_period_end between now() and now()+interval '7 days'),
      'conversion_rate',(select round(100.0*count(*) filter(where status='active' and plan_code<>'discovery' and coalesce(provider,'')<>'promotion')/nullif(count(*),0),1) from public.subscriptions),
      'mrr_xof',(select coalesce(sum(p.monthly_price_xof*greatest(1,s.seats)),0) from public.subscriptions s join public.plan_catalog p on p.code=s.plan_code where s.status='active' and s.plan_code<>'discovery' and coalesce(s.provider,'')<>'promotion'),
      'revenue_30d_xof',(select coalesce(sum(amount),0) from public.billing_transactions where status='successful' and currency='XOF' and paid_at>=now()-interval '30 days'),
      'revenue_total_xof',(select coalesce(sum(amount),0) from public.billing_transactions where status='successful' and currency='XOF'),
      'trials',(select count(*) from public.subscriptions where status='trialing'),
      'pending_payments',(select count(*) from public.manual_payment_requests where status='pending'),
      'failed_payments',(select count(*) from public.billing_transactions where status='failed'),
      'active_promotions',(select count(*) from public.promotion_codes where active=true and (valid_until is null or valid_until>now())),
      'promotion_redemptions',(select count(*) from public.promotion_redemptions),
      'pending_emails',(select count(*) from public.email_deliveries where status='pending'),
      'failed_emails',(select count(*) from public.email_deliveries where status='failed'),
      'pending_whatsapp',(select count(*) from public.whatsapp_deliveries where status='pending'),
      'failed_whatsapp',(select count(*) from public.whatsapp_deliveries where status='failed')
    ),
    'workspaces',coalesce((select jsonb_agg(row_to_json(items)::jsonb order by items.created_at desc) from (
      select w.id,w.name,w.account_type,w.subscription_plan,w.subscription_status,w.seat_limit,w.trial_ends_at,w.created_at,
        p.full_name as owner_name,p.email as owner_email,
        s.plan_code,s.status as subscription_status_code,s.seats,s.current_period_end,s.provider,
        (select count(*) from public.workspace_members m where m.workspace_id=w.id and m.status='Actif') as member_count,
        (select count(*) from public.projects pr where pr.workspace_id=w.id) as project_count
      from public.workspaces w left join public.profiles p on p.id=w.created_by left join public.subscriptions s on s.workspace_id=w.id
      order by w.created_at desc limit 250
    ) items),'[]'::jsonb),
    'promotion_codes',coalesce((select jsonb_agg(row_to_json(pc)::jsonb order by pc.created_at desc) from (
      select c.id,c.code,c.label,c.plan_code,c.duration_days,c.max_redemptions,c.valid_until,c.active,c.created_at,
        (select count(*) from public.promotion_redemptions r where r.promotion_code_id=c.id) as redemption_count
      from public.promotion_codes c order by c.created_at desc limit 100
    ) pc),'[]'::jsonb),
    'channels',coalesce((select jsonb_agg(row_to_json(c)::jsonb order by c.channel) from public.notification_channel_settings c),'[]'::jsonb),
    'recent_failures',coalesce((select jsonb_agg(row_to_json(f)::jsonb order by f.created_at desc) from (
      select id,workspace_id,provider,plan_code,amount,currency,status,created_at from public.billing_transactions where status='failed' order by created_at desc limit 50
    ) f),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.process_promotion_expirations()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  expired_record record;
  owner_record record;
  expired_count integer:=0;
begin
  for expired_record in
    select s.id as subscription_id,s.workspace_id,s.current_period_end,w.name as workspace_name
    from public.subscriptions s join public.workspaces w on w.id=s.workspace_id
    where s.provider='promotion' and s.status in ('active','trialing','past_due')
      and s.current_period_end is not null and s.current_period_end<=now()
    for update of s
  loop
    update public.subscriptions set status='canceled',updated_at=now() where id=expired_record.subscription_id;
    expired_count:=expired_count+1;
    for owner_record in
      select p.id from public.workspace_members wm join public.profiles p on p.id=wm.user_id
      where wm.workspace_id=expired_record.workspace_id and wm.role='Propriétaire' and wm.status='Actif' and p.notify_email=true
    loop
      insert into public.email_deliveries(recipient_id,email_type,dedupe_key,subject,template_data)
      values(owner_record.id,'notification','promotion-expired:'||expired_record.subscription_id::text,
        'Jalonis · Votre période promotionnelle est terminée',
        jsonb_build_object(
          'title','Votre période promotionnelle est terminée',
          'body','L’espace « '||expired_record.workspace_name||' » est désormais en lecture seule. Choisissez une offre dans Espace & accès pour continuer à travailler.',
          'event_type','promotion.expired','workspace_id',expired_record.workspace_id
        )) on conflict(dedupe_key) do nothing;
    end loop;
  end loop;
  return jsonb_build_object('ok',true,'expired',expired_count,'processed_at',now());
end;
$$;

revoke all on function public.process_promotion_expirations() from public,anon,authenticated;
grant execute on function public.process_promotion_expirations() to service_role;
select cron.schedule('jalonis-promotion-expirations','59 * * * *','select public.process_promotion_expirations()');
select public.process_promotion_expirations();
