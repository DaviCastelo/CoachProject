# 03 — Modelo de Dados

Schema Postgres completo. Convenções: nomes em `snake_case` e inglês (alinhado ao Supabase e ao vocabulário do cliente, que é americano), chaves primárias `uuid` com `gen_random_uuid()`, timestamps `timestamptz` em UTC, `created_at`/`updated_at` em todas as tabelas de domínio, soft delete via `deleted_at` apenas onde o histórico importa.

---

## 1. Decisão estruturante: multi-tenant desde o dia 1

Toda tabela de domínio carrega `organization_id`. Hoje existe uma organização só (CA Tempo Training). Fiz assim mesmo por três motivos:

1. **Custo zero agora, custo altíssimo depois.** Retrofitar multi-tenancy em um banco com dados reais é uma migração de risco.
2. **A CA Tempo pode virar duas.** Se abrirem uma segunda localidade ou uma marca de camps separada, já está resolvido.
3. **É o caminho natural de licenciar a plataforma.** Se o produto ficar bom (e é o objetivo), vender para outros clubes de treino privado é uma linha de receita óbvia — e o Byga cobra caro por isso.

O isolamento é garantido por RLS: toda política começa checando se o usuário pertence à organização da linha.

---

## 2. Núcleo — identidade e organização

```sql
-- Organização (tenant)
create table organizations (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name              text not null,               -- "CA Tempo Training"
  legal_name        text,
  timezone          text not null default 'America/New_York',
  currency          char(3) not null default 'USD',
  locale            text not null default 'en-US',
  logo_url          text,
  brand_colors      jsonb default '{}',
  contact_email     text,
  contact_phone     text,
  address           jsonb,
  settings          jsonb not null default '{}',  -- políticas de cancelamento, prazos, etc.
  stripe_account_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Perfil espelhando auth.users (1:1)
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  phone         text,
  avatar_url    text,
  locale        text default 'en-US',
  timezone      text,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create type org_role as enum ('owner','admin','coach','staff','guardian','athlete');

-- Vínculo usuário ↔ organização, com papel
create table memberships (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  user_id          uuid not null references profiles(id) on delete cascade,
  role             org_role not null,
  status           text not null default 'active',  -- active | invited | suspended
  invited_by       uuid references profiles(id),
  invited_at       timestamptz,
  accepted_at      timestamptz,
  created_at       timestamptz not null default now(),
  unique (organization_id, user_id, role)
);

create index on memberships (user_id);
create index on memberships (organization_id, role);
```

**Por que `memberships` permite múltiplos papéis por usuário:** Carlos é owner **e** coach. Arthur pode ser admin **e** coach. E existe o caso real do coach que também é pai de um atleta do clube. Um enum único na tabela `profiles` quebraria nisso.

### Funções auxiliares para RLS

```sql
-- Organizações do usuário atual
create or replace function auth_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id from memberships
  where user_id = auth.uid() and status = 'active'
$$;

-- Tem algum dos papéis nesta organização?
create or replace function has_org_role(org uuid, roles org_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and organization_id = org
      and status = 'active' and role = any(roles)
  )
$$;

-- É staff (qualquer papel interno)?
create or replace function is_staff(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_org_role(org, array['owner','admin','coach','staff']::org_role[])
$$;

-- Atletas que o usuário atual pode ver (como responsável ou como o próprio atleta)
create or replace function auth_athlete_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select athlete_id from guardian_athletes ga
    join guardians g on g.id = ga.guardian_id
   where g.user_id = auth.uid()
  union
  select a.id from athletes a where a.user_id = auth.uid()
$$;
```

---

## 3. Pessoas — atletas, responsáveis, famílias

