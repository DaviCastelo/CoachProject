-- Login de atleta (senha temporária) + anexos em avisos.

-- ---------------------------------------------------------------------------
-- 1. Senha temporária: o atleta precisa trocar no primeiro acesso
-- ---------------------------------------------------------------------------

alter table profiles
  add column if not exists must_change_password boolean not null default false;

-- O próprio usuário limpa a flag ao trocar a senha (profile_self_update já cobre
-- o UPDATE; a coluna entra no mesmo escopo).

-- ---------------------------------------------------------------------------
-- 2. Anexos de aviso (imagem/PDF)
-- ---------------------------------------------------------------------------

create table if not exists announcement_attachments (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  storage_path    text not null,
  file_name       text not null,
  mime_type       text not null,
  size_bytes      int not null,
  created_at      timestamptz not null default now()
);

create index if not exists announcement_attachments_ann_idx
  on announcement_attachments (announcement_id);

alter table announcement_attachments enable row level security;

-- Quem pode ver o aviso pode ver o anexo: destinatário, staff ou autor.
-- Usa os helpers definer da 0022 para não recair na recursão de RLS.
drop policy if exists announcement_attachments_read on announcement_attachments;
create policy announcement_attachments_read on announcement_attachments
  for select using (
    is_staff(announcement_org(announcement_id))
    or is_announcement_recipient(announcement_id)
  );

drop policy if exists announcement_attachments_write on announcement_attachments;
create policy announcement_attachments_write on announcement_attachments
  for all using (can_manage_announcement(announcement_id))
  with check (can_manage_announcement(announcement_id));

grant select, insert, update, delete on announcement_attachments to authenticated;
grant all on announcement_attachments to postgres, service_role;

-- Bucket privado: o servidor grava e gera URL assinada para leitura.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'announcements', 'announcements', false, 10485760,
  array['application/pdf','image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do nothing;
