# 04 — Módulos Funcionais

Dez módulos. Para cada um: o problema que resolve, as telas, os fluxos e as automações. Onde faz diferença, incluí o wireframe em texto para deixar claro o que aparece na tela.

---

## M1 · Intake e Inscrição

**Substitui:** os dois formulários JotForm.

### Telas

| Tela | Rota | Quem acessa |
|------|------|-------------|
| Formulário público de inscrição | `/register/[formSlug]` | Qualquer um, sem login |
| Confirmação + próximos passos | `/register/[formSlug]/success` | Qualquer um |
| Construtor de formulários | `/forms/[id]/edit` | Owner, Admin |
| Caixa de submissões | `/forms/[id]/submissions` | Owner, Admin, Coach |
| Revisão de inscrição | `/registrations/[id]` | Owner, Admin, Coach |

### Fluxo de inscrição

```
Pai clica no link da bio do Instagram
  → /register/summer-camp-2026?utm_source=ig&utm_content=link_in_bio
  → Passo 1: dados do atleta (nome, nascimento, gênero, clube, nível, posições)
       └ validação em tempo real: ano de nascimento fora de 2013–2018 → mensagem clara
  → Passo 2: dados do responsável (nome, e-mail, telefone, parentesco)
       └ se o e-mail já existe → "já temos você, é o mesmo cadastro?" → login por magic link
  → Passo 3: escolha do pass (Week 1 / Week 2 / Full Camp)
       └ contador de vagas ao vivo; se lotado, oferece lista de espera
  → Passo 4: saúde e emergência (alergias, medicação, contato de emergência, consentimento de imagem)
  → Passo 5: waiver — texto completo, scroll obrigatório até o fim, assinatura desenhada ou digitada
  → Passo 6: pagamento (ACH ou cartão) OU "pagar depois" se o clube permitir
  → Confirmação: e-mail com recibo + PDF do waiver + link do portal
```

### O que acontece no servidor a cada submissão

Uma única transação:

1. `form_submissions` recebe o payload cru (auditoria — o que a pessoa realmente digitou)
2. Casa ou cria `households`, `guardians`, `athletes` a partir dos `mapsTo` do schema
3. Detecta duplicata por `(lower(first_name), lower(last_name), date_of_birth)` — se achar, atualiza em vez de criar
4. Grava `waiver_signatures` com hash, IP e user agent
5. Cria `registrations` com status `pending` (ou `approved` se o programa for auto-aprovação)
6. Gera `invoices` com as linhas e os descontos aplicados
7. Se houver pagamento, cria o PaymentIntent e vincula
8. Se a inscrição vier de um formulário de interesse, cria também um `leads` no estágio `new`
9. Enfileira: e-mail de confirmação para a família, notificação para o staff
10. Grava `audit_log`

**Regra de ouro:** o passo 1 é gravado antes de qualquer processamento. Se algo quebrar na etapa 4, a submissão não se perde — ela aparece na caixa de submissões com erro e pode ser reprocessada. No JotForm de hoje, o dado só existe lá; aqui ele nunca some.

### Construtor de formulários

