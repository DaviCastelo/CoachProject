# 02 — Arquitetura e Stack

Você fixou duas peças: **Vercel** para deploy e **Supabase** para dados. Essa restrição já elimina metade das dúvidas, porque as duas juntas formam um par com um caminho canônico bem trilhado. O resto das escolhas abaixo foi feito com três critérios em ordem: (1) um desenvolvedor solo consegue entregar em 45–90 dias, (2) o custo operacional cabe em um fee de $300/mês, (3) nada aqui vira dívida técnica se a plataforma crescer para vários clubes.

---

## 1. Decisão em uma tabela

| Camada | Escolha | Versão-alvo |
|--------|---------|-------------|
| Framework full-stack | **Next.js (App Router)** | 16.2.x |
| Linguagem | **TypeScript** (strict) | 5.x |
| UI runtime | **React Server Components + Server Actions** | React 19 |
| Estilo | **Tailwind CSS v4** | 4.x |
| Biblioteca de componentes | **shadcn/ui** (Radix UI por baixo) | — |
| Banco de dados | **Supabase Postgres** | 17 |
| Autenticação | **Supabase Auth** + `@supabase/ssr` | — |
| Autorização | **Row Level Security** no Postgres | — |
| Arquivos | **Supabase Storage** | — |
| Tempo real | **Supabase Realtime** | — |
| Vídeo | **Cloudflare Stream** (ou Mux) | — |
| Migrations | **Supabase CLI** (SQL versionado) | — |
| Tipagem do banco | `supabase gen types typescript` | — |
| Validação | **Zod** | 4.x |
| Formulários | **React Hook Form** + `@hookform/resolvers` | — |
| Mutations tipadas | **next-safe-action** | — |
| Estado de servidor no cliente | **TanStack Query** (só nas telas de calendário) | 5.x |
| Calendário | **Schedule-X** ou **react-big-calendar** (ambos MIT) | — |
| Drag & drop | **dnd-kit** | — |
| Gráficos | **Recharts** | — |
| Tabelas | **TanStack Table** | 8.x |
| Pagamentos | **Stripe** (cartão + ACH) | — |
| E-mail | **Resend** + **React Email** | — |
| SMS | **Twilio** | — |
| Push | Web Push nativo (VAPID) via PWA | — |
| PDF | **pdf-lib** + **@react-pdf/renderer** | — |
| Jobs e workflows | **Vercel Cron** + **Vercel Workflow (WDK)** | — |
| i18n | **next-intl** | — |
| IA (Fase 7) | **Vercel AI SDK** + **AI Gateway** | — |
| Erros | **Sentry** | — |
| Produto/analytics | **PostHog** | — |
| Testes | **Vitest** + **Playwright** | — |
| Lint/format | **Biome** (ou ESLint + Prettier) | — |
| Gerenciador de pacotes | **pnpm** | — |
| CI | **GitHub Actions** + Vercel Preview Deployments | — |

---

## 2. Por que Next.js e não um front separado com API própria

A alternativa óbvia seria um SPA (Vite + React) falando com um backend dedicado (NestJS, Fastify, Hono). Descartei por três motivos concretos deste projeto:

**Um só deploy, um só repositório, um só desenvolvedor.** Separar front e back dobra o número de coisas a configurar, versionar, monitorar e pagar, sem trazer benefício nenhum numa aplicação de CRUD sofisticado com poucas centenas de usuários.

**Server Components eliminam a maior parte da API.** As telas mais pesadas do produto (calendário com roster, dashboard financeiro, lista de atletas) são leitura de dados relacionais. Com RSC essas queries acontecem no servidor, perto do Postgres, e o cliente recebe HTML. Não precisamos escrever, versionar e documentar endpoints REST para isso. Onde a API é realmente necessária (webhook do Stripe, webhook do Twilio, iCal público, endpoints do PWA) usamos Route Handlers.

**Vercel é a casa do Next.js.** Preview deployment por PR, edge network, cron, image optimization e observabilidade vêm de graça na configuração padrão. Qualquer outro framework na Vercel funciona, mas com atrito.

**Onde Next.js é fraco e como mitigo:** jobs longos e agendamentos complexos não são o forte de serverless. Por isso os disparos periódicos ficam em Vercel Cron chamando handlers curtos e idempotentes, e as sequências longas (dunning de pagamento, régua de follow-up de lead) ficam no Vercel Workflow, que é durável e sobrevive a timeout.

