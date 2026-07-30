# 10 — Operação, Custos e Contrato

A reunião fechou os termos comerciais: **$300/mês** cobrindo desenvolvimento e manutenção, entrega em **45 dias a 3 meses**, pagamento em dinheiro pessoalmente. Este documento traduz esse acordo em escopo operacional concreto, para que ninguém descubra depois que esperava outra coisa.

---

## 1. Custo de infraestrutura

### Fase de desenvolvimento (meses 1–3)

| Serviço | Plano | Custo/mês |
|---------|-------|-----------|
| Vercel | Hobby durante o desenvolvimento | $0 |
| Supabase | Free (2 projetos) | $0 |
| Stripe | Pay-as-you-go, modo teste | $0 |
| Resend | Free (3.000 e-mails/mês) | $0 |
| Twilio | Trial | ~$0 |
| Sentry | Developer | $0 |
| PostHog | Free (1M eventos) | $0 |
| Domínio | `.app` ou `.com` | ~$1,25 (~$15/ano) |
| **Total** | | **~$1,25/mês** |

### Produção (a partir do mês 3)

| Serviço | Plano | Custo/mês | Por que |
|---------|-------|-----------|---------|
| Vercel | Pro | $20 | Analytics, proteção de deploy, limites maiores |
| Supabase | Pro | $25 | PITR de 7 dias, sem pausa automática, 8 GB de banco, suporte |
| Resend | Pro | $20 | 50.000 e-mails/mês, domínio verificado |
| Twilio | Uso | ~$8 | ~1.000 SMS/mês a ~$0,0079 cada |
| Cloudflare Stream | Uso | ~$10 | ~500 min armazenados + ~2.000 min assistidos |
| Sentry | Team | $26 | Alertas e retenção maior |
| PostHog | Free | $0 | Volume abaixo do limite gratuito |
| Domínio | — | $1,25 | |
| **Total** | | **~$110/mês** | |

**Enxugamento possível:** manter Sentry no plano gratuito e PostHog no free reduz para **~$85/mês**. Recomendo começar assim e subir o Sentry quando o volume justificar.

Stripe não entra nesta conta porque é percentual sobre transação, coberto em [docs/07](07-pagamentos-e-taxas.md).

### Como isso se relaciona com o fee de $300

```
Fee mensal                      $300
Infraestrutura                 -$110
──────────────────────────────────────
Margem para desenvolvimento     $190/mês
```

Isso precisa estar claro entre as partes: o fee cobre infraestrutura **e** trabalho contínuo. Se a CA Tempo preferir pagar a infraestrutura diretamente (contas em nome deles), o fee passa a ser integralmente serviço — e, na verdade, é o que eu recomendo, pela razão do item 6.

---

## 2. Escopo do fee mensal após a entrega

Colocar isso por escrito evita o desgaste clássico de projeto de software: o cliente achar que tudo está incluído e o desenvolvedor achar que nada está.

### Incluído

