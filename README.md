# CA Tempo Platform

Plataforma web para a **CA Tempo Training** — academia de treinamento de futebol.

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- **Supabase** (Postgres + Auth + RLS)
- **Tailwind CSS v4** + shadcn/ui
- **pnpm** monorepo

## Estrutura

```
apps/web/          # Aplicação Next.js
packages/domain/   # Regras de negócio puras + Vitest
packages/db/       # Tipos gerados do Supabase
supabase/          # Migrations SQL + testes pgTAP
e2e/               # Playwright E2E
```

## Setup local

```bash
# Pré-requisitos: Node 22+, pnpm, Docker (Supabase local)
cp .env.example apps/web/.env.local
# Preencher variáveis Supabase (use valores do supabase start)

pnpm install
supabase start
supabase db reset    # migrations + seed
pnpm dev             # http://localhost:3000
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Build de produção |
| `pnpm test` | Vitest (packages/domain) |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm db:types` | Gera tipos TypeScript do Supabase |

## Testes

```bash
supabase test db      # pgTAP — isolamento RLS (bloqueante)
pnpm test             # Vitest unitários
pnpm test:e2e         # Playwright
```

## Deploy

- **Vercel:** `ca-tempo.vercel.app`
- **Supabase:** projeto `ca-tempo-production`
- **Vercel monorepo:** definir **Root Directory** = `apps/web` — ver [docs/vercel-deploy.md](docs/vercel-deploy.md)
- Ver [docs/setup-auth.md](docs/setup-auth.md) para configurar auth e serviços externos.

## Usuários de teste (seed local)

| Email | Papel |
|-------|-------|
| arthur@catempo.test | owner |
| coach@catempo.test | coach |
| guardian@catempo.test | guardian |

Senha: `testpassword123`
