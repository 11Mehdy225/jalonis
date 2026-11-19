create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  phone text,
  job_title text,
  timezone text not null default 'Africa/Abidjan',
  notify_email boolean not null default true,
  notify_whatsapp boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  account_type text not null default 'Personnel' check (account_type in ('Personnel','Organisation')),
  subscription_plan text not null default 'Découverte',
  subscription_status text not null default 'Essai',
  seat_limit integer not null default 1 check (seat_limit > 0),
  trial_ends_at timestamptz default (now() + interval '14 days'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'Membre' check (role in ('Propriétaire','Administrateur','Chef de projet','Scrum Master','Product Owner','Membre','Observateur','Fournisseur externe')),
  status text not null default 'Actif' check (status in ('Actif','Suspendu')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,user_id)
);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role text not null default 'Membre',
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'En attente' check (status in ('En attente','Acceptée','Expirée','Annulée')),
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index workspace_pending_invitation on public.workspace_invitations(workspace_id,lower(email)) where status='En attente';

create table public.plan_catalog (
  code text primary key,
  name text not null,
  account_type text not null,
  monthly_price_eur numeric(10,2),
  annual_price_eur numeric(10,2),
  min_seats integer not null default 1,
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true
);
insert into public.plan_catalog(code,name,account_type,monthly_price_eur,annual_price_eur,min_seats,features) values
('discovery','Découverte','Personnel',0,0,1,'{"projects":2,"cloud":false}'),
('personal_pro','Personnel Pro','Personnel',4.90,49.90,1,'{"cloud":true,"email_reminders":true}'),
('team','Équipe','Organisation',5.90,60.18,3,'{"collaboration":true,"audit":true}'),
('business','Business','Organisation',9.90,100.98,10,'{"automation":true,"assistant":true,"priority_support":true}'),
('enterprise','Entreprise privée','Organisation',null,null,1,'{"dedicated_hosting":true,"sso":true}');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  plan_code text not null references public.plan_catalog(code),
  status text not null default 'trialing',
  seats integer not null default 1,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, code text, description text, sponsor text, manager text, objective text, success_criteria text,
  start_date date, end_date date, budget numeric(14,2) not null default 0,
  status text not null default 'Planification', health text not null default 'good', methodology text not null default 'Hybride',
  product_goal text, definition_done text,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  title text not null, status text default 'À faire', priority text default 'Moyenne', assignee text, assignee_id uuid references public.profiles(id),
  start_date date, due_date date, progress integer default 0 check(progress between 0 and 100), notes text, color text,
  wbs_code text, predecessor_id uuid references public.tasks(id) on delete set null, dependency_type text default 'FS', lag_days integer default 0,
  is_milestone boolean default false, baseline_start date, baseline_end date, actual_start date, actual_end date, work_hours numeric default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.risks (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  title text not null, category text, probability integer default 1, impact integer default 1, owner text, response text,
  status text default 'Ouvert', linked_task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.team (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  name text not null, role text, email text, availability integer default 100, skills text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  title text not null, meeting_date timestamptz, participants text, agenda text, decisions text, actions text,
  linked_task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.custom_fields (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  entity_type text not null, label text not null, field_type text default 'text', options jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.sprints (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  name text not null, goal text, start_date date, end_date date, status text default 'Planifié', capacity_points integer default 0,
  review_notes text, retrospective_notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.backlog_items (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  title text not null, item_type text default 'User Story', description text, acceptance_criteria text, definition_done text,
  priority text default 'Moyenne', story_points integer default 0, status text default 'Backlog', sprint_id uuid references public.sprints(id) on delete set null,
  assignee text, assignee_id uuid references public.profiles(id), linked_task_id uuid references public.tasks(id) on delete set null,
  epic text, parent_epic_id uuid references public.backlog_items(id) on delete set null, estimate_hours numeric default 0,
  start_date date, due_date date, rank integer default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  name text not null, supplier_code text, category text, supplier_type text default 'Services', status text default 'Prospect',
  tax_id text, registration_number text, contact_name text, email text, phone text, address text, country text, website text,
  qualification_score numeric default 0, risk_level text default 'Moyen', payment_terms text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.procurements (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  reference text, title text not null, request_type text default 'RFQ', category text, description text, issue_date date, deadline date,
  status text default 'Brouillon', currency text default 'EUR', estimated_budget numeric default 0, owner text,
  linked_task_id uuid references public.tasks(id) on delete set null, linked_risk_id uuid references public.risks(id) on delete set null,
  evaluation_method text, technical_weight numeric default 60, financial_weight numeric default 40,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.supplier_quotes (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  procurement_id uuid references public.procurements(id) on delete cascade, supplier_id uuid references public.suppliers(id) on delete cascade,
  quote_reference text, submission_date date, amount numeric default 0, currency text default 'EUR', lead_time_days integer default 0,
  validity_date date, technical_score numeric default 0, financial_score numeric default 0, compliance_score numeric default 0,
  total_score numeric default 0, status text default 'Reçue', notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.supplier_contracts (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade, procurement_id uuid references public.procurements(id) on delete set null,
  contract_number text, title text not null, start_date date, end_date date, amount numeric default 0, currency text default 'EUR',
  status text default 'Brouillon', owner text, payment_terms text, deliverables text, renewal_notice_days integer default 30,
  linked_task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.supplier_evaluations (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade, contract_id uuid references public.supplier_contracts(id) on delete set null,
  evaluation_date date, evaluator text, quality_score numeric default 0, delivery_score numeric default 0, cost_score numeric default 0,
  compliance_score numeric default 0, communication_score numeric default 0, overall_score numeric default 0, comments text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.supplier_documents (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade, procurement_id uuid references public.procurements(id) on delete set null,
  contract_id uuid references public.supplier_contracts(id) on delete set null, document_type text, title text not null,
  file_name text, stored_path text, issue_date date, expiry_date date, status text default 'Valide', notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  entity_type text not null, entity_id uuid not null, author_id uuid not null default auth.uid() references public.profiles(id),
  body text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.daily_scrum_entries (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  sprint_id uuid references public.sprints(id) on delete set null, user_id uuid not null default auth.uid() references public.profiles(id),
  entry_date date not null default current_date, yesterday text, today text, blockers text, confidence integer check(confidence between 1 and 5),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(project_id,user_id,entry_date)
);

create table public.audit_log (
  id bigint generated always as identity primary key, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id), action text not null, entity_type text not null, entity_id uuid,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=auth.uid() and status='Actif');
$$;

create or replace function public.has_workspace_role(target_workspace uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=auth.uid() and status='Actif' and role=any(allowed_roles));
$$;

create or replace function public.can_access_project(target_project uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.projects p where p.id=target_project and public.is_workspace_member(p.workspace_id));
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  new_workspace uuid;
  account_kind text;
  requested_name text;
  plan text;
begin
  insert into public.profiles(id,full_name,email)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email);
  account_kind := case when new.raw_user_meta_data->>'account_type'='Organisation' then 'Organisation' else 'Personnel' end;
  requested_name := coalesce(nullif(new.raw_user_meta_data->>'workspace_name',''), case when account_kind='Organisation' then 'Mon organisation' else 'Espace personnel' end);
  plan := case when account_kind='Organisation' then 'team' else 'discovery' end;
  insert into public.workspaces(name,slug,account_type,seat_limit,created_by)
  values(requested_name,lower(regexp_replace(requested_name,'[^a-zA-Z0-9]+','-','g'))||'-'||substr(new.id::text,1,8),account_kind,case when account_kind='Organisation' then 5 else 1 end,new.id)
  returning id into new_workspace;
  insert into public.workspace_members(workspace_id,user_id,role) values(new_workspace,new.id,'Propriétaire');
  insert into public.subscriptions(workspace_id,plan_code,status,seats,current_period_start,current_period_end)
  values(new_workspace,plan,'trialing',1,now(),now()+interval '14 days');
  insert into public.workspace_members(workspace_id,user_id,role)
  select i.workspace_id,new.id,i.role from public.workspace_invitations i
  where lower(i.email)=lower(new.email) and i.status='En attente' and i.expires_at>now()
  on conflict do nothing;
  update public.workspace_invitations set status='Acceptée',updated_at=now()
  where lower(email)=lower(new.email) and status='En attente' and expires_at>now();
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.plan_catalog enable row level security;
alter table public.subscriptions enable row level security;
alter table public.projects enable row level security;

create policy profiles_self_or_colleague_select on public.profiles for select using (
  id=auth.uid() or exists(select 1 from public.workspace_members mine join public.workspace_members theirs on theirs.workspace_id=mine.workspace_id where mine.user_id=auth.uid() and theirs.user_id=profiles.id and mine.status='Actif')
);
create policy profiles_self_update on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy workspace_member_select on public.workspaces for select using(public.is_workspace_member(id));
create policy workspace_admin_update on public.workspaces for update using(public.has_workspace_role(id,array['Propriétaire','Administrateur'])) with check(public.has_workspace_role(id,array['Propriétaire','Administrateur']));
create policy membership_member_select on public.workspace_members for select using(public.is_workspace_member(workspace_id));
create policy membership_admin_insert on public.workspace_members for insert with check(public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur']));
create policy membership_admin_update on public.workspace_members for update using(public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur']));
create policy membership_admin_delete on public.workspace_members for delete using(public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur']) and role<>'Propriétaire');
create policy invitation_member_select on public.workspace_invitations for select using(public.is_workspace_member(workspace_id));
create policy invitation_admin_insert on public.workspace_invitations for insert with check(public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur','Chef de projet']));
create policy invitation_admin_update on public.workspace_invitations for update using(public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur','Chef de projet']));
create policy invitation_admin_delete on public.workspace_invitations for delete using(public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur','Chef de projet']));
create policy plans_public_read on public.plan_catalog for select using(active=true);
create policy subscription_admin_read on public.subscriptions for select using(public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur']));
create policy projects_member_all on public.projects for all using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id));

do $$
declare table_name text;
begin
  foreach table_name in array array['tasks','risks','team','meetings','custom_fields','sprints','backlog_items','suppliers','procurements','supplier_quotes','supplier_contracts','supplier_evaluations','supplier_documents','comments','daily_scrum_entries']
  loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('create policy %I on public.%I for all using (public.can_access_project(project_id)) with check (public.can_access_project(project_id))',table_name||'_project_access',table_name);
  end loop;
end $$;

alter table public.audit_log enable row level security;
create policy audit_workspace_read on public.audit_log for select using(public.has_workspace_role(workspace_id,array['Propriétaire','Administrateur','Chef de projet']));

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','workspaces','workspace_members','workspace_invitations','subscriptions','projects','tasks','risks','team','meetings','custom_fields','sprints','backlog_items','suppliers','procurements','supplier_quotes','supplier_contracts','supplier_evaluations','supplier_documents','comments','daily_scrum_entries']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',table_name||'_updated_at',table_name);
  end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit) values('workspace-files','workspace-files',false,52428800)
on conflict(id) do nothing;

create policy workspace_files_select on storage.objects for select using (
  bucket_id='workspace-files' and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);
create policy workspace_files_insert on storage.objects for insert with check (
  bucket_id='workspace-files' and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);
create policy workspace_files_update on storage.objects for update using (
  bucket_id='workspace-files' and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);
create policy workspace_files_delete on storage.objects for delete using (
  bucket_id='workspace-files' and public.has_workspace_role(((storage.foldername(name))[1])::uuid,array['Propriétaire','Administrateur','Chef de projet'])
);
