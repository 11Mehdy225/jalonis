-- Project-specific field definitions and values for tasks and agile work items.
alter table public.custom_fields add column if not exists is_required boolean not null default false;
alter table public.custom_fields add column if not exists rank integer not null default 0;

drop policy if exists custom_fields_member_insert on public.custom_fields;
drop policy if exists custom_fields_member_update on public.custom_fields;
drop policy if exists custom_fields_manager_delete on public.custom_fields;
create policy custom_fields_manager_insert on public.custom_fields for insert with check(public.can_manage_project(project_id));
create policy custom_fields_manager_update on public.custom_fields for update using(public.can_manage_project(project_id)) with check(public.can_manage_project(project_id));
create policy custom_fields_manager_delete on public.custom_fields for delete using(public.can_manage_project(project_id));

create table if not exists public.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  field_id uuid not null references public.custom_fields(id) on delete cascade,
  entity_type text not null check(entity_type in ('tasks','backlog_items')),
  entity_id uuid not null,
  value_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(field_id,entity_type,entity_id)
);

create index if not exists custom_field_values_entity_idx on public.custom_field_values(project_id,entity_type,entity_id);
alter table public.custom_field_values enable row level security;
create policy custom_field_values_member_select on public.custom_field_values for select using(public.can_access_project(project_id));
create policy custom_field_values_member_insert on public.custom_field_values for insert with check(public.can_write_project(project_id));
create policy custom_field_values_member_update on public.custom_field_values for update using(public.can_write_project(project_id)) with check(public.can_write_project(project_id));
create policy custom_field_values_manager_delete on public.custom_field_values for delete using(public.can_manage_project(project_id));

create trigger custom_field_values_updated_at before update on public.custom_field_values
for each row execute function public.set_updated_at();