Interface arrastar-e-soltar sobre o JSON schema descrito em [docs/03 › Formulários](03-modelo-de-dados.md#6-formulários-inscrições-e-waivers).

- Tipos de campo: texto, e-mail, telefone (máscara US), data, data de nascimento, select, multi-select, radio, checkbox, textarea, upload, assinatura, cabeçalho, texto informativo, seletor de pass
- Lógica condicional: `showIf` por valor de outro campo
- Campo mapeado ao domínio (`mapsTo`) ou campo livre (fica só no JSON da submissão)
- Preview lado a lado, mobile e desktop
- Publicação versionada — editar um formulário publicado cria a versão n+1; submissões antigas continuam apontando para a versão que a pessoa viu

### Templates prontos no seed
Camp de temporada, treino 1:1 / small group, avaliação de trial, atualização de dados da temporada, pesquisa de satisfação.

---

## M2 · Agenda e Sessões

**Substitui:** as abas de roster e disponibilidade do Google Sheets. É o coração do produto.

### Tela principal — calendário do coach

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◀ Julho 2026 ▶      [Dia][Semana][Mês][Agenda]     Coach: Todos ▾    │
│                                          [+ Nova sessão]  [Filtros ▾]│
├──────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┤
│      │  DOM   │  SEG   │  TER   │  QUA   │  QUI   │  SEX   │  SÁB   │
├──────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│16:00 │        │▓U9 Blue│        │▓U9 Blue│        │        │▓Camp   │
│      │        │ 6/8 ✓5 │        │ 6/8 ✓4 │        │        │ 22/24  │
├──────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│17:00 │        │▒U12 Red│        │▒U12 Red│▓1:1    │        │▓Camp   │
│      │        │ 8/8 ✓8 │        │ 8/8 ✓6 │ Lucas  │        │        │
├──────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│18:00 │        │        │░U14 GK │        │░U14 GK │        │        │
│      │        │        │ 4/6    │        │ 4/6 ⚠  │        │        │
└──────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘
  Cor = grupo    n/N = confirmados/capacidade    ✓n = presentes    ⚠ = conflito
```

### Painel do roster — o requisito nomeado por Carlos

Clicar em qualquer bloco abre um painel lateral (não muda de página):

```
┌─ U9 Blue · Segunda, 28/07 · 16:00–17:00 ──────────────── ✕ ─┐
│ 📍 Evelyn Greer Park · Field 3        Coach: Carlos Barboza  │
│ ☁ 28°C, 10% chuva                                            │
│                                                              │
│ [Fazer chamada] [Enviar recado] [Editar] [⚠ Cancelar sessão] │
│                                                              │
│ ROSTER · 6 de 8                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 🖼 Lucas Silva · U9 · 8 anos              ✓ Confirmado │  │
│ │    📞 Maria Silva (mãe) · (305) 555-0142  📧 Enviar    │  │
│ │    ✅ Waiver válido    💰 Em dia                        │  │
│ ├────────────────────────────────────────────────────────┤  │
│ │ 🖼 Ethan Brown · U9 · 9 anos              ✓ Confirmado │  │
│ │    📞 John Brown (pai) · (305) 555-0177                 │  │
│ │    ⚠ ALERGIA: amendoim   💰 $350 em aberto              │  │
│ ├────────────────────────────────────────────────────────┤  │
│ │ 🖼 Sofia Martinez · U9 · 8 anos           ✗ Cancelou   │  │
│ │    Cancelou há 2h · "está doente"                       │  │
│ │    → [Oferecer vaga à lista de espera (2)]              │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ PLANO DE TREINO: Finishing under pressure  [ver drills]     │
│ NOTA DA SESSÃO: ______________________________              │
└──────────────────────────────────────────────────────────────┘
```

Tudo o que a reunião pediu está aqui em uma tela: quem está no grupo, contato dos pais, dados de inscrição, status de pagamento e alerta médico.

### Criação de sessão

- Sessão avulsa ou série recorrente (RRULE: "toda segunda e quarta às 16h até 20/12")
- Escolha de grupo (traz o roster automaticamente) ou de atleta único (1:1)
- Detecção de conflito **antes** de salvar, via `detect_session_conflicts` — mostra o que colide e permite salvar mesmo assim com justificativa
- Duplicar semana inteira em um clique (montagem de temporada em minutos, não horas)

### Cancelamento — a dor nº 1 resolvida

```
Coach clica em "Cancelar sessão"
  ↓
┌─ Cancelar U9 Blue · Segunda 28/07 16:00 ─────────────────┐
│ Motivo:  ( ) Chuva  ( ) Campo indisponível               │
│          ( ) Coach indisponível  ( ) Outro: ____         │
│                                                           │
│ Escopo:  (•) Apenas esta sessão                          │
│          ( ) Esta e as próximas da série                 │
│          ( ) Todas as sessões de 28/07 (4 sessões)  ←────┼── cancelamento em lote
│                                                           │
│ Financeiro: (•) Gerar crédito na conta                   │
│             ( ) Agendar reposição                        │
│             ( ) Sem impacto financeiro                   │
│                                                           │
│ Avisar 6 famílias por:  ☑ SMS  ☑ E-mail  ☑ Push          │
│ Mensagem: "Treino de hoje cancelado por chuva. Um        │
│ crédito foi lançado na sua conta. Nos vemos quarta!"     │
│                                                     [Editar]│
│                                                           │
│              [Voltar]        [Cancelar e avisar 6 famílias]│
└───────────────────────────────────────────────────────────┘
```

Um clique substitui o que hoje é "comunicação individual com cada participante". O sistema ainda gera os créditos, libera o campo na agenda e registra tudo no log de auditoria.

### Chamada (mobile, offline-first)

Lista grande, dedo-friendly, três estados por atleta (presente / ausente / atrasado), swipe para marcar. Funciona sem rede — grava em IndexedDB e sincroniza. Opcional: check-in por QR code, com o coach escaneando o crachá digital no celular do pai.

Ao fechar a chamada, o coach pode registrar o **RPE da sessão** (esforço percebido de 1 a 10), que alimenta o monitoramento de carga descrito em [docs/05](05-features-avancadas-coaches.md#2-monitoramento-de-carga-de-treino-e-risco-de-lesão).

### Automações do módulo

| Gatilho | Ação | Momento |
|---------|------|---------|
| Sessão criada | Convite para o roster | Imediato |
| 48h antes | Pedido de confirmação de presença | Cron horário |
| 24h antes | Lembrete com local e link do mapa | Cron horário |
| 2h antes | SMS para quem não confirmou | Cron horário |
| Sessão cancelada | Notificação multicanal + crédito | Imediato |
| Alguém cancela | Oferta automática ao primeiro da lista de espera, com 2h de validade | Imediato |
| Sessão termina | Lembrete ao coach para fechar a chamada | +30 min |
| 3 faltas em 30 dias | Alerta de risco de churn para o coach | Cron diário |
| Previsão de chuva > 70% | Sugestão de cancelamento no dashboard | Cron 6h antes |

---

## M3 · Portal da Família

**Resolve:** a dependência total do staff.

### Home do portal

```
┌─ Olá, Maria 👋 ──────────────────────────────────────────┐
│                                                           │
│ SEUS ATLETAS                                              │
│ [🖼 Lucas · U9 Blue]  [🖼 Sofia · U12 Red]  [+ adicionar] │
│                                                           │
│ PRÓXIMO TREINO                                            │
│ ┌───────────────────────────────────────────────────────┐│
│ │ Lucas · U9 Blue                                       ││
│ │ Segunda, 28/07 · 16:00–17:00                          ││
│ │ 📍 Evelyn Greer Park, Field 3  [abrir no mapa]        ││
│ │                                                        ││
│ │   RSVP:  (•) Sim    ( ) Não    ( ) Sem resposta       ││
│ └───────────────────────────────────────────────────────┘│
│                                                           │
│ ⚠ AÇÕES PENDENTES                                        │
│ • Fatura de $350 vence em 3 dias        [Pagar agora]    │
│ • Waiver da Sofia expira em 15 dias     [Assinar]        │
│                                                           │
│ ESTA SEMANA          Seg ✓  Qua ✓  Sáb —                 │
└───────────────────────────────────────────────────────────┘
```

### Funcionalidades

- **Agenda** — lista e calendário dos filhos, com assinatura iCal para sincronizar no Google/Apple Calendar
- **RSVP (Sim / Não / Sem resposta)** — a família responde à presença sozinha, com a política do clube aplicada e explicada na hora ("cancelamento com menos de 24h não gera crédito"). "Sem resposta" é o estado inicial e pode ser reescolhido enquanto houver prazo.
- **Solicitar reposição** — vê os horários com vaga que combinam com o perfil do atleta e pede
- **Faturas** — histórico, recibo em PDF, pagar em aberto, saldo de crédito
- **Perfil do atleta** — atualiza contato, saúde, disponibilidade, foto, consentimentos
- **Progresso** — relatórios de avaliação compartilhados, presença, clipes de vídeo
- **Mensagens** — thread com o clube
- **Preferências** — canais de notificação, idioma, horário de silêncio

### Detalhes que importam

- Um login enxerga todos os filhos; trocar de atleta é um toque
- Instalável como app (PWA) com ícone da CA Tempo na home screen
- Multi-idioma: inglês padrão, espanhol e português disponíveis
- Nenhuma senha obrigatória — magic link resolve

---

## M4 · Pagamentos e Financeiro

**Substitui:** o check verde na planilha e o "we will reach out to share payment options".

### Para a família
Checkout na inscrição (ACH ou cartão), pagamento de fatura em aberto, plano de parcelas, uso automático de crédito, recibo em PDF, método salvo para próxima compra.

### Para o clube

| Tela | O que faz |
|------|-----------|
| `/billing` | Visão geral: recebido no mês, a receber, vencido, ticket médio |
| `/billing/invoices` | Todas as faturas, filtro por status/programa/família |
| `/billing/invoices/[id]` | Detalhe, editar, enviar cobrança, registrar pagamento offline, reembolsar |
| `/billing/payments` | Todos os pagamentos com a taxa real de cada um |
| `/billing/discounts` | Regras de desconto, cupons, bolsas |
| `/billing/payouts` | Conciliação com os repasses da Stripe |

### Registro de pagamento offline
Arthur combinou pagar em dinheiro. Muitos pais fazem o mesmo. A tela de registro manual precisa ser tão rápida quanto marcar o check verde:

```
Fatura #2026-0147 · Lucas Silva · $350,00
[Dinheiro] [Cheque] [Zelle] [Venmo] [Outro]
Valor: $350,00    Data: 28/07/2026    Ref: ______
                                  [Registrar pagamento]
```

Um clique, dois campos. Se for mais lento que a planilha, eles voltam para a planilha.

### Descontos
As regras de desconto (cupom promocional, early bird e bolsa) ficam em `/billing/discounts` e são aplicadas conforme cada regra no checkout. **Não há desconto de irmão** — removido do escopo a pedido do cliente.

### Régua de cobrança (dunning)
Vercel Workflow durável: vencimento → lembrete no dia +1 → e-mail no dia +3 → SMS no dia +7 → alerta ao admin no dia +14 → marcação de bloqueio de inscrição no dia +30 (configurável). Qualquer pagamento no meio do caminho encerra a régua.

Análise de taxas e escolha do gateway em [docs/07](07-pagamentos-e-taxas.md).

---

## M5 · CRM de Prospects e Trials

**Resolve:** *"perdem o rastro de jogadores interessados por causa do alto volume de consultas"*.

### Pipeline em kanban

```
┌─ NOVO (7) ─┬─ CONTATADO (4) ─┬─ TRIAL AGENDADO (3) ─┬─ TRIAL FEITO (2) ─┬─ CONVERTIDO ─┐
│ Ryan T.    │ Maya P.         │ Diego R.             │ Alex K.           │ Lucas S.     │
│ U10 · IG   │ U12 · indicação │ U9 · 30/07 16h       │ ⭐ 8/10           │ → U9 Blue    │
│ há 2h      │ há 3 dias ⚠     │ Grupo: definir       │ → propor pacote   │              │
├────────────┼─────────────────┼──────────────────────┼───────────────────┼──────────────┤
│ Emma L.    │ Noah B.         │ Zoe M.               │                   │              │
│ U14 · IG   │ U8 · IG         │ U14 · 02/08 17h      │                   │              │
│ há 5h      │ há 6 dias 🔴    │                      │                   │              │
└────────────┴─────────────────┴──────────────────────┴───────────────────┴──────────────┘
  ⚠ sem contato há 3+ dias      🔴 sem contato há 5+ dias
```

Arrastar entre colunas muda o estágio e dispara automação.

### Ficha do lead
Dados do atleta e do responsável, origem com UTM (o link da bio já carrega `utm_source=ig`), disponibilidade declarada, **grupo definido manualmente pelo staff**, histórico completo de interações, próxima ação com prazo e responsável.

### Alocação manual em grupo
Este é o RF-05.3 — Carlos quer alocar em "U9 Blue" já na inscrição. **A alocação é manual:** o staff escolhe o grupo do prospect a partir da lista de grupos do clube. Não há sugestão automática de grupo — o time coloca cada atleta no grupo que quiser. Para apoiar a decisão, a ficha exibe a disponibilidade declarada e a idade/nível do atleta ao lado da lista de grupos, mas a escolha é sempre humana.

### Automações
Lead novo → notificação instantânea ao staff e e-mail automático de boas-vindas em até 5 minutos. Sem resposta em 3 dias → tarefa criada. Sem resposta em 7 → entra em régua de nutrição. Trial realizado → e-mail com o resumo da avaliação e a proposta de pacote. Convertido → cria atleta ativo, coloca no grupo, gera fatura, dispara onboarding.

---

## M6 · Comunicação

### Canais
E-mail transacional (Resend + React Email, com a marca), SMS (Twilio, só para urgência e lembrete), push (Web Push via PWA), e mensagens dentro da plataforma.

### Comunicado segmentado

```
┌─ Novo comunicado ─────────────────────────────────────┐
│ Para:  ☑ U9 Blue (8)   ☐ U12 Red (8)   ☐ U14 GK (6)  │
│        ou filtro avançado:                            │
│        [Faixa etária ▾] [Status ▾] [Pagamento ▾]      │
│        → 14 destinatários                             │
│                                                        │
│ Canais: ☑ E-mail  ☑ Push  ☐ SMS                       │
│ Assunto: ...                                          │
│ Mensagem: ...   Variáveis: {{athlete_name}} ...       │
│                                                        │
│ [Enviar teste para mim]  [Agendar]  [Enviar agora]    │
└────────────────────────────────────────────────────────┘
```

### Boas práticas embutidas
Horário de silêncio respeitado (nada de SMS às 23h, exceto cancelamento de sessão iminente), descadastro por categoria, log completo de entrega e falha, `idempotency_key` em toda mensagem para não duplicar.

### Biblioteca de templates
`session_canceled`, `session_reminder_24h`, `session_confirm_request`, `registration_received`, `registration_approved`, `waiver_expiring`, `payment_receipt`, `payment_reminder`, `payment_overdue`, `waitlist_spot_available`, `evaluation_shared`, `welcome_family`, `trial_followup`, `birthday`. Todos editáveis pelo staff, em três idiomas.

---

## M7 · Club Library

**Atende:** *"coaches poderiam subir vídeos de treino, como drills e triangulações, num repositório compartilhado"*.

### Navegação
Grid de cards com thumbnail, filtros combinados por categoria de habilidade, faixa etária, dificuldade, duração e número de jogadores. Busca textual em título, objetivo e tags.

### Card de drill
Vídeo (player HLS adaptativo do Cloudflare Stream), objetivo, pontos de coaching em bullets, setup (espaço, jogadores, equipamento), diagrama, variações, e drills relacionados.

### Upload
Arrastar o vídeo, preencher metadados, definir visibilidade. Transcodificação e thumbnail automáticos. Nos vídeos com atletas identificáveis, a visibilidade padrão é `staff` e há um aviso sobre consentimento de imagem.

### Construtor de plano de sessão
Arrasta drills para uma linha do tempo, define minutos de cada bloco, o total é somado. Salva como template reutilizável, anexa a uma sessão da agenda e exporta PDF para levar impresso ao campo.

```
Plano: "Finishing under pressure" · U9–U11 · 60 min
├ 10 min  Aquecimento — Rondo 4v2
├ 15 min  Técnico — Finalização de primeira
├ 20 min  Situacional — 2v1 para o gol
└ 15 min  Jogo — 4v4 com gols pequenos
                                    [Exportar PDF] [Anexar à sessão]
```

### Visibilidade
`staff` (só interno) · `coaches` · `group` (só um grupo) · `public` (marketing).

### Biblioteca separada para as famílias (prioridade 3)
As famílias **não** enxergam o acervo técnico dos coaches. Elas têm uma **biblioteca de vídeos separada** (RF-07.7), curada à parte — drills leves para praticar em casa, sem os planos e as anotações internas. É prioridade 3 (Could) e entra numa fase posterior: o pai que recebe "3 drills para o Lucas treinar no quintal essa semana" percebe valor entre as sessões, mas isso não bloqueia o MVP.

---

## M8 · Avaliação e Desenvolvimento

Prioridade secundária confirmada na reunião — entra na Fase 6.

### Formulário de avaliação (mobile, para preencher no campo)

```
┌─ Avaliação · Lucas Silva · U9 Blue ───────────────┐
│ Template: Avaliação trimestral U9–U11             │
│                                                    │
│ TÉCNICO                                            │
│ Primeiro toque      ●●●●●●●○○○  7                 │
│ Passe               ●●●●●●○○○○  6                 │
│ Finalização         ●●●●●●●●○○  8                 │
│ 1v1 ofensivo        ●●●●●●●○○○  7                 │
│ TÁTICO                                             │
│ Leitura de jogo     ●●●●●○○○○○  5                 │
│ Tomada de decisão   ●●●●●●○○○○  6                 │
│ ...                                                │
│                                                    │
│ Pontos fortes: ______________________              │
│ A desenvolver: ______________________              │
│ Resumo para a família: ______________              │
│ 🔒 Nota privada (só staff): _________              │
│                                                    │
│          [Salvar rascunho]  [Compartilhar]         │
└────────────────────────────────────────────────────┘
```

### Visualização do progresso
Radar chart comparando a avaliação atual com a anterior e com a média da faixa etária. Linha do tempo do score geral. Destaque automático da maior evolução e da maior queda.

### Relatório para a família
PDF com a marca da CA Tempo: radar, evolução, resumo do coach, presença no período, metas do IDP e próximos passos. **Não há geração nem envio automático** — removido do escopo a pedido do cliente. Quando o coach quiser, gera o relatório sob demanda e o compartilha no portal da família.

### Plano de desenvolvimento individual (IDP)
Metas mensuráveis com prazo, ligadas às áreas fracas da avaliação, com drills recomendados da biblioteca para cada meta e acompanhamento visual de progresso.

---

## M9 · Gestão e Relatórios

### Dashboard operacional (home do coach)

```
┌──────────────────────────────────────────────────────────────┐
│ HOJE, segunda 28/07                                          │
│ ┌────────────┬────────────┬────────────┬──────────────────┐ │
│ │ 4 sessões  │ 26 atletas │ 3 sem      │ ☁ 30% chuva 16h  │ │
│ │            │ esperados  │ confirmar  │                  │ │
│ └────────────┴────────────┴────────────┴──────────────────┘ │
│                                                              │
│ PRECISA DE ATENÇÃO                                           │
│ 🔴 2 leads sem contato há mais de 5 dias      [ver]         │
│ 🟠 $1.400 em faturas vencidas (4 famílias)     [ver]         │
│ 🟠 3 waivers expiram em 30 dias                [ver]         │
│ 🟡 Ethan Brown faltou 3 dos últimos 4 treinos  [ver]         │
│ 🟡 U14 GK com 4 de 6 vagas há 3 semanas        [ver]         │
│                                                              │
│ AGENDA DE HOJE                                               │
│ 16:00 U9 Blue     6/8   Field 3   [chamada]                 │
│ 17:00 U12 Red     8/8   Field 3   [chamada]                 │
│ 18:00 1:1 Lucas   1/1   Field 1   [chamada]                 │
│ 19:00 U14 GK      4/6   Field 2   [chamada]                 │
└──────────────────────────────────────────────────────────────┘
```

O bloco "precisa de atenção" é o coração do dashboard. Ele responde a pergunta que Arthur e Carlos fazem toda manhã, sem que eles precisem procurar.

### Relatórios

| Relatório | Responde |
|-----------|----------|
| Receita por período/programa/coach | Quanto entrou e de onde |
| Contas a receber por idade da dívida | Quem devo cobrar hoje |
| Taxa de ocupação por grupo e horário | Quais horários vendem e quais estão vazios |
| Presença por atleta e por grupo | Quem está sumindo |
| Retenção por coorte de entrada | Quantos continuam depois de 3 e 6 meses |
| Funil de conversão de leads | Quantos % do Instagram viram alunos |
| Horas por coach | Quanto pagar a cada um |
| Custo de campo x receita gerada | Se cada local se paga |
| Taxa de gateway por método | Quanto a Stripe/PayPal levou (embasa a decisão do RF-04.2) |

Tudo exportável em CSV e agendável por e-mail (resumo semanal às segundas de manhã).

---

## M10 · Site Público

**Substitui:** o link na bio apontando direto para o JotForm.

### Páginas
`/` (landing com a marca, filosofia de treino, coaches, depoimentos, feed do Instagram, CTA), `/programs` (todos os programas abertos), `/programs/[slug]` (detalhe do camp com datas, preços, vagas restantes e inscrição direta), `/coaches`, `/contact`, `/join` (formulário de interesse que vira lead).

### Técnica
Server Components estáticos com PPR — o contador de vagas é a única parte dinâmica. Metadata dinâmica e Open Graph por programa (quando alguém compartilha o link do camp no WhatsApp, aparece o card bonito). JSON-LD `SportsActivityLocation` e `Event` para SEO local. Imagens otimizadas via `next/image`.

### Por que isso importa comercialmente
Hoje o funil é Instagram → JotForm. Não há página que apresente a CA Tempo para quem chegou pelo Google buscando "soccer training near me". Um site próprio com SEO local é aquisição orgânica que não depende do algoritmo do Instagram — e custa zero a mais, porque a infraestrutura já está de pé.
