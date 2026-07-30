# 09 — Design System e Marca

## 1. Leitura da identidade existente

A logo da CA Tempo Training é um **selo circular monocromático**: anel externo preto com o nome em arco na parte superior ("CA TEMPO TRAINING") e "ESTABLISHED 2025" na inferior, duas estrelas de cinco pontas nas laterais, e um escudo branco central com o monograma "CA" em tipografia script.

O que essa logo comunica e que o produto precisa honrar:

| Elemento | Significado | Consequência no design |
|----------|-------------|------------------------|
| Preto e branco absolutos | Seriedade, atemporalidade, foco | Paleta de altíssimo contraste; cor usada com parcimônia, só como sinal |
| Formato de selo/emblema | Tradição de clube esportivo, pertencimento | Elementos com bordas definidas; nada de gradiente ou glassmorphism |
| Escudo | Proteção, time, identidade | Motivo reutilizável em avatar, badge de conquista, cartão de atleta |
| Monograma script | Toque artesanal, personalizado | Reservado à marca; a UI usa sans-serif limpa |
| "Established 2025" | Marca jovem que se posiciona como duradoura | Interface madura, não "startup colorida" |

**Direção de design:** *sportswear premium*. Referências mentais: a estética de material de clube profissional e de marca esportiva, não a de dashboard SaaS genérico. Preto profundo, branco, tipografia forte, muito espaço, e uma cor de destaque usada com disciplina.

---

## 2. Tokens

### Cor

```css
/* Neutros — a base da identidade */
--ink-950: #0A0A0A;   /* preto da marca — fundo do modo escuro, texto no claro */
--ink-900: #141414;
--ink-800: #1F1F1F;
--ink-700: #2E2E2E;
--ink-600: #4A4A4A;
--ink-500: #6B6B6B;
--ink-400: #909090;
--ink-300: #BDBDBD;
--ink-200: #DEDEDE;
--ink-100: #F0F0F0;
--ink-50:  #FAFAFA;
--paper:   #FFFFFF;

/* Destaque — usada apenas em ação primária e estado ativo */
--accent-500: #C8A24A;   /* dourado sóbrio, evoca troféu e emblema */
--accent-600: #A8853A;
--accent-100: #F5EDDA;

/* Semânticos — só para estado, nunca decorativos */
--success-500: #16794A;   /* confirmado, pago, presente */
--warning-500: #B45309;   /* pendente, vence em breve */
--danger-500:  #B02A2A;   /* cancelado, vencido, ausente */
--info-500:    #1F5F8B;   /* informativo, lista de espera */

/* Cores de grupo — atribuídas por turma no calendário */
--group-blue:   #2563EB;
--group-red:    #DC2626;
--group-green:  #059669;
--group-purple: #7C3AED;
--group-orange: #EA580C;
--group-teal:   #0D9488;
```

A regra do dourado: **uma única ação primária dourada por tela**. Se tudo é destaque, nada é.

O modo escuro não é um extra. Coach usa o celular no sol e à noite no campo iluminado; o modo escuro com contraste alto é mais legível nas duas situações e economiza bateria em tela OLED.

### Tipografia

```css
--font-display: 'Bebas Neue', 'Oswald', sans-serif;  /* títulos, números grandes */
--font-body:    'Inter', system-ui, sans-serif;      /* texto, formulários, tabelas */
--font-mono:    'JetBrains Mono', monospace;         /* valores, IDs, horários em tabela */
```

A display condensada em caixa alta é o vocabulário visual do esporte — placar, camisa, cartaz de camp. Usada em títulos de seção, nome do grupo e números de destaque. Nunca em parágrafo.

```css
--text-display: 3rem/1.05  var(--font-display), letter-spacing: 0.02em;
--text-h1:      2rem/1.15   var(--font-display);
--text-h2:      1.5rem/1.2  var(--font-display);
--text-h3:      1.25rem/1.3 var(--font-body), 600;
--text-body:    1rem/1.5    var(--font-body);
--text-sm:      0.875rem/1.45;
--text-xs:      0.75rem/1.4;
```

Corpo de texto nunca abaixo de 16px em mobile — evita o zoom automático do iOS em campos de formulário e é o mínimo confortável para leitura ao ar livre.

### Espaçamento, raio e sombra

