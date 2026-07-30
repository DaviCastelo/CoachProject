create table org_settings (
  organization_id  uuid not null references organizations(id) on delete cascade,
  key              text not null,
  value            jsonb not null default 'true',
  updated_at       timestamptz not null default now(),
  primary key (organization_id, key)
);
