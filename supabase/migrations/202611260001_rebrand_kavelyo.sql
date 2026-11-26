-- Rebrand visible database messages without rewriting historical migrations.
-- Technical identifiers (cron names, template identifiers and dedupe keys) stay
-- unchanged so existing production integrations continue to work.

update public.notification_channel_settings
set sender_name = 'Kavelyo'
where sender_name = 'Jalonis';

update public.email_deliveries
set
  subject = replace(subject, 'Jalonis', 'Kavelyo'),
  template_data = case
    when template_data ? 'title' then jsonb_set(
      template_data,
      '{title}',
      to_jsonb(replace(template_data->>'title', 'Jalonis', 'Kavelyo'))
    )
    else template_data
  end,
  updated_at = now()
where status in ('pending', 'failed')
  and (
    subject like '%Jalonis%'
    or coalesce(template_data->>'title', '') like '%Jalonis%'
  );

do $$
declare
  function_record record;
begin
  for function_record in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) like '%Jalonis%'
  loop
    execute replace(
      pg_get_functiondef(function_record.oid),
      'Jalonis',
      'Kavelyo'
    );
  end loop;
end;
$$;
