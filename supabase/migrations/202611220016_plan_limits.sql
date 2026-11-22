-- Trial, plan limits and server-side usage protection.
update public.plan_catalog set features=features||'{"projects":2,"storage_mb":250}'::jsonb where code='discovery';
update public.plan_catalog set features=features||'{"projects":-1,"storage_mb":2048}'::jsonb where code='personal_pro';
update public.plan_catalog set features=features||'{"projects":-1,"storage_mb":10240}'::jsonb where code='team';
update public.plan_catalog set features=features||'{"projects":-1,"storage_mb":51200}'::jsonb where code='business';
update public.plan_catalog set features=features||'{"projects":-1,"storage_mb":-1}'::jsonb where code='enterprise';

create or replace function public.enforce_workspace_project_limit()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  project_limit integer;
  project_count integer;
  subscription_status text;
  period_end timestamptz;
begin
  select coalesce((p.features->>'projects')::integer,2),s.status,s.current_period_end
    into project_limit,subscription_status,period_end
  from public.subscriptions s join public.plan_catalog p on p.code=s.plan_code
  where s.workspace_id=new.workspace_id;

  if subscription_status='trialing' and period_end is not null and period_end<now() then
    raise exception 'La période d’essai est terminée. Choisissez une offre pour créer un nouveau projet.' using errcode='P0001';
  end if;
  if subscription_status not in ('trialing','active','preview') then
    raise exception 'L’abonnement ne permet pas de créer un nouveau projet.' using errcode='P0001';
  end if;
  if project_limit>=0 then
    select count(*) into project_count from public.projects where workspace_id=new.workspace_id;
    if project_count>=project_limit then
      raise exception 'La limite de % projet(s) de cette offre est atteinte.',project_limit using errcode='P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_plan_limit on public.projects;
create trigger projects_plan_limit before insert on public.projects for each row execute function public.enforce_workspace_project_limit();

create or replace function public.normalize_subscription_seats()
returns trigger language plpgsql security definer set search_path=public as $$
declare minimum_seats integer;
begin
  select min_seats into minimum_seats from public.plan_catalog where code=new.plan_code;
  new.seats=greatest(1,coalesce(minimum_seats,1),new.seats);
  return new;
end;
$$;

drop trigger if exists subscription_minimum_seats on public.subscriptions;
create trigger subscription_minimum_seats before insert or update on public.subscriptions for each row execute function public.normalize_subscription_seats();

create or replace function public.enforce_workspace_seat_limit()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  allowed_seats integer;
  occupied_seats integer;
begin
  if new.status<>'Actif' or new.role in ('Observateur','Fournisseur externe') then return new; end if;
  select seat_limit into allowed_seats from public.workspaces where id=new.workspace_id;
  select count(*) into occupied_seats from public.workspace_members
  where workspace_id=new.workspace_id and status='Actif'
    and role not in ('Observateur','Fournisseur externe') and id<>new.id;
  if occupied_seats>=coalesce(allowed_seats,1) then
    raise exception 'La limite de % siège(s) actif(s) de cette offre est atteinte.',coalesce(allowed_seats,1) using errcode='P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_members_seat_limit on public.workspace_members;
create trigger workspace_members_seat_limit before insert or update of role,status on public.workspace_members for each row execute function public.enforce_workspace_seat_limit();

create or replace function public.sync_workspace_subscription_summary()
returns trigger language plpgsql security definer set search_path=public as $$
declare plan_name text;
begin
  select name into plan_name from public.plan_catalog where code=new.plan_code;
  update public.workspaces set
    subscription_plan=coalesce(plan_name,new.plan_code),
    subscription_status=case new.status when 'trialing' then 'Essai' when 'active' then 'Actif' when 'past_due' then 'Paiement requis' when 'canceled' then 'Résilié' else new.status end,
    seat_limit=greatest(1,new.seats),
    trial_ends_at=case when new.status='trialing' then new.current_period_end else trial_ends_at end,
    updated_at=now()
  where id=new.workspace_id;
  return new;
end;
$$;

drop trigger if exists subscription_workspace_summary on public.subscriptions;
create trigger subscription_workspace_summary after insert or update on public.subscriptions for each row execute function public.sync_workspace_subscription_summary();

-- Normalize existing subscriptions and refresh the workspace summary once.
update public.subscriptions set seats=seats,updated_at=now();
