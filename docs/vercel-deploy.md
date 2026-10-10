# Deploy na Vercel (monorepo pnpm)

O app Next.js fica em `apps/web`. O `next` está em `apps/web/package.json`, **não** na raiz do repositório.

## Opção A — Recomendada: Root Directory = `apps/web`

1. Vercel → projeto **ca-tempo** → **Settings** → **General**
2. **Root Directory** → **Edit** → digite `apps/web` → **Save**
3. Ative **Include source files outside of the Root Directory in the Build Step** (necessário para `@ca-tempo/domain` e `@ca-tempo/db`)
4. **Redeploy** (Deployments → ⋯ → Redeploy)

Com isso, a Vercel usa `apps/web/vercel.json` e detecta o Next.js automaticamente.

### Variáveis de ambiente (Production)

Sem estas o app não sobe:

```
NEXT_PUBLIC_SUPABASE_URL=https://dbnoddzaqjgtfnymyqjm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key — Settings → API → anon/public>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret — Settings → API → service_role>
NEXT_PUBLIC_SITE_URL=https://ca-tempo.vercel.app
```

Sem estas o app sobe, mas **não cobra ninguém**. A tela de pagamento detecta a
ausência e mostra só o caminho offline (Venmo, dinheiro, cheque), em vez de
oferecer um botão que daria erro:

```
STRIPE_SECRET_KEY=<Developers → API keys. Em produção prefira rk_live_ restrita>
STRIPE_WEBHOOK_SECRET=<whsec_… criado junto com o endpoint de webhook>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<pk_live_…>
```

Sem estas o app sobe e as notificações **ficam na fila** com status `pending`,
visíveis no painel de pagamentos. Nada é perdido: no dia em que a conta Resend
existir, basta preencher e fazer redeploy, sem mudança de código:

```
RESEND_API_KEY=
NOTIFICATIONS_FROM_EMAIL=<remetente de um domínio verificado na Resend>
```

E esta protege o cron que drena a fila. Sem ela a rota responde `503` e fica
fechada, em vez de aberta para qualquer um esvaziar a fila de e-mails:

```
CRON_SECRET=<32 bytes aleatórios>
```

**Importante:** `SUPABASE_SERVICE_ROLE_KEY` deve ser a chave **service_role** (secret), **não** a mesma chave de `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Se estiverem iguais, operações server-side que dependem da service role falham com erro de RLS.

**Nota sobre o cron:** o plano Hobby da Vercel só aceita agendamento **diário**. O `vercel.json` usa `0 11 * * *` por isso — com `0 * * * *` a configuração é recusada na criação do deploy e a branch nem chega a construir, sem aparecer como deploy falho.

Após alterar variáveis na Vercel, faça **Redeploy** (Deployments → ⋯ → Redeploy) para o runtime carregar os novos valores.

**Diagnóstico rápido:** após o deploy, acesse `https://ca-tempo.vercel.app/api/health`. Se `reason` for `invalid_service_role_key`, a chave ainda está errada (`detail`: `same_as_anon` | `not_service_role` | `missing`).

### Erro RLS ao criar formulário (`violates row-level security policy for table "forms"`)

**Causa:** `SUPABASE_SERVICE_ROLE_KEY` incorreta (geralmente a anon key no lugar da service role).

**Correção:**

1. Supabase Dashboard → **Settings → API** → copiar **service_role** (secret)
2. Vercel → **Settings → Environment Variables** → atualizar `SUPABASE_SERVICE_ROLE_KEY`
3. Redeploy

O CRUD do coach (`/coach/forms`) usa o JWT do usuário logado + RLS `forms_staff_all`, então funciona mesmo sem service role correta. A service role continua necessária para URLs assinadas de storage e upload de PDF de waiver.

### Erro RLS ao submeter inscrição (`violates row-level security policy for table "form_submissions"`)

**Causa:** INSERT direto em `form_submissions` com JWT anon (policy RLS bloqueia).

**Correção (código + banco):**

1. Aplicar migration `20260823120000_public_registration_submit.sql` no Supabase de produção:
   ```bash
   supabase login
   supabase link --project-ref dbnoddzaqjgtfnymyqjm
   supabase db push
   ```
2. Redeploy na Vercel (o app chama `submit_public_registration` via RPC `SECURITY DEFINER`)
3. Mapear campos do formulário no editor (`athlete.first_name`, `athlete.last_name`, `athlete.date_of_birth`, `guardian.phone`, etc.) — sem isso, a RPC roda mas retorna `incomplete_mapping`

A inscrição passa a funcionar **mesmo** com `SUPABASE_SERVICE_ROLE_KEY` incorreta. Corrija a service role mesmo assim para PDF/storage.

### Validar migrations no Supabase de produção

No SQL Editor do Supabase, execute:

```sql
select policyname from pg_policies where tablename = 'forms';
```

Deve listar `forms_staff_all` e `forms_public_read`. Se vazio, aplique as migrations:

```bash
supabase link --project-ref dbnoddzaqjgtfnymyqjm
supabase db push
```

## Opção B — Root Directory na raiz (`.`)

Se o Root Directory ficar na raiz do repo, use o `vercel.json` na raiz (já incluído no projeto). Ele declara `next` no `package.json` raiz só para detecção do framework e aponta o output para `apps/web/.next`.

**Prefira a Opção A** — é o padrão oficial da Vercel para monorepos.

## Validar após deploy

- https://ca-tempo.vercel.app/api/health → `200`
- https://ca-tempo.vercel.app/login → página de login

## Erro comum

```
No Next.js version detected
```

**Causa:** Root Directory aponta para a raiz, mas `next` está só em `apps/web/package.json`.

**Correção:** Opção A acima.
