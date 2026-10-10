-- Fase 2 — RLS do intake/site público.
-- Padrão: negar tudo, abrir por papel. Escritas do pipeline público acontecem no
-- servidor (Server Action com service_role, que ignora RLS), então NÃO há policy
-- de INSERT para anon aqui — anon só LÊ o conteúdo público (programas, formulários, waiver).

alter table programs           enable row level security;
alter table program_options    enable row level security;
alter table groups             enable row level security;
alter table forms              enable row level security;
alter table form_versions      enable row level security;
alter table form_submissions   enable row level security;
alter table registrations      enable row level security;
alter table waiver_templates   enable row level security;
alter table waiver_signatures  enable row level security;

-- programs: staff tudo; público lê os publicados
create policy programs_staff_all on programs
  for all using (is_staff(organization_id)) with check (is_staff(organization_id));
create policy programs_public_read on programs
  for select using (status = 'published');

-- program_options: staff tudo; público lê os ativos de programas publicados
create policy program_options_staff_all on program_options
  for all using (is_staff(organization_id)) with check (is_staff(organization_id));
create policy program_options_public_read on program_options
  for select using (
    is_active and exists (
      select 1 from programs p where p.id = program_options.program_id and p.status = 'published'
    )
  );

-- groups: só staff
create policy groups_staff_all on groups
  for all using (is_staff(organization_id)) with check (is_staff(organization_id));

-- forms: staff tudo; público lê os publicados
create policy forms_staff_all on forms
  for all using (is_staff(organization_id)) with check (is_staff(organization_id));
create policy forms_public_read on forms
  for select using (status = 'published');

-- form_versions: staff tudo; público lê versões de formulários publicados
create policy form_versions_staff_all on form_versions
  for all using (
    exists (select 1 from forms f where f.id = form_versions.form_id and is_staff(f.organization_id))
  ) with check (
    exists (select 1 from forms f where f.id = form_versions.form_id and is_staff(f.organization_id))
  );
create policy form_versions_public_read on form_versions
  for select using (
    exists (select 1 from forms f where f.id = form_versions.form_id and f.status = 'published')
  );

-- form_submissions: staff tudo; família lê as do próprio atleta (escrita é server-side)
create policy form_submissions_staff_all on form_submissions
  for all using (is_staff(organization_id)) with check (is_staff(organization_id));
create policy form_submissions_family_read on form_submissions
  for select using (athlete_id in (select auth_athlete_ids()));

-- registrations: staff tudo; família lê as do próprio atleta
create policy registrations_staff_all on registrations
  for all using (is_staff(organization_id)) with check (is_staff(organization_id));
create policy registrations_family_read on registrations
  for select using (athlete_id in (select auth_athlete_ids()));

-- waiver_templates: staff tudo; público lê os ativos (para exibir o texto na assinatura)
create policy waiver_templates_staff_all on waiver_templates
  for all using (is_staff(organization_id)) with check (is_staff(organization_id));
create policy waiver_templates_public_read on waiver_templates
  for select using (is_active);

-- waiver_signatures: staff tudo; família lê as do próprio atleta (escrita é server-side)
create policy waiver_signatures_staff_all on waiver_signatures
  for all using (is_staff(organization_id)) with check (is_staff(organization_id));
create policy waiver_signatures_family_read on waiver_signatures
  for select using (athlete_id in (select auth_athlete_ids()));
