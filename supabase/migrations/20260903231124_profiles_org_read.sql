-- G1 — Staff precisa ler o nome/e-mail dos colegas para montar a aba de coaches
-- do grupo e o seletor "adicionar coach". Até aqui `profiles` só tinha
-- profile_self_read (cada um via apenas a si), o que deixava a lista vazia.
--
-- SECURITY DEFINER para não disparar recursão de policy entre profiles e memberships.

create or replace function shares_org_with_viewer(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from memberships target
      join memberships viewer
        on viewer.organization_id = target.organization_id
     where target.user_id = p_profile_id
       and target.status = 'active'
       and viewer.user_id = auth.uid()
       and viewer.status = 'active'
       and viewer.role in ('owner','admin','coach','staff')
  );
$$;

grant execute on function shares_org_with_viewer(uuid) to authenticated;

drop policy if exists profile_org_staff_read on profiles;
create policy profile_org_staff_read on profiles
  for select using (shares_org_with_viewer(id));
