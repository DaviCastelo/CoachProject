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
  surface          text,
  has_lights       boolean,
  parking_notes    text,
  access_notes     text,
  hourly_cost_cents int,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create index on locations (organization_id, is_active);
