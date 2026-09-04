-- G5 — Anúncios por grupo (comunicação unidirecional; NÃO é chat — brief §14/§17).
-- Destinatários são MATERIALIZADOS no envio: se o roster mudar depois, quem recebeu
-- continua vendo e o histórico de auditoria permanece correto.

do $$ begin
  create type announcement_status as enum ('draft','sent');
exception when duplicate_object then null;
end $$;

create table if not exists announcements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  author_id       uuid references profiles(id) on delete set null,
  title           text not null,
  body            text not null,
  status          announcement_status not null default 'draft',
  sent_at         timestamptz,
  session_id      uuid references sessions(id) on delete set null,  -- anúncio ligado a um evento
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists announcements_org_sent_idx on announcements (organization_id, sent_at desc);

create table if not exists announcement_groups (
  announcement_id   uuid not null references announcements(id) on delete cascade,
  group_id          uuid not null references groups(id) on delete cascade,
  include_subgroups boolean not null default false,
  primary key (announcement_id, group_id)
);

create index if not exists announcement_groups_group_idx on announcement_groups (group_id);

create table if not exists announcement_recipients (
  announcement_id uuid not null references announcements(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  athlete_id      uuid references athletes(id) on delete set null,  -- por qual atleta recebeu
  read_at         timestamptz,
  primary key (announcement_id, profile_id)
);

create index if not exists announcement_recipients_profile_idx
  on announcement_recipients (profile_id, read_at);

-- ---------------------------------------------------------------------------
-- Helper de autorização
-- ---------------------------------------------------------------------------

-- Pode editar/enviar este anúncio? admin da org OU coach de todos... na prática,
-- de ALGUM dos grupos escolhidos (a validação de "só os seus grupos" acontece na RPC).
create or replace function can_manage_announcement(p_announcement_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from announcements a
     where a.id = p_announcement_id
       and (
         has_org_role(a.organization_id, array['owner','admin']::org_role[])
         or a.author_id = auth.uid()
       )
  );
$$;

grant execute on function can_manage_announcement(uuid) to authenticated;
