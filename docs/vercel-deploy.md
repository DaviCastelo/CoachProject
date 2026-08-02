# Deploy na Vercel (monorepo pnpm)

O app Next.js fica em `apps/web`. O `next` está em `apps/web/package.json`, **não** na raiz do repositório.

## Opção A — Recomendada: Root Directory = `apps/web`

1. Vercel → projeto **ca-tempo** → **Settings** → **General**
2. **Root Directory** → **Edit** → digite `apps/web` → **Save**
3. Ative **Include source files outside of the Root Directory in the Build Step** (necessário para `@ca-tempo/domain` e `@ca-tempo/db`)
4. **Redeploy** (Deployments → ⋯ → Redeploy)

Com isso, a Vercel usa `apps/web/vercel.json` e detecta o Next.js automaticamente.

### Variáveis de ambiente (Production)

```
NEXT_PUBLIC_SUPABASE_URL=https://dbnoddzaqjgtfnymyqjm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key — Settings → API → anon/public>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret — Settings → API → service_role>
NEXT_PUBLIC_SITE_URL=https://ca-tempo.vercel.app
COOKIE_SECRET=<min 32 caracteres aleatórios>
```

**Importante:** `SUPABASE_SERVICE_ROLE_KEY` deve ser a chave **service_role** (secret), **não** a mesma chave de `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Se estiverem iguais, operações server-side que dependem da service role falham com erro de RLS.

Após alterar variáveis na Vercel, faça **Redeploy** (Deployments → ⋯ → Redeploy) para o runtime carregar os novos valores.

### Erro RLS ao criar formulário (`violates row-level security policy for table "forms"`)

**Causa:** `SUPABASE_SERVICE_ROLE_KEY` incorreta (geralmente a anon key no lugar da service role).

**Correção:**

1. Supabase Dashboard → **Settings → API** → copiar **service_role** (secret)
2. Vercel → **Settings → Environment Variables** → atualizar `SUPABASE_SERVICE_ROLE_KEY`
3. Redeploy

O CRUD do coach (`/coach/forms`) usa o JWT do usuário logado + RLS `forms_staff_all`, então funciona mesmo sem service role correta. A service role continua necessária para o pipeline público de inscrição (`/register/...`) e URLs assinadas de storage.

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
