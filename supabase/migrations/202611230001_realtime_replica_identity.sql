-- Reassert the core collaborative publication and include complete row images.
-- This is safe to apply when a table is already part of the publication.
do $$
declare table_name text;
begin
  foreach table_name in array array['projects','tasks','comments','activities','notifications'] loop
    if not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I',table_name);
    end if;
    execute format('alter table public.%I replica identity full',table_name);
  end loop;
end $$;
