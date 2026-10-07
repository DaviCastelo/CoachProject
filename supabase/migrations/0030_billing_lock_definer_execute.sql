-- Mesma faxina da 0007, agora para a função de cobrança.
--
-- `create function` concede `execute` a `public` por padrão, e no Supabase isso
-- publica a função em /rest/v1/rpc/<nome> para o papel `anon`. O linter de
-- segurança do projeto pegou `can_view_invoice` exposta assim.
--
-- Na prática ela devolveria sempre false para quem não está logado (auth.uid()
-- é nulo e is_staff também), mas visitante não tem o que fazer perguntando se
-- pode ver uma fatura. Superfície que não precisa existir, não existe.
--
-- `authenticated` CONTINUA com execute de propósito: a policy
-- `invoices_family_read` chama a função, e policy roda com o papel do chamador.
-- Sem este grant a família deixaria de ver a própria fatura.

revoke all on function can_view_invoice(uuid) from public, anon;
grant execute on function can_view_invoice(uuid) to authenticated;
