-- Provider-agnostic billing ledger. Payment credentials always stay in Edge Functions.
create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tx_ref text not null unique,
  provider text not null default 'flutterwave',
  provider_transaction_id text,
  plan_code text not null references public.plan_catalog(code),
  billing_cycle text not null check(billing_cycle in ('monthly','annual')),
  seats integer not null check(seats>0),
  amount numeric(12,2) not null check(amount>=0),
  currency text not null default 'EUR',
  status text not null default 'pending' check(status in ('pending','successful','failed','cancelled','refunded')),
  checkout_url text,
  paid_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_provider_transaction_unique
  on public.billing_transactions(provider,provider_transaction_id)
  where provider_transaction_id is not null;
create index if not exists billing_workspace_created_idx on public.billing_transactions(workspace_id,created_at desc);

create table if not exists public.billing_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_key text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  unique(provider,event_key)
);

alter table public.billing_transactions enable row level security;
alter table public.billing_events enable row level security;
create policy billing_admin_read on public.billing_transactions for select
  using(public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur']));
create trigger billing_transactions_updated_at before update on public.billing_transactions
  for each row execute function public.set_updated_at();

grant select on public.billing_transactions to authenticated;
revoke all on public.billing_events from anon,authenticated;
