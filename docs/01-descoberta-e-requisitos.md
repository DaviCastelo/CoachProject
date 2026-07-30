# 01 — Descoberta e Requisitos

## 1. Personas

### P1 — Coach/Owner (Arthur, Carlos)
Treina em campo a maior parte do dia, resolve administração no celular entre sessões e à noite. Não é usuário técnico. Quer abrir o app, ver "quem tenho hoje às 17h" e "quem ainda não pagou" sem pensar. É quem sente a dor do cancelamento manual.

**Sucesso para ele:** cancelar uma sessão em 3 toques e saber que todo mundo foi avisado.

### P2 — Coach assistente / staff
Pode ser contratado por sessão. Tem acesso à agenda completa do clube, faz chamada e registra nota do treino. **Não** deve ver dados financeiros nem contatos que não sejam dos seus atletas.

**Sucesso para ele:** chegar no campo, abrir a chamada e ir treinar.

### P3 — Responsável / Pai (usuário mais numeroso)
Descobriu a CA Tempo pelo Instagram. Inscreve um ou dois filhos. Quer saber onde é o treino, se vai chover, se pode remarcar, quanto deve, e se o filho está evoluindo. Usa exclusivamente celular. Muitas vezes fala inglês; parte da base é hispânica ou brasileira.

**Sucesso para ele:** resolver tudo sem mandar mensagem para o coach.

### P4 — Atleta (8 a 18 anos)
Menor de idade na maioria dos casos. Acesso próprio só faz sentido a partir de ~13 anos, e ainda assim com consentimento do responsável. Motiva-se por vídeos e conquistas.

**Sucesso para ele:** ver os drills da semana e treinar entre as sessões.

### P5 — Prospect (lead)
Ainda não é cliente. Preencheu o formulário do link na bio. Hoje pode ser esquecido. Precisa ser cultivado até virar trial e depois aluno.

**Sucesso para ele:** receber resposta rápida e uma proposta de horário que caiba na agenda dele.

---

## 2. Matriz de permissões

| Recurso | Owner | Admin | Coach | Staff | Responsável | Atleta |
|---|---|---|---|---|---|---|
| Ver todas as sessões | ✅ | ✅ | ✅ | ✅ | Só do filho | Só as suas |
| Criar/editar sessão | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Cancelar sessão em massa | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver roster + contato dos pais | ✅ | ✅ | ✅ | Só do seu grupo | ❌ | ❌ |
| Fazer chamada | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Confirmar/cancelar presença própria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (se habilitado) |
| Ver dados financeiros do clube | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ver a própria fatura | — | — | — | — | ✅ | ❌ |
| Emitir reembolso/crédito | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gerenciar CRM de prospects | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Upload na biblioteca | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver biblioteca (itens públicos) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Criar avaliação | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver avaliação do atleta | ✅ | ✅ | ✅ | ❌ | ✅ (versão família) | ❌ |
| Ver notas privadas do coach | ✅ | ✅ | Só as suas | ❌ | ❌ | ❌ |
| Configurar organização / usuários | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Exportar dados | ✅ | ✅ | ❌ | ❌ | Só os próprios | ❌ |

