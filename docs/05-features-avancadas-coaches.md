# 05 — Features Avançadas para Coaches de Soccer

Você pediu "muito mais" e funcionalidades interessantes para coaches. Este documento é o catálogo dessas ideias — o que separa uma ferramenta administrativa de uma plataforma que os coaches querem abrir.

Cada item tem **esforço** (P/M/G), **impacto** e a **fase** sugerida. Nem tudo precisa ser construído; a lista existe para que Arthur e Carlos escolham o que faz sentido para eles.

---

## Parte 1 — Diferenciais de alto impacto

### 1. Cancelamento inteligente com integração meteorológica
**Esforço P · Impacto muito alto · Fase 3**

O maior custo operacional deles é cancelamento manual. Vamos além de facilitar: antecipamos.

Um cron consulta a previsão (OpenWeather ou Tomorrow.io) para o local e horário de cada sessão nas próximas 24h. Se a probabilidade de chuva passa do limiar configurado, o dashboard mostra um alerta acionável:

```
☔ Alerta · 4 sessões de amanhã em risco
   Evelyn Greer Park · 80% de chuva entre 16h e 19h
   [Cancelar as 4 e avisar 26 famílias]  [Mover para o campo coberto]  [Ignorar]
```

Nenhum concorrente local faz isso. O coach economiza a decisão e a comunicação em um único clique.

### 2. Monitoramento de carga de treino e risco de lesão
**Esforço M · Impacto alto · Fase 6**

Ciência do esporte que normalmente só existe em clube profissional, aplicada com um dado simples: ao fechar a chamada, o coach registra o **RPE** (esforço percebido, escala 1–10) da sessão.

```
Carga da sessão = RPE × duração em minutos
Carga aguda      = média da carga dos últimos 7 dias
Carga crônica    = média da carga dos últimos 28 dias
ACWR             = carga aguda ÷ carga crônica
```

A literatura de ciência do esporte associa ACWR fora da faixa de aproximadamente 0,8–1,3 a maior risco de lesão em atletas — é um indicador de tendência amplamente usado, e não um diagnóstico. Na prática, o sistema mostra:

```
Lucas Silva · ACWR 1.6  ⚠ pico de carga
  Treinou 5x esta semana (média das 4 anteriores: 2,8x)
  Sugestão: sessão de recuperação ou reduzir intensidade
```

Para um pai, ver que a academia monitora a carga do filho é um argumento de retenção enorme. Precisa vir com um aviso claro de que é ferramenta de gestão de treino, não avaliação médica.

### 3. Motor de casamento de disponibilidade (availability matching)
**Esforço M · Impacto muito alto · Fase 5**

Este resolve o gargalo mais silencioso da operação. Hoje o formulário pergunta a disponibilidade em texto livre e alguém precisa cruzar manualmente com a agenda.

