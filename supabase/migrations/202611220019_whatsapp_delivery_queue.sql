-- Consent-aware WhatsApp delivery queue for Meta Cloud API templates.
alter table public.profiles add column if not exists whatsapp_opt_in_at timestamptz;
alter table public.profiles add column if not exists whatsapp_opt_out_at timestamptz;

-- Existing flags predate explicit consent capture, so require a fresh opt-in.
update public.profiles set notify_whatsapp=false where notify_whatsapp=true and whatsapp_opt_in_at is null;

create or replace function public.capture_whatsapp_consent()
returns trigger language plpgsql set search_path=public as $$
declare clean_phone text;
begin
  if new.notify_whatsapp and not old.notify_whatsapp then
    clean_phone := regexp_replace(coalesce(new.phone,''),'[^0-9]','','g');
    if length(clean_phone) < 8 or length(clean_phone) > 15 then
      raise exception 'Un numéro WhatsApp international valide est requis pour activer les rappels.' using errcode='P0001';
    end if;
    new.whatsapp_opt_in_at=now();
    new.whatsapp_opt_out_at=null;
  elsif not new.notify_whatsapp and old.notify_whatsapp then
    new.whatsapp_opt_out_at=now();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_whatsapp_consent on public.profiles;
create trigger profiles_whatsapp_consent before update of notify_whatsapp,phone on public.profiles
  for each row execute function public.capture_whatsapp_consent();

create table if not exists public.whatsapp_deliveries (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete cascade,
  message_type text not null check(message_type in ('notification','daily_digest')),
  dedupe_key text not null unique,
  template_name text not null,
  template_data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check(status in ('pending','sending','sent','delivered','read','failed')),
  attempts integer not null default 0,
  scheduled_for timestamptz not null default now(),
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_provider_message_unique on public.whatsapp_deliveries(provider_message_id) where provider_message_id is not null;
create index if not exists whatsapp_delivery_pending_idx on public.whatsapp_deliveries(status,scheduled_for,created_at);
alter table public.whatsapp_deliveries enable row level security;
create policy whatsapp_delivery_recipient_read on public.whatsapp_deliveries for select using(recipient_id=auth.uid());
create policy whatsapp_delivery_admin_read on public.whatsapp_deliveries for select using(
  project_id is not null and exists(select 1 from public.projects p where p.id=project_id and public.has_workspace_role(p.workspace_id,array['Propriétaire','Administrateur']))
);
create trigger whatsapp_deliveries_updated_at before update on public.whatsapp_deliveries for each row execute function public.set_updated_at();

create or replace function public.queue_notification_whatsapp()
returns trigger language plpgsql security definer set search_path=public as $$
declare recipient public.profiles%rowtype; allowed boolean := false;
begin
  select * into recipient from public.profiles where id=new.recipient_id;
  if recipient.id is null or not recipient.notify_whatsapp or recipient.whatsapp_opt_in_at is null or recipient.phone is null then return new; end if;
  allowed := case
    when new.event_type='assignment.changed' then recipient.notify_assignments
    when new.event_type in ('status.changed','task.completed') then recipient.notify_status_changes
    when new.event_type in ('comment.created','mention.created') then recipient.notify_comments
    else false
  end;
  if not allowed then return new; end if;
  insert into public.whatsapp_deliveries(recipient_id,project_id,notification_id,message_type,dedupe_key,template_name,template_data)
  values(new.recipient_id,new.project_id,new.id,'notification','whatsapp:notification:'||new.id::text,'jalonis_project_alert',jsonb_build_object('title',new.title,'body',coalesce(new.body,'')))
  on conflict(dedupe_key) do nothing;
  return new;
end;
$$;

drop trigger if exists notifications_queue_whatsapp on public.notifications;
create trigger notifications_queue_whatsapp after insert on public.notifications for each row execute function public.queue_notification_whatsapp();

revoke all on public.whatsapp_deliveries from anon,authenticated;
grant select on public.whatsapp_deliveries to authenticated;
