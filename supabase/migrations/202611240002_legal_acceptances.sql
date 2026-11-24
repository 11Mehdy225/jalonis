create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null check(document_type in ('terms','sales','privacy')),
  document_version text not null,
  acceptance_method text not null default 'signup-checkbox',
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id,document_type,document_version)
);

alter table public.legal_acceptances enable row level security;

drop policy if exists legal_acceptances_self_select on public.legal_acceptances;
create policy legal_acceptances_self_select on public.legal_acceptances
for select to authenticated using(user_id=auth.uid());

revoke insert,update,delete on public.legal_acceptances from anon,authenticated;
grant select on public.legal_acceptances to authenticated;

create or replace function public.record_signup_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare metadata jsonb;
begin
  select raw_user_meta_data into metadata from auth.users where id=new.id;
  if coalesce((metadata->>'legal_accepted')::boolean,false) then
    insert into public.legal_acceptances(user_id,document_type,document_version,acceptance_method)
    values
      (new.id,'terms',coalesce(metadata->>'terms_version','unknown'),'signup-checkbox'),
      (new.id,'sales',coalesce(metadata->>'sales_version','unknown'),'signup-checkbox'),
      (new.id,'privacy',coalesce(metadata->>'privacy_version','unknown'),'signup-checkbox')
    on conflict(user_id,document_type,document_version) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profile_record_signup_legal_acceptance on public.profiles;
create trigger profile_record_signup_legal_acceptance
after insert on public.profiles
for each row execute function public.record_signup_legal_acceptance();

create or replace function public.accept_legal_documents(p_terms_version text,p_sales_version text,p_privacy_version text,p_method text default 'account-checkbox')
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Session requise'; end if;
  if coalesce(trim(p_terms_version),'')='' or coalesce(trim(p_sales_version),'')='' or coalesce(trim(p_privacy_version),'')='' then raise exception 'Version juridique manquante'; end if;
  insert into public.legal_acceptances(user_id,document_type,document_version,acceptance_method)
  values
    (auth.uid(),'terms',p_terms_version,left(coalesce(p_method,'account-checkbox'),50)),
    (auth.uid(),'sales',p_sales_version,left(coalesce(p_method,'account-checkbox'),50)),
    (auth.uid(),'privacy',p_privacy_version,left(coalesce(p_method,'account-checkbox'),50))
  on conflict(user_id,document_type,document_version) do nothing;
  return true;
end;
$$;

revoke all on function public.accept_legal_documents(text,text,text,text) from public;
grant execute on function public.accept_legal_documents(text,text,text,text) to authenticated;
grant select,insert on public.legal_acceptances to service_role;
