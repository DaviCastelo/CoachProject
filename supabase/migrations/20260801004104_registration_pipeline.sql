-- Fase 2 — pipeline de inscrição transacional (docs/04 › M1).
-- Recebe uma submissão já persistida (passo 1 — "nada se perde") e, numa única
-- transação, faz o dedupe do atleta por (org, lower(nome), lower(sobrenome), dob),
-- casa/cria household + guardian, vincula guardian↔athlete, cria a registration e
-- marca a submissão como 'processed'. Chamada apenas server-side (service_role).

create or replace function process_registration_submission(
  p_submission_id uuid,
  p_athlete jsonb,
  p_guardian jsonb,
  p_household jsonb default '{}'::jsonb,
  p_program_id uuid default null,
  p_program_option_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org       uuid;
  v_household uuid;
  v_guardian  uuid;
  v_athlete   uuid;
  v_reg       uuid;
  v_first  text := nullif(p_athlete->>'first_name', '');
  v_last   text := nullif(p_athlete->>'last_name', '');
  v_dob    date := (nullif(p_athlete->>'date_of_birth', ''))::date;
  v_gemail text := nullif(lower(p_guardian->>'email'), '');
begin
  select organization_id into v_org from form_submissions where id = p_submission_id;
  if v_org is null then raise exception 'submission % not found', p_submission_id; end if;
  if v_first is null or v_last is null or v_dob is null then
    raise exception 'athlete first_name, last_name and date_of_birth are required';
  end if;

  -- Dedupe do atleta
  select id into v_athlete from athletes
   where organization_id = v_org
     and lower(first_name) = lower(v_first)
     and lower(last_name)  = lower(v_last)
     and date_of_birth = v_dob
     and deleted_at is null
   limit 1;

  -- Household: reusa o do guardian existente, senão cria
  if v_gemail is not null then
    select g.household_id into v_household from guardians g
     where g.organization_id = v_org and lower(g.email) = v_gemail
       and g.household_id is not null
     limit 1;
  end if;
  if v_household is null then
    insert into households (organization_id, name, primary_email)
      values (v_org, coalesce(nullif(p_household->>'name', ''), v_last), v_gemail)
      returning id into v_household;
  end if;

  -- Guardian: casa por email na org, senão cria
  if v_gemail is not null then
    select id into v_guardian from guardians
     where organization_id = v_org and lower(email) = v_gemail
     limit 1;
  end if;
  if v_guardian is null then
    insert into guardians (organization_id, household_id, first_name, last_name, email, phone, relationship)
      values (v_org, v_household,
              coalesce(nullif(p_guardian->>'first_name', ''), 'Guardian'),
              coalesce(nullif(p_guardian->>'last_name', ''), v_last),
              coalesce(v_gemail, ''),
              nullif(p_guardian->>'phone', ''),
              nullif(p_guardian->>'relationship', ''))
      returning id into v_guardian;
  else
    update guardians set household_id = coalesce(household_id, v_household) where id = v_guardian;
  end if;

  -- Athlete: cria se novo, senão atualiza o essencial
  if v_athlete is null then
    insert into athletes (organization_id, household_id, first_name, last_name, date_of_birth,
                          gender, current_club, playing_level, jersey_size, status, source)
      values (v_org, v_household, v_first, v_last, v_dob,
              nullif(p_athlete->>'gender', ''), nullif(p_athlete->>'current_club', ''),
              nullif(p_athlete->>'playing_level', ''), nullif(p_athlete->>'jersey_size', ''),
              'prospect', 'registration')
      returning id into v_athlete;
  else
    update athletes set
       household_id  = coalesce(household_id, v_household),
       current_club  = coalesce(nullif(p_athlete->>'current_club', ''), current_club),
       playing_level = coalesce(nullif(p_athlete->>'playing_level', ''), playing_level),
       jersey_size   = coalesce(nullif(p_athlete->>'jersey_size', ''), jersey_size),
       updated_at    = now()
     where id = v_athlete;
  end if;

  -- Vínculo guardian ↔ athlete
  insert into guardian_athletes (guardian_id, athlete_id)
    values (v_guardian, v_athlete)
    on conflict (guardian_id, athlete_id) do nothing;

  -- Registration idempotente por submission_id
  select id into v_reg from registrations where submission_id = p_submission_id limit 1;
  if v_reg is null then
    insert into registrations (organization_id, athlete_id, program_id, program_option_id,
                               submission_id, status, source)
      values (v_org, v_athlete, p_program_id, p_program_option_id,
              p_submission_id, 'pending', 'registration')
      returning id into v_reg;
  end if;

  update form_submissions
     set status = 'processed', athlete_id = v_athlete, guardian_id = v_guardian, error = null
   where id = p_submission_id;

  return v_reg;
end $$;

-- Só o servidor (service_role) chama; nunca anon/authenticated/public.
revoke all on function process_registration_submission(uuid, jsonb, jsonb, jsonb, uuid, uuid)
  from public, anon, authenticated;
grant execute on function process_registration_submission(uuid, jsonb, jsonb, jsonb, uuid, uuid)
  to service_role;
