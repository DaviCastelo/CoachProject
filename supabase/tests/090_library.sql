-- Biblioteca: quem vê, quem apaga, e o que impede a cota de estourar.
--
-- São vídeos de menores, então a primeira coisa testada é que família e outra
-- organização não enxergam nada. A segunda é que ninguém escreve direto nas
-- tabelas: `storage_key` decide que objeto recebe URL assinada.

begin;
select plan(24);

insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-000000004a01','lib-a','Lib A'),
  ('00000000-0000-0000-0000-000000004a02','lib-b','Lib B');

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-000000004b01','admin@lib.test',  crypt('p', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-000000004b02','coach@lib.test',  crypt('p', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-000000004b03','parent@lib.test', crypt('p', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-000000004b04','other@lib.test',  crypt('p', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-000000004a01','00000000-0000-0000-0000-000000004b01','admin'),
  ('00000000-0000-0000-0000-000000004a01','00000000-0000-0000-0000-000000004b02','coach'),
  ('00000000-0000-0000-0000-000000004a01','00000000-0000-0000-0000-000000004b03','guardian'),
  ('00000000-0000-0000-0000-000000004a02','00000000-0000-0000-0000-000000004b04','admin');

insert into org_settings (organization_id, key, value) values
  ('00000000-0000-0000-0000-000000004a01','library.limits','{"quota_bytes":1000,"max_file_bytes":600}');

insert into library_folders (id, organization_id, parent_id, name) values
  ('00000000-0000-0000-0000-000000004c01','00000000-0000-0000-0000-000000004a01',null,'Jogos'),
  ('00000000-0000-0000-0000-000000004c02','00000000-0000-0000-0000-000000004a01','00000000-0000-0000-0000-000000004c01','U10'),
  ('00000000-0000-0000-0000-000000004c03','00000000-0000-0000-0000-000000004a01',null,'Treinos');

select throws_ok(
  $$ insert into library_folders (organization_id, parent_id, name) values
     ('00000000-0000-0000-0000-000000004a02','00000000-0000-0000-0000-000000004c01','Invasora') $$,
  '23503', null,
  'pasta não pode ter pai em outra organização'
);

insert into library_files (id, organization_id, folder_id, name, kind, size_bytes, storage_key, status, uploaded_by) values
  ('00000000-0000-0000-0000-000000004d01','00000000-0000-0000-0000-000000004a01','00000000-0000-0000-0000-000000004c02','Final.mp4','video',100,'00000000-0000-0000-0000-000000004a01/x1','ready','00000000-0000-0000-0000-000000004b02');

set local role authenticated;

-- Coach ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004b02","role":"authenticated"}', true);

select is((select count(*)::int from library_files), 1, 'coach enxerga o arquivo da organização');

update library_files set storage_key = 'outra-org/segredo';
select is(
  (select storage_key from library_files where id = '00000000-0000-0000-0000-000000004d01'),
  '00000000-0000-0000-0000-000000004a01/x1',
  'UPDATE direto não muda storage_key'
);

select throws_ok(
  $$ insert into library_folders (organization_id, name) values ('00000000-0000-0000-0000-000000004a01','Direto') $$,
  '42501', null, 'INSERT direto em pasta é recusado'
);

select lives_ok(
  $$ select library_create_folder('00000000-0000-0000-0000-000000004a01', null, 'Clinicas') $$,
  'coach cria pasta'
);

select throws_ok(
  $$ select library_create_folder('00000000-0000-0000-0000-000000004a01', null, '  JOGOS ') $$,
  'folder_name_taken', 'nome repetido na mesma pasta é recusado, sem diferenciar maiúscula'
);

select throws_ok(
  $$ select library_move_folder('00000000-0000-0000-0000-000000004c01','00000000-0000-0000-0000-000000004c02') $$,
  'folder_cycle', 'pasta não entra dentro da própria filha'
);

select throws_ok(
  $$ select library_move_folder('00000000-0000-0000-0000-000000004c01','00000000-0000-0000-0000-000000004c01') $$,
  'folder_cycle', 'pasta não entra dentro de si mesma'
);

select throws_ok(
  $$ select library_delete_folder('00000000-0000-0000-0000-000000004c01') $$,
  'forbidden', 'coach não apaga pasta'
);

select throws_ok(
  $$ select library_begin_upload('00000000-0000-0000-0000-000000004a01', null, 'grande.mp4', 'video', 'video/mp4', 601) $$,
  'file_too_large', 'arquivo acima do limite é recusado antes de enviar'
);

select is(
  (select storage_key from library_begin_upload('00000000-0000-0000-0000-000000004a01', null, 'a.mp4', 'video', 'video/mp4', 500)) like '00000000-0000-0000-0000-000000004a01/%',
  true,
  'o caminho do objeto nasce no banco, dentro da pasta da organização'
);

select throws_ok(
  $$ select library_begin_upload('00000000-0000-0000-0000-000000004a01', null, 'b.mp4', 'video', 'video/mp4', 500) $$,
  'quota_exceeded', 'envio em andamento já conta na cota'
);

select is(
  (select (library_usage('00000000-0000-0000-0000-000000004a01')->>'used_bytes')::int), 600,
  'uso soma pronto e em andamento'
);

select throws_ok(
  $$ select library_finish_upload((select id from library_files where name = 'a.mp4')) $$,
  'upload_missing', 'não fecha envio que nunca chegou ao bucket'
);

select lives_ok(
  $$ select library_add_link('00000000-0000-0000-0000-000000004a01', null, 'Jogo inteiro', 'https://youtu.be/abc') $$,
  'link entra sem ocupar cota'
);

select throws_ok(
  $$ select library_add_link('00000000-0000-0000-0000-000000004a01', null, 'Ruim', 'javascript:alert(1)') $$,
  'invalid_url', 'link que não é https é recusado'
);

select lives_ok(
  $$ select library_delete_file('00000000-0000-0000-0000-000000004d01') $$,
  'coach apaga o próprio arquivo'
);

select throws_ok(
  $$ select library_rename_file('00000000-0000-0000-0000-000000004d01', 'x') $$,
  'file_not_found', 'arquivo em exclusão não aceita mais edição'
);

-- Responsável ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004b03","role":"authenticated"}', true);

select is((select count(*)::int from library_folders), 0, 'família não enxerga pasta nenhuma');
select throws_ok(
  $$ select library_create_folder('00000000-0000-0000-0000-000000004a01', null, 'Familia') $$,
  'forbidden', 'família não cria pasta'
);

-- Outra organização ----------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004b04","role":"authenticated"}', true);

select is((select count(*)::int from library_files), 0, 'outra organização não enxerga arquivo');
select throws_ok(
  $$ select library_rename_folder('00000000-0000-0000-0000-000000004c01', 'Hackeada') $$,
  'folder_not_found', 'outra organização não renomeia pasta'
);

-- Admin ----------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004b01","role":"authenticated"}', true);

reset role;
insert into library_files (id, organization_id, folder_id, name, kind, size_bytes, storage_key, status) values
  ('00000000-0000-0000-0000-000000004d02','00000000-0000-0000-0000-000000004a01','00000000-0000-0000-0000-000000004c02','Filho.mp4','video',1,'00000000-0000-0000-0000-000000004a01/x2','ready');
set local role authenticated;

select is(
  library_delete_folder('00000000-0000-0000-0000-000000004c01'), 1,
  'apagar pasta alcança arquivo de subpasta'
);

reset role;
select is(
  (select status::text from library_files where id = '00000000-0000-0000-0000-000000004d02'), 'deleting',
  'arquivo fica marcado para sair do bucket, em vez de virar órfão'
);

select * from finish();
rollback;