### Sobre Cache Components (Next.js 16)
O Next 16 traz `use cache`, `cacheLife` e `cacheTag` com PPR. Vamos usar **seletivamente**: no site público (landing, páginas de camp) o ganho é grande e o dado é estável. No painel autenticado, cache agressivo é um risco de vazamento de dado entre tenants — ali a regra é renderização dinâmica com `cacheTag` só em listas realmente compartilhadas (locais, templates, biblioteca pública). Toda query que passa por RLS **não** entra em cache compartilhado.

---

## 3. Por que Supabase como backend e não um backend próprio

O Supabase entrega, prontos, quatro serviços que sozinhos consumiriam semanas: Postgres gerenciado, autenticação (incluindo magic link, OAuth e recuperação de senha), storage com políticas de acesso, e realtime via replicação lógica.

A escolha estruturante é usar **Row Level Security como camada primária de autorização**, não como rede de segurança secundária. Isso significa que a regra "um pai só enxerga os filhos dele" vive no banco, em SQL, e não pode ser burlada por um bug de esquecimento em um `where` do código de aplicação. Em um sistema que guarda dados de crianças, isso não é preciosismo — é o controle que impede o pior incidente possível.

**Consequências práticas dessa decisão:**

- Toda tabela nasce com `alter table ... enable row level security` na mesma migration que a cria. Sem exceção.
- A `service_role` key nunca chega ao browser e é usada apenas em três lugares: webhooks, jobs de cron e scripts de migração de dados.
- Testes automatizados de política de acesso são obrigatórios (pgTAP ou testes de integração que autenticam como cada persona e verificam o que vazou).

### Supabase CLI e não Drizzle/Prisma

Considerei Drizzle ORM. É excelente e eu usaria em outro contexto. Aqui perde por um motivo: com RLS pesado, funções `security definer`, triggers e políticas, o schema real do banco tem muito mais coisa do que um ORM consegue expressar. Manter duas fontes de verdade (o schema do ORM e as migrations SQL das políticas) é o tipo de complexidade que quebra em um projeto solo com prazo curto.

**Decisão:** migrations SQL versionadas via Supabase CLI são a única fonte de verdade. Tipagem TypeScript é gerada do banco com `supabase gen types typescript`. Consultas usam `supabase-js` com tipos gerados. Quando uma query relacional ficar complexa demais para o query builder, viramos uma função Postgres (`rpc`), que também fica versionada e testável.

Se no futuro a complexidade de queries justificar, dá para adicionar Drizzle **apenas na camada de leitura**, apontando para o mesmo schema, sem reescrever nada. A porta fica aberta.

---

## 4. Diagrama da arquitetura

```
                             ┌──────────────────────────┐
                             │        Instagram         │
                             │      (link na bio)       │
                             └────────────┬─────────────┘
                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              VERCEL                                     │
│                                                                          │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────────────┐  │
│  │ Site público │  │ Portal família │  │      Painel do coach       │  │
│  │  (estático   │  │  (dinâmico,    │  │  (dinâmico, RSC + Actions) │  │
│  │   + PPR)     │  │   RSC)         │  │                            │  │
│  └──────────────┘  └────────────────┘  └────────────────────────────┘  │
│                                                                          │
│  Route Handlers          Server Actions         Cron + Workflow (WDK)   │
│  ├ /api/webhooks/stripe  ├ createSession        ├ lembrete 24h antes    │
│  ├ /api/webhooks/twilio  ├ cancelSession        ├ dunning de fatura     │
│  ├ /api/webhooks/resend  ├ signWaiver           ├ nudge de lead parado  │
│  ├ /api/ical/[token]     ├ recordAttendance     ├ relatório semanal     │
│  └ /api/push/subscribe   └ ...                  └ promoção de waitlist  │
└───────────┬─────────────────────────────────────────────┬───────────────┘
            │                                              │
            ▼                                              ▼
┌───────────────────────────────────┐      ┌──────────────────────────────┐
│            SUPABASE               │      │      SERVIÇOS EXTERNOS       │
│                                   │      │                              │
│  Postgres 17  ── RLS em tudo      │      │  Stripe    pagamentos + ACH  │
│  Auth         ── e-mail, OAuth    │      │  Resend    e-mail transac.   │
│  Storage      ── docs, fotos, PDF │      │  Twilio    SMS               │
│  Realtime     ── roster ao vivo   │      │  CF Stream vídeo da library  │
│  pg_cron      ── housekeeping     │      │  Sentry    erros             │
│                                   │      │  PostHog   produto           │
└───────────────────────────────────┘      └──────────────────────────────┘
```

---

## 5. Estrutura de pastas

