-- Expose only the operations required by the browser API. Row-level security
-- remains the source of truth for workspace and project isolation.
grant usage on schema public to anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;

grant select on public.plan_catalog to anon, authenticated;

grant select,update on public.profiles to authenticated;
grant select,update on public.workspaces to authenticated;

grant select,insert,update,delete on
  public.workspace_members,
  public.workspace_invitations,
  public.projects,
  public.tasks,
  public.task_dependencies,
  public.work_calendars,
  public.risks,
  public.team,
  public.meetings,
  public.sprints,
  public.backlog_items,
  public.attachments,
  public.suppliers,
  public.procurements,
  public.supplier_quotes,
  public.supplier_contracts,
  public.supplier_evaluations,
  public.supplier_documents,
  public.comments,
  public.daily_scrum_entries,
  public.activities,
  public.notifications,
  public.checklist_items,
  public.sprint_snapshots,
  public.time_entries,
  public.cost_entries,
  public.change_requests,
  public.issues,
  public.decisions,
  public.stakeholders,
  public.raci_assignments,
  public.conflicts,
  public.communication_plans,
  public.custom_fields,
  public.custom_field_values
to authenticated;

grant select on
  public.subscriptions,
  public.audit_log,
  public.billing_transactions,
  public.email_deliveries,
  public.whatsapp_deliveries,
  public.assistant_runs
to authenticated;

revoke all on public.billing_events from anon,authenticated;
grant usage,select on all sequences in schema public to authenticated;
