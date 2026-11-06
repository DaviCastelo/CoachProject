-- Biblioteca: treinos, jogos, fotos e documentos dos coaches.
--
-- Nenhum byte de arquivo entra no Postgres. As tabelas guardam só nome, pasta
-- e tamanho; o arquivo vai do navegador direto para o bucket `library`, sem
-- passar pela Vercel, que recusa corpo de requisição acima de poucos MB.
--
-- Vídeo longo entra como link (YouTube não listado): não ocupa espaço nenhum.
--
-- Escrita só por RPC. `storage_key`, `size_bytes` e `status` decidem que objeto
-- um usuário recebe assinado e quanto da cota foi gasto. Com UPDATE direto,
-- bastaria apontar `storage_key` para o arquivo de outra organização.

create type library_file_kind as enum ('image', 'video', 'pdf', 'document', 'link');
create type library_file_status as enum ('uploading', 'ready', 'deleting');

create table library_folders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  parent_id       uuid,
  name            text not null check (char_length(btrim(name)) between 1 and 120),
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id),
  -- Chave composta: uma pasta não consegue ter pai em outra organização.
  foreign key (parent_id, organization_id)
    references library_folders (id, organization_id)
);

create unique index library_folders_name_uq on library_folders (
  organization_id,
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(btrim(name))
);
create index library_folders_parent_idx on library_folders (organization_id, parent_id);

create table library_files (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  folder_id        uuid,
  name             text not null check (char_length(btrim(name)) between 1 and 200),
  kind             library_file_kind not null,
  mime_type        text,
  size_bytes       bigint not null default 0 check (size_bytes >= 0),
  storage_key      text unique,
  thumb_key        text,
  external_url     text,
  width            int,
  height           int,
  duration_seconds numeric,
  status           library_file_status not null default 'uploading',
  uploaded_by      uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (folder_id, organization_id)
    references library_folders (id, organization_id),
  check (
    (kind = 'link' and external_url is not null and storage_key is null)
    or (kind <> 'link' and storage_key is not null and external_url is null)
  )
);

create index library_files_folder_idx
  on library_files (organization_id, folder_id, status, created_at desc);
create index library_files_sweep_idx on library_files (status, created_at)
  where status <> 'ready';

alter table library_folders enable row level security;
alter table library_files enable row level security;

-- Só leitura. São vídeos de menores: família e atleta não entram aqui.
create policy library_folders_staff_read on library_folders
  for select using (is_staff(organization_id));
create policy library_files_staff_read on library_files
  for select using (is_staff(organization_id));

-- Privado, sem política em storage.objects: só URL assinada lê ou escreve.
-- O limite por arquivo e os tipos aceitos ficam no bucket porque aqui o
-- servidor de arquivos recusa de verdade, sem depender do que o navegador diz.
-- 50 MiB é o teto do plano Free do Supabase.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library', 'library', false, 52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv'
  ]
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Limites
-- ---------------------------------------------------------------------------

-- 900 MB de cota deixa folga no 1 GB do plano Free para assinaturas e anexos.
-- Mudar de plano é trocar `library.limits` em org_settings e o limite do bucket.
create or replace function library_limits(p_org uuid, out quota_bytes bigint, out max_file_bytes bigint)
language sql stable security definer set search_path = public as $$
  select coalesce((s.value->>'quota_bytes')::bigint, 900000000),
         coalesce((s.value->>'max_file_bytes')::bigint, 52428800)
    from (select 1) one
    left join org_settings s on s.organization_id = p_org and s.key = 'library.limits';
$$;

