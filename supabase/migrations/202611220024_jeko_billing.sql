-- Online payment providers stay replaceable: public routing lives in the database,
-- credentials remain in Edge Function secrets and payment confirmation is atomic.
create table if not exists public.billing_provider_settings (
  provider text primary key check(provider in ('jeko','flutterwave')),
  display_name text not null,
  payment_method text,
  currency text not null,
  active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_provider_single_active
  on public.billing_provider_settings(active) where active=true;

create table if not exists public.provider_plan_prices (
  id uuid primary key default gen_random_uuid(),
  provider text not null references public.billing_provider_settings(provider) on delete cascade,
  plan_code text not null references public.plan_catalog(code) on delete cascade,
  billing_cycle text not null check(billing_cycle in ('monthly','annual')),
  currency text not null,
  unit_amount numeric(12,2) not null check(unit_amount>0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,plan_code,billing_cycle,currency)
);

alter table public.billing_provider_settings enable row level security;
alter table public.provider_plan_prices enable row level security;

create policy billing_provider_customer_read on public.billing_provider_settings for select
  using(active=true or public.is_platform_admin());
create policy provider_prices_customer_read on public.provider_plan_prices for select
  using(active=true or public.is_platform_admin());
create policy billing_provider_platform_manage on public.billing_provider_settings for all
  using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy provider_prices_platform_manage on public.provider_plan_prices for all
  using(public.is_platform_admin()) with check(public.is_platform_admin());

create trigger billing_provider_settings_updated_at before update on public.billing_provider_settings
  for each row execute function public.set_updated_at();
create trigger provider_plan_prices_updated_at before update on public.provider_plan_prices
  for each row execute function public.set_updated_at();

create or replace function public.activate_paid_subscription(
  transaction_id uuid,
  provider_transaction text,
  provider_customer text default null
) returns boolean language plpgsql security definer set search_path=public as $$
declare
  payment public.billing_transactions%rowtype;
  period_end timestamptz;
begin
  select * into payment from public.billing_transactions where id=transaction_id for update;
  if payment.id is null then raise exception 'Transaction introuvable.'; end if;
  if payment.status='successful' then return false; end if;
  if payment.status<>'pending' then raise exception 'Transaction non activable.'; end if;

  period_end:=case when payment.billing_cycle='annual' then now()+interval '1 year' else now()+interval '1 month' end;
  update public.billing_transactions
    set status='successful',provider_transaction_id=coalesce(provider_transaction,provider_transaction_id),paid_at=now()
    where id=payment.id;

  insert into public.subscriptions(workspace_id,plan_code,status,seats,provider,provider_customer_id,provider_subscription_id,current_period_start,current_period_end,cancel_at_period_end)
    values(payment.workspace_id,payment.plan_code,'active',payment.seats,payment.provider,provider_customer,provider_transaction,now(),period_end,false)
    on conflict(workspace_id) do update set
      plan_code=excluded.plan_code,status='active',seats=excluded.seats,provider=excluded.provider,
      provider_customer_id=excluded.provider_customer_id,provider_subscription_id=excluded.provider_subscription_id,
      current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,
      cancel_at_period_end=false,updated_at=now();

  insert into public.audit_log(workspace_id,actor_id,action,entity_type,entity_id,metadata)
    values(payment.workspace_id,payment.created_by,'billing.payment.confirmed','billing_transaction',payment.id,
      jsonb_build_object('provider',payment.provider,'plan_code',payment.plan_code,'amount',payment.amount,'currency',payment.currency,'seats',payment.seats));
  return true;
end;
$$;

grant select on public.billing_provider_settings,public.provider_plan_prices to authenticated;
grant insert,update,delete on public.billing_provider_settings,public.provider_plan_prices to authenticated;
revoke all on function public.activate_paid_subscription(uuid,text,text) from public,anon,authenticated;
grant execute on function public.activate_paid_subscription(uuid,text,text) to service_role;

insert into public.billing_provider_settings(provider,display_name,payment_method,currency,active,sort_order)
values('jeko','Jèko · Wave et Mobile Money','wave','XOF',false,10)
on conflict(provider) do nothing;