```sql
-- Núcleo familiar: agrupa irmãos e concentra faturamento e desconto
create table households (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text,                       -- "Família Silva"
  primary_email    text,
  primary_phone    text,
  address          jsonb,
  billing_notes    text,
  account_balance  numeric(12,2) not null default 0,  -- crédito positivo
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table guardians (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  household_id     uuid references households(id) on delete set null,
  user_id          uuid references profiles(id) on delete set null,  -- null até aceitar o convite
  first_name       text not null,
  last_name        text not null,
  email            text not null,
  phone            text,
  relationship     text,                       -- mother | father | grandparent | other
  is_primary       boolean not null default false,
  is_emergency     boolean not null default true,
  preferred_language text default 'en',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on guardians (organization_id, lower(email));

create type athlete_status as enum ('prospect','trial','active','paused','inactive','alumni');

create table athletes (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  household_id      uuid references households(id) on delete set null,
  user_id           uuid references profiles(id) on delete set null,  -- login próprio (13+)
  first_name        text not null,
  last_name         text not null,
  preferred_name    text,
  date_of_birth     date not null,
  gender            text,
  photo_url         text,
  status            athlete_status not null default 'prospect',

  -- contexto futebolístico (espelha os formulários atuais)
  current_club      text,
  playing_level     text,          -- GOLD | PREMIER | ECNL | PRE-ECNL | ECNLRL | PRE-ECNLRL | MLS | GA
  positions         text[],
  dominant_foot     text,          -- left | right | both
  jersey_size       text,          -- Youth S ... Adult M
  school            text,
  graduation_year   int,

  -- objetivos e disponibilidade
  short_term_goals  text,
  long_term_goals   text,
  training_interests text[],       -- finishing | 1v1 | speed | goalkeeping | ...
  availability      jsonb,         -- estruturado, ver seção 4

  -- saúde e consentimento
  medical_notes     text,
  allergies         text,
  medications       text,
  emergency_contact jsonb,
  photo_consent     boolean not null default false,
  medical_treatment_consent boolean not null default false,

  notes             text,
  tags              text[],
  source            text,          -- instagram | referral | walk-in | ...
  utm               jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index on athletes (organization_id, status);
create index on athletes (organization_id, date_of_birth);
create index on athletes (household_id);

-- Idade e faixa etária calculadas, nunca armazenadas
create or replace function athlete_age(dob date) returns int
language sql immutable as $$ select extract(year from age(dob))::int $$;

-- Faixa "U" do futebol americano de base: o ano de nascimento define
create or replace function athlete_age_group(dob date) returns text
language sql stable as $$
  select 'U' || (extract(year from current_date)::int
                 - extract(year from dob)::int
                 + case when extract(month from current_date) >= 8 then 1 else 0 end)
$$;

create table guardian_athletes (
  guardian_id  uuid not null references guardians(id) on delete cascade,
  athlete_id   uuid not null references athletes(id) on delete cascade,
  can_pickup   boolean not null default true,
  can_pay      boolean not null default true,
  can_receive_comms boolean not null default true,
  primary key (guardian_id, athlete_id)
);
```

**Sobre `athletes.date_of_birth` e não `age`:** o formulário atual coleta data de nascimento e a elegibilidade dos camps é definida por ano de nascimento (2013–2018). Guardar idade é um bug esperando a virada do ano. A função `athlete_age_group` implementa a convenção americana onde a temporada vira em agosto.

---

## 4. Estrutura de disponibilidade

O campo mais problemático do formulário atual ("What is the player availability? Please be specific with days and time" em texto livre) vira estrutura:

```jsonc
// athletes.availability
{
  "weekly": [
    { "day": 1, "from": "16:00", "to": "19:00" },  // 0=domingo
    { "day": 3, "from": "16:00", "to": "19:00" },
    { "day": 6, "from": "08:00", "to": "12:00" }
  ],
  "blackouts": [
    { "from": "2026-12-20", "to": "2027-01-05", "reason": "viagem" }
  ],
  "preferred_locations": ["uuid-do-local"],
  "notes": "tem jogo do clube aos domingos"
}
```

