-- Updated public launch prices. Annual billing charges ten months.
update public.plan_catalog
set monthly_price_xof = 5000,
    annual_price_xof = 50000
where code = 'personal_pro';

update public.plan_catalog
set monthly_price_xof = 6000,
    annual_price_xof = 60000
where code = 'team';

update public.plan_catalog
set monthly_price_xof = 9000,
    annual_price_xof = 90000
where code = 'business';

update public.plan_catalog
set monthly_price_xof = null,
    annual_price_xof = null
where code = 'enterprise';

insert into public.manual_plan_prices(plan_code,billing_cycle,currency,unit_amount,active) values
  ('personal_pro','monthly','XOF',5000,true),
  ('personal_pro','annual','XOF',50000,true),
  ('team','monthly','XOF',6000,true),
  ('team','annual','XOF',60000,true),
  ('business','monthly','XOF',9000,true),
  ('business','annual','XOF',90000,true)
on conflict(plan_code,billing_cycle,currency)
do update set unit_amount=excluded.unit_amount,active=true,updated_at=now();

insert into public.provider_plan_prices(provider,plan_code,billing_cycle,currency,unit_amount,active) values
  ('jeko','personal_pro','monthly','XOF',5000,true),
  ('jeko','personal_pro','annual','XOF',50000,true),
  ('jeko','team','monthly','XOF',6000,true),
  ('jeko','team','annual','XOF',60000,true),
  ('jeko','business','monthly','XOF',9000,true),
  ('jeko','business','annual','XOF',90000,true)
on conflict(provider,plan_code,billing_cycle,currency)
do update set unit_amount=excluded.unit_amount,active=true,updated_at=now();