Monorepo simples com pnpm workspaces — não precisamos de Turborepo agora, mas a estrutura já permite adicionar depois.

```
ca-tempo/
├── apps/
│   └── web/                         # aplicação Next.js única
│       ├── app/
│       │   ├── (public)/            # site público, sem auth
│       │   │   ├── page.tsx
│       │   │   ├── camps/[slug]/
│       │   │   ├── register/[formSlug]/
│       │   │   └── waiver/[token]/
│       │   ├── (family)/            # portal da família
│       │   │   ├── layout.tsx       # guard: role = guardian|athlete
│       │   │   ├── schedule/
│       │   │   ├── athletes/[id]/
│       │   │   ├── billing/
│       │   │   └── messages/
│       │   ├── (coach)/             # painel do staff
│       │   │   ├── layout.tsx       # guard: role = owner|admin|coach|staff
│       │   │   ├── dashboard/
│       │   │   ├── calendar/
│       │   │   ├── sessions/[id]/
│       │   │   ├── groups/
│       │   │   ├── athletes/
│       │   │   ├── prospects/
│       │   │   ├── billing/
│       │   │   ├── library/
│       │   │   ├── evaluations/
│       │   │   ├── forms/
│       │   │   ├── reports/
│       │   │   └── settings/
│       │   ├── api/
│       │   └── auth/
│       ├── components/
│       │   ├── ui/                  # shadcn
│       │   ├── calendar/
│       │   ├── roster/
│       │   └── forms/
│       ├── lib/
│       │   ├── supabase/            # client, server, admin, middleware
│       │   ├── auth/                # sessão, roles, guards
│       │   ├── actions/             # server actions por domínio
│       │   ├── queries/             # funções de leitura reutilizáveis
│       │   ├── stripe/
│       │   ├── email/
│       │   ├── sms/
│       │   ├── pdf/
│       │   └── utils/
│       ├── emails/                  # templates React Email
│       ├── messages/                # en.json, pt-BR.json, es.json
│       └── types/database.ts        # gerado pelo Supabase CLI
├── packages/
│   ├── domain/                      # regras de negócio puras + schemas Zod
│   │   ├── scheduling/              # RRULE, conflitos, capacidade
│   │   ├── billing/                 # descontos, proration, crédito
│   │   ├── evaluation/              # cálculo de score, ACWR
│   │   └── forms/                   # JSON schema → Zod
│   └── config/                      # tsconfig, biome, tailwind preset
├── supabase/
│   ├── migrations/                  # fonte única de verdade do schema
│   ├── seed.sql
│   ├── functions/                   # edge functions (se necessárias)
│   └── tests/                       # pgTAP — testes de RLS
├── e2e/                             # Playwright
└── docs/
```

**O motivo de `packages/domain` existir:** a lógica que decide se uma sessão pode ser cancelada com crédito, ou como um desconto se aplica, precisa ser testável sem banco e sem HTTP. Isolar isso em funções puras com Zod é o que permite ter cobertura de teste real nas partes que envolvem dinheiro e agenda — exatamente as que não podem ter bug.

---

## 6. Decisões técnicas específicas e justificativa

### Autenticação: magic link como padrão

Pais de atleta não vão criar e lembrar de senha. O padrão será **magic link por e-mail** (Supabase Auth `signInWithOtp`), com OAuth Google/Apple como atalho. Senha fica disponível mas não é o caminho principal. Para owner/admin, MFA (TOTP) obrigatório, porque essas contas veem dados financeiros e contatos de todas as famílias.

**Convite de família:** ao aprovar uma inscrição, o sistema dispara um convite. O responsável clica, cai autenticado, e já vê os filhos vinculados. Zero fricção de cadastro.

### Fuso horário: UTC no banco, `America/New_York` na exibição

Toda coluna de data-hora é `timestamptz` armazenada em UTC. A organização tem um `timezone` configurável e toda renderização converte. Isso não é detalhe — sessão de treino é o dado mais sensível a fuso do sistema, e horário de verão americano muda duas vezes por ano.

### Recorrência: RRULE (RFC 5545), não linhas duplicadas

Sessões recorrentes guardam a regra (`rrule`) e um conjunto de exceções, mas **materializam** instâncias concretas em `sessions` até um horizonte de 6 meses, expandido por um cron. Motivo: chamada, pagamento e cancelamento precisam se ligar a uma sessão concreta, com ID estável. Materializar dá o melhor dos dois mundos — a regra é editável, e cada ocorrência é uma entidade real.

### Vídeo: Cloudflare Stream, não Supabase Storage

