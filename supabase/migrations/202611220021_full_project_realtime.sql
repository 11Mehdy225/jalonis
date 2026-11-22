-- Broadcast every collaborative project register through Supabase Realtime.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'projects','tasks','task_dependencies','work_calendars','risks','team','meetings','sprints','backlog_items',
    'attachments','suppliers','procurements','supplier_quotes','supplier_contracts','supplier_evaluations',
    'supplier_documents','comments','activities','notifications','checklist_items','sprint_snapshots','time_entries',
    'cost_entries','change_requests','issues','decisions','stakeholders','raci_assignments','conflicts',
    'communication_plans','custom_fields','custom_field_values'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I',table_name);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
