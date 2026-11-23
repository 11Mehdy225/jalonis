-- Subscription lifecycle, payment grace period and server-side read-only enforcement.
create or replace function public.workspace_subscription_write_allowed(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select case
      -- Discovery is the permanent free plan. It never expires.
      when s.plan_code='discovery' and s.status in ('trialing','active','preview') then true
      -- A paid subscription remains writable for three days after its due date.
      when s.status in ('active','trialing') then
        s.current_period_end is null or now()<=s.current_period_end+interval '3 days'
      when s.status='past_due' then
        s.current_period_end is not null
        and s.current_period_end<now()
        and now()<=s.current_period_end+interval '3 days'
      else false
    end
    from public.subscriptions s
    where s.workspace_id=target_workspace
  ),false)
$$;

create or replace function public.project_subscription_write_allowed(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select public.workspace_subscription_write_allowed(p.workspace_id)
    from public.projects p where p.id=target_project
  ),false)
$$;

revoke all on function public.workspace_subscription_write_allowed(uuid) from public,anon;
revoke all on function public.project_subscription_write_allowed(uuid) from public,anon;
grant execute on function public.workspace_subscription_write_allowed(uuid) to authenticated,service_role;
grant execute on function public.project_subscription_write_allowed(uuid) to authenticated,service_role;

create or replace function public.enforce_subscription_write_access()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  row_data jsonb;
  target_workspace uuid;
  target_project uuid;
begin
  -- Service jobs and nested maintenance triggers must remain able to update summaries.
  if auth.uid() is null or pg_trigger_depth()>1 then
    return case when tg_op='DELETE' then old else new end;
  end if;

  row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if tg_table_name='workspaces' then
    target_workspace:=nullif(row_data->>'id','')::uuid;
  elsif row_data ? 'workspace_id' then
    target_workspace:=nullif(row_data->>'workspace_id','')::uuid;
  elsif row_data ? 'project_id' then
    target_project:=nullif(row_data->>'project_id','')::uuid;
    select workspace_id into target_workspace from public.projects where id=target_project;
  end if;

  if target_workspace is not null and not public.workspace_subscription_write_allowed(target_workspace) then
    raise exception 'Abonnement inactif. Cet espace est en lecture seule jusqu’à sa réactivation.' using errcode='P0001';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

revoke all on function public.enforce_subscription_write_access() from public,anon,authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'workspaces','workspace_members','workspace_invitations','projects',
    'tasks','risks','team','meetings','custom_fields','sprints','backlog_items',
    'suppliers','procurements','supplier_quotes','supplier_contracts',
    'supplier_evaluations','supplier_documents','comments','daily_scrum_entries',
    'attachments','activities','notifications','checklist_items','sprint_snapshots',
    'time_entries','cost_entries','change_requests','issues','decisions','stakeholders',
    'raci_assignments','conflicts','communication_plans','task_dependencies',
    'work_calendars','custom_field_values','assistant_runs'
  ] loop
    execute format('drop trigger if exists subscription_write_access on public.%I',table_name);
    execute format(
      'create trigger subscription_write_access before insert or update or delete on public.%I for each row execute function public.enforce_subscription_write_access()',
      table_name
    );
  end loop;
end;
$$;

-- Existing storage policies grant access by role. Restrictive policies also require
-- an active subscription for uploads, replacements and deletions. Downloads remain available.
drop policy if exists workspace_files_subscription_insert on storage.objects;
create policy workspace_files_subscription_insert on storage.objects as restrictive for insert to authenticated
with check(
  bucket_id<>'workspace-files'
  or public.workspace_subscription_write_allowed(((storage.foldername(name))[1])::uuid)
);

drop policy if exists workspace_files_subscription_update on storage.objects;
create policy workspace_files_subscription_update on storage.objects as restrictive for update to authenticated
using(
  bucket_id<>'workspace-files'
  or public.workspace_subscription_write_allowed(((storage.foldername(name))[1])::uuid)
)
with check(
  bucket_id<>'workspace-files'
  or public.workspace_subscription_write_allowed(((storage.foldername(name))[1])::uuid)
);

drop policy if exists workspace_files_subscription_delete on storage.objects;
create policy workspace_files_subscription_delete on storage.objects as restrictive for delete to authenticated
using(
  bucket_id<>'workspace-files'
  or public.workspace_subscription_write_allowed(((storage.foldername(name))[1])::uuid)
);

