begin;
select plan(5);

insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-0000000000f3','org-i','Org I');

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-000000000050', 'admin@i.com',   crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000051', 'coach@i.com',   crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000052', 'parent1@i.com', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000053', 'optout@i.com',  crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-000000000050','admin'),
  ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-000000000051','coach'),
  ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-000000000052','guardian'),
  ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-000000000053','guardian');

insert into groups (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000000d5','00000000-0000-0000-0000-0000000000f3','U12'),
  ('00000000-0000-0000-0000-0000000000d6','00000000-0000-0000-0000-0000000000f3','Other');

insert into athletes (id, organization_id, first_name, last_name, date_of_birth) values
  ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000f3','Kid','Five','2014-05-01'),
  ('00000000-0000-0000-0000-0000000000e6','00000000-0000-0000-0000-0000000000f3','Kid','Six','2014-07-01');

insert into guardians (id, organization_id, user_id, first_name, last_name, email) values
  ('00000000-0000-0000-0000-0000000000c5','00000000-0000-0000-0000-0000000000f3',
   '00000000-0000-0000-0000-000000000052','P','One','parent1@i.com'),
  ('00000000-0000-0000-0000-0000000000c6','00000000-0000-0000-0000-0000000000f3',
   '00000000-0000-0000-0000-000000000053','P','Two','optout@i.com');

-- Um responsável recebe comunicação; o outro optou por NÃO receber.
insert into guardian_athletes (guardian_id, athlete_id, can_receive_comms) values
  ('00000000-0000-0000-0000-0000000000c5','00000000-0000-0000-0000-0000000000e5', true),
  ('00000000-0000-0000-0000-0000000000c6','00000000-0000-0000-0000-0000000000e6', false);

insert into group_members (organization_id, group_id, athlete_id) values
  ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000d5','00000000-0000-0000-0000-0000000000e5'),
  ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000d5','00000000-0000-0000-0000-0000000000e6');

insert into group_coaches (organization_id, group_id, coach_id) values
  ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000d5','00000000-0000-0000-0000-000000000051');

-- Admin envia para o U12 -----------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000050","role":"authenticated"}', true);

insert into announcements (id, organization_id, author_id, title, body) values
  ('00000000-0000-0000-0000-0000000000ab','00000000-0000-0000-0000-0000000000f3',
   '00000000-0000-0000-0000-000000000050','Treino cancelado','Chuva forte hoje.');

insert into announcement_groups (announcement_id, group_id) values
  ('00000000-0000-0000-0000-0000000000ab','00000000-0000-0000-0000-0000000000d5');

-- Destinatários esperados: responsável que aceita comms + coach do grupo = 2
-- (o responsável com can_receive_comms=false fica de fora)
select is(
  (select send_announcement('00000000-0000-0000-0000-0000000000ab')),
  2,
  'Announcement reaches opted-in guardians and group coaches'
);

select is(
  (select count(*)::int from announcement_recipients
    where announcement_id = '00000000-0000-0000-0000-0000000000ab'
      and profile_id = '00000000-0000-0000-0000-000000000053'),
  0,
  'Guardian who opted out of comms is excluded'
);

select throws_ok(
  $$select send_announcement('00000000-0000-0000-0000-0000000000ab')$$,
  'P0001',
  'already_sent',
  'An announcement cannot be sent twice'
);

-- Coach só envia para os grupos que treina -----------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000051","role":"authenticated"}', true);

insert into announcements (id, organization_id, author_id, title, body) values
  ('00000000-0000-0000-0000-0000000000ac','00000000-0000-0000-0000-0000000000f3',
   '00000000-0000-0000-0000-000000000051','Fora do escopo','Nao deveria enviar.');

insert into announcement_groups (announcement_id, group_id) values
  ('00000000-0000-0000-0000-0000000000ac','00000000-0000-0000-0000-0000000000d6');

select throws_ok(
  $$select send_announcement('00000000-0000-0000-0000-0000000000ac')$$,
  'P0001',
  'group_not_owned',
  'Coach cannot send announcements to groups they do not coach'
);

-- O destinatário enxerga o anúncio que recebeu
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000052","role":"authenticated"}', true);

select is(
  (select count(*)::int from announcements
    where id = '00000000-0000-0000-0000-0000000000ab'),
  1,
  'Recipient can read the announcement they received'
);

select * from finish();
rollback;