Guardar MP4 no Supabase Storage e servir direto funciona, até o dia em que um coach sobe um vídeo de 4K de 10 minutos e o pai tenta assistir no 4G do estacionamento. Cloudflare Stream faz transcodificação adaptativa, geração de thumbnail e entrega HLS por ~$5/1.000 minutos armazenados e ~$1/1.000 minutos assistidos. Para o volume esperado é dezenas de dólares por ano. **Supabase Storage continua sendo usado** para PDFs (waiver, relatórios), fotos de perfil e documentos.

### PWA em vez de app nativo na v1

Instalável na home screen, push notification, funciona offline para a chamada. Cobre 100% do que o Byga faz com app nativo, exceto integração profunda com o SO. Economiza 4–6 semanas de desenvolvimento e as filas de review das lojas. Se a demanda por nativo aparecer, Expo com React Native reaproveita o `packages/domain` inteiro.

### Chamada offline-first

A chamada é a única tela que **precisa** funcionar sem rede — campo público, sinal ruim, coach com o celular na mão. Implementação: cache do roster em IndexedDB, marcações gravadas localmente, sincronização com resolução por `last-write-wins` com timestamp quando a rede volta.

### Idempotência é requisito, não boa prática

Três lugares onde a mesma operação pode ser disparada duas vezes e causar dano real: webhook do Stripe (a Stripe reenvia), notificação de cancelamento (usuário clica duas vezes), e cron (Vercel pode executar em sobreposição). Todos os três recebem chave de idempotência persistida em tabela, com constraint única.

---

## 7. Ambientes

| Ambiente | URL | Supabase | Stripe | Propósito |
|----------|-----|----------|--------|-----------|
| Local | `localhost:3000` | Supabase local (Docker) | test | Desenvolvimento |
| Preview | `*.vercel.app` por PR | projeto `staging` | test | Revisão de feature |
| Staging | `staging.catempo.app` | projeto `staging` | test | Homologação com o cliente |
| Produção | `app.catempo.app` | projeto `production` | live | Uso real |

Staging existe por uma razão específica: Arthur e Carlos precisam **usar** e aprovar cada fase antes de ir para produção. Sem um ambiente estável para eles testarem, o feedback vira "não é bem isso" depois do deploy.

---

## 8. CI/CD

```
push em branch → GitHub Actions
                 ├─ typecheck (tsc --noEmit)
                 ├─ lint (biome)
                 ├─ unit (vitest — packages/domain)
                 └─ build
                    ↓
              Vercel Preview Deploy
                    ↓
              Playwright E2E contra o preview
                    ↓
              merge em main → deploy produção
                            → supabase db push (migrations)
```

Regra: **migration nunca é destrutiva em um único deploy.** Toda mudança de schema que remove ou renomeia coluna vira duas etapas (adicionar novo → migrar dado → remover antigo em deploy posterior), porque o rollback da Vercel é instantâneo, mas o do banco não é.

---

## 9. Variáveis de ambiente

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # servidor apenas — nunca prefixar com NEXT_PUBLIC_

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Comunicação
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# Vídeo
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_STREAM_TOKEN=

# Observabilidade
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=

# App
NEXT_PUBLIC_APP_URL=
CRON_SECRET=                        # protege as rotas de cron
```

Gerenciadas via `vercel env` e sincronizadas localmente com `vercel env pull`. Nenhum `.env` entra no git.

---

## 10. Alternativas consideradas e por que não

| Alternativa | Por que não |
|-------------|-------------|
| Remix / React Router 7 | Ótimo framework, mas a integração com Vercel Cron, PPR e Image Optimization é menos direta que Next.js |
| NestJS como backend separado | Duplica infraestrutura e deploy para uma aplicação sem necessidade de escala independente |
| Prisma | Suporte a RLS é indireto; connection pooling em serverless exige Accelerate (custo extra) |
| Firebase | Contradiz a restrição do Supabase; NoSQL é ruim para os relacionamentos densos deste domínio |
| Clerk para auth | Bom produto, mas Supabase Auth já vem incluso e integra nativamente com RLS via `auth.uid()` |
| DocuSign para waiver | ~$25/mês por usuário para algo que resolvemos com canvas + hash + PDF, dentro da lei ESIGN |
| Inngest / Trigger.dev | Vercel Workflow cobre o caso e não adiciona mais um fornecedor na conta |
| Mux para vídeo | Excelente, mas Cloudflare Stream é significativamente mais barato no volume esperado |
| FullCalendar Premium | A view de scheduler por recurso é paga; Schedule-X e react-big-calendar resolvem sob MIT |
