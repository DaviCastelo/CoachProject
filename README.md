# CA Tempo Platform

Plataforma de gestão para a **CA Tempo Training** — academia de treinamento de futebol (soccer) fundada em 2025, focada em treinos privados 1:1, small groups e camps de temporada.

O objetivo é substituir a operação atual (JotForm + Google Sheets + e-mail/SMS manual) por uma plataforma única que atenda três públicos: **coaches/staff**, **atletas** e **responsáveis (pais)**.

---

## Documentação de planejamento

Leia na ordem. Cada documento é autocontido, mas eles se referenciam.

| # | Documento | O que responde |
|---|-----------|----------------|
| 00 | [Visão Geral](docs/00-visao-geral.md) | O que é o produto, pesquisa sobre a CA Tempo, benchmark (Byga/JotForm), princípios do projeto |
| 01 | [Descoberta e Requisitos](docs/01-descoberta-e-requisitos.md) | Processo atual, dores, personas, requisitos funcionais e user stories rastreados até a reunião |
| 02 | [Arquitetura e Stack](docs/02-arquitetura-e-stack.md) | Decisão de tecnologia (front, back, infra) com justificativa e alternativas descartadas |
| 03 | [Modelo de Dados](docs/03-modelo-de-dados.md) | Schema Postgres completo, multi-tenancy, RLS e política de acesso |
| 04 | [Módulos Funcionais](docs/04-modulos-funcionais.md) | Especificação dos 10 módulos do produto, tela a tela e fluxo a fluxo |
| 05 | [Features Avançadas para Coaches](docs/05-features-avancadas-coaches.md) | Diferenciais que vão além do Byga: carga de treino, IDP, video feedback, IA, recruiting |
| 06 | [Roadmap e Fases](docs/06-roadmap-e-fases.md) | Cronograma de 45 dias a 3 meses, corte de MVP, critérios de aceite por fase |
| 07 | [Pagamentos e Taxas](docs/07-pagamentos-e-taxas.md) | Análise comparativa Stripe x PayPal x ACH — decisão pendente da reunião |
| 08 | [Segurança e Compliance](docs/08-seguranca-e-compliance.md) | Dados de menores, COPPA, waiver com validade legal (ESIGN/UETA), PCI, LGPD/CCPA |
| 09 | [Design System e Marca](docs/09-design-system-e-marca.md) | Identidade visual derivada da logo, tokens, componentes, acessibilidade |
| 10 | [Operação, Custos e Contrato](docs/10-operacao-custos-e-contrato.md) | Custo de infra, ambientes, CI/CD, suporte, escopo do fee mensal de $300 |

---

## Resumo executivo em 60 segundos

**Problema.** A CA Tempo opera com formulários JotForm avulsos e planilhas Google. Cada cancelamento de sessão exige contato individual com cada família. O controle de pagamento é um "check verde" manual na planilha. Prospects chegam pelo Instagram em volume alto e se perdem por falta de um funil.

**Solução.** Uma aplicação web (PWA) multi-tenant onde:
- famílias se cadastram, assinam o waiver digitalmente e ganham um portal para ver a agenda, confirmar presença e cancelar sozinhas;
- coaches veem um calendário onde clicar num horário abre o roster do grupo com contato dos pais, status de pagamento e alertas médicos;
- um cancelamento em massa vira um clique com notificação automática por e-mail/SMS/push;
- pagamentos, parcelamento e bolsas ficam registrados junto da inscrição;
- prospects entram num CRM com pipeline até virarem alunos em um grupo (ex.: "U9 Blue");
- coaches mantêm uma biblioteca de drills em vídeo e aplicam avaliações periódicas de desenvolvimento.

**Stack.** Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui na Vercel; Supabase (Postgres + Auth + Storage + Realtime) como backend, com Row Level Security como camada primária de autorização; Stripe para pagamentos; Resend + Twilio para comunicação. Detalhes e justificativa em [docs/02](docs/02-arquitetura-e-stack.md).

**Prazo.** MVP que aposenta a planilha em ~45 dias (Fases 1–4). Plataforma completa em 3 meses (Fases 5–7). Detalhamento em [docs/06](docs/06-roadmap-e-fases.md).

---

## Estado do repositório

Repositório recém-inicializado. Nenhum código ainda — este é o pacote de planejamento que precede a Fase 1. O passo seguinte está descrito em [docs/06 › Fase 0](docs/06-roadmap-e-fases.md#fase-0--descoberta-e-preparação-semana-0).