create or replace function library_usage(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_limits record;
  v_used   bigint;
begin
  if not is_staff(p_org) then
    raise exception 'forbidden';
  end if;

  select * into v_limits from library_limits(p_org);
  -- `uploading` e `deleting` ainda ocupam espaço no bucket.
  select coalesce(sum(size_bytes), 0) into v_used
    from library_files where organization_id = p_org;

  return jsonb_build_object(
    'used_bytes', v_used,
    'quota_bytes', v_limits.quota_bytes,
    'max_file_bytes', v_limits.max_file_bytes
  );
end $$;

-- ---------------------------------------------------------------------------
-- Pastas
-- ---------------------------------------------------------------------------

create or replace function library_folder_depth(p_folder uuid)
returns int language sql stable security definer set search_path = public as $$
  with recursive up as (
    select id, parent_id, 1 as depth from library_folders where id = p_folder
    union all
    select f.id, f.parent_id, up.depth + 1
      from library_folders f join up on f.id = up.parent_id
  )
  select coalesce(max(depth), 0) from up;
$$;

create or replace function library_folder_height(p_folder uuid)
returns int language sql stable security definer set search_path = public as $$
  with recursive down as (
    select id, 1 as height from library_folders where id = p_folder
    union all
    select f.id, down.height + 1
      from library_folders f join down on f.parent_id = down.id
  )
  select coalesce(max(height), 0) from down;
$$;

create or replace function library_folder_path(p_folder uuid)
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  with recursive up as (
    select f.id, f.parent_id, f.name, f.organization_id, 1 as depth
      from library_folders f where f.id = p_folder
    union all
    select f.id, f.parent_id, f.name, f.organization_id, up.depth + 1
      from library_folders f join up on f.id = up.parent_id
  )
  select up.id, up.name from up
   where is_staff(up.organization_id)
   order by up.depth desc;
$$;

create or replace function library_create_folder(p_org uuid, p_parent uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_staff(p_org) then
    raise exception 'forbidden';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'invalid_name';
  end if;
  if p_parent is not null then
    if not exists (select 1 from library_folders where id = p_parent and organization_id = p_org) then
      raise exception 'folder_not_found';
    end if;
    if library_folder_depth(p_parent) >= 8 then
      raise exception 'folder_too_deep';
    end if;
  end if;

  insert into library_folders (organization_id, parent_id, name, created_by)
  values (p_org, p_parent, btrim(p_name), auth.uid())
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'folder_name_taken';
end $$;

create or replace function library_rename_folder(p_folder uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from library_folders where id = p_folder;
  if v_org is null or not is_staff(v_org) then
    raise exception 'folder_not_found';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'invalid_name';
  end if;

  update library_folders set name = btrim(p_name), updated_at = now() where id = p_folder;
exception
  when unique_violation then
    raise exception 'folder_name_taken';
end $$;

create or replace function library_move_folder(p_folder uuid, p_parent uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from library_folders where id = p_folder;
  if v_org is null or not is_staff(v_org) then
    raise exception 'folder_not_found';
  end if;

  if p_parent is not null then
    if not exists (select 1 from library_folders where id = p_parent and organization_id = v_org) then
      raise exception 'folder_not_found';
    end if;
    -- Pasta dentro de si mesma, ou de uma filha, sumiria da árvore para sempre.
    if p_folder in (select id from library_folder_path(p_parent)) then
      raise exception 'folder_cycle';
    end if;
    if library_folder_depth(p_parent) + library_folder_height(p_folder) > 8 then
      raise exception 'folder_too_deep';
    end if;
  end if;

  update library_folders set parent_id = p_parent, updated_at = now() where id = p_folder;
exception
  when unique_violation then
    raise exception 'folder_name_taken';
end $$;

-- Apagar é definitivo, então fica com owner e admin. Os arquivos são marcados
-- `deleting`: quem chamou tira do bucket em seguida, e o cron refaz se falhar.
create or replace function library_delete_folder(p_folder uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_org   uuid;
  v_files int;
begin
  select organization_id into v_org from library_folders where id = p_folder;
  if v_org is null or not is_staff(v_org) then
    raise exception 'folder_not_found';
  end if;
  if not has_org_role(v_org, array['owner','admin']::org_role[]) then
    raise exception 'forbidden';
  end if;

  with recursive tree as (
    select id from library_folders where id = p_folder
    union all
    select f.id from library_folders f join tree on f.parent_id = tree.id
  )
  update library_files
     set status = 'deleting', folder_id = null, updated_at = now()
   where folder_id in (select id from tree);
  get diagnostics v_files = row_count;

  with recursive tree as (
    select id from library_folders where id = p_folder
    union all
    select f.id from library_folders f join tree on f.parent_id = tree.id
  )
  delete from library_folders where id in (select id from tree);

  return v_files;
end $$;

-- ---------------------------------------------------------------------------
-- Arquivos
-- ---------------------------------------------------------------------------

-- Reserva a cota antes do envio e devolve o caminho do objeto. O caminho nasce
-- aqui e não vem do cliente: é ele que decide o que será assinado depois.
create or replace function library_begin_upload(
  p_org        uuid,
  p_folder     uuid,
  p_name       text,
  p_kind       library_file_kind,
  p_mime       text,
  p_size       bigint,
  p_width      int default null,
  p_height     int default null,
  p_duration   numeric default null,
  p_has_thumb  boolean default false
) returns library_files
language plpgsql security definer set search_path = public as $$
declare
  v_limits record;
  v_used   bigint;
  v_id     uuid := gen_random_uuid();
  v_row    library_files;
begin
  if not is_staff(p_org) then
    raise exception 'forbidden';
  end if;
  if p_kind = 'link' then
    raise exception 'invalid_kind';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'invalid_name';
  end if;
  if p_size is null or p_size <= 0 then
    raise exception 'invalid_size';
  end if;
  if p_folder is not null
     and not exists (select 1 from library_folders where id = p_folder and organization_id = p_org) then
    raise exception 'folder_not_found';
  end if;

  -- Dois envios simultâneos não podem ler a mesma sobra de cota.
  perform pg_advisory_xact_lock(hashtextextended('library:' || p_org::text, 0));

  select * into v_limits from library_limits(p_org);
  if p_size > v_limits.max_file_bytes then
    raise exception 'file_too_large';
  end if;

  select coalesce(sum(size_bytes), 0) into v_used
    from library_files where organization_id = p_org;
  if v_used + p_size > v_limits.quota_bytes then
    raise exception 'quota_exceeded';
  end if;

  insert into library_files (
    id, organization_id, folder_id, name, kind, mime_type, size_bytes,
    storage_key, thumb_key, width, height, duration_seconds, uploaded_by
  ) values (
    v_id, p_org, p_folder, btrim(p_name), p_kind, p_mime, p_size,
    p_org::text || '/' || v_id::text,
    case when p_has_thumb then p_org::text || '/' || v_id::text || '.thumb.webp' end,
    p_width, p_height, p_duration, auth.uid()
  )
  returning * into v_row;

  return v_row;
end $$;

-- Quem manda no tamanho é o que o bucket recebeu, não o que o navegador disse.
create or replace function library_finish_upload(p_file uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_row  library_files;
  v_real bigint;
begin
  select * into v_row from library_files where id = p_file;
  if v_row.id is null or not is_staff(v_row.organization_id) then
    raise exception 'file_not_found';
  end if;
  if v_row.status <> 'uploading' then
    raise exception 'file_not_uploading';
  end if;

  select (o.metadata->>'size')::bigint into v_real
    from storage.objects o
   where o.bucket_id = 'library' and o.name = v_row.storage_key;

  if v_real is null then
    raise exception 'upload_missing';
  end if;
  if v_real <> v_row.size_bytes then
    raise exception 'size_mismatch';
  end if;

  update library_files set status = 'ready', updated_at = now() where id = p_file;
end $$;

create or replace function library_add_link(p_org uuid, p_folder uuid, p_name text, p_url text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_staff(p_org) then
    raise exception 'forbidden';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'invalid_name';
  end if;
  if p_url is null or p_url !~* '^https://' then
    raise exception 'invalid_url';
  end if;
  if p_folder is not null
     and not exists (select 1 from library_folders where id = p_folder and organization_id = p_org) then
    raise exception 'folder_not_found';
  end if;

  insert into library_files (organization_id, folder_id, name, kind, external_url, status, uploaded_by)
  values (p_org, p_folder, btrim(p_name), 'link', p_url, 'ready', auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function library_rename_file(p_file uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from library_files where id = p_file and status = 'ready';
  if v_org is null or not is_staff(v_org) then
    raise exception 'file_not_found';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'invalid_name';
  end if;

  update library_files set name = btrim(p_name), updated_at = now() where id = p_file;
end $$;

create or replace function library_move_file(p_file uuid, p_folder uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from library_files where id = p_file and status = 'ready';
  if v_org is null or not is_staff(v_org) then
    raise exception 'file_not_found';
  end if;
  if p_folder is not null
     and not exists (select 1 from library_folders where id = p_folder and organization_id = v_org) then
    raise exception 'folder_not_found';
  end if;

  update library_files set folder_id = p_folder, updated_at = now() where id = p_file;
end $$;

-- Quem enviou pode apagar o próprio arquivo; o resto é com owner e admin.
create or replace function library_delete_file(p_file uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_row library_files;
begin
  select * into v_row from library_files where id = p_file;
  if v_row.id is null or not is_staff(v_row.organization_id) then
    raise exception 'file_not_found';
  end if;
  if v_row.uploaded_by is distinct from auth.uid()
     and not has_org_role(v_row.organization_id, array['owner','admin']::org_role[]) then
    raise exception 'forbidden';
  end if;

  update library_files
     set status = 'deleting', folder_id = null, updated_at = now()
   where id = p_file;
end $$;

revoke all on function library_limits(uuid) from public, anon, authenticated;
revoke all on function library_folder_depth(uuid) from public, anon, authenticated;
revoke all on function library_folder_height(uuid) from public, anon, authenticated;

revoke all on function library_usage(uuid) from public, anon;
revoke all on function library_folder_path(uuid) from public, anon;
revoke all on function library_create_folder(uuid, uuid, text) from public, anon;
revoke all on function library_rename_folder(uuid, text) from public, anon;
revoke all on function library_move_folder(uuid, uuid) from public, anon;
revoke all on function library_delete_folder(uuid) from public, anon;
revoke all on function library_begin_upload(uuid, uuid, text, library_file_kind, text, bigint, int, int, numeric, boolean) from public, anon;
revoke all on function library_finish_upload(uuid) from public, anon;
revoke all on function library_add_link(uuid, uuid, text, text) from public, anon;
revoke all on function library_rename_file(uuid, text) from public, anon;
revoke all on function library_move_file(uuid, uuid) from public, anon;
revoke all on function library_delete_file(uuid) from public, anon;

grant execute on function library_usage(uuid) to authenticated;
grant execute on function library_folder_path(uuid) to authenticated;
grant execute on function library_create_folder(uuid, uuid, text) to authenticated;
grant execute on function library_rename_folder(uuid, text) to authenticated;
grant execute on function library_move_folder(uuid, uuid) to authenticated;
grant execute on function library_delete_folder(uuid) to authenticated;
grant execute on function library_begin_upload(uuid, uuid, text, library_file_kind, text, bigint, int, int, numeric, boolean) to authenticated;
grant execute on function library_finish_upload(uuid) to authenticated;
grant execute on function library_add_link(uuid, uuid, text, text) to authenticated;
grant execute on function library_rename_file(uuid, text) to authenticated;
grant execute on function library_move_file(uuid, uuid) to authenticated;
grant execute on function library_delete_file(uuid) to authenticated;
