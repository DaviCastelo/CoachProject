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
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role>
NEXT_PUBLIC_SITE_URL=https://ca-tempo.vercel.app
COOKIE_SECRET=<min 32 caracteres aleatórios>
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
