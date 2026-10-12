-- A ficha passa a apontar para o programa. Várias fichas podem usar o mesmo
-- programa. programs.form_id continua sendo só o botão da página pública.

alter table forms
  add column program_id uuid references programs(id) on delete set null;

create index forms_program_id_idx on forms (program_id);

update forms f
   set program_id = picked.id
  from (
    select distinct on (form_id) id, form_id
      from programs
     where form_id is not null
     order by form_id, (status = 'published') desc, created_at
  ) picked
 where f.id = picked.form_id
   and f.program_id is null;

create or replace function submit_public_registration(
  p_form_version_id uuid,
  p_data jsonb,
  p_athlete jsonb,
  p_guardian jsonb,
  p_household jsonb default '{}'::jsonb,
  p_program_option_id uuid default null,
  p_waiver jsonb default null,
  p_ip inet default null,
  p_user_agent text default null,
  p_athlete_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org         uuid;
  v_form_id     uuid;
  v_program_id  uuid;
  v_option_id   uuid;
  v_submission  uuid;
  v_reg         uuid;
begin
  select f.organization_id, f.id
    into v_org, v_form_id
  from form_versions fv
  join forms f on f.id = fv.form_id
  where fv.id = p_form_version_id
    and f.status = 'published'
    and fv.published_at is not null;

  if v_org is null then
    raise exception 'form_not_found';
  end if;

  select p.id into v_program_id
    from forms f
    join programs p on p.id = f.program_id
   where f.id = v_form_id
     and p.status = 'published';

  if v_program_id is null then
    select id into v_program_id
      from programs
     where form_id = v_form_id
       and status = 'published'
     limit 1;
  end if;

  v_option_id := null;
  if p_program_option_id is not null and v_program_id is not null then
    select po.id into v_option_id
      from program_options po
     where po.id = p_program_option_id
       and po.program_id = v_program_id
       and po.is_active;
  end if;

  insert into form_submissions (
    organization_id, form_version_id, data, status, ip_address, user_agent
  ) values (
    v_org, p_form_version_id, p_data, 'received', p_ip, p_user_agent
  )
  returning id into v_submission;

  v_reg := process_registration_submission(
    v_submission,
    p_athlete,
    p_guardian,
    p_household,
    v_program_id,
    v_option_id,
    p_waiver,
    p_athlete_id
  );

  return v_reg;
exception
  when others then
    if v_submission is not null then
      update form_submissions
         set status = 'rejected', error = sqlerrm
       where id = v_submission;
    end if;
    raise;
end;
$$;