```css
/* escala de 4px */
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
--space-5: 24px;  --space-6: 32px;  --space-8: 48px;  --space-10: 64px;

--radius-sm: 4px;   --radius-md: 8px;   --radius-lg: 12px;   --radius-full: 9999px;

/* sombras discretas — a marca é gráfica, não "material" */
--shadow-sm: 0 1px 2px rgba(0,0,0,.06);
--shadow-md: 0 4px 12px rgba(0,0,0,.08);
--shadow-lg: 0 12px 32px rgba(0,0,0,.12);
```

### Alvos de toque

```css
--touch-min:     44px;   /* mínimo absoluto (WCAG 2.2 AA) */
--touch-comfort: 56px;   /* padrão nas telas de campo */
```

---

## 3. Componentes específicos do domínio

Além dos primitivos do shadcn/ui, o produto tem componentes próprios que carregam a identidade:

| Componente | Onde aparece | Característica |
|------------|--------------|----------------|
| `AthleteCard` | Roster, busca, grupo | Foto circular com anel na cor do grupo, nome, idade, badges de status (waiver, pagamento, alergia) |
| `AthleteAvatar` | Em toda parte | Foto ou iniciais sobre o motivo do escudo da marca |
| `SessionBlock` | Calendário | Cor do grupo, ocupação `n/N`, ícones de estado, faixa diagonal quando cancelada |
| `RosterPanel` | Painel lateral da sessão | O componente mais importante do produto — ver [docs/04 § M2](04-modulos-funcionais.md#painel-do-roster--o-requisito-nomeado-por-carlos) |
| `AttendanceToggle` | Chamada | Três estados, 56px, feedback tátil, funciona offline |
| `PaymentBadge` | Roster, lista de atletas | Verde "em dia" / âmbar "pendente" / vermelho "vencido" — o sucessor direto do check verde da planilha |
| `WaiverBadge` | Roster | Válido / expirando / expirado / ausente |
| `MedicalAlert` | Roster, chamada | Vermelho, alto contraste, impossível de não ver |
| `SkillRadar` | Avaliação, progresso | Radar chart com sobreposição do período anterior |
| `DrillCard` | Biblioteca | Thumbnail, duração, dificuldade, tags de habilidade |
| `PipelineCard` | CRM | Lead com origem, tempo parado e próxima ação |
| `StatTile` | Dashboards | Número grande na fonte display, rótulo pequeno, variação |
| `EmptyState` | Listas vazias | Ilustração com o escudo + ação sugerida, nunca uma tela em branco |

---

## 4. Padrões de interação

### Mobile-first, de verdade
Desenhar primeiro em 375px de largura. Se não couber ali, não entra. Navegação inferior fixa nas áreas autenticadas (Agenda · Atletas · Financeiro · Mais para o coach; Agenda · Atletas · Conta para a família). Ações primárias no terço inferior da tela, ao alcance do polegar. Gestos de swipe nas listas, com equivalente por botão sempre disponível.

### Feedback imediato
Toda mutação usa atualização otimista com reversão em caso de erro. Skeleton no carregamento, nunca spinner de tela cheia. Toast de confirmação com **desfazer** em toda ação reversível — especialmente cancelamento de sessão, que tem uma janela de 30 segundos para reverter antes de as notificações saírem.

Esse detalhe do desfazer é importante: cancelar 4 sessões e avisar 26 famílias é rápido demais para não ter rede de proteção.

### Prevenção de erro
Ações destrutivas exigem confirmação que **declara o alcance** ("isto vai cancelar 4 sessões e notificar 26 famílias"), não um "tem certeza?" genérico. Conflito de agenda é mostrado antes de salvar, não depois. Formulários salvam rascunho automaticamente.

---

## 5. Acessibilidade — WCAG 2.2 AA

| Critério | Como atendemos |
|----------|----------------|
| Contraste de texto | Mínimo 4,5:1 (a paleta monocromática ajuda muito aqui) |
| Contraste de componente | Mínimo 3:1 em borda e ícone |
| Alvo de toque | Mínimo 44×44px; 56px nas telas de campo |
| Navegação por teclado | Toda funcionalidade acessível sem mouse; foco sempre visível |
| Leitor de tela | HTML semântico, ARIA onde necessário, `aria-live` para atualizações do calendário |
| Cor não é o único sinal | Status sempre com ícone e texto, além da cor (essencial: ~8% dos homens têm alguma deficiência de visão de cor) |
| Movimento | Respeita `prefers-reduced-motion` |
| Zoom | Funcional até 200% sem scroll horizontal |
| Rótulo de formulário | Sempre visível; placeholder nunca substitui label |
| Mensagem de erro | Específica, junto ao campo, anunciada ao leitor de tela |

Verificação automatizada com `axe-core` no Playwright em toda rota principal, mais revisão manual por teclado a cada fase.

---

## 6. Conteúdo e tom de voz

**Inglês é o idioma padrão** (a base de clientes é americana). Português e espanhol disponíveis.

Tom: direto, respeitoso, encorajador. Nunca infantilizado — falamos com adultos que pagam, e com atletas que se levam a sério.

| Em vez de | Escreva |
|-----------|---------|
| "Error: request failed" | "Não foi possível salvar. Verifique a conexão e tente de novo." |
| "Are you sure?" | "Cancelar o treino de segunda às 16h? 6 famílias serão avisadas." |
| "No data" | "Nenhuma sessão agendada ainda. Crie a primeira." |
| "Submit" | "Confirmar inscrição" |
| "User" | "Atleta" ou "Responsável" — nunca "usuário" |

Vocabulário fixo: **Athlete** (não "player" nem "student"), **Guardian** (não "parent", porque nem sempre é), **Session** (não "class"), **Group** (não "team", porque a CA Tempo não trabalha com times), **Coach**.

Esse último ponto vem direto da reunião: eles corrigiram a ideia de "time" e insistiram em grupos por habilidade. A linguagem do produto tem que refletir isso.

---

## 7. Aplicação da marca

### Uso da logo
- Versão principal: selo completo em fundo branco ou preto
- Versão reduzida: apenas o escudo com "CA", para favicon, ícone do app e avatar
- Área de respiro mínima: metade do diâmetro do selo
- Tamanho mínimo do selo completo: 40px; abaixo disso, usar só o escudo
- **Nunca:** distorcer, aplicar gradiente, recolorir, adicionar sombra ou colocar sobre foto de baixo contraste

### Materiais gerados pelo sistema
Todo PDF que sai da plataforma carrega a marca de forma consistente: cabeçalho com o selo, tipografia display no título, rodapé com contato e data de geração. Isso vale para recibo, fatura, waiver assinado, plano de sessão, relatório de progresso e one-pager de recrutamento.

O relatório trimestral de progresso é o material de marca mais importante que a plataforma produz — é o que o pai imprime, guarda e mostra para outros pais.

### Ícone do app (PWA)
Escudo "CA" branco sobre fundo preto, com padding seguro para o recorte circular do Android e o *squircle* do iOS. Splash screen preta com o selo centralizado.

### Assets a coletar do cliente (Fase 0)
- [ ] Logo em vetor (SVG ou AI) — hoje só temos o PNG do Instagram
- [ ] Versão do escudo isolado
- [ ] Fotos em alta resolução dos treinos e dos camps
- [ ] Fotos e mini-bio dos coaches
- [ ] Depoimentos de famílias
- [ ] Fontes licenciadas, se houver alguma oficial diferente das sugeridas

---

## 8. Referência da paleta em Tailwind v4

```css
@theme {
  --color-ink-950: #0A0A0A;
  --color-ink-900: #141414;
  --color-ink-800: #1F1F1F;
  --color-ink-700: #2E2E2E;
  --color-ink-600: #4A4A4A;
  --color-ink-500: #6B6B6B;
  --color-ink-400: #909090;
  --color-ink-300: #BDBDBD;
  --color-ink-200: #DEDEDE;
  --color-ink-100: #F0F0F0;
  --color-ink-50:  #FAFAFA;

  --color-accent-100: #F5EDDA;
  --color-accent-500: #C8A24A;
  --color-accent-600: #A8853A;

  --color-success: #16794A;
  --color-warning: #B45309;
  --color-danger:  #B02A2A;
  --color-info:    #1F5F8B;

  --font-display: 'Bebas Neue', 'Oswald', sans-serif;
  --font-sans:    'Inter', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', monospace;

  --radius-card: 12px;
  --spacing-touch: 56px;
}
```
