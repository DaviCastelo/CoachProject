# 00 — Visão Geral

## 1. O que descobri sobre a CA Tempo Training

Levantamento feito a partir da logo, do Instagram `@catempotraining`, dos dois formulários JotForm ativos e das duas transcrições da reunião de 28/07/2026.

### Identidade

| Item | Achado |
|------|--------|
| Nome | CA Tempo Training |
| Fundação | 2025 (a logo traz "ESTABLISHED 2025") |
| Marca | Selo circular preto e branco, escudo central com monograma "CA" em script, duas estrelas laterais |
| Coaches titulares | Carlos Barboza e Arthur Pompeu (na reunião: "Carlos" e "Arthur Abreu") |
| Mercado | Futebol de base nos EUA — os níveis oferecidos no formulário (GOLD, PREMIER, ECNL, PRE-ECNL, ECNL RL, PRE-ECNL RL, MLS, GA) são exclusivos do ecossistema US Youth Soccer |
| Canal de aquisição | Instagram, com link na bio apontando direto para formulários JotForm (os UTMs confirmam: `utm_source=ig`, `utm_content=link_in_bio`) |
| Posicionamento | Desenvolvimento individual e de pequenos grupos por habilidade específica — **não** é um clube com times completos |

Esse último ponto é decisivo para o produto. Na reunião eu sugeri uma interface "estilo FIFA" para visualizar posições no campo e **Arthur e Carlos recusaram explicitamente**: o trabalho deles é por grupo de habilidade, não por escalação. O produto deve otimizar para "quem está neste horário e neste grupo", não para formação tática.

### Linhas de produto identificadas

**1. Camps de temporada** (formulário `260500843625149` — "CA TEMPO SUMMER CAMPS - 1st Edition")

