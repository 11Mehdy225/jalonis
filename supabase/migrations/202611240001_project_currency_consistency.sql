-- A project has one accounting currency. Procurement records inherit it and
-- cannot silently diverge from the charter.
create or replace function public.apply_project_currency()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  select coalesce(currency, 'XOF') into new.currency
  from public.projects
  where id = new.project_id;
  new.currency := coalesce(new.currency, 'XOF');
  return new;
end;
$$;

drop trigger if exists procurements_project_currency on public.procurements;
create trigger procurements_project_currency
before insert or update on public.procurements
for each row execute function public.apply_project_currency();

drop trigger if exists supplier_quotes_project_currency on public.supplier_quotes;
create trigger supplier_quotes_project_currency
before insert or update on public.supplier_quotes
for each row execute function public.apply_project_currency();

drop trigger if exists supplier_contracts_project_currency on public.supplier_contracts;
create trigger supplier_contracts_project_currency
before insert or update on public.supplier_contracts
for each row execute function public.apply_project_currency();

create or replace function public.sync_project_currency()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.currency is distinct from old.currency then
    update public.procurements set currency = coalesce(new.currency, 'XOF') where project_id = new.id;
    update public.supplier_quotes set currency = coalesce(new.currency, 'XOF') where project_id = new.id;
    update public.supplier_contracts set currency = coalesce(new.currency, 'XOF') where project_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_sync_currency on public.projects;
create trigger projects_sync_currency
after update of currency on public.projects
for each row execute function public.sync_project_currency();

update public.procurements item
set currency = coalesce(project.currency, 'XOF')
from public.projects project
where project.id = item.project_id;

update public.supplier_quotes item
set currency = coalesce(project.currency, 'XOF')
from public.projects project
where project.id = item.project_id;

update public.supplier_contracts item
set currency = coalesce(project.currency, 'XOF')
from public.projects project
where project.id = item.project_id;

alter table public.procurements alter column currency set default 'XOF';
alter table public.supplier_quotes alter column currency set default 'XOF';
alter table public.supplier_contracts alter column currency set default 'XOF';
