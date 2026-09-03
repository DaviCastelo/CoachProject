begin;
select plan(10);

-- Org + usuários -------------------------------------------------------------
insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-0000000000f1','org-g','Org G');

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-000000000030', 'admin@g.com',  crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000031', 'coachA@g.com', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000032', 'coachB@g.com', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000033', 'parent@g.com', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000030','admin'),
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000031','coach'),
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000032','coach'),
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000033','guardian');

-- Grupos: U12 com subgrupo U12 Boys, e um grupo separado
insert into groups (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f1','U12'),
  ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000f1','Advanced');
insert into groups (id, organization_id, name, parent_group_id) values
  ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000f1','U12 Boys','00000000-0000-0000-0000-0000000000a1');

-- Atletas + família
insert into athletes (id, organization_id, first_name, last_name, date_of_birth) values
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000f1','Kid','One','2014-05-01'),
  ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000f1','Kid','Two','2014-06-01');

insert into guardians (id, organization_id, user_id, first_name, last_name, email) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-000000000033','Pat','Silva','parent@g.com');

-- Um responsável, DOIS filhos (brief §12)
insert into guardian_athletes (guardian_id, athlete_id) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000b2');

-- coachA treina U12; coachB treina Advanced
insert into group_coaches (organization_id, group_id, coach_id) values
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000031'),
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000032');

-- Os dois atletas estão no U12; um deles TAMBÉM no Advanced (participação múltipla)
insert into group_members (organization_id, group_id, athlete_id) values
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000b1');

-- 1. Hierarquia --------------------------------------------------------------
select is(
  (select count(*)::int from group_descendants('00000000-0000-0000-0000-0000000000a1')),
  2,
  'group_descendants returns the group plus its subgroup'
);

select throws_ok(
  $$update groups set parent_group_id = '00000000-0000-0000-0000-0000000000a2'
     where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'P0001',
  null,
  'Hierarchy cycle is blocked by trigger'
);

-- 2. Participação múltipla ---------------------------------------------------
select is(
  (select count(*)::int from group_members
    where athlete_id = '00000000-0000-0000-0000-0000000000b1' and left_at is null),
  2,
  'A player can belong to several groups at once'
);

-- 3. Escopo do COACH ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000031","role":"authenticated"}', true);

select is(
  (select count(*)::int from auth_coach_group_ids()),
  1,
  'Coach A is bound to exactly one group'
);

-- coachA gerencia o roster do U12...
select lives_ok(
  $$update group_members set notes = 'ok'
     where group_id = '00000000-0000-0000-0000-0000000000a1'
       and athlete_id = '00000000-0000-0000-0000-0000000000b2'$$,
  'Coach can manage the roster of their own group'
);

-- ...mas NÃO cria grupos (isso é de admin — brief §7)
select throws_ok(
  $$insert into groups (organization_id, name)
    values ('00000000-0000-0000-0000-0000000000f1','Hacky Group')$$,
  '42501',
  null,
  'Coach cannot create groups (admin only)'
);

-- coachA não mexe no roster do grupo do coachB
select is(
  (select count(*)::int from group_members gm
    where gm.group_id = '00000000-0000-0000-0000-0000000000a3'
      and can_manage_group(gm.group_id)),
  0,
  'Coach cannot manage a group they do not coach'
);

-- 4. Escopo da FAMÍLIA -------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000033","role":"authenticated"}', true);

select is(
  (select count(*)::int from auth_athlete_ids()),
  2,
  'Guardian resolves to both of their children'
);

select is(
  (select count(*)::int from group_members),
  3,
  'Guardian sees only their own children memberships'
);

select throws_ok(
  $$insert into group_members (organization_id, group_id, athlete_id)
    values ('00000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-0000000000a1',
            '00000000-0000-0000-0000-0000000000b1')$$,
  '42501',
  null,
  'Guardian cannot add players to a group'
);

select * from finish();
rollback;
