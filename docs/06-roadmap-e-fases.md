# 06 — Roadmap e Fases

A reunião fechou em **45 dias a 3 meses**, com 3 meses como teto de segurança. Este documento traduz isso em fases entregáveis, com o corte de MVP explícito e critérios de aceite verificáveis.

## Premissas do cronograma

- Um desenvolvedor, dedicação de meio período a tempo integral
- Arthur e Carlos disponíveis para validar cada fase em staging antes do deploy em produção
- As respostas do [questionário de descoberta](01-descoberta-e-requisitos.md#6-perguntas-em-aberto-para-o-cliente) chegam na Fase 0
- Semana = 5 dias úteis

## Visão geral

```
Semana   0    1    2    3    4    5    6    7    8    9   10   11   12
         │────│────│────│────│────│────│────│────│────│────│────│────│
Fase 0   ████
Fase 1        █████████
Fase 2                  ██████████
Fase 3                            ██████████
Fase 4                                      █████████
                                            ▲
                                    ENTREGA 1 — dia ~45
                                    (planilha aposentada)
Fase 5                                                ██████████
Fase 6                                                          ████████
                                                                        ▲
                                                              ENTREGA 2 — dia ~90
                                                              (plataforma completa)
Fase 7                                                                   ─── contínuo
```

---

## Fase 0 — Descoberta e preparação (semana 0)

Sem esta fase, tudo depois atrasa. A própria reunião 2 já registrou a pendência: *"[Arthur, Carlos] Documentar Processos Atuais: fornecer detalhes sobre o fluxo de trabalho manual e a lógica de tomada de decisão."*

### O que eu faço
- Mapeio os processos atuais em fluxogramas e valido com eles
- Levanto todos os formulários JotForm e planilhas em uso
- Defino a política de cancelamento, os preços e as regras de desconto por escrito
- Crio contas: Vercel, Supabase, Stripe, Resend, Twilio, Sentry, domínio
- Configuro repositório, CI, ambientes local/staging/produção

### O que o cliente precisa entregar
| Item | Responsável | Bloqueia |
|------|-------------|----------|
| Acesso aos formulários JotForm (export) | Arthur | Fase 2 |
| Acesso às planilhas do Google Sheets | Arthur/Carlos | Fase 3 |
| Texto legal exato do waiver | Arthur | Fase 2 |
| Tabela de preços completa (fora dos camps) | Carlos | Fase 4 |
| Política de cancelamento por escrito | Arthur/Carlos | Fase 3 |
| Critério de alocação em grupos ("por que U9 Blue e não U9 White") | Carlos | Fase 5 |
| Logo em vetor e fotos em alta | Arthur | Fase 1 |
| Definição do gateway de pagamento | Carlos + eu | Fase 4 |
| Domínio desejado | Arthur | Fase 1 |

**Entregável:** documento de processos validado + contas provisionadas + repositório rodando.

---

## Fase 1 — Fundação (semanas 1–2)

Nada visível para o usuário final, tudo que sustenta o resto.

### Escopo
- Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui, com o tema da CA Tempo aplicado
- Supabase: projetos staging e produção, migrations iniciais (organizations, profiles, memberships, households, guardians, athletes, locations)
- RLS ativado em todas as tabelas criadas, com as funções auxiliares (`auth_org_ids`, `has_org_role`, `is_staff`, `auth_athlete_ids`)
- Auth: magic link, OAuth Google, convite de usuário, MFA para owner/admin
- Layouts e guards das três áreas: `(public)`, `(family)`, `(coach)`
- Design system: tokens, tipografia, componentes base, dark mode, PWA manifest
- i18n com next-intl (en, pt-BR, es)
- CI: typecheck, lint, teste, build, preview deploy
- Sentry e PostHog conectados
- Testes de RLS em pgTAP para as tabelas existentes

### Critérios de aceite
- [ ] Deploy em produção funcionando em domínio próprio com HTTPS
- [ ] Arthur consegue entrar por magic link e ver o painel vazio
- [ ] Um usuário de teste de outra organização não enxerga nenhum dado da CA Tempo (verificado por teste automatizado)
- [ ] Lighthouse ≥ 90 em performance e acessibilidade na home
- [ ] App instalável na home screen do iPhone e do Android

---

## Fase 2 — Intake, Waivers e Site (semanas 2–4)

Primeira entrega com valor real. **Substitui o JotForm.**

### Escopo
- Motor de formulários: renderizador do JSON schema com React Hook Form + Zod, lógica condicional, multi-etapas, salvamento de rascunho
- Construtor de formulários para o staff (arrastar e soltar)
- Formulário público de inscrição, mobile-first, sem login
- Pipeline de submissão → cria/atualiza household, guardian, athlete, registration
- Detecção e mesclagem de duplicatas
- Waiver: renderização do template, scroll obrigatório, assinatura em canvas, hash SHA-256, trilha de auditoria, geração de PDF
- Caixa de submissões e tela de aprovação de inscrição
- Site público: landing, lista de programas, página de programa com vagas
- **Migração dos dados históricos do JotForm**
- E-mails transacionais: confirmação de inscrição, cópia do waiver, notificação ao staff

### Critérios de aceite
- [ ] Os dois formulários atuais (Summer Camp e Training) reproduzidos com 100% dos campos
- [ ] Um pai completa a inscrição no celular em menos de 4 minutos
- [ ] Waiver assinado gera PDF com nome, hash, IP, data e hora
- [ ] Submissão duplicada é detectada e oferece atualização
- [ ] Histórico do JotForm importado e conferido
- [ ] **O próximo camp real é publicado por esta plataforma, não pelo JotForm**

O último critério é o que importa. Se a Fase 2 não substituir o JotForm de verdade, ela não terminou.

---

## Fase 3 — Agenda, Rosters e Portal da Família (semanas 4–6)

O coração do produto. **Substitui o Google Sheets.**

### Escopo
- Calendário do coach (dia/semana/mês/agenda) com filtro por coach, grupo e local
- CRUD de grupos, membros e coaches do grupo
- CRUD de locais
- Criação de sessão avulsa e de série recorrente (RRULE) com materialização até 6 meses
- Detecção de conflito de campo, coach e capacidade
- **Painel de roster ao clicar no horário** (RF-02.2, prioridade nomeada por Carlos)
- Disponibilidade e bloqueios dos coaches
- **Cancelamento com notificação automática**, individual, em série e em lote (RF-02.8)
- Lista de espera com promoção automática
- Chamada mobile offline-first
- Portal da família: agenda, confirmar/cancelar, perfil do atleta, preferências
- Assinatura iCal para famílias e coaches
- Motor de notificação: e-mail (Resend), SMS (Twilio), push (Web Push)
- Crons: confirmação 48h, lembrete 24h, SMS 2h, promoção de waitlist, expansão da recorrência
- Alerta meteorológico ([feature #1](05-features-avancadas-coaches.md#1-cancelamento-inteligente-com-integração-meteorológica))

### Critérios de aceite
- [ ] A grade completa de treinos da temporada está no sistema
- [ ] Clicar num horário mostra roster, contato dos pais e alerta médico em menos de 1 segundo
- [ ] Cancelar 4 sessões de um dia e avisar 26 famílias leva menos de 60 segundos
- [ ] Um pai cancela a presença do filho pelo celular sem falar com ninguém
- [ ] A chamada funciona com o celular em modo avião e sincroniza depois
- [ ] Os treinos aparecem no Google Calendar do coach
- [ ] Conflito de campo é bloqueado antes de salvar

---

## Fase 4 — Pagamentos (semanas 6–8) · fim da ENTREGA 1

### Escopo
- Integração Stripe: Checkout, Payment Intents, webhooks idempotentes
- ACH Direct Debit como método padrão para valores acima do limiar (ver [docs/07](07-pagamentos-e-taxas.md))
- Faturas com numeração, linhas, PDF e link hospedado
- Motor de descontos: cupom, early bird, bolsa
- Registro de pagamento offline (dinheiro, cheque, Zelle, Venmo)
- Créditos em conta e consumo automático
- Reembolso total e parcial
- Planos de parcelamento
- Régua de cobrança em Vercel Workflow
- Dashboard financeiro e relatórios de receita, a receber e taxa por método
- Conciliação com os payouts da Stripe
- **Migração do status de pagamento das planilhas** (cada check verde vira fatura paga)

### Critérios de aceite
- [ ] Um pai paga a inscrição do camp por ACH e recebe o recibo automaticamente
- [ ] Registrar pagamento em dinheiro leva menos de 15 segundos
- [ ] Webhook duplicado da Stripe não credita a fatura duas vezes (teste automatizado)
- [ ] O relatório mostra a taxa real paga por método no período
- [ ] Nenhum dado de cartão passa pelo nosso servidor

### 🎯 ENTREGA 1 — dia ~45

Neste ponto a CA Tempo pode **desligar o JotForm e o Google Sheets**. Inscrição, waiver, agenda, roster, presença, cancelamento em massa, portal da família e pagamento estão em produção com dados reais.

Antes de declarar entregue: uma semana de operação em paralelo (sistema novo + planilha) para conferência, e treinamento de Arthur e Carlos com material gravado.

---

## Fase 5 — CRM, Comunicação e Gestão (semanas 8–10)

### Escopo
- Pipeline kanban de leads com automação por estágio
- Captura de lead pelo formulário de interesse com UTM
- Alocação **manual** do prospect no grupo escolhido pelo staff (sem sugestão automática de grupo)
- Motor de casamento de disponibilidade + detecção de demanda latente, como apoio à decisão ([feature #3](05-features-avancadas-coaches.md#3-motor-de-casamento-de-disponibilidade-availability-matching))
- Agendamento de trial e conversão em um clique
- Central de comunicação: campanhas segmentadas, templates editáveis, log de entrega
- Detecção de risco de churn
- Relatório semanal automático por e-mail
- Painel de horas e pagamento dos coaches
- Dashboard operacional com o bloco "precisa de atenção"
- Log de auditoria consultável

### Critérios de aceite
- [ ] Todo lead do Instagram entra no pipeline automaticamente e ninguém fica sem contato por mais de 3 dias sem alerta
- [ ] O staff aloca manualmente um novo atleta no grupo escolhido, direto pela ficha do lead
- [ ] Um comunicado segmentado ("todos os pais de U9 com fatura em aberto") sai em menos de 2 minutos
- [ ] Arthur recebe o relatório semanal toda segunda de manhã
- [ ] O relatório de horas fecha com o que eles pagariam manualmente

---

## Fase 6 — Library, Avaliações e Refinamento (semanas 10–12)

### Escopo
- Club Library: upload de vídeo via Cloudflare Stream, metadados de drill, filtros, busca, coleções, controle de visibilidade
- Construtor de plano de sessão com exportação em PDF
- Templates de avaliação e formulário mobile de preenchimento
- Radar chart e histórico de evolução
- Plano de desenvolvimento individual (IDP) com metas
- Nota rápida por atleta durante a sessão
- Galeria de fotos por sessão com respeito ao consentimento de imagem
- Check-in por QR code
- Monitoramento de carga (RPE, ACWR)
- Mapa de calor de ocupação
- Refinamento geral: performance, acessibilidade, correções do feedback de uso real

### Critérios de aceite
- [ ] Um coach sobe um vídeo de drill do celular e ele fica assistível em menos de 5 minutos
- [ ] Um plano de sessão é montado em menos de 3 minutos e exportado em PDF
- [ ] Uma avaliação é preenchida no campo, pelo celular, em menos de 2 minutos
- [ ] Lighthouse ≥ 90 em todas as rotas principais
- [ ] Zero erro crítico no Sentry por 7 dias consecutivos

### 🎯 ENTREGA 2 — dia ~90

Plataforma completa em produção, cobrindo todos os requisitos "Must" e a maioria dos "Should".

---

## Fase 7 — Evolução contínua (pós-entrega, dentro do fee mensal)

Backlog priorizado junto com o cliente, uma ou duas iniciativas por mês:

**Trimestre seguinte:** perfil de recrutamento universitário · vídeo feedback com anotação · renovação automática de temporada · gerador de plano de treino com IA · WhatsApp Business

**Depois:** biblioteca de vídeos separada para famílias (prioridade 3) · gamificação e desafios · quadro tático · app nativo (Expo) · precificação dinâmica · assistente de IA para leads · multi-clube (licenciar a plataforma)

---

## Riscos e mitigação

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Cliente demora a entregar os processos documentados | **Alta** | Alto | Fase 0 com prazo explícito; começar Fase 1 em paralelo, que não depende deles |
| Escopo cresce durante o projeto | **Alta** | Alto | Requisitos priorizados em Must/Should/Could; toda adição desloca outra coisa, por escrito |
| Definição do gateway atrasa a Fase 4 | Média | Alto | Camada de pagamento abstraída; Stripe implementado por padrão, PayPal como adaptador adicional |
| Resistência da equipe a abandonar a planilha | Média | Alto | Substituir módulo por módulo, com uma semana de operação em paralelo; treinamento gravado |
| Qualidade ruim dos dados históricos | **Alta** | Médio | Importação com dry-run, relatório de rejeitados e correção manual assistida |
| Coach na beira do campo sem sinal | Média | Médio | Chamada offline-first desde a Fase 3 |
| Custo de SMS estourar | Baixa | Baixo | SMS só para urgência; push e e-mail como padrão; teto mensal configurável |
| Vazamento de dado de menor | Baixa | **Crítico** | RLS como camada primária + testes pgTAP obrigatórios + revisão de segurança antes de cada entrega |
| Desenvolvedor solo indisponível | Baixa | Alto | Documentação viva no repositório; código convencional; sem dependência exótica |

---

## Como o progresso é acompanhado

- **Demo quinzenal** em staging, gravada, com Arthur e Carlos
- **Checklist de critérios de aceite** por fase, marcado em conjunto
- **Board público** de tarefas (GitHub Projects) para eles acompanharem quando quiserem
- **Changelog** no repositório a cada deploy de produção
- Nenhuma fase é considerada entregue sem o cliente marcar o aceite

## O que garante o prazo de 45 dias

Três decisões específicas protegem a Entrega 1:

1. **A ordem das fases segue a dor, não a arquitetura.** Intake antes de agenda, agenda antes de pagamento. Se a semana 6 chegar apertada, o que fica para depois é pagamento — e eles continuam recebendo em dinheiro, como já fazem hoje.
2. **Tudo que é "Could" está fora da Entrega 1**, sem exceção. Biblioteca, avaliação, CRM e IA são valiosos, mas nenhum deles substitui uma planilha.
3. **Cada fase vai para produção**, não para a gaveta. O valor é entregue em incrementos utilizáveis, então mesmo um atraso na Fase 4 deixa a CA Tempo em situação melhor do que hoje.