- Já houve uma 1ª edição no Winter Camp; o Summer Camp é a continuação
- Datas em dois blocos: 22–25/06 e 29/06–02/07
- Horário 9h–12h, local "TBD" no momento da publicação
- Meninos e meninas nascidos entre 2013 e 2018
- Passes: Week 1 $350 (4 dias + camiseta), Week 2 $350, Full Camp $600 (8 dias + camiseta)
- Desconto de irmão no formulário atual: $25 por atleta ($50 no total para dois) — **não será mantido na nova plataforma** (removido do escopo; ver [docs/01 › RF-04](01-descoberta-e-requisitos.md#rf-04--pagamentos))
- Coleta tamanho de camiseta (Youth S até Adult M)
- Campos coletados: nome do atleta, nome do responsável, e-mail, telefone, data de nascimento, clube atual, nível competitivo
- Fecho revelador: *"Once we receive your application, we will reach out to finalize your registration and share available payment options if we are not sold out."* — ou seja, **o pagamento hoje acontece fora do formulário, manualmente, e a vaga não é reservada no ato**

**2. Treinos 1:1 e small group** (formulário `260825527256158` — "CA TEMPO Summer/Fall 2026 TRAINING")

- Dados do atleta: nome, data de nascimento, gênero, clube/time atual, nível competitivo, posição(ões)
- Tipo de treino de interesse
- Objetivos de curto e longo prazo do jogador
- **Disponibilidade** ("please be specific with days and time") — hoje texto livre
- Dados do responsável: nome, e-mail, telefone

O campo de disponibilidade em texto livre é a origem de um gargalo enorme: alguém precisa ler cada resposta e cruzar manualmente com a agenda dos coaches para montar grupos. É um dos pontos onde a automação gera mais ganho (ver [docs/05 › Motor de casamento de disponibilidade](05-features-avancadas-coaches.md#3-motor-de-casamento-de-disponibilidade-availability-matching)).

### Como a operação funciona hoje

```
Instagram (link na bio)
        │
        ▼
   JotForm  ──── intake + liability waiver
        │
        ▼
 Google Sheets ── roster por horário
                  disponibilidade dos coaches
                  status do aluno
                  ✅ verde = pagamento recebido
        │
        ▼
 E-mail + SMS manuais ── confirmação, lembrete, cancelamento
```

Não existe banco de dados, não existe portal para a família, não existe histórico do atleta, e nenhuma das três camadas conversa entre si.

---

## 2. As dores, na ordem em que doem

Extraídas literalmente das transcrições:

1. **Cancelamento de sessão é o maior sangramento de tempo.** Arthur descreveu que cancelar exige "comunicação individual com cada participante, o que resulta em desperdício substancial de tempo".
2. **Método "arcaico e totalmente manual"** (palavras de Arthur). A equipe gasta horas em tarefas administrativas que não são treinar.
3. **Rastreio de pagamento frágil.** O check verde na planilha é o único registro. Não há fatura, recibo, histórico ou cobrança automática.
4. **Prospects se perdem.** Carlos e Arthur disseram que o volume de interessados é alto e a organização perde o rastro de quem demonstrou interesse.
5. **Famílias dependem do staff para tudo.** Não conseguem ver a própria agenda nem cancelar sozinhas.
6. **Conhecimento dos coaches não é acumulado.** Não há repositório de drills, nem histórico de evolução do atleta.

---

## 3. Benchmark — o que copiar e o que superar

### Byga (referência de mercado que eles citaram)

O Byga é a plataforma que o clube deles já usa e serve de padrão de qualidade. Módulos relevantes:

| Módulo Byga | Relevância para a CA Tempo | Decisão |
|-------------|---------------------------|---------|
| Tryouts Manager | Média — eles não fazem tryouts formais, mas fazem **trials** de novos alunos | Adaptar como "Trials & Prospects" |
| Registration & Payments (preços flexíveis, bolsas, parcelamento) | **Alta** | Copiar integralmente |
| Scheduling Engine (publicar em calendários, alertas automáticos) | **Crítica** | Copiar e melhorar com cancelamento em massa |
| Resource Management (conflito de campo e de coach) | Média-alta — eles disputam campos públicos | Incluir na Fase 3 |
| Teams & Game Day (roster, chamada, chat ao vivo) | Média — sem jogos, mas chamada e roster são essenciais | Adaptar como "Roster & Check-in" |
| Club Oversight (relatório financeiro, analytics, campanhas) | Alta | Copiar na Fase 5 |
| TeamCFO | Baixa — estrutura pequena demais | Simplificar em "conta da família" |
| Communication (segmentação, chat, notificação) | **Crítica** | Copiar |
| Workflow Automation | **Crítica** | Copiar e ampliar |
| Integrated Websites | Alta — hoje eles não têm site, só Instagram | Incluir como microsite público |
| College Recruiting | Média — grande valor percebido para famílias de U14+ | Fase 7 |
| Mobile App nativo | Média | PWA primeiro, nativo depois |

O que o Byga **não** resolve e nós vamos resolver: ele é feito para clubes com centenas ou milhares de membros e times fixos. A CA Tempo é uma operação de treino individualizado, onde o produto é a *sessão* e o *grupo de habilidade*, não o time. Nosso modelo de dados nasce em volta de sessão + grupo, o que deixa a UX muito mais direta para eles.

### JotForm (a ferramenta que estamos substituindo)

O que precisamos absorver para que a migração não seja um downgrade:

- Construtor de formulários com campos variados e lógica condicional
- Formulário público sem login, mobile-first, compartilhável por link
- Assinatura eletrônica embutida
- Visualização das respostas em tabela (Jotform Tables)
- Geração de PDF a partir da submissão
- Campos de pagamento
- Fluxos de aprovação

Nossa vantagem: no JotForm cada resposta é uma linha morta. Na nossa plataforma cada submissão **cria ou atualiza um perfil de atleta, vincula responsáveis, gera fatura, coloca em um grupo e dispara automação**.

---

## 4. Princípios de produto

Cinco regras que vão arbitrar todas as decisões de escopo daqui pra frente.

1. **Simples vence bonito.** Carlos foi explícito ao rejeitar interface visual complexa. Cada tela precisa responder uma pergunta operacional em um clique.
2. **Mobile-first de verdade.** Coach está na beira do campo com uma mão livre; pai está no estacionamento. Desktop é o caso secundário, não o principal.
3. **Toda ação manual repetida vira automação.** Se o staff faz a mesma coisa duas vezes por semana, o sistema faz sozinho.
4. **A família se serve sozinha.** Cada tarefa que a família consegue resolver sem falar com o staff é tempo devolvido aos coaches.
5. **Nada se perde.** Prospect, atleta, pagamento, avaliação, sessão cancelada — tudo tem registro auditável e histórico.

---

## 5. Escopo do que estamos construindo

```
┌─────────────────────────────────────────────────────────────────┐
│                      PLATAFORMA CA TEMPO                        │
├───────────────┬───────────────────┬─────────────────────────────┤
│  SITE PÚBLICO │   PORTAL FAMÍLIA  │      PAINEL DO COACH        │
│               │                   │                             │
│ Landing       │ Agenda do atleta  │ Calendário + roster         │
│ Camps         │ Confirmar/cancelar│ Grupos e turmas             │
│ Inscrição     │ Faturas e recibos │ Inscrições e waivers        │
│ Waiver        │ Perfil do atleta  │ CRM de prospects            │
│ Feed Instagram│ Progresso/relatos │ Financeiro                  │
│               │ Biblioteca (parte)│ Biblioteca de drills        │
│               │ Mensagens         │ Avaliações e IDP            │
│               │                   │ Relatórios e automações     │
└───────────────┴───────────────────┴─────────────────────────────┘
```

Detalhamento de cada bloco em [docs/04 — Módulos Funcionais](04-modulos-funcionais.md).
