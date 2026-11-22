-- Enforce workspace roles for SaaS project data and stored files.
create or replace function public.can_write_workspace(target_workspace uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.has_workspace_role(target_workspace,array['Propriétaire','Administrateur','Chef de projet','Scrum Master','Product Owner','Membre']);
$$;

create or replace function public.can_manage_workspace(target_workspace uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.has_workspace_role(target_workspace,array['Propriétaire','Administrateur']);
$$;

create or replace function public.can_write_project(target_project uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.projects p where p.id=target_project and public.can_write_workspace(p.workspace_id));
$$;

create or replace function public.can_manage_project(target_project uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.projects p where p.id=target_project and public.has_workspace_role(p.workspace_id,array['Propriétaire','Administrateur','Chef de projet']));
$$;

drop policy if exists projects_member_all on public.projects;
create policy projects_member_select on public.projects for select using(public.is_workspace_member(workspace_id));
create policy projects_manager_insert on public.projects for insert with check(public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur','Chef de projet']));
create policy projects_manager_update on public.projects for update using(public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur','Chef de projet'])) with check(public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur','Chef de projet']));
create policy projects_admin_delete on public.projects for delete using(public.can_manage_workspace(workspace_id));

drop policy if exists notifications_project_insert on public.notifications;
create policy notifications_project_insert on public.notifications for insert
with check(public.can_write_project(project_id));

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'tasks','risks','team','meetings','custom_fields','sprints','backlog_items','suppliers','procurements',
    'supplier_quotes','supplier_contracts','supplier_evaluations','supplier_documents','comments','daily_scrum_entries',
    'attachments','activities','checklist_items','sprint_snapshots','time_entries','cost_entries','change_requests',
    'issues','decisions','stakeholders','raci_assignments','conflicts','communication_plans','task_dependencies','work_calendars'
  ] loop
    for policy_name in select policyname from pg_policies where schemaname='public' and tablename=table_name and policyname like '%project_access'
    loop
      execute format('drop policy if exists %I on public.%I',policy_name,table_name);
    end loop;
    execute format('create policy %I on public.%I for select using (public.can_access_project(project_id))',table_name||'_member_select',table_name);
    execute format('create policy %I on public.%I for insert with check (public.can_write_project(project_id))',table_name||'_member_insert',table_name);
    execute format('create policy %I on public.%I for update using (public.can_write_project(project_id)) with check (public.can_write_project(project_id))',table_name||'_member_update',table_name);
    execute format('create policy %I on public.%I for delete using (public.can_manage_project(project_id))',table_name||'_manager_delete',table_name);
  end loop;
end $$;

drop policy if exists workspace_files_insert on storage.objects;
drop policy if exists workspace_files_update on storage.objects;
drop policy if exists workspace_files_delete on storage.objects;
create policy workspace_files_insert on storage.objects for insert with check(
  bucket_id='workspace-files' and public.can_write_workspace(((storage.foldername(name))[1])::uuid)
);
create policy workspace_files_update on storage.objects for update using(
  bucket_id='workspace-files' and public.can_write_workspace(((storage.foldername(name))[1])::uuid)
) with check(
  bucket_id='workspace-files' and public.can_write_workspace(((storage.foldername(name))[1])::uuid)
);
create policy workspace_files_delete on storage.objects for delete using(
  bucket_id='workspace-files' and public.can_manage_workspace(((storage.foldername(name))[1])::uuid)
);
