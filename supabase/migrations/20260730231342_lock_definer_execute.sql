revoke execute on function auth_org_ids()  from public, anon;
grant execute on function auth_org_ids()  to authenticated;
revoke execute on function auth_athlete_ids() from public, anon;
grant execute on function auth_athlete_ids() to authenticated;
revoke execute on function is_staff(uuid) from public, anon;
grant execute on function is_staff(uuid) to authenticated;
revoke execute on function has_org_role(uuid, org_role[]) from public, anon;
grant execute on function has_org_role(uuid, org_role[]) to authenticated;