Isso é o que torna possível o motor de casamento de disponibilidade ([docs/05](05-features-avancadas-coaches.md#3-motor-de-casamento-de-disponibilidade-availability-matching)). Sem estrutura, é impossível cruzar automaticamente com a agenda dos coaches.

---

## 5. Programas, grupos e agenda

```sql
create type program_type as enum ('camp','small_group','private_1on1','clinic','season','package');

create table programs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  slug             text not null,
  name             text not null,               -- "CA Tempo Summer Camp 2026"
  type             program_type not null,
  description      text,
  hero_image_url   text,
  starts_on        date,
  ends_on          date,
  registration_opens_at  timestamptz,
  registration_closes_at timestamptz,
  min_birth_year   int,                          -- 2018 no camp atual
  max_birth_year   int,                          -- 2013
  genders          text[],
  capacity         int,
  status           text not null default 'draft', -- draft | published | closed | archived
  form_id          uuid,                          -- formulário de inscrição
  waiver_template_id uuid,
  settings         jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, slug)
);

-- Passes / opções de compra dentro de um programa
create table program_options (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  program_id       uuid not null references programs(id) on delete cascade,
  name             text not null,      -- "CA TEMPO FULL CAMP PASS"
  description      text,               -- "Includes 8 days of training + Camp T-Shirt"
  price_cents      int not null,       -- 60000
  capacity         int,
  sessions_included int,
  sort_order       int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Grupo de treino: a unidade operacional da CA Tempo ("U9 Blue")
create table groups (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  program_id       uuid references programs(id) on delete set null,
  name             text not null,               -- "U9 Blue"
  color            text,                        -- cor para o calendário
  skill_focus      text[],                      -- finishing | build-up | 1v1 ...
  age_group        text,                        -- U9
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

create table group_members (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  athlete_id    uuid not null references athletes(id) on delete cascade,
  status        text not null default 'active',   -- active | trial | waitlist | removed
  joined_at     timestamptz not null default now(),
  left_at       timestamptz,
  unique (group_id, athlete_id)
);

create table group_coaches (
  group_id   uuid not null references groups(id) on delete cascade,
  coach_id   uuid not null references profiles(id) on delete cascade,
  is_lead    boolean not null default false,
  primary key (group_id, coach_id)
);

create table locations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  address          text,
  city             text,
  state            text,
  postal_code      text,
  latitude         numeric(9,6),
  longitude        numeric(9,6),
  map_url          text,
  field_count      int default 1,
  surface          text,               -- grass | turf | indoor
  has_lights       boolean,
  parking_notes    text,
  access_notes     text,               -- "portão 3, entrar pela rua lateral"
  hourly_cost_cents int,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
```

### Sessões

```sql
create type session_status as enum ('scheduled','canceled','completed','postponed');

-- Regra de recorrência
create table session_series (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  group_id         uuid references groups(id) on delete cascade,
  program_id       uuid references programs(id) on delete cascade,
  rrule            text not null,        -- RFC 5545
  starts_on        date not null,
  ends_on          date,
  start_time       time not null,
  duration_minutes int not null,
  location_id      uuid references locations(id),
  materialized_until date,
  created_at       timestamptz not null default now()
);

create table sessions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  series_id        uuid references session_series(id) on delete set null,
  group_id         uuid references groups(id) on delete set null,
  program_id       uuid references programs(id) on delete set null,
  athlete_id       uuid references athletes(id) on delete set null,  -- preenchido em 1:1

  title            text,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  location_id      uuid references locations(id),
  field_label      text,                       -- "Field 3"
  capacity         int,

  status           session_status not null default 'scheduled',
  canceled_at      timestamptz,
  canceled_by      uuid references profiles(id),
  cancellation_reason text,
  cancellation_policy_applied text,            -- credit | charge | waived
  weather_snapshot jsonb,

  session_plan_id  uuid,                       -- plano de treino aplicado
  coach_notes      text,                       -- visível ao staff
  is_public        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint session_time_valid check (ends_at > starts_at)
);

create index on sessions (organization_id, starts_at);
create index on sessions (group_id, starts_at);
create index on sessions using gist (tstzrange(starts_at, ends_at));

create table session_coaches (
  session_id  uuid not null references sessions(id) on delete cascade,
  coach_id    uuid not null references profiles(id) on delete cascade,
  role        text not null default 'lead',    -- lead | assistant
  rate_cents  int,                              -- para cálculo de pagamento
  primary key (session_id, coach_id)
);

-- Disponibilidade recorrente dos coaches
create table coach_availability (
  id           uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  coach_id     uuid not null references profiles(id) on delete cascade,
  day_of_week  int not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  location_id  uuid references locations(id),
  effective_from date,
  effective_to   date,
  created_at   timestamptz not null default now()
);

-- Bloqueios pontuais (férias, compromisso)
create table coach_time_off (
  id           uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  coach_id     uuid not null references profiles(id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  reason       text,
  created_at   timestamptz not null default now()
);
```

### Presença

```sql
-- RSVP da família tem três estados: 'invited' = "Sem resposta" (default),
-- 'confirmed' = "Sim", 'declined' = "Não". Os demais são marcados pelo coach na chamada.
create type attendance_status as enum
  ('invited','confirmed','declined','present','absent','late','excused','no_show');

create table session_attendance (
  id             uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id     uuid not null references sessions(id) on delete cascade,
  athlete_id     uuid not null references athletes(id) on delete cascade,
  status         attendance_status not null default 'invited',

  responded_at   timestamptz,
  responded_by   uuid references profiles(id),      -- qual responsável respondeu
  checked_in_at  timestamptz,
  checked_in_by  uuid references profiles(id),
  check_in_method text,                             -- manual | qr | self

  is_makeup      boolean not null default false,
  makeup_for_session_id uuid references sessions(id),
  credit_issued  boolean not null default false,
  rpe            int check (rpe between 1 and 10),  -- carga percebida
  coach_note     text,                              -- nota do coach sobre este atleta nesta sessão

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (session_id, athlete_id)
);

create index on session_attendance (athlete_id, created_at desc);
create index on session_attendance (organization_id, status);

create table session_waitlist (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  athlete_id  uuid not null references athletes(id) on delete cascade,
  position    int not null,
  notified_at timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (session_id, athlete_id)
);
```

---

## 6. Formulários, inscrições e waivers

```sql
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
  schema       jsonb not null,                 -- definição dos campos + lógica condicional
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
  created_at       timestamptz not null default now()
);

create index on form_submissions using gin (data jsonb_path_ops);
```

### Schema JSON dos formulários

```jsonc
{
  "sections": [
    {
      "id": "athlete",
      "title": "Athlete Information",
      "fields": [
        { "id": "first_name", "type": "text", "label": "Athlete's First Name", "required": true,
          "mapsTo": "athlete.first_name" },
        { "id": "dob", "type": "date", "label": "Birth Date", "required": true,
          "mapsTo": "athlete.date_of_birth",
          "validation": { "minYear": 2013, "maxYear": 2018 } },
        { "id": "level", "type": "select", "label": "Current Playing Level",
          "options": ["GOLD","PREMIER","ECNL","PRE-ECNL","ECNLRL","PRE-ECNLRL","MLS","GA"],
          "mapsTo": "athlete.playing_level" },
        { "id": "shirt", "type": "select", "label": "Shirt Size",
          "options": ["Youth S","Youth M","Youth L","Youth XL","Adult S","Adult M"],
          "mapsTo": "athlete.jersey_size",
          "showIf": { "field": "program.type", "equals": "camp" } }
      ]
    }
  ],
  "pricing": {
    "source": "program_options",
    "discounts": []
  }
}
```

O `mapsTo` é a peça que diferencia isto do JotForm: cada campo sabe em qual coluna do domínio ele desemboca. A submissão não é uma linha morta — ela cria e atualiza entidades reais.

### Inscrições

```sql
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

  invoice_id        uuid,
  source            text,
  utm               jsonb,
  admin_notes       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on registrations (organization_id, status);
create index on registrations (program_id, status);
```

### Waivers e assinatura eletrônica

```sql
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
  signature_data     text not null,           -- data URL do canvas ou texto
  document_hash      text not null,           -- SHA-256 do texto exato assinado
  pdf_url            text,

  -- trilha de auditoria exigida por ESIGN/UETA
  signed_at          timestamptz not null default now(),
  ip_address         inet not null,
  user_agent         text not null,
  consent_to_electronic_signature boolean not null default true,

  expires_on         date,                    -- waivers costumam valer por temporada
  revoked_at         timestamptz,
  created_at         timestamptz not null default now()
);

create index on waiver_signatures (athlete_id, signed_at desc);
```

**`document_hash` é o detalhe que dá validade ao waiver.** Guardar "o Fulano assinou" não vale nada se o texto puder mudar depois. Guardamos o hash SHA-256 do documento exato que estava na tela, o que torna a assinatura verificável e não repudiável.

---

## 7. Financeiro

```sql
create table price_rules (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  type             text not null,     -- early_bird | promo_code | scholarship
  code             text,
  amount_cents     int,
  percent_off      numeric(5,2),
  applies_to       jsonb,             -- { programIds: [], optionIds: [] }
  max_uses         int,
  used_count       int not null default 0,
  starts_at        timestamptz,
  ends_at          timestamptz,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create type invoice_status as enum ('draft','open','paid','partially_paid','void','uncollectible','refunded');

create table invoices (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  household_id     uuid references households(id) on delete set null,
  athlete_id       uuid references athletes(id) on delete set null,
  registration_id  uuid references registrations(id) on delete set null,

  number           text not null,
  status           invoice_status not null default 'draft',
  subtotal_cents   int not null default 0,
  discount_cents   int not null default 0,
  tax_cents        int not null default 0,
  total_cents      int not null default 0,
  paid_cents       int not null default 0,
  balance_cents    int generated always as (total_cents - paid_cents) stored,

  currency         char(3) not null default 'USD',
  due_date         date,
  issued_at        timestamptz,
  paid_at          timestamptz,
  voided_at        timestamptz,

  stripe_invoice_id      text,
  stripe_payment_intent_id text,
  hosted_url       text,
  pdf_url          text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, number)
);

create table invoice_lines (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references invoices(id) on delete cascade,
  description   text not null,
  quantity      int not null default 1,
  unit_cents    int not null,
  amount_cents  int not null,
  program_option_id uuid references program_options(id),
  price_rule_id uuid references price_rules(id),
  sort_order    int not null default 0
);

create type payment_method as enum ('card','ach','paypal','cash','check','zelle','venmo','credit','other');

create table payments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  invoice_id       uuid references invoices(id) on delete set null,
  household_id     uuid references households(id) on delete set null,

  amount_cents     int not null,
  fee_cents        int not null default 0,       -- taxa cobrada pelo gateway
  net_cents        int generated always as (amount_cents - fee_cents) stored,
  method           payment_method not null,
  status           text not null default 'succeeded',  -- pending | succeeded | failed | refunded

  stripe_payment_intent_id text,
  stripe_charge_id text,
  external_reference text,                       -- nº do cheque, id do Zelle
  received_at      timestamptz not null default now(),
  recorded_by      uuid references profiles(id), -- quem lançou o pagamento offline
  notes            text,
  created_at       timestamptz not null default now()
);

create index on payments (organization_id, received_at desc);

create table refunds (
  id             uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  payment_id     uuid not null references payments(id) on delete cascade,
  amount_cents   int not null,
  reason         text,
  stripe_refund_id text,
  issued_by      uuid references profiles(id),
  created_at     timestamptz not null default now()
);

-- Crédito na conta da família (usado quando o clube cancela uma sessão)
create table account_credits (
  id             uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  household_id   uuid not null references households(id) on delete cascade,
  amount_cents   int not null,                 -- positivo credita, negativo consome
  reason         text not null,
  session_id     uuid references sessions(id),
  invoice_id     uuid references invoices(id),
  issued_by      uuid references profiles(id),
  expires_on     date,
  created_at     timestamptz not null default now()
);

create table payment_plans (
  id             uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id     uuid not null references invoices(id) on delete cascade,
  installments   int not null,
  interval       text not null default 'month',
  next_charge_at timestamptz,
  status         text not null default 'active',
  stripe_subscription_id text,
  created_at     timestamptz not null default now()
);
```

**`fee_cents` em `payments` existe por um motivo específico:** a reunião deixou a escolha de gateway em aberto justamente por causa das taxas. Registrar a taxa real de cada transação transforma essa discussão em dado — em três meses dá para mostrar exatamente quanto cada método custou. Ver [docs/07](07-pagamentos-e-taxas.md).

---

## 8. CRM de prospects

```sql
create type lead_stage as enum
  ('new','contacted','trial_scheduled','trial_completed','converted','lost','nurture');

create table leads (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  athlete_id       uuid references athletes(id) on delete set null,
  submission_id    uuid references form_submissions(id) on delete set null,

  athlete_name     text not null,
  athlete_dob      date,
  guardian_name    text,
  guardian_email   text,
  guardian_phone   text,

  stage            lead_stage not null default 'new',
  interest         text[],
  suggested_group_id uuid references groups(id),
  assigned_to      uuid references profiles(id),

  source           text,             -- instagram | referral | google | walk-in
  utm              jsonb,
  score            int,              -- lead scoring
  next_action      text,
  next_action_at   timestamptz,
  last_contacted_at timestamptz,
  lost_reason      text,
  converted_at     timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on leads (organization_id, stage, next_action_at);

create table lead_activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  type        text not null,        -- note | email | call | sms | stage_change | trial
  content     text,
  metadata    jsonb,
  actor_id    uuid references profiles(id),
  created_at  timestamptz not null default now()
);
```

---

## 9. Comunicação

```sql
create table message_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  key              text not null,        -- session_canceled | payment_reminder | welcome
  channel          text not null,        -- email | sms | push
  locale           text not null default 'en',
  subject          text,
  body             text not null,        -- suporta {{variáveis}}
  is_active        boolean not null default true,
  unique (organization_id, key, channel, locale)
);

create table campaigns (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  channel          text not null,
  segment          jsonb not null,       -- filtros: grupo, faixa etária, status de pagamento
  subject          text,
  body             text not null,
  scheduled_at     timestamptz,
  sent_at          timestamptz,
  status           text not null default 'draft',
  stats            jsonb not null default '{}',
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now()
);

create table messages (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  campaign_id      uuid references campaigns(id) on delete set null,
  template_key     text,
  channel          text not null,
  to_address       text not null,
  recipient_user_id uuid references profiles(id),
  athlete_id       uuid references athletes(id),
  session_id       uuid references sessions(id),

  subject          text,
  body             text,
  status           text not null default 'queued',  -- queued|sent|delivered|opened|bounced|failed
  provider         text,
  provider_message_id text,
  error            text,
  idempotency_key  text unique,
  sent_at          timestamptz,
  delivered_at     timestamptz,
  opened_at        timestamptz,
  created_at       timestamptz not null default now()
);

create index on messages (organization_id, created_at desc);

create table notification_preferences (
  user_id        uuid primary key references profiles(id) on delete cascade,
  email_enabled  boolean not null default true,
  sms_enabled    boolean not null default true,
  push_enabled   boolean not null default true,
  quiet_hours    jsonb,                 -- { from: "21:00", to: "07:00" }
  unsubscribed_categories text[]
);

create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique,
  keys       jsonb not null,
  created_at timestamptz not null default now()
);
```

---

## 10. Club Library

```sql
create type library_visibility as enum ('staff','coaches','families','public','group');

create table library_items (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  title            text not null,
  description      text,
  type             text not null,        -- video | pdf | image | link | drill | form
  visibility       library_visibility not null default 'staff',
  visible_group_ids uuid[],

  -- mídia
  storage_path     text,                 -- Supabase Storage
  stream_uid       text,                 -- Cloudflare Stream
  thumbnail_url    text,
  duration_seconds int,
  external_url     text,

  -- metadados de drill
  skill_categories text[],               -- passing | finishing | 1v1 | pressing ...
  age_groups       text[],
  difficulty       int check (difficulty between 1 and 5),
  players_min      int,
  players_max      int,
  space_required   text,                 -- "20x30 yards"
  equipment        text[],
  objective        text,
  coaching_points  text[],
  variations       text,
  diagram_url      text,

  tags             text[],
  view_count       int not null default 0,
  uploaded_by      uuid references profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on library_items using gin (skill_categories);
create index on library_items using gin (tags);

create table library_collections (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  description      text,
  visibility       library_visibility not null default 'staff',
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now()
);

create table library_collection_items (
  collection_id uuid not null references library_collections(id) on delete cascade,
  item_id       uuid not null references library_items(id) on delete cascade,
  sort_order    int not null default 0,
  primary key (collection_id, item_id)
);

-- Plano de treino montado a partir de drills
create table session_plans (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  objective        text,
  age_groups       text[],
  total_minutes    int,
  blocks           jsonb not null,   -- [{ itemId, minutes, notes }]
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now()
);
```

---

## 11. Avaliação e desenvolvimento

```sql
create table evaluation_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  version          int not null default 1,
  age_groups       text[],
  scale_min        int not null default 1,
  scale_max        int not null default 10,
  criteria         jsonb not null,   -- [{ id, category, label, weight, description }]
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
```

Estrutura de `criteria`, alinhada aos quatro pilares clássicos de desenvolvimento no futebol:

```jsonc
[
  { "id": "first_touch",   "category": "technical", "label": "First touch",           "weight": 1 },
  { "id": "passing",       "category": "technical", "label": "Passing accuracy",      "weight": 1 },
  { "id": "finishing",     "category": "technical", "label": "Finishing",             "weight": 1.5 },
  { "id": "1v1_attack",    "category": "technical", "label": "1v1 attacking",         "weight": 1 },
  { "id": "scanning",      "category": "tactical",  "label": "Scanning / awareness",  "weight": 1.5 },
  { "id": "decision",      "category": "tactical",  "label": "Decision making",       "weight": 1.5 },
  { "id": "positioning",   "category": "tactical",  "label": "Positioning",           "weight": 1 },
  { "id": "speed",         "category": "physical",  "label": "Speed",                 "weight": 1 },
  { "id": "agility",       "category": "physical",  "label": "Agility / change of direction", "weight": 1 },
  { "id": "endurance",     "category": "physical",  "label": "Endurance",             "weight": 0.5 },
  { "id": "coachability",  "category": "mental",    "label": "Coachability",          "weight": 1.5 },
  { "id": "competitiveness","category": "mental",   "label": "Competitiveness",       "weight": 1 },
  { "id": "resilience",    "category": "mental",    "label": "Resilience",            "weight": 1 }
]
```

```sql
create table evaluations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  template_id      uuid not null references evaluation_templates(id),
  athlete_id       uuid not null references athletes(id) on delete cascade,
  coach_id         uuid not null references profiles(id),
  session_id       uuid references sessions(id) on delete set null,

  period_start     date,
  period_end       date,
  scores           jsonb not null,        -- { "first_touch": 7, "passing": 6, ... }
  overall_score    numeric(4,2),          -- média ponderada calculada
  strengths        text,
  areas_to_improve text,
  family_summary   text,                  -- versão que a família vê
  private_notes    text,                  -- só o staff vê

  status           text not null default 'draft',  -- draft | shared
  shared_at        timestamptz,
  pdf_url          text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on evaluations (athlete_id, created_at desc);

-- Plano de desenvolvimento individual
create table development_plans (
  id             uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  athlete_id     uuid not null references athletes(id) on delete cascade,
  coach_id       uuid references profiles(id),
  title          text not null,
  focus_areas    text[],
  starts_on      date,
  ends_on        date,
  status         text not null default 'active',
  created_at     timestamptz not null default now()
);

create table development_goals (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references development_plans(id) on delete cascade,
  title          text not null,
  description    text,
  metric         text,
  target_value   text,
  current_value  text,
  due_on         date,
  status         text not null default 'open',   -- open | achieved | dropped
  achieved_at    timestamptz,
  sort_order     int not null default 0
);

-- Clipes de vídeo do atleta com anotação do coach
create table athlete_clips (
  id             uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  athlete_id     uuid not null references athletes(id) on delete cascade,
  session_id     uuid references sessions(id) on delete set null,
  stream_uid     text,
  thumbnail_url  text,
  title          text,
  uploaded_by    uuid references profiles(id),
  visibility     library_visibility not null default 'families',
  is_highlight   boolean not null default false,
  created_at     timestamptz not null default now()
);

create table clip_annotations (
  id            uuid primary key default gen_random_uuid(),
  clip_id       uuid not null references athlete_clips(id) on delete cascade,
  timestamp_ms  int not null,
  body          text not null,
  author_id     uuid references profiles(id),
  created_at    timestamptz not null default now()
);
```

---

## 12. Operação e auditoria

```sql
create table audit_log (
  id               bigserial primary key,
  organization_id  uuid references organizations(id) on delete cascade,
  actor_id         uuid references profiles(id),
  actor_email      text,
  action           text not null,          -- session.canceled | payment.refunded | athlete.deleted
  entity_type      text not null,
  entity_id        uuid,
  before           jsonb,
  after            jsonb,
  ip_address       inet,
  user_agent       text,
  created_at       timestamptz not null default now()
);

create index on audit_log (organization_id, created_at desc);
create index on audit_log (entity_type, entity_id);

create table job_runs (
  id           uuid primary key default gen_random_uuid(),
  job_name     text not null,
  status       text not null,
  payload      jsonb,
  error        text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  idempotency_key text unique
);

create table webhook_events (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null,          -- stripe | twilio | resend
  event_id       text not null,
  event_type     text not null,
  payload        jsonb not null,
  processed_at   timestamptz,
  error          text,
  created_at     timestamptz not null default now(),
  unique (provider, event_id)
);
```

A tabela `webhook_events` com `unique (provider, event_id)` é o mecanismo de idempotência: a Stripe reenvia eventos, e sem isso um `payment_intent.succeeded` duplicado credita a fatura duas vezes.

---

## 13. Row Level Security

O padrão é o mesmo em todas as tabelas: negar tudo, depois abrir por papel.

```sql
alter table athletes enable row level security;

-- Staff vê todos os atletas da própria organização
create policy athletes_staff_all on athletes
  for all
  using (is_staff(organization_id))
  with check (is_staff(organization_id));

-- Responsável e o próprio atleta veem apenas os seus
create policy athletes_family_read on athletes
  for select
  using (id in (select auth_athlete_ids()));

-- Responsável pode atualizar dados de contato e saúde do próprio filho
create policy athletes_family_update on athletes
  for update
  using (id in (select auth_athlete_ids()))
  with check (id in (select auth_athlete_ids()));
```

```sql
alter table sessions enable row level security;

create policy sessions_staff_all on sessions
  for all using (is_staff(organization_id)) with check (is_staff(organization_id));

-- Família vê sessão em que o filho está no roster ou no grupo dele
create policy sessions_family_read on sessions
  for select using (
    is_public and (
      exists (select 1 from session_attendance sa
               where sa.session_id = sessions.id
                 and sa.athlete_id in (select auth_athlete_ids()))
      or exists (select 1 from group_members gm
                  where gm.group_id = sessions.group_id
                    and gm.status = 'active'
                    and gm.athlete_id in (select auth_athlete_ids()))
    )
  );
```

```sql
alter table session_attendance enable row level security;

create policy attendance_staff_all on session_attendance
  for all using (is_staff(organization_id)) with check (is_staff(organization_id));

create policy attendance_family_read on session_attendance
  for select using (athlete_id in (select auth_athlete_ids()));

-- Família só faz RSVP (Sim / Não / Sem resposta) — nunca marca presença
create policy attendance_family_respond on session_attendance
  for update
  using (athlete_id in (select auth_athlete_ids()))
  with check (
    athlete_id in (select auth_athlete_ids())
    and status in ('confirmed','declined','invited')  -- invited = "Sem resposta"
  );
```

```sql
-- Financeiro: apenas owner/admin no lado do clube; família só o que é dela
alter table invoices enable row level security;

create policy invoices_admin_all on invoices
  for all
  using (has_org_role(organization_id, array['owner','admin']::org_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::org_role[]));

create policy invoices_family_read on invoices
  for select using (
    household_id in (
      select g.household_id from guardians g where g.user_id = auth.uid()
    )
  );
```

```sql
-- Avaliações: notas privadas nunca chegam à família
alter table evaluations enable row level security;

create policy evaluations_staff_all on evaluations
  for all using (is_staff(organization_id)) with check (is_staff(organization_id));

create policy evaluations_family_read on evaluations
  for select using (
    status = 'shared' and athlete_id in (select auth_athlete_ids())
  );
```

O campo `private_notes` fica na mesma linha que a família consegue ler quando `status = 'shared'`. RLS opera em linhas, não em colunas — então a proteção real vem de **nunca selecionar essa coluna nas queries do portal da família**, reforçada por uma view:

```sql
create view family_evaluations with (security_invoker = true) as
  select id, organization_id, athlete_id, coach_id, period_start, period_end,
         scores, overall_score, strengths, areas_to_improve, family_summary,
         shared_at, pdf_url
    from evaluations
   where status = 'shared';
```

O portal da família consulta apenas `family_evaluations`. A alternativa mais rígida seria mover `private_notes` para uma tabela separada `evaluation_private_notes` com política própria — recomendo fazer isso se o volume de notas sensíveis crescer.

### Testes de RLS são obrigatórios

Para cada tabela, um teste pgTAP que autentica como cada persona e verifica exatamente quantas linhas ela enxerga. Isto é o que impede o pior incidente possível neste produto: um pai enxergando o telefone e o endereço dos filhos das outras famílias.

```sql
-- supabase/tests/rls_athletes.test.sql (esboço)
begin;
select plan(4);

set local role authenticated;
set local request.jwt.claims = '{"sub":"<uuid-do-pai-A>"}';
select is( (select count(*) from athletes)::int, 2, 'pai A vê apenas os 2 filhos dele' );

set local request.jwt.claims = '{"sub":"<uuid-do-coach>"}';
select is( (select count(*) from athletes)::int, 47, 'coach vê todos da organização' );

set local request.jwt.claims = '{"sub":"<uuid-de-outra-org>"}';
select is( (select count(*) from athletes)::int, 0, 'usuário de outra org não vê nada' );

select throws_ok(
  $$ update athletes set first_name = 'x' where id = '<atleta-de-outro-pai>' $$,
  'nenhuma linha afetada por RLS'
);

select * from finish();
rollback;
```

---

## 14. Views e funções de apoio

```sql
-- Roster de uma sessão com tudo que o coach precisa em uma consulta
create view session_roster with (security_invoker = true) as
select
  s.id                as session_id,
  s.starts_at,
  a.id                as athlete_id,
  a.first_name, a.last_name, a.photo_url,
  athlete_age(a.date_of_birth) as age,
  a.medical_notes, a.allergies, a.emergency_contact,
  sa.status           as attendance_status,
  sa.checked_in_at,
  g.first_name || ' ' || g.last_name as guardian_name,
  g.phone             as guardian_phone,
  g.email             as guardian_email,
  coalesce(inv.balance_cents, 0) as outstanding_balance_cents,
  exists (
    select 1 from waiver_signatures ws
     where ws.athlete_id = a.id
       and ws.revoked_at is null
       and (ws.expires_on is null or ws.expires_on >= current_date)
  ) as waiver_valid
from sessions s
join session_attendance sa on sa.session_id = s.id
join athletes a           on a.id = sa.athlete_id
left join guardian_athletes ga on ga.athlete_id = a.id
left join guardians g          on g.id = ga.guardian_id and g.is_primary
left join lateral (
  select sum(balance_cents) as balance_cents
    from invoices i
   where i.household_id = a.household_id and i.status in ('open','partially_paid')
) inv on true;
```

Essa view sozinha atende o RF-02.2 e RF-02.3 — o requisito que Carlos nomeou como prioridade. Clicar no horário roda uma query e devolve nome, foto, idade, alerta médico, contato do pai, status de presença, saldo devedor e validade do waiver.

```sql
-- Detecção de conflito antes de salvar uma sessão
create or replace function detect_session_conflicts(
  p_org uuid, p_starts timestamptz, p_ends timestamptz,
  p_location uuid, p_coach_ids uuid[], p_exclude_session uuid default null
) returns table (conflict_type text, conflict_id uuid, detail text)
language sql stable as $$
  -- campo ocupado
  select 'location', s.id, s.title
    from sessions s
   where s.organization_id = p_org
     and s.location_id = p_location
     and s.status = 'scheduled'
     and (p_exclude_session is null or s.id <> p_exclude_session)
     and tstzrange(s.starts_at, s.ends_at) && tstzrange(p_starts, p_ends)
  union all
  -- coach em duas sessões ao mesmo tempo
  select 'coach', s.id, s.title
    from sessions s join session_coaches sc on sc.session_id = s.id
   where s.organization_id = p_org
     and sc.coach_id = any(p_coach_ids)
     and s.status = 'scheduled'
     and (p_exclude_session is null or s.id <> p_exclude_session)
     and tstzrange(s.starts_at, s.ends_at) && tstzrange(p_starts, p_ends)
  union all
  -- coach fora da disponibilidade declarada
  select 'availability', ct.id, 'coach indisponível'
    from coach_time_off ct
   where ct.coach_id = any(p_coach_ids)
     and tstzrange(ct.starts_at, ct.ends_at) && tstzrange(p_starts, p_ends);
$$;
```

---

## 15. Índices e performance

As consultas quentes e seus índices:

| Consulta | Índice |
|----------|--------|
| Calendário do mês | `sessions (organization_id, starts_at)` |
| Detecção de conflito | GiST em `tstzrange(starts_at, ends_at)` |
| Roster de uma sessão | `session_attendance (session_id)` (do unique) |
| Histórico de presença do atleta | `session_attendance (athlete_id, created_at desc)` |
| Busca de atleta por nome | `gin (to_tsvector('simple', first_name || ' ' || last_name))` |
| Pipeline do CRM | `leads (organization_id, stage, next_action_at)` |
| Faturas em aberto | índice parcial `invoices (organization_id) where status in ('open','partially_paid')` |
| Busca na biblioteca | `gin (skill_categories)` e `gin (tags)` |
| Submissões por campo | `gin (data jsonb_path_ops)` |

No volume da CA Tempo (dezenas de atletas, centenas de sessões por temporada) nada disso é gargalo hoje. Estão aqui porque custam nada agora e evitam refatoração quando a base multiplicar por dez.

---

## 16. Migração dos dados atuais

Ordem de importação, respeitando as dependências:

1. `organizations` — CA Tempo Training, timezone, marca
2. `locations` — campos utilizados
3. `profiles` + `memberships` — Arthur, Carlos, staff
4. `programs` + `program_options` — Winter Camp, Summer Camp, treinos por temporada
5. `households` → `guardians` → `athletes` → `guardian_athletes` (a partir do export do JotForm)
6. `groups` + `group_members` (a partir das abas do Google Sheets)
7. `session_series` + `sessions` (a partir da grade da planilha)
8. `invoices` + `payments` — cada "✅ verde" vira uma fatura paga com `method = 'cash'` e nota "migrado da planilha"
9. `waiver_signatures` — waivers históricos entram como `signature_type = 'imported'` com PDF anexado, marcados para recoleta na próxima temporada

**Ponto de atenção:** o waiver assinado no JotForm não tem a mesma trilha de auditoria do nosso modelo. Importamos como registro histórico, mas a recomendação jurídica é recoletar todos os waivers na plataforma nova no início da próxima temporada.

Scripts de importação ficam em `supabase/seed/` e rodam com `service_role`, sempre com `dry-run` primeiro e relatório de linhas rejeitadas.