create or replace function public.process_subscription_lifecycle()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  subscription_record record;
  owner_record record;
  days_remaining integer;
  reminder_stage text;
  reminder_subject text;
  reminder_body text;
  queued_count integer:=0;
  overdue_count integer:=0;
begin
  -- The free Discovery plan is permanent, including accounts created during onboarding.
  update public.subscriptions
  set status='active',current_period_end=null,updated_at=now()
  where plan_code='discovery' and (status<>'active' or current_period_end is not null);

  update public.subscriptions
  set status='past_due',updated_at=now()
  where plan_code<>'discovery'
    and status in ('active','trialing')
    and current_period_end is not null
    and current_period_end<now();
  get diagnostics overdue_count=row_count;

  for subscription_record in
    select s.id,s.workspace_id,s.plan_code,s.status,s.current_period_end,w.name as workspace_name
    from public.subscriptions s
    join public.workspaces w on w.id=s.workspace_id
    where s.plan_code<>'discovery'
      and s.status in ('active','trialing','past_due')
      and s.current_period_end is not null
  loop
    days_remaining:=floor(extract(epoch from (subscription_record.current_period_end-now()))/86400)::integer;
    reminder_stage:=case
      when days_remaining between 4 and 7 then 'j7'
      when days_remaining between 1 and 3 then 'j3'
      when days_remaining=0 then 'echeance'
      when days_remaining between -2 and -1 then 'grace'
      when days_remaining<=-3 then 'lecture_seule'
      else null
    end;
    if reminder_stage is null then continue; end if;

    reminder_subject:=case reminder_stage
      when 'j7' then 'Jalonis · Abonnement à renouveler dans 7 jours'
      when 'j3' then 'Jalonis · Abonnement à renouveler bientôt'
      when 'echeance' then 'Jalonis · Échéance de votre abonnement'
      when 'grace' then 'Jalonis · Délai de grâce en cours'
      else 'Jalonis · Espace passé en lecture seule'
    end;
    reminder_body:=case reminder_stage
      when 'j7' then 'L’abonnement de l’espace « '||subscription_record.workspace_name||' » arrive à échéance. Vous pouvez le renouveler depuis Espace & accès.'
      when 'j3' then 'Il reste moins de trois jours avant l’échéance de l’espace « '||subscription_record.workspace_name||' ».'
      when 'echeance' then 'Votre abonnement arrive à échéance aujourd’hui. Un délai de grâce de trois jours protège la continuité de votre équipe.'
      when 'grace' then 'Le délai de grâce de trois jours est en cours. Les données restent accessibles et un paiement réactive automatiquement l’espace.'
      else 'L’espace « '||subscription_record.workspace_name||' » est maintenant en lecture seule. Vos données restent accessibles ; renouvelez l’abonnement pour reprendre les modifications.'
    end;

    for owner_record in
      select p.id
      from public.workspace_members wm
      join public.profiles p on p.id=wm.user_id
      where wm.workspace_id=subscription_record.workspace_id
        and wm.role='Propriétaire' and wm.status='Actif' and p.notify_email=true
    loop
      insert into public.email_deliveries(recipient_id,email_type,dedupe_key,subject,template_data)
      values(
        owner_record.id,'notification',
        'subscription:'||subscription_record.id::text||':'||subscription_record.current_period_end::date::text||':'||reminder_stage,
        reminder_subject,
        jsonb_build_object('title',reminder_subject,'body',reminder_body,'event_type','subscription.lifecycle','workspace_id',subscription_record.workspace_id)
      )
      on conflict(dedupe_key) do nothing;
      if found then queued_count:=queued_count+1; end if;
    end loop;
  end loop;

  return jsonb_build_object('ok',true,'past_due',overdue_count,'emails_queued',queued_count,'processed_at',now());
end;
$$;

revoke all on function public.process_subscription_lifecycle() from public,anon,authenticated;
grant execute on function public.process_subscription_lifecycle() to service_role;

-- Supabase Cron runs the lifecycle every day at 06:00 in Abidjan (UTC).
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule(
  'jalonis-subscription-lifecycle',
  '0 6 * * *',
  'select public.process_subscription_lifecycle()'
);

-- Apply the free-plan normalization and initial lifecycle state immediately.
select public.process_subscription_lifecycle();