Com `athletes.availability` estruturado ([docs/03 § 4](03-modelo-de-dados.md#4-estrutura-de-disponibilidade)) e `coach_availability`, o sistema calcula a interseção e responde perguntas que hoje ninguém consegue responder:

```
┌─ Encaixar novo atleta: Diego R. (U9, PREMIER) ────────────┐
│ Disponível: seg/qua 16–19h, sáb 8–12h                      │
│                                                            │
│ ✅ U9 Blue · seg+qua 16h · 3 vagas · Carlos                │
│    100% de compatibilidade                                 │
│ ⚠ U9 White · ter+qui 17h · 5 vagas                        │
│    0% — nenhuma sobreposição                               │
│ 💡 OPORTUNIDADE: 4 prospects U9 estão livres sábado 9h.    │
│    Abrir um novo grupo geraria ~$X/mês.                    │
└────────────────────────────────────────────────────────────┘
```

A última linha é a mais valiosa: o sistema **descobre demanda latente**. Ele detecta que existem N interessados com disponibilidade sobreposta e sugere abrir uma turma. É receita que hoje se perde por falta de visibilidade.

Importante: isto é **apoio à decisão sobre disponibilidade e demanda**, não alocação automática. A alocação do atleta em um grupo é sempre manual — o staff coloca cada um no grupo que quiser (ver [M5 › Alocação manual em grupo](04-modulos-funcionais.md#m5--crm-de-prospects-e-trials)).

### 4. Detecção de risco de churn
**Esforço P · Impacto alto · Fase 5**

Perder um aluno é muito mais caro que adquirir um. Um score diário sinaliza quem está saindo antes de sair:

| Sinal | Peso |
|-------|------|
| Faltou 3 dos últimos 4 treinos | Alto |
| Não confirma presença há 2 semanas | Médio |
| Fatura vencida há mais de 14 dias | Alto |
| Não abre e-mails há 30 dias | Baixo |
| Queda no score de avaliação | Médio |
| Pacote acabando sem renovação | Alto |

O coach recebe uma lista curta: "3 atletas em risco esta semana" com a ação sugerida (ligar, oferecer reposição, mandar clipe de progresso). Uma ligação de 2 minutos salva uma mensalidade.

### 5. Check-in por QR code
**Esforço P · Impacto médio · Fase 6**

Cada atleta tem um crachá digital com QR rotativo no portal da família. O coach abre a câmera e escaneia — presença marcada, alerta médico exibido na hora, responsáveis notificados de que a criança chegou.

Para camps com 24 crianças chegando ao mesmo tempo, transforma 10 minutos de chamada em 90 segundos. O Byga vende isso como diferencial do Tryouts Manager.

### 6. Vídeo feedback com anotação em timeline
**Esforço M · Impacto alto · Fase 7**

O pai grava o filho no jogo de domingo e sobe no portal. O coach assiste, pausa em 1:23 e escreve "aqui você precisava escanear antes de receber". A anotação aparece ancorada no tempo do vídeo.

É Hudl/Veo em versão simplificada, sem o custo. Para treino privado, é um serviço premium que pode até ser cobrado à parte.

### 7. Relatório de progresso automático para a família
**❌ Removido do escopo — a pedido do cliente**

Não haverá relatório de progresso gerado e enviado automaticamente. As avaliações continuam existindo como ferramenta interna do coach ([M8](04-modulos-funcionais.md#m8--avaliação-e-desenvolvimento)) e um relatório pode ser gerado sob demanda e compartilhado no portal, mas sem qualquer automação de envio trimestral.

### 8. Perfil de recrutamento universitário
**Esforço M · Impacto alto para U14+ · Fase 7**

Nos EUA, o objetivo declarado da maioria das famílias que pagam treino privado é bolsa universitária. Uma página pública por atleta com foto, posição, pé dominante, ano de formatura, GPA, clube atual, estatísticas, vídeo de highlights e contato do coach — exportável como one-pager em PDF para enviar a college coaches.

O Byga cobra por esse módulo. Para a CA Tempo, é diferenciação frente a qualquer treinador autônomo da região.

---

## Parte 2 — Ferramentas de campo

### 9. Quadro tático e desenhador de drills
**Esforço G · Impacto médio · Fase 7**

Canvas onde o coach arrasta jogadores, cones, bolas e setas de movimento sobre um campo. Salva como imagem no drill da biblioteca, ou anima a sequência para exportar como GIF/MP4. Elimina a dependência de ferramentas externas.

### 10. Gerador de plano de treino com IA
**Esforço M · Impacto alto · Fase 7**

Vercel AI SDK sobre a biblioteca de drills do próprio clube:

> "Monte uma sessão de 60 minutos para U10 focada em finalização sob pressão, 8 jogadores, meio campo disponível"

Retorna um plano estruturado usando **os drills que a CA Tempo já cadastrou**, respeitando duração, número de jogadores e espaço. Não é IA inventando conteúdo — é IA organizando o acervo do clube.

### 11. Modo campo (one-handed)
**Esforço P · Impacto alto · Fase 3**

Uma tela otimizada para uso com uma mão, sol batendo e luva: fonte grande, alto contraste, botões de 56px, sem menu escondido. Mostra apenas o essencial da sessão em andamento — roster, chamada, cronômetro de blocos, nota rápida por atleta.

### 12. Nota rápida por atleta durante a sessão
**Esforço P · Impacto médio · Fase 6**

Toque no nome do atleta durante o treino, ditado por voz ou dois toques em tags pré-definidas ("bom 1v1", "cabeça baixa", "cansado"). No fim, essas notas alimentam a avaliação — que deixa de ser um esforço de memória no fim do trimestre e vira acúmulo de observações reais.

### 13. Rodízio automático de grupos
**Esforço M · Impacto médio · Fase 7**

Para camps com 24 crianças e 4 estações, o sistema gera a matriz de rodízio equilibrada (todo mundo passa por todas as estações, grupos balanceados por nível) e imprime o mapa para levar ao campo.

---

## Parte 3 — Crescimento e receita

### 14. Programa de indicação
**❌ Removido do escopo — a pedido do cliente**

Não haverá programa de indicação com crédito. A origem "referral" continua sendo rastreada apenas como canal de aquisição do lead (de onde ele veio), sem código, crédito ou ranking associados.

### 15. Pacotes e créditos de sessão
**Esforço M · Impacto alto · Fase 4**

Em vez de vender sessão avulsa, vender pacote de 5/10/20 sessões com desconto progressivo, validade e saldo visível no portal ("você tem 7 sessões restantes, válidas até 30/09"). Melhora fluxo de caixa, aumenta o ticket e reduz churn — o pai que comprou 10 leva o filho nas 10.

### 16. Lista de espera com conversão automática
**Esforço P · Impacto médio · Fase 3**

Turma lotada não perde a demanda. O interessado entra na fila, vê a posição e é notificado automaticamente quando vaga abre, com janela de 2 horas para confirmar antes de passar para o próximo.

### 17. Página de camp com prova social e escassez
**Esforço P · Impacto médio · Fase 2**

"Restam 4 vagas de 24", contagem regressiva para o fim das inscrições, depoimentos e fotos das edições anteriores. O formulário atual já diz "if we are not sold out" — a escassez é real, só não está sendo comunicada.

### 18. Gift card e sessão presente
**Esforço P · Impacto baixo-médio · Fase 7**

Avó quer dar 3 sessões de presente de aniversário. Compra online, recebe um código, a família resgata. Receita antecipada e canal de aquisição novo.

### 19. Renovação automática de temporada
**Esforço M · Impacto alto · Fase 7**

45 dias antes do fim da temporada, cada família recebe uma oferta de renovação com o mesmo horário garantido e desconto de antecipação, com um clique para confirmar. Transforma a rematrícula, que hoje é uma campanha manual, em fluxo automático.

---

## Parte 4 — Engajamento de atletas e famílias

### 20. Gamificação de presença e evolução
**Esforço M · Impacto médio · Fase 7**

Streak de presença, badges por marcos ("50 sessões", "10 treinos seguidos", "maior evolução do trimestre"), ranking opcional por grupo. Crianças de 8 a 14 anos respondem muito a isso — e presença alta é retenção alta.

Precisa ser desenhado com cuidado: ranking de habilidade entre crianças pode ser contraproducente. Recomendo gamificar **esforço e consistência**, não talento.

### 21. Desafios semanais em casa
**Esforço P · Impacto médio · Fase 7**

O coach publica um desafio ("100 embaixadinhas sem cair"), o atleta grava e envia, o coach valida e libera o badge. Mantém o vínculo entre sessões e gera conteúdo para o Instagram do clube.

### 22. Galeria de fotos e vídeos por sessão
**Esforço P · Impacto médio · Fase 6**

Coach sobe as fotos do treino, as famílias veem apenas as sessões dos próprios filhos, download em alta resolução. Respeitando o flag `photo_consent` de cada atleta — quem não consentiu não aparece.

Pais adoram foto do filho jogando. É o conteúdo de maior engajamento que um clube produz e hoje se perde no WhatsApp.

### 23. Aniversário automático
**Esforço P · Impacto baixo · Fase 7**

Mensagem personalizada da CA Tempo no aniversário do atleta, com card gerado com a marca. Custa nada e é lembrado.

---

## Parte 5 — Inteligência de gestão

### 24. Mapa de calor de ocupação
**Esforço P · Impacto alto · Fase 6**

Grade dia × hora mostrando ocupação em cores. Revela na hora que terça às 18h está vazio e sábado de manhã lota — informação que redefine a grade e o preço.

```
        6h  8h  10h 12h 14h 16h 18h 20h
Seg     ·   ·   ·   ·   ·   ██  ██  ▓
Ter     ·   ·   ·   ·   ·   ▓   ░   ·     ░ = ocioso
Qua     ·   ·   ·   ·   ·   ██  ██  ▓     ▓ = parcial
Qui     ·   ·   ·   ·   ·   ▓   ░   ·     █ = cheio
Sáb     ·   ██  ██  ██  ▓   ·   ·   ·
```

### 25. Precificação dinâmica sugerida
**Esforço M · Impacto médio · Fase 7**

Com base em ocupação histórica, o sistema sugere desconto em horários ociosos e valorização em horários disputados. A decisão continua humana — o sistema só mostra o dado.

### 26. Painel de horas e pagamento dos coaches
**Esforço P · Impacto alto · Fase 5**

Horas trabalhadas por coach no período, valor devido pela taxa de cada sessão, exportação para pagamento e 1099. Hoje é conta de cabeça ou mais uma planilha.

### 27. Custo real por sessão
**Esforço M · Impacto médio · Fase 7**

Receita da sessão menos custo do campo, custo do coach e taxa de gateway. Mostra a margem real de cada tipo de treino. Pode revelar, por exemplo, que o 1:1 de $80 tem margem pior que o small group de $40 por atleta.

### 28. Relatório semanal automático por e-mail
**Esforço P · Impacto alto · Fase 5**

Toda segunda de manhã, Arthur e Carlos recebem: sessões da semana, receita, novos leads, atletas em risco, faturas vencidas e o que precisa de atenção. Uma leitura de 30 segundos que substitui abrir cinco telas.

---

## Parte 6 — Integrações

### 29. Sincronização de calendário (iCal)
**Esforço P · Impacto alto · Fase 3**

Cada família e cada coach recebe uma URL de assinatura privada. Os treinos aparecem no Google Calendar e no Apple Calendar do celular, com atualização automática quando algo muda. É a feature de agenda mais usada e uma das mais baratas de implementar.

### 30. Instagram
**Esforço P · Impacto médio · Fase 6**

Feed embutido no site e um botão para gerar cards prontos para post ("Camp com 4 vagas restantes", "Parabéns ao atleta do mês") no template visual da marca. O Instagram é o canal de aquisição principal deles — vale reduzir o atrito de produzir conteúdo.

### 31. WhatsApp Business API
**Esforço M · Impacto alto se a base for hispânica/brasileira · Fase 7**

Boa parte das famílias no sul da Flórida prefere WhatsApp a SMS. A API oficial permite lembretes e confirmações no canal onde a pessoa realmente responde.

### 32. Assistente de IA para triagem de leads
**Esforço M · Impacto médio · Fase 7**

Lead novo chega às 22h. Um agente responde em segundos com uma mensagem personalizada, tira dúvidas frequentes (preço, local, faixa etária) e oferece horários de trial compatíveis com a disponibilidade declarada. Escala o follow-up sem contratar ninguém, com escalonamento para humano quando a pergunta sai do script.

---

## Priorização sugerida

Se fosse escolher apenas cinco para maximizar retorno por hora investida:

| # | Feature | Por quê |
|---|---------|---------|
| 1 | Cancelamento inteligente com clima (#1) | Ataca diretamente a dor nº 1 e é barato |
| 2 | Sincronização iCal (#29) | Altíssimo uso, esforço mínimo |
| 3 | Casamento de disponibilidade (#3) | Desbloqueia receita latente que hoje se perde |
| 4 | Detecção de churn (#4) | Cada aluno salvo se paga muitas vezes |
| 5 | Relatório semanal por e-mail (#28) | Faz Arthur e Carlos usarem o sistema todo dia |

O que **não** recomendo priorizar, apesar de parecer atraente: quadro tático (#9) e precificação dinâmica (#25). São caros de construir e resolvem um problema que a CA Tempo ainda não tem no volume atual.
