-- Fase 2 — Intake, Waivers e Programas (schema)
-- Fonte: docs/03-modelo-de-dados. Tabelas do site público, formulários, inscrições e waivers.
-- 'groups' entra aqui (só a tabela) porque 'registrations' a referencia; membros/coaches/agenda
-- ficam para a Fase 3.

create type program_type as enum ('camp','small_group','private_1on1','clinic','season','package');

create table programs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  slug             text not null,
  name             text not null,
  type             program_type not null,
  description      text,
  hero_image_url   text,
  starts_on        date,
  ends_on          date,
  registration_opens_at  timestamptz,
  registration_closes_at timestamptz,
  min_birth_year   int,
  max_birth_year   int,
  genders          text[],
  capacity         int,
  status           text not null default 'draft',   -- draft | published | closed | archived
  form_id          uuid,                             -- formulário de inscrição (sem FK: evita ciclo)
  waiver_template_id uuid,
  settings         jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, slug)
);

create table program_options (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  program_id       uuid not null references programs(id) on delete cascade,
  name             text not null,
  description      text,
  price_cents      int not null,
  capacity         int,
  sessions_included int,
  sort_order       int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create index on program_options (program_id, sort_order);

-- Grupo de treino ("U9 Blue") — só a tabela nesta fase
create table groups (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  program_id       uuid references programs(id) on delete set null,
  name             text not null,
  color            text,
  skill_focus      text[],
  age_group        text,
  min_birth_year   int,
  max_birth_year   int,
  playing_levels   text[],
  capacity         int not null default 8,
  default_location_id uuid,
  default_duration_minutes int default 60,
  status           text not null default 'active',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on groups (organization_id, status);

-- Construtor de formulários (substitui o JotForm)
create table forms (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  slug             text not null,
  name             text not null,
  description      text,
  type             text not null,              -- registration | evaluation | survey | intake
  status           text not null default 'draft',
  requires_waiver  boolean not null default false,
  requires_payment boolean not null default false,
  success_message  text,
  redirect_url     text,
  created_at       timestamptz not null default now(),
  unique (organization_id, slug)
);

-- Versionamento: uma submissão sempre aponta para a versão exata que a pessoa viu
create table form_versions (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references forms(id) on delete cascade,
  version      int not null,
  schema       jsonb not null,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (form_id, version)
);

create table form_submissions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  form_version_id  uuid not null references form_versions(id),
  athlete_id       uuid references athletes(id) on delete set null,
  guardian_id      uuid references guardians(id) on delete set null,
  submitted_by     uuid references profiles(id),
  data             jsonb not null,
  ip_address       inet,
  user_agent       text,
  utm              jsonb,
  pdf_url          text,
  status           text not null default 'received',  -- received | processed | rejected
  error            text,                               -- dead-letter: motivo da falha de processamento
  created_at       timestamptz not null default now()
);
create index on form_submissions using gin (data jsonb_path_ops);
create index on form_submissions (organization_id, status);

create type registration_status as enum
  ('pending','approved','waitlisted','rejected','canceled','completed');

create table registrations (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  athlete_id        uuid not null references athletes(id) on delete cascade,
  program_id        uuid references programs(id) on delete set null,
  program_option_id uuid references program_options(id) on delete set null,
  group_id          uuid references groups(id) on delete set null,
  submission_id     uuid references form_submissions(id) on delete set null,
  status            registration_status not null default 'pending',
  approved_at       timestamptz,
  approved_by       uuid references profiles(id),
  canceled_at       timestamptz,
  cancellation_reason text,
  invoice_id        uuid,                              -- FK adicionada na Fase 4 (invoices)
  source            text,
  utm               jsonb,
  admin_notes       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on registrations (organization_id, status);
create index on registrations (program_id, status);

create table waiver_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  version          int not null,
  body_markdown    text not null,
  requires_initials boolean not null default false,
  effective_from   date not null,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (organization_id, name, version)
);

create table waiver_signatures (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations(id) on delete cascade,
  waiver_template_id uuid not null references waiver_templates(id),
  athlete_id         uuid not null references athletes(id) on delete cascade,
  guardian_id        uuid references guardians(id) on delete set null,
  signer_name        text not null,
  signer_email       text not null,
  signer_relationship text not null,
  signature_type     text not null,           -- drawn | typed
  signature_data     text not null,
  document_hash      text not null,           -- SHA-256 do texto exato assinado
  pdf_url            text,
  signed_at          timestamptz not null default now(),
  ip_address         inet not null,
  user_agent         text not null,
  consent_to_electronic_signature boolean not null default true,
  expires_on         date,
  revoked_at         timestamptz,
  created_at         timestamptz not null default now()
);
create index on waiver_signatures (athlete_id, signed_at desc);
