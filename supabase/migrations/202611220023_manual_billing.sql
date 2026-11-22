-- Manual payments keep early SaaS sales operational without weakening subscription controls.
create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_platform_admin(candidate uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.platform_admins where user_id=candidate and active=true)
$$;

create table if not exists public.manual_payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null,
  account_name text not null,
  account_reference text not null,
  instructions text,
  currency text not null default 'XOF',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manual_plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null references public.plan_catalog(code) on delete cascade,
  billing_cycle text not null check(billing_cycle in ('monthly','annual')),
  currency text not null default 'XOF',
  unit_amount numeric(12,2) not null check(unit_amount>0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_code,billing_cycle,currency)
);

create table if not exists public.manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  payment_method_id uuid not null references public.manual_payment_methods(id),
  plan_code text not null references public.plan_catalog(code),
  billing_cycle text not null check(billing_cycle in ('monthly','annual')),
  seats integer not null check(seats>0),
  amount numeric(12,2) not null check(amount>0),
  currency text not null default 'XOF',
  payer_name text not null,
  payment_reference text not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  billing_transaction_id uuid references public.billing_transactions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists manual_payment_reference_unique
  on public.manual_payment_requests(payment_method_id,lower(payment_reference))
  where status in ('pending','approved');
create index if not exists manual_payment_workspace_idx
  on public.manual_payment_requests(workspace_id,created_at desc);
create index if not exists manual_payment_pending_idx
  on public.manual_payment_requests(status,created_at) where status='pending';

alter table public.platform_admins enable row level security;
alter table public.manual_payment_methods enable row level security;
alter table public.manual_plan_prices enable row level security;
alter table public.manual_payment_requests enable row level security;

create policy platform_admin_self_read on public.platform_admins for select
  using(user_id=auth.uid());
create policy manual_methods_customer_read on public.manual_payment_methods for select
  using(active=true or public.is_platform_admin());
create policy manual_prices_customer_read on public.manual_plan_prices for select
  using(active=true or public.is_platform_admin());
create policy manual_requests_workspace_read on public.manual_payment_requests for select
  using(public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur']) or public.is_platform_admin());
create policy platform_admin_workspace_read on public.workspaces for select
  using(public.is_platform_admin());
create policy manual_methods_platform_manage on public.manual_payment_methods for all
  using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy manual_prices_platform_manage on public.manual_plan_prices for all
  using(public.is_platform_admin()) with check(public.is_platform_admin());

create trigger manual_payment_methods_updated_at before update on public.manual_payment_methods
  for each row execute function public.set_updated_at();
create trigger manual_plan_prices_updated_at before update on public.manual_plan_prices
  for each row execute function public.set_updated_at();
create trigger manual_payment_requests_updated_at before update on public.manual_payment_requests
  for each row execute function public.set_updated_at();

create or replace function public.review_manual_payment(
  request_id uuid,
  reviewer_id uuid,
  decision text,
  review_note text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  payment public.manual_payment_requests%rowtype;
  transaction_id uuid;
  period_end timestamptz;
begin
  if not public.is_platform_admin(reviewer_id) then raise exception 'Administrateur Jalonis requis.'; end if;
  if decision not in ('approved','rejected') then raise exception 'Décision invalide.'; end if;

  select * into payment from public.manual_payment_requests where id=request_id for update;
  if payment.id is null then raise exception 'Demande de paiement introuvable.'; end if;
  if payment.status<>'pending' then raise exception 'Cette demande a déjà été traitée.'; end if;

  if decision='rejected' then
    update public.manual_payment_requests set status='rejected',admin_note=review_note,reviewed_by=reviewer_id,reviewed_at=now() where id=request_id;
    insert into public.audit_log(workspace_id,actor_id,action,entity_type,entity_id,metadata)
      values(payment.workspace_id,reviewer_id,'billing.manual.rejected','manual_payment_request',request_id,jsonb_build_object('note',review_note));
    return null;
  end if;

  period_end:=case when payment.billing_cycle='annual' then now()+interval '1 year' else now()+interval '1 month' end;
  insert into public.billing_transactions(workspace_id,tx_ref,provider,provider_transaction_id,plan_code,billing_cycle,seats,amount,currency,status,paid_at,created_by)
    values(payment.workspace_id,'manual-'||payment.id,'manual',payment.payment_method_id||':'||payment.payment_reference,payment.plan_code,payment.billing_cycle,payment.seats,payment.amount,payment.currency,'successful',now(),payment.requested_by)
    returning id into transaction_id;

  insert into public.subscriptions(workspace_id,plan_code,status,seats,provider,provider_subscription_id,current_period_start,current_period_end,cancel_at_period_end)
    values(payment.workspace_id,payment.plan_code,'active',payment.seats,'manual',payment.id::text,now(),period_end,false)
    on conflict(workspace_id) do update set plan_code=excluded.plan_code,status='active',seats=excluded.seats,provider='manual',provider_subscription_id=excluded.provider_subscription_id,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,cancel_at_period_end=false,updated_at=now();

  update public.manual_payment_requests set status='approved',admin_note=review_note,reviewed_by=reviewer_id,reviewed_at=now(),billing_transaction_id=transaction_id where id=request_id;
  insert into public.audit_log(workspace_id,actor_id,action,entity_type,entity_id,metadata)
    values(payment.workspace_id,reviewer_id,'billing.manual.approved','manual_payment_request',request_id,jsonb_build_object('plan_code',payment.plan_code,'amount',payment.amount,'currency',payment.currency,'seats',payment.seats));
  return transaction_id;
end;
$$;

grant select on public.platform_admins,public.manual_payment_methods,public.manual_plan_prices,public.manual_payment_requests to authenticated;
grant insert,update,delete on public.manual_payment_methods,public.manual_plan_prices to authenticated;
revoke all on function public.review_manual_payment(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_manual_payment(uuid,uuid,text,text) to service_role;

