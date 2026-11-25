-- Project-scoped access for consultants and multi-project organisations.
alter table public.projects add column if not exists access_mode text not null default 'restricted'
  check(access_mode in ('workspace','restricted'));

-- Existing projects become restricted, while their current members are copied
-- below so nobody loses access during the migration.

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  access_role text not null default 'contributor' check(access_role in ('manager','contributor','viewer')),
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,user_id)
);
create index if not exists project_members_user_idx on public.project_members(user_id,project_id);

create or replace function public.can_access_project(target_project uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.projects p
    where p.id=target_project
      and public.is_workspace_member(p.workspace_id)
      and (
        p.access_mode='workspace'
        or p.created_by=auth.uid()
        or public.has_workspace_role(p.workspace_id,array['Propriétaire','Administrateur'])
        or exists(select 1 from public.project_members pm where pm.project_id=p.id and pm.user_id=auth.uid())
      )
  );
$$;

create or replace function public.can_write_project(target_project uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.can_access_project(target_project)
    and exists(
      select 1 from public.projects p
      where p.id=target_project
        and public.has_workspace_role(p.workspace_id,array['Propriétaire','Administrateur','Chef de projet','Scrum Master','Product Owner','Membre'])
    );
$$;

create or replace function public.can_manage_project(target_project uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.projects p
    where p.id=target_project and public.can_access_project(p.id) and (
      p.created_by=auth.uid()
      or public.has_workspace_role(p.workspace_id,array['Propriétaire','Administrateur'])
      or exists(select 1 from public.project_members pm where pm.project_id=p.id and pm.user_id=auth.uid() and pm.access_role='manager')
    )
  );
$$;

create or replace function public.can_manage_project_access(target_project uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.can_manage_project(target_project);
$$;

create or replace function public.can_view_workspace_member(target_workspace uuid,target_user uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select target_user=auth.uid()
    or public.has_workspace_role(target_workspace,array['Propriétaire','Administrateur'])
    or exists(select 1 from public.projects p where p.workspace_id=target_workspace and public.can_manage_project(p.id))
    or exists(select 1 from public.projects p where p.workspace_id=target_workspace and p.access_mode='workspace' and public.can_access_project(p.id))
    or exists(
      select 1 from public.project_members mine
      join public.project_members theirs on theirs.project_id=mine.project_id
      join public.projects p on p.id=mine.project_id
      where p.workspace_id=target_workspace and mine.user_id=auth.uid() and theirs.user_id=target_user
    );
$$;

alter table public.project_members enable row level security;
create policy project_members_access_select on public.project_members for select to authenticated using(public.can_access_project(project_id));
create policy project_members_manager_insert on public.project_members for insert to authenticated with check(public.can_manage_project_access(project_id));
create policy project_members_manager_update on public.project_members for update to authenticated using(public.can_manage_project_access(project_id)) with check(public.can_manage_project_access(project_id));
create policy project_members_manager_delete on public.project_members for delete to authenticated using(public.can_manage_project_access(project_id));
create trigger project_members_updated_at before update on public.project_members for each row execute function public.set_updated_at();

drop policy if exists membership_member_select on public.workspace_members;
create policy membership_scoped_select on public.workspace_members for select to authenticated
using(public.can_view_workspace_member(workspace_id,user_id));
drop policy if exists profiles_self_or_colleague_select on public.profiles;
create policy profiles_scoped_colleague_select on public.profiles for select to authenticated using(
  id=auth.uid() or exists(select 1 from public.workspace_members wm where wm.user_id=profiles.id and public.can_view_workspace_member(wm.workspace_id,profiles.id))
);
drop policy if exists invitation_member_select on public.workspace_invitations;
create policy invitation_manager_select on public.workspace_invitations for select to authenticated
using(invited_by=auth.uid() or public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur']));
drop policy if exists audit_workspace_read on public.audit_log;
create policy audit_workspace_admin_read on public.audit_log for select to authenticated
using(public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur']));

drop policy if exists projects_member_select on public.projects;
drop policy if exists projects_manager_insert on public.projects;
drop policy if exists projects_manager_update on public.projects;
drop policy if exists projects_admin_delete on public.projects;
create policy projects_scoped_select on public.projects for select to authenticated using(public.can_access_project(id));
create policy projects_manager_insert on public.projects for insert to authenticated with check(public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur','Chef de projet']));
create policy projects_manager_update on public.projects for update to authenticated using(public.can_manage_project_access(id)) with check(public.can_manage_project_access(id));
create policy projects_admin_delete on public.projects for delete to authenticated using(public.can_manage_workspace(workspace_id));

create or replace function public.add_project_creator_access()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.created_by is not null then
    insert into public.project_members(project_id,user_id,access_role,added_by)
    values(new.id,new.created_by,'manager',new.created_by) on conflict(project_id,user_id) do update set access_role='manager';
  end if;
  return new;
end;
$$;
drop trigger if exists project_creator_access on public.projects;
create trigger project_creator_access after insert on public.projects for each row execute function public.add_project_creator_access();

insert into public.project_members(project_id,user_id,access_role,added_by)
select p.id,p.created_by,'manager',p.created_by from public.projects p where p.created_by is not null
on conflict(project_id,user_id) do nothing;

insert into public.project_members(project_id,user_id,access_role,added_by)
select p.id,wm.user_id,
  case when wm.role in ('Propriétaire','Administrateur','Chef de projet') then 'manager'
       when wm.role in ('Observateur','Fournisseur externe') then 'viewer'
       else 'contributor' end,
  p.created_by
from public.projects p join public.workspace_members wm on wm.workspace_id=p.workspace_id and wm.status='Actif'
on conflict(project_id,user_id) do nothing;

create or replace function public.get_project_access(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.can_access_project(p_project_id) then raise exception 'Accès au projet refusé.'; end if;
  select jsonb_build_object(
    'project_id',p.id,
    'access_mode',p.access_mode,
    'can_manage',public.can_manage_project_access(p.id),
    'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',pm.user_id,'access_role',pm.access_role,'full_name',pr.full_name,'email',pr.email) order by pr.full_name) from public.project_members pm join public.profiles pr on pr.id=pm.user_id where pm.project_id=p.id),'[]'::jsonb)
  ) into result from public.projects p where p.id=p_project_id;
  return result;
end;
$$;

create or replace function public.set_project_access(p_project_id uuid,p_access_mode text,p_members jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare workspace_value uuid; creator_value uuid; item jsonb; member_id uuid; member_role text;
begin
  if not public.can_manage_project_access(p_project_id) then raise exception 'Gestion des accès refusée.'; end if;
  if p_access_mode not in ('workspace','restricted') then raise exception 'Mode d’accès invalide.'; end if;
  select workspace_id,created_by into workspace_value,creator_value from public.projects where id=p_project_id for update;
  update public.projects set access_mode=p_access_mode where id=p_project_id;
  delete from public.project_members where project_id=p_project_id and user_id<>coalesce(creator_value,'00000000-0000-0000-0000-000000000000'::uuid);
  for item in select value from jsonb_array_elements(coalesce(p_members,'[]'::jsonb)) loop
    member_id:=(item->>'user_id')::uuid;
    member_role:=case when item->>'access_role' in ('manager','contributor','viewer') then item->>'access_role' else 'contributor' end;
    if not exists(select 1 from public.workspace_members wm where wm.workspace_id=workspace_value and wm.user_id=member_id and wm.status='Actif') then
      raise exception 'Un membre sélectionné ne fait pas partie de cet espace.';
    end if;
    insert into public.project_members(project_id,user_id,access_role,added_by)
    values(p_project_id,member_id,member_role,auth.uid())
    on conflict(project_id,user_id) do update set access_role=excluded.access_role,added_by=auth.uid(),updated_at=now();
  end loop;
  if creator_value is not null then
    insert into public.project_members(project_id,user_id,access_role,added_by)
    values(p_project_id,creator_value,'manager',auth.uid())
    on conflict(project_id,user_id) do update set access_role='manager',updated_at=now();
  end if;
  if auth.uid()<>coalesce(creator_value,'00000000-0000-0000-0000-000000000000'::uuid)
     and not public.has_workspace_role(workspace_value,array['Propriétaire','Administrateur']) then
    insert into public.project_members(project_id,user_id,access_role,added_by)
    values(p_project_id,auth.uid(),'manager',auth.uid())
    on conflict(project_id,user_id) do update set access_role='manager',updated_at=now();
  end if;
  return public.get_project_access(p_project_id);
end;
$$;

alter table public.workspace_invitations add column if not exists project_ids uuid[] not null default '{}'::uuid[];

create or replace function public.accept_my_invitations()
returns integer language plpgsql security definer set search_path=public as $$
declare accepted_count integer; account_email text;
begin
  if auth.uid() is null then raise exception 'Session requise'; end if;
  select email into account_email from public.profiles where id=auth.uid();
  if account_email is null then raise exception 'Profil utilisateur introuvable'; end if;
  insert into public.workspace_members(workspace_id,user_id,role,status)
  select i.workspace_id,auth.uid(),i.role,'Actif' from public.workspace_invitations i
  where lower(i.email)=lower(account_email) and i.status='En attente' and i.expires_at>now()
  on conflict(workspace_id,user_id) do update set role=excluded.role,status='Actif',updated_at=now();
  get diagnostics accepted_count = row_count;
  insert into public.project_members(project_id,user_id,access_role,added_by)
  select invited_project.project_id,auth.uid(),'contributor',i.invited_by
  from public.workspace_invitations i cross join lateral unnest(i.project_ids) as invited_project(project_id)
  join public.projects p on p.id=invited_project.project_id and p.workspace_id=i.workspace_id
  where lower(i.email)=lower(account_email) and i.status='En attente' and i.expires_at>now()
  on conflict(project_id,user_id) do nothing;
  update public.workspace_invitations set status='Acceptée',updated_at=now()
  where lower(email)=lower(account_email) and status='En attente' and expires_at>now();
  return accepted_count;
end;
$$;

drop policy if exists workspace_files_select on storage.objects;
drop policy if exists workspace_files_insert on storage.objects;
drop policy if exists workspace_files_update on storage.objects;
drop policy if exists workspace_files_delete on storage.objects;
create policy workspace_files_select on storage.objects for select to authenticated using(
  bucket_id='workspace-files' and public.can_access_project(((storage.foldername(name))[2])::uuid)
);
create policy workspace_files_insert on storage.objects for insert to authenticated with check(
  bucket_id='workspace-files' and public.can_write_project(((storage.foldername(name))[2])::uuid)
);
create policy workspace_files_update on storage.objects for update to authenticated using(
  bucket_id='workspace-files' and public.can_write_project(((storage.foldername(name))[2])::uuid)
) with check(
  bucket_id='workspace-files' and public.can_write_project(((storage.foldername(name))[2])::uuid)
);
create policy workspace_files_delete on storage.objects for delete to authenticated using(
  bucket_id='workspace-files' and public.can_manage_project(((storage.foldername(name))[2])::uuid)
);

revoke all on function public.get_project_access(uuid),public.set_project_access(uuid,text,jsonb) from public;
grant execute on function public.get_project_access(uuid),public.set_project_access(uuid,text,jsonb) to authenticated;
grant select on public.project_members to authenticated;
grant select,insert,update,delete on public.project_members to service_role;
