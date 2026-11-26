-- Trace meeting outcomes through the decision and action registers.
alter table public.action_items
  add column if not exists linked_meeting_id uuid references public.meetings(id) on delete set null,
  add column if not exists linked_decision_id uuid references public.decisions(id) on delete set null;

create index if not exists action_items_meeting_idx on public.action_items(project_id,linked_meeting_id);
create index if not exists action_items_decision_idx on public.action_items(project_id,linked_decision_id);
