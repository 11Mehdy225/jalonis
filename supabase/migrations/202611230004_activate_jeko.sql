-- Enable Jeko only after its provider settings and all public XOF prices exist.
do $$
begin
  if not exists (
    select 1
    from public.billing_provider_settings
    where provider = 'jeko'
      and currency = 'XOF'
  ) then
    raise exception 'Jeko provider settings are missing or invalid';
  end if;

  if (
    select count(*)
    from public.provider_plan_prices
    where provider = 'jeko'
      and currency = 'XOF'
      and active = true
      and (plan_code, billing_cycle) in (
        ('personal_pro', 'monthly'),
        ('personal_pro', 'annual'),
        ('team', 'monthly'),
        ('team', 'annual'),
        ('business', 'monthly'),
        ('business', 'annual')
      )
  ) <> 6 then
    raise exception 'The six Jeko XOF prices must be configured before activation';
  end if;

  update public.billing_provider_settings
  set active = false
  where provider <> 'jeko'
    and active = true;

  update public.billing_provider_settings
  set active = true
  where provider = 'jeko';
end
$$;
