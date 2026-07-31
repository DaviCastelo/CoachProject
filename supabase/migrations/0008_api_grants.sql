-- Supabase API roles need table-level grants; RLS policies enforce row access.

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

grant usage, select on all sequences in schema public to authenticated, service_role;

grant execute on function athlete_age(date) to authenticated, anon;
grant execute on function athlete_age_group(date) to authenticated, anon;

grant usage on type org_role to authenticated, anon;
grant usage on type athlete_status to authenticated, anon;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant select on tables to anon;

alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
