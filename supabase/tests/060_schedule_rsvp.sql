begin;
select plan(9);

-- Setup ----------------------------------------------------------------------
insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-0000000000f2','org-h','Org H');

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-000000000040', 'admin@h.com',  crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000041', 'parent@h.com', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000042', 'other@h.com',  crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-000000000040','admin'),
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-000000000041','guardian'),
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-000000000042','guardian');

insert into groups (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f2','U12'),
  ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000f2','U14');

insert into athletes (id, organization_id, first_name, last_name, date_of_birth) values
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f2','Multi','Group','2014-05-01'),
  ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000f2','Only','U14','2012-05-01'),
  ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-0000000000f2','Not','Invited','2013-05-01');

insert into guardians (id, organization_id, user_id, first_name, last_name, email) values
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-000000000041','Pat','H','parent@h.com'),
  ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-000000000042','Other','H','other@h.com');

insert into guardian_athletes (guardian_id, athlete_id) values
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000e3');

-- O atleta e1 está nos DOIS grupos convidados (edge case central do brief §8)
insert into group_members (organization_id, group_id, athlete_id) values
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000e2');

-- Evento em DOIS grupos -------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000040","role":"authenticated"}', true);

insert into sessions (id, organization_id, title, starts_at, ends_at, created_by) values
  ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000f2',
   'Joint Training', now() + interval '2 days', now() + interval '2 days 1 hour',
   '00000000-0000-0000-0000-000000000040');

insert into session_groups (session_id, group_id) values
  ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000d2');

select is(
  (select publish_session('00000000-0000-0000-0000-0000000000aa')),
  2,
  'Publishing invites each athlete once, even across two groups'
);

select is(
  (select count(*)::int from session_attendance
    where session_id = '00000000-0000-0000-0000-0000000000aa'
      and athlete_id = '00000000-0000-0000-0000-0000000000e1'),
  1,
  'Athlete in two invited groups gets exactly one RSVP row'
);

select is(
  (select count(*)::int from session_attendance
    where session_id = '00000000-0000-0000-0000-0000000000aa' and status = 'invited'),
  2,
  'Default RSVP state is invited (= No reply)'
);

-- Publicar de novo não duplica
select is(
  (select publish_session('00000000-0000-0000-0000-0000000000aa')),
  0,
  'Re-publishing does not duplicate invitations'
);

-- RSVP do responsável em nome do filho ---------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000041","role":"authenticated"}', true);

select lives_ok(
  $$select respond_rsvp('00000000-0000-0000-0000-0000000000aa',
                        '00000000-0000-0000-0000-0000000000e1', 'confirmed')$$,
  'Guardian can RSVP on behalf of their own child'
);

select is(
  (select responded_by from session_attendance
    where session_id = '00000000-0000-0000-0000-0000000000aa'
      and athlete_id = '00000000-0000-0000-0000-0000000000e1'),
  '00000000-0000-0000-0000-000000000041'::uuid,
  'RSVP records WHO answered (audit trail)'
);

-- Não pode responder por filho alheio
select throws_ok(
  $$select respond_rsvp('00000000-0000-0000-0000-0000000000aa',
                        '00000000-0000-0000-0000-0000000000e2', 'confirmed')$$,
  'P0001',
  'forbidden',
  'Guardian cannot RSVP for a child that is not theirs'
);

-- Não pode marcar presença (isso é da chamada do coach)
select throws_ok(
  $$select respond_rsvp('00000000-0000-0000-0000-0000000000aa',
                        '00000000-0000-0000-0000-0000000000e1', 'present')$$,
  'P0001',
  'invalid_rsvp_status',
  'Family cannot set attendance states, only the three RSVP ones'
);

-- Visibilidade: responsável de atleta não convidado não enxerga o evento
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000042","role":"authenticated"}', true);

select is(
  (select count(*)::int from sessions where id = '00000000-0000-0000-0000-0000000000aa'),
  0,
  'A family with no athlete in the event cannot see it'
);

select * from finish();
rollback;
