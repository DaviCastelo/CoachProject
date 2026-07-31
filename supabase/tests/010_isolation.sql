begin;
select plan(2);

insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-0000000000a1','org-a','Org A'),
  ('00000000-0000-0000-0000-0000000000b1','org-b','Org B');

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-000000000001', 'a@a.com', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'b@b.com', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- profiles are created by on_auth_user_created trigger

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','owner'),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000002','owner');

insert into athletes (organization_id, first_name, last_name, date_of_birth)
  values ('00000000-0000-0000-0000-0000000000a1','Lucas','Silva','2015-05-01');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is( (select count(*)::int from athletes), 0,
  'Usuário da Org B não lê atletas da Org A' );

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is( (select count(*)::int from athletes), 1,
  'Usuário da Org A lê o atleta da Org A' );

select * from finish();
rollback;