Essa matriz é a especificação direta das políticas de RLS descritas em [docs/03 › Row Level Security](03-modelo-de-dados.md#8-row-level-security-rls).

---

## 3. Requisitos funcionais rastreados

Cada requisito tem origem explícita. `[R]` = dito na reunião, `[F]` = observado nos formulários JotForm, `[B]` = benchmark Byga/JotForm, `[D]` = proposta minha.

### RF-01 · Intake e cadastro

| ID | Requisito | Origem | Prioridade |
|----|-----------|--------|-----------|
| RF-01.1 | Formulário público de inscrição, sem login, mobile-first, com link compartilhável | [R][F] | Must |
| RF-01.2 | Submissão cria automaticamente perfil de atleta com nome, idade, interesse de habilidade e waiver assinado | [R] | Must |
| RF-01.3 | Vincular atleta a um ou mais responsáveis; suportar irmãos no mesmo household | [F] | Must |
| RF-01.4 | Coletar todos os campos dos formulários atuais (clube, nível, posição, objetivos, disponibilidade, tamanho de camiseta, gênero, data de nascimento) | [F] | Must |
| RF-01.5 | Waiver de responsabilidade com assinatura eletrônica e trilha de auditoria | [R] | Must |
| RF-01.6 | Detectar atleta já existente (mesmo nome + data de nascimento) e oferecer atualização em vez de duplicar | [D] | Must |
| RF-01.7 | Construtor de formulários para o staff criar novos formulários sem código | [B] | Should |
| RF-01.8 | Lógica condicional (ex.: mostrar tamanho de camiseta só se for camp) | [B] | Should |
| RF-01.9 | Gerar PDF da submissão + waiver e anexar ao perfil | [B] | Should |
| RF-01.10 | Importar histórico do JotForm e das planilhas atuais via CSV | [D] | Must |

### RF-02 · Agenda e sessões

| ID | Requisito | Origem | Prioridade |
|----|-----------|--------|-----------|
| RF-02.1 | Calendário (dia/semana/mês) com todas as sessões | [R] | Must |
| RF-02.2 | **Clicar num horário abre o roster daquele grupo** — requisito nomeado por Carlos como prioridade | [R] | Must |
| RF-02.3 | O roster mostra contato dos pais e dados de inscrição | [R] | Must |
| RF-02.4 | Sessões recorrentes com exceções (RRULE) | [D] | Must |
| RF-02.5 | Cadastro de locais/campos com endereço e link de mapa | [D] | Must |
| RF-02.6 | Disponibilidade dos coaches (regras recorrentes + bloqueios pontuais) | [R] | Must |
| RF-02.7 | Detecção de conflito: coach duplicado, campo duplicado, capacidade estourada | [B] | Should |
| RF-02.8 | **Cancelamento de sessão com notificação automática a todos os participantes** — a dor nº 1 | [R] | Must |
| RF-02.9 | Cancelamento em lote (ex.: "todas as sessões de sábado por causa de chuva") | [D] | Must |
| RF-02.10 | Reagendamento com proposta de novo horário e aceite da família | [D] | Should |
| RF-02.11 | Lista de espera com promoção automática quando alguém cancela | [D] | Should |
| RF-02.12 | Exportar/assinar calendário em iCal para Google/Apple Calendar | [B] | Should |

### RF-03 · Portal da família

| ID | Requisito | Origem | Prioridade |
|----|-----------|--------|-----------|
| RF-03.1 | Família acessa a agenda dos próprios atletas | [R] | Must |
| RF-03.2 | **Família responde a presença sozinha, com três opções de RSVP: "Sim", "Não" e "Sem resposta"** | [R] | Must |
| RF-03.3 | Política de cancelamento configurável (prazo, crédito x cobrança) | [D] | Must |
| RF-03.4 | Ver faturas, recibos e saldo | [D] | Must |
| RF-03.5 | Editar dados do atleta e do responsável | [D] | Must |
| RF-03.6 | Um login enxerga todos os filhos (household) | [F] | Must |
| RF-03.7 | Receber e responder mensagens do clube | [D] | Should |
| RF-03.8 | Ver relatório de progresso do atleta | [R] | Could |
| RF-03.9 | Preferências de notificação (e-mail/SMS/push, horário de silêncio) | [D] | Should |

### RF-04 · Pagamentos

| ID | Requisito | Origem | Prioridade |
|----|-----------|--------|-----------|
| RF-04.1 | Cobrança online integrada à inscrição | [R] | Must |
| RF-04.2 | Escolha de gateway com taxa mínima — decisão em aberto na reunião | [R] | Must |
| RF-04.3 | Substituir o "check verde" por status de pagamento real e auditável | [R] | Must |
| RF-04.5 | Registrar pagamento offline (dinheiro, cheque, Zelle) | [R] | Must |
| RF-04.6 | Parcelamento / plano de pagamento | [B] | Should |
| RF-04.7 | Bolsa / desconto financeiro por família | [B] | Should |
| RF-04.8 | Cupom promocional | [D] | Could |
| RF-04.9 | Cobrança automática de inadimplência (dunning) com lembretes | [D] | Should |
| RF-04.10 | Crédito em conta quando uma sessão é cancelada pelo clube | [D] | Must |
| RF-04.11 | Reembolso parcial e total com registro | [D] | Should |

### RF-05 · CRM de prospects e trials

| ID | Requisito | Origem | Prioridade |
|----|-----------|--------|-----------|
| RF-05.1 | **Portal dedicado para rastrear novos interessados para não perder ninguém** | [R] | Must |
| RF-05.2 | Pipeline com estágios (novo → contatado → trial agendado → trial realizado → convertido → perdido) | [D] | Must |
| RF-05.3 | **Alocar o prospect em um grupo específico (ex.: "U9 Blue") já na inscrição** | [R] | Must |
| RF-05.4 | Registro de atividades e follow-ups com dono e prazo | [D] | Must |
| RF-05.5 | Rastrear origem (UTM do Instagram já vem nos links atuais) | [F] | Should |
| RF-05.6 | Alerta de lead sem contato há X dias | [D] | Should |
| RF-05.7 | Agendar trial e converter em inscrição com um clique | [D] | Should |

### RF-06 · Comunicação

| ID | Requisito | Origem | Prioridade |
|----|-----------|--------|-----------|
| RF-06.1 | E-mail transacional (confirmação, lembrete, recibo, cancelamento) | [R] | Must |
| RF-06.2 | SMS para avisos urgentes (cancelamento no mesmo dia) | [R] | Must |
| RF-06.3 | Push via PWA | [D] | Should |
| RF-06.4 | Comunicado segmentado (por grupo, faixa etária, status de pagamento) | [B] | Should |
| RF-06.5 | Templates editáveis pelo staff | [B] | Should |
| RF-06.6 | Log de entrega, abertura e falha | [D] | Should |
| RF-06.7 | Chat/thread entre coach e família dentro da plataforma | [B] | Could |

### RF-07 · Club Library

| ID | Requisito | Origem | Prioridade |
|----|-----------|--------|-----------|
| RF-07.1 | **Coaches sobem vídeos de treino (drills, triangulações) num repositório compartilhado** | [R] | Must |
| RF-07.2 | Organização por tag, categoria de habilidade, faixa etária e dificuldade | [D] | Should |
| RF-07.3 | Controle de visibilidade (só staff / coaches / famílias / grupo específico) | [D] | Must |
| RF-07.4 | Metadados do drill: objetivo, duração, nº de jogadores, equipamento, espaço | [D] | Should |
| RF-07.5 | Coleções/playlists e planos de sessão montados a partir de drills | [D] | Could |
| RF-07.6 | Formulários de avaliação armazenados na biblioteca | [R] | Should |
| RF-07.7 | Biblioteca de vídeos **separada** para as famílias, distinta do acervo técnico dos coaches (prioridade 3) | [D] | Could |

### RF-08 · Avaliação e desenvolvimento

| ID | Requisito | Origem | Prioridade |
|----|-----------|--------|-----------|
| RF-08.1 | Formulário de avaliação para acompanhar o desenvolvimento do jogador — Carlos e Arthur classificaram como **prioridade secundária** | [R] | Should |
| RF-08.2 | Templates de avaliação por categoria (técnico, tático, físico, mental) | [D] | Should |
| RF-08.3 | Evolução ao longo do tempo com gráfico comparativo | [D] | Could |
| RF-08.4 | Relatório de progresso para a família em PDF | [D] | Could |
| RF-08.5 | Plano de desenvolvimento individual (IDP) com metas | [D] | Could |

### RF-09 · Gestão e relatórios

| ID | Requisito | Origem | Prioridade |
|----|-----------|--------|-----------|
| RF-09.1 | Dashboard operacional (sessões da semana, presenças, pendências) | [D] | Must |
| RF-09.2 | Dashboard financeiro (receita, a receber, ticket médio) | [B] | Should |
| RF-09.3 | Taxa de ocupação das sessões e dos grupos | [D] | Should |
| RF-09.4 | Retenção e churn por coorte | [D] | Could |
| RF-09.5 | Horas trabalhadas por coach para pagamento | [D] | Should |
| RF-09.6 | Exportação CSV de tudo | [D] | Must |
| RF-09.7 | Log de auditoria de ações sensíveis | [D] | Must |

### RF-10 · Site público

| ID | Requisito | Origem | Prioridade |
|----|-----------|--------|-----------|
| RF-10.1 | Landing page da marca, substituindo o link na bio do Instagram | [B] | Should |
| RF-10.2 | Página por programa/camp com inscrição direta | [F] | Must |
| RF-10.3 | Contador de vagas e estado "sold out" | [F] | Should |
| RF-10.4 | Feed do Instagram embutido | [D] | Could |
| RF-10.5 | SEO local ("soccer training near me") | [D] | Could |

---

## 4. Requisitos não funcionais

| ID | Requisito | Alvo |
|----|-----------|------|
| RNF-01 | Mobile-first; tudo operável com uma mão | 100% das telas críticas |
| RNF-02 | Performance | LCP < 2,5 s em 4G; INP < 200 ms |
| RNF-03 | Disponibilidade | 99,5% mensal |
| RNF-04 | Acessibilidade | WCAG 2.2 AA |
| RNF-05 | Internacionalização | EN (padrão), PT-BR, ES |
| RNF-06 | Fuso horário | Timestamps em UTC, exibição no fuso da organização |
| RNF-07 | Segurança | RLS em todas as tabelas; MFA obrigatório para owner/admin |
| RNF-08 | Privacidade | Dados de menores segregados; consentimento parental registrado |
| RNF-09 | Backup | PITR de 7 dias + dump diário externo |
| RNF-10 | Auditoria | Toda ação destrutiva ou financeira logada com ator, IP e timestamp |
| RNF-11 | Resiliência offline | Chamada funciona sem rede e sincroniza depois |
| RNF-12 | Custo de infraestrutura | ≤ $120/mês no ano 1 |

---

## 5. Fora de escopo (explicitamente)

Registrar o que **não** vamos fazer é tão importante quanto o que vamos, porque protege o prazo de 45 dias–3 meses.

- Interface tática "estilo FIFA" com posicionamento em campo — **rejeitada pelo cliente na reunião**
- Gestão de campeonatos, tabelas, súmulas e arbitragem
- Streaming ao vivo de jogos
- App nativo iOS/Android na v1 (PWA cobre o caso de uso; nativo entra na Fase 7 se houver demanda)
- Folha de pagamento e contabilidade fiscal (exportamos os dados; a contabilidade fica com o contador)
- Loja de produtos/uniformes (só o controle de tamanho de camiseta dos camps)
- Marketplace multi-clube público

---

## 6. Perguntas em aberto para o cliente

Estas travam decisões de implementação. A reunião 2 já deixou uma pendência formal: *"[Arthur, Carlos] Documentar Processos Atuais: fornecer detalhes sobre o fluxo de trabalho manual e a lógica de tomada de decisão"*. Esta seção é o roteiro dessa documentação.

**Bloqueantes (respondidas antes da Fase 2)**

1. Qual é exatamente a política de cancelamento? Quantas horas de antecedência, gera crédito ou perda, quem pode isentar?
2. Quando o clube cancela, o padrão é crédito, reposição ou reembolso?
3. Como um prospect vira aluno hoje? Quais critérios definem que ele entra no "U9 Blue" e não no "U9 White"? (Isso vira algoritmo — precisa da lógica explícita.)
4. Qual o texto legal exato do waiver atual e quem é o responsável jurídico por ele?
5. Quais gateways de pagamento já existem em nome da empresa? Há conta Stripe ou PayPal Business ativa?
6. Como os coaches são remunerados — por hora, por sessão, percentual? (Define o relatório de horas.)
7. Quantos atletas ativos existem hoje e quantas sessões por semana? (Dimensiona capacidade e custo.)

**Importantes (antes da Fase 4)**

8. Preços praticados fora dos camps: quanto custa 1:1, small group, pacote de 5/10 sessões?
9. Existe mensalidade recorrente ou tudo é pacote avulso?
10. Quais campos/locais são usados e há custo de aluguel a repassar?
11. Há política de desconto (early bird, bolsa)?

**Desejáveis**

12. Alguém do staff vai administrar o sistema além de Arthur e Carlos?
13. Existe intenção de licenciar a plataforma para outros clubes no futuro? (Se sim, o multi-tenant da Fase 1 deixa de ser precaução e vira produto.)
14. Há acervo de vídeos de drills já gravado, e em qual volume?
