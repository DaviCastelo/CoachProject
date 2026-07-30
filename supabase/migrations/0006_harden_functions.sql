create or replace function athlete_age(dob date) returns int
language sql immutable set search_path = '' as $$ select extract(year from age(dob))::int $$;

create or replace function athlete_age_group(dob date) returns text
language sql stable set search_path = '' as $$
  select 'U' || (extract(year from current_date)::int
                 - extract(year from dob)::int
                 + case when extract(month from current_date) >= 8 then 1 else 0 end)
$$;

revoke all on function handle_new_user() from public, anon, authenticated;
