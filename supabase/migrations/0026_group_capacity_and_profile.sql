-- Coach precisa ajustar as vagas do grupo que treina, mas NÃO deve ganhar
-- escrita livre em `groups` (renomear, remover, mudar o grupo pai, trocar de org).
-- Uma RPC dedicada dá exatamente esse poder e nada além.

create or replace function set_group_capacity(p_group_id uuid, p_capacity int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_capacity is null or p_capacity < 1 then
    raise exception 'invalid_capacity';
  end if;

  if not can_manage_group(p_group_id) then
    raise exception 'forbidden';
  end if;

  update groups
     set capacity = p_capacity, updated_at = now()
   where id = p_group_id;
end $$;

revoke all on function set_group_capacity(uuid, int) from public, anon;
grant execute on function set_group_capacity(uuid, int) to authenticated;
