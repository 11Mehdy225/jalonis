-- Invited users join the intended workspace without receiving an unwanted personal workspace.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  new_workspace uuid;
  account_kind text;
  requested_name text;
  plan text;
  pending_invites integer;
begin
  insert into public.profiles(id,full_name,email)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email);

  select count(*) into pending_invites from public.workspace_invitations
  where lower(email)=lower(new.email) and status='En attente' and expires_at>now();

  if pending_invites>0 then
    return new;
  end if;

  account_kind := case when new.raw_user_meta_data->>'account_type'='Organisation' then 'Organisation' else 'Personnel' end;
  requested_name := coalesce(nullif(new.raw_user_meta_data->>'workspace_name',''),case when account_kind='Organisation' then 'Mon organisation' else 'Espace personnel' end);
  plan := case when account_kind='Organisation' then 'team' else 'discovery' end;
  insert into public.workspaces(name,slug,account_type,seat_limit,created_by)
  values(requested_name,lower(regexp_replace(requested_name,'[^a-zA-Z0-9]+','-','g'))||'-'||substr(new.id::text,1,8),account_kind,case when account_kind='Organisation' then 5 else 1 end,new.id)
  returning id into new_workspace;
  insert into public.workspace_members(workspace_id,user_id,role) values(new_workspace,new.id,'Propriétaire');
  insert into public.subscriptions(workspace_id,plan_code,status,seats,current_period_start,current_period_end)
  values(new_workspace,plan,'trialing',1,now(),now()+interval '14 days');
  return new;
end;
$$;

create or replace function public.accept_my_invitations()
returns integer language plpgsql security definer set search_path=public as $$
declare
  accepted_count integer;
  account_email text;
begin
  if auth.uid() is null then raise exception 'Session requise'; end if;
  select email into account_email from public.profiles where id=auth.uid();
  if account_email is null then raise exception 'Profil utilisateur introuvable'; end if;

  insert into public.workspace_members(workspace_id,user_id,role,status)
  select i.workspace_id,auth.uid(),i.role,'Actif' from public.workspace_invitations i
  where lower(i.email)=lower(account_email) and i.status='En attente' and i.expires_at>now()
  on conflict(workspace_id,user_id) do update set role=excluded.role,status='Actif',updated_at=now();

  get diagnostics accepted_count = row_count;
  update public.workspace_invitations set status='Acceptée',updated_at=now()
  where lower(email)=lower(account_email) and status='En attente' and expires_at>now();
  return accepted_count;
end;
$$;
revoke all on function public.accept_my_invitations() from public;
grant execute on function public.accept_my_invitations() to authenticated;
