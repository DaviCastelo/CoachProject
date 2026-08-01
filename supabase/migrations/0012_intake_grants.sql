-- Fase 2 — grants para as roles da API nas novas tabelas/enums.
-- As default privileges definidas na 0008 já cobrem tabelas novas, mas reafirmamos
-- explicitamente para garantir (idempotente). RLS continua controlando as linhas.

grant usage on type program_type to authenticated, anon;
grant usage on type registration_status to authenticated, anon;

grant all on all tables in schema public to postgres, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

grant usage, select on all sequences in schema public to authenticated, service_role;
