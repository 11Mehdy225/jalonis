-- Transactional email queue with deduplication and preference-aware notification triggers.
create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete cascade,
  email_type text not null check(email_type in ('notification','daily_digest')),
  dedupe_key text not null unique,
  subject text not null,
  template_data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  scheduled_for timestamptz not null default now(),
  provider_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_delivery_pending_idx on public.email_deliveries(status,scheduled_for,created_at);
create index if not exists email_delivery_recipient_idx on public.email_deliveries(recipient_id,created_at desc);
alter table public.email_deliveries enable row level security;
create policy email_delivery_recipient_read on public.email_deliveries for select using(recipient_id=auth.uid());
create policy email_delivery_admin_read on public.email_deliveries for select using(
  project_id is not null and exists(
    select 1 from public.projects p where p.id=project_id
      and public.has_workspace_role(p.workspace_id,array['Propriétaire','Administrateur'])
  )
);
create trigger email_deliveries_updated_at before update on public.email_deliveries
  for each row execute function public.set_updated_at();

create or replace function public.queue_notification_email()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  recipient public.profiles%rowtype;
  allowed boolean := false;
begin
  select * into recipient from public.profiles where id=new.recipient_id;
  if recipient.id is null or not recipient.notify_email then return new; end if;
  allowed := case
    when new.event_type='assignment.changed' then recipient.notify_assignments
    when new.event_type in ('status.changed','task.completed') then recipient.notify_status_changes
    when new.event_type in ('comment.created','mention.created') then recipient.notify_comments
    else false
  end;
  if not allowed then return new; end if;
  insert into public.email_deliveries(recipient_id,project_id,notification_id,email_type,dedupe_key,subject,template_data)
  values(new.recipient_id,new.project_id,new.id,'notification','notification:'||new.id::text,'Jalonis · '||new.title,
    jsonb_build_object('title',new.title,'body',coalesce(new.body,''),'event_type',new.event_type))
  on conflict(dedupe_key) do nothing;
  return new;
end;
$$;

drop trigger if exists notifications_queue_email on public.notifications;
create trigger notifications_queue_email after insert on public.notifications
  for each row execute function public.queue_notification_email();

revoke all on public.email_deliveries from anon,authenticated;
grant select on public.email_deliveries to authenticated;
