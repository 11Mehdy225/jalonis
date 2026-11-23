-- Public launch prices in West African CFA francs.
alter table public.plan_catalog add column if not exists monthly_price_xof numeric(12,2);
alter table public.plan_catalog add column if not exists annual_price_xof numeric(12,2);

update public.plan_catalog set
  monthly_price_xof=0,
  annual_price_xof=0,
  features=features||'{"projects":2,"storage_mb":250,"collaboration":false,"email_reminders":false}'::jsonb
where code='discovery';

update public.plan_catalog set
  monthly_price_xof=3500,
  annual_price_xof=35000,
  features=features||'{"projects":-1,"storage_mb":2048,"email_reminders":true,"exports":true}'::jsonb
where code='personal_pro';

update public.plan_catalog set
  monthly_price_xof=4500,
  annual_price_xof=45000,
  features=features||'{"projects":-1,"storage_mb":10240,"collaboration":true,"audit":true,"email_reminders":true,"exports":true}'::jsonb
where code='team';

update public.plan_catalog set
  monthly_price_xof=7500,
  annual_price_xof=75000,
  features=features||'{"projects":-1,"storage_mb":51200,"collaboration":true,"audit":true,"automation":true,"assistant":true,"assistant_monthly_runs":100,"priority_support":true,"exports":true}'::jsonb
where code='business';

update public.plan_catalog set
  monthly_price_xof=null,
  annual_price_xof=null,
  features=features||'{"projects":-1,"storage_mb":-1,"collaboration":true,"audit":true,"automation":true,"assistant":true,"priority_support":true,"dedicated_hosting":true,"sso":true}'::jsonb
where code='enterprise';

insert into public.manual_plan_prices(plan_code,billing_cycle,currency,unit_amount,active) values
  ('personal_pro','monthly','XOF',3500,true),
  ('personal_pro','annual','XOF',35000,true),
  ('team','monthly','XOF',4500,true),
  ('team','annual','XOF',45000,true),
  ('business','monthly','XOF',7500,true),
  ('business','annual','XOF',75000,true)
on conflict(plan_code,billing_cycle,currency) do update set unit_amount=excluded.unit_amount,active=true,updated_at=now();

insert into public.provider_plan_prices(provider,plan_code,billing_cycle,currency,unit_amount,active) values
  ('jeko','personal_pro','monthly','XOF',3500,true),
  ('jeko','personal_pro','annual','XOF',35000,true),
  ('jeko','team','monthly','XOF',4500,true),
  ('jeko','team','annual','XOF',45000,true),
  ('jeko','business','monthly','XOF',7500,true),
  ('jeko','business','annual','XOF',75000,true)
on conflict(provider,plan_code,billing_cycle,currency) do update set unit_amount=excluded.unit_amount,active=true,updated_at=now();