- Hospedagem, banco de dados e serviços de terceiros operacionais
- Correção de bugs, sem limite
- Monitoramento, alertas e resposta a incidentes
- Backup e teste trimestral de restauração
- Atualizações de segurança e de dependências
- Ajustes pequenos (texto, campo de formulário, template de e-mail, novo tipo de desconto, novo relatório simples)
- Suporte por WhatsApp/e-mail em horário comercial
- Uma reunião mensal de acompanhamento
- Uma iniciativa de melhoria por mês, escolhida do backlog da [Fase 7](06-roadmap-e-fases.md#fase-7--evolução-contínua-pós-entrega-dentro-do-fee-mensal)

### Não incluído (orçado à parte)

- Módulo novo de grande porte (app nativo, integração com sistema de terceiro, IA generativa)
- Redesenho completo da identidade
- Migração de dados de outra plataforma além do JotForm e do Sheets já previstos
- Treinamento presencial além do inicial
- Suporte 24/7 ou SLA com penalidade
- Taxas de transação de pagamento (são da CA Tempo)
- Custo de SMS acima de 2.000/mês

### SLA proposto

| Severidade | Definição | Primeira resposta | Resolução alvo |
|------------|-----------|-------------------|----------------|
| **S1 — Crítico** | Sistema fora do ar, pagamento quebrado, vazamento de dado | 2h | 8h |
| **S2 — Alto** | Funcionalidade importante indisponível, sem contorno | 8h | 2 dias úteis |
| **S3 — Médio** | Funcionalidade com contorno disponível | 2 dias úteis | 1 semana |
| **S4 — Baixo** | Cosmético, melhoria | 1 semana | Próxima iteração |

Horário comercial: segunda a sexta, 9h–18h. S1 é atendido fora do horário.

---

## 3. Titularidade e continuidade

Este é o item que mais gera problema em projeto de software para pequeno negócio, e por isso precisa ser explícito.

| Item | Proposta |
|------|----------|
| Código-fonte | Propriedade da CA Tempo Training; repositório com acesso de owner para Arthur e Carlos desde o dia 1 |
| Dados | 100% da CA Tempo, sempre |
| Contas de serviço | **Em nome da CA Tempo**, com o desenvolvedor como colaborador |
| Domínio | Registrado em nome da CA Tempo |
| Exportação | Comando de export de todos os dados disponível a qualquer momento |
| Encerramento | Aviso de 30 dias de qualquer lado; entrega de credenciais, documentação e transferência assistida |

**Por que as contas devem ficar em nome deles:** se as contas de Vercel, Supabase e Stripe estiverem no meu nome e eu ficar indisponível, o negócio deles para. Colocar em nome da CA Tempo protege o cliente e, do meu lado, elimina o risco de eu ser cobrado por consumo de uma operação que não é minha. É melhor para os dois.

O código é deles porque foi pago por eles. Isso não me impede de reaproveitar padrões e componentes genéricos em outros projetos — o que é justo definir por escrito também, se houver intenção de licenciar a plataforma para outros clubes no futuro (a pergunta 13 do [questionário de descoberta](01-descoberta-e-requisitos.md#6-perguntas-em-aberto-para-o-cliente)).

---

## 4. Rotina operacional

### Diária (automática)
Health check a cada 5 minutos, backup do banco, crons de lembrete e confirmação, verificação de previsão do tempo, cálculo de score de churn, expansão de sessões recorrentes.

### Semanal
Revisão do Sentry, revisão de dependências (Dependabot), relatório automático de segunda-feira para Arthur e Carlos, verificação de que os crons rodaram.

### Mensal
Reunião de acompanhamento, revisão de custo de infraestrutura, revisão de métricas de produto no PostHog, priorização da iniciativa do mês, auditoria de acessos ativos.

### Trimestral
Teste de restauração de backup, revisão de segurança com o [checklist](08-seguranca-e-compliance.md#10-checklist-antes-de-cada-entrega), atualização de dependências maiores, revisão de taxas de pagamento com dados reais, pesquisa de satisfação com as famílias.

---

## 5. Treinamento e adoção

O maior risco do projeto não é técnico. É a equipe voltar para a planilha porque o sistema novo pareceu mais lento nos primeiros dias.

### Plano de adoção

**Antes de cada entrega:** sessão de treinamento ao vivo (60 min), gravada, com Arthur e Carlos operando o sistema, não assistindo a uma demonstração.

**Material permanente:**
- Vídeos curtos (2–3 min) por tarefa: criar sessão, cancelar em massa, fazer chamada, registrar pagamento, aprovar inscrição
- Guia rápido de uma página, imprimível, para levar ao campo
- FAQ dentro do próprio produto

**Para as famílias:**
- E-mail de boas-vindas com um vídeo de 90 segundos
- Guia de primeiro acesso no portal
- Card pronto para o Instagram anunciando a novidade

### Operação em paralelo
Uma semana rodando sistema novo e planilha ao mesmo tempo em cada substituição, com conferência diária. Só depois a planilha é arquivada — não apagada, arquivada.

### Métricas de adoção acompanhadas
Logins semanais de Arthur e Carlos, percentual de sessões com chamada feita no app, percentual de famílias com conta ativa, percentual de confirmações feitas pela família sem intervenção do staff, número de comunicações manuais por WhatsApp que ainda acontecem.

A última métrica é a mais reveladora. Se em dois meses eles ainda estiverem avisando cancelamento por WhatsApp individual, alguma coisa na ferramenta não está boa o suficiente — e é meu problema resolver, não deles se adaptarem.

---

## 6. Métricas de sucesso do projeto

Como saber, em números, se isso valeu a pena.

### Operacionais (a razão de existir do projeto)

| Métrica | Hoje | Meta em 3 meses |
|---------|------|-----------------|
| Tempo para cancelar uma sessão e avisar todos | 30–60 min | **< 2 min** |
| Tempo para montar a grade da semana | 1–2 h | < 15 min |
| Tempo para saber quem pagou | 5–10 min de planilha | < 10 s |
| Confirmações de presença feitas pela família | 0% | > 70% |
| Leads sem follow-up | desconhecido | 0 |
| Horas administrativas por semana | estimadas 10–15 | **< 4** |

### De negócio

| Métrica | Meta |
|---------|------|
| Taxa de conversão de lead em aluno | +20% sobre a linha de base |
| Inadimplência | < 5% |
| Retenção trimestral | > 80% |
| Ocupação média das sessões | > 85% |
| Receita processada online | > 60% do total |

### De produto

| Métrica | Meta |
|---------|------|
| Famílias com conta ativa | > 90% dos atletas ativos |
| Sessões com chamada registrada | > 95% |
| Uso semanal por Arthur e Carlos | 5+ dias/semana |
| Erros críticos no Sentry | 0 por semana |
| Uptime | > 99,5% |

A primeira linha da primeira tabela é o projeto inteiro em uma métrica. Se em três meses cancelar uma sessão ainda levar meia hora, nada mais importa.

---

## 7. Estimativa de esforço

Para dar transparência ao que os $300/mês estão comprando em cada fase:

| Fase | Dias de trabalho estimados |
|------|---------------------------|
| 0 — Descoberta | 3 |
| 1 — Fundação | 9 |
| 2 — Intake e Waivers | 12 |
| 3 — Agenda e Portal | 14 |
| 4 — Pagamentos | 9 |
| 5 — CRM e Comunicação | 11 |
| 6 — Library e Avaliações | 12 |
| **Total até a Entrega 2** | **~70 dias** |
| Manutenção contínua | ~3 dias/mês |

Setenta dias úteis são cerca de 14 semanas em dedicação integral, ou o teto de 3 meses acordado quando há sobreposição entre fases e disponibilidade parcial. O prazo é apertado mas viável, **desde que a Fase 0 não atrase** — é a dependência crítica de todo o cronograma.

---

## 8. Próximos passos imediatos

Em ordem, começando agora:

1. **Validar este planejamento com Arthur e Carlos.** Uma reunião passando pelos documentos 00, 01 e 06, e confirmando escopo e prazo.
2. **Coletar as respostas bloqueantes** do [questionário de descoberta](01-descoberta-e-requisitos.md#6-perguntas-em-aberto-para-o-cliente) — as sete primeiras travam o desenvolvimento.
3. **Obter os acessos:** export do JotForm, planilhas do Google Sheets, logo em vetor, fotos.
4. **Decidir o gateway** com base em [docs/07](07-pagamentos-e-taxas.md) e abrir a conta Stripe em nome da CA Tempo.
5. **Registrar o domínio** e provisionar as contas de serviço.
6. **Iniciar a Fase 1.**

O item 2 é o único que não depende de mim. Sem a lógica de decisão documentada — especialmente a política de cancelamento e o critério de alocação em grupos — a automação não tem o que automatizar. Foi exatamente essa a conclusão da segunda reunião, e continua sendo o caminho crítico.
