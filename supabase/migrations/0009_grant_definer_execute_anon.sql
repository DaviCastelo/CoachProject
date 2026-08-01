-- A 0007 revogou EXECUTE de anon nas auxiliares de RLS, mas isso quebra qualquer
-- SELECT feito como anon (ex.: /api/health, e leituras públicas futuras da Fase 2)
-- em tabelas cujas policies chamam essas funções (organizations, locations,
-- org_settings, athletes, households, guardian_athletes).
--
-- Ao avaliar a policy, o Postgres executa a função no contexto do papel que consulta;
-- sem EXECUTE, a query falha com "permission denied for function" em vez de retornar 0 linhas.
--
-- Para anon as funções são seguras: auth.uid() é null, então retornam vazio/false —
-- nenhum dado de outra pessoa é exposto. O WARN do security advisor
-- (anon pode executar SECURITY DEFINER) é cosmético e esperado para helpers de RLS.
grant execute on function auth_org_ids() to anon;
grant execute on function auth_athlete_ids() to anon;
grant execute on function is_staff(uuid) to anon;
grant execute on function has_org_role(uuid, org_role[]) to anon;
