# 07 — Pagamentos e Taxas

Este documento existe para resolver a única decisão que a reunião deixou formalmente em aberto:

> **Needs Further Discussion — Payment integration tool selection.** A seleção de uma plataforma de pagamento específica foi adiada para permitir mais pesquisa sobre minimização de taxas de transação.
>
> **Next step — [Carlos, Davi Castelo] Research Payment Platforms:** identificar processadoras com taxas menores.

Aqui está a pesquisa, com números verificados nas páginas oficiais de preço em julho de 2026.

---

## 1. Taxas verificadas

### Stripe (fonte: stripe.com/us/pricing)

| Método | Taxa |
|--------|------|
| Cartão de crédito/débito doméstico | **2,9% + $0,30** |
| Cartão digitado manualmente | +0,5% |
| **ACH Direct Debit** | **0,8%, com teto de $5,00** |
| Instant Bank Payments | 2,6% + $0,30 |
| Klarna (parcelado) | 5,99% + $0,30 |
| Cartão internacional | +1% + $0,30 |
| Stripe Invoicing | +0,4% por fatura paga |
| Stripe Billing (recorrência) | +0,7% do volume |
| Disputa/chargeback | $15 por disputa |

Sem taxa de setup e sem mensalidade.

### PayPal (fonte: paypal.com/us/business/fees)

| Método | Taxa |
|--------|------|
| PayPal Checkout — cartão | **2,99% + $0,49** |
| Expanded Checkout — cartão | 2,89% + $0,29 |
| Carteira PayPal ou Venmo | **3,49% + $0,49** |
| PayPal Pay Later | 4,99% + $0,49 |
| Fatura (invoicing) | 3,49% + $0,49 |
| QR code presencial | 2,29% + $0,09 |

Sem mensalidade. Proteção contra chargeback custa +0,40% a +0,50%.

---

## 2. O que isso significa no dinheiro da CA Tempo

Usando os preços reais do formulário de camp atual:

### Full Camp Pass — $600

| Método | Taxa | Valor líquido | Perda |
|--------|------|---------------|-------|
| **Stripe ACH** | $4,80 (teto: 0,8% = $4,80) | **$595,20** | 0,80% |
| Stripe cartão | $17,70 | $582,30 | 2,95% |
| PayPal Expanded — cartão | $17,63 | $582,37 | 2,94% |
| PayPal Checkout — cartão | $18,43 | $581,57 | 3,07% |
| PayPal / Venmo (carteira) | $21,43 | $578,57 | 3,57% |

### Week Pass — $350

| Método | Taxa | Valor líquido | Perda |
|--------|------|---------------|-------|
| **Stripe ACH** | $2,80 | **$347,20** | 0,80% |
| Stripe cartão | $10,45 | $339,55 | 2,99% |
| PayPal Checkout — cartão | $10,95 | $339,05 | 3,13% |
| PayPal / Venmo (carteira) | $12,71 | $337,29 | 3,63% |

### Sessão 1:1 estimada em $80

| Método | Taxa | Valor líquido | Perda |
|--------|------|---------------|-------|
| **Stripe ACH** | $0,64 | **$79,36** | 0,80% |
| Stripe cartão | $2,62 | $77,38 | 3,28% |
| PayPal / Venmo | $3,28 | $76,72 | 4,10% |

### Projeção anual

Cenário conservador de **$120.000/ano** em receita processada online:

| Cenário | Custo anual em taxas |
|---------|---------------------|
| 100% PayPal carteira (3,49% + $0,49) | ~$4.400 |
| 100% Stripe cartão (2,9% + $0,30) | ~$3.600 |
| **70% ACH + 30% cartão (Stripe)** | **~$1.750** |
| 100% Stripe ACH (teoricamente) | ~$960 |

**A economia de mudar de "cartão em qualquer gateway" para "ACH como padrão" é da ordem de $1.800 a $2.600 por ano** — seis a nove meses do próprio fee de manutenção da plataforma.

---

## 3. Recomendação

**Stripe, com ACH Direct Debit como método padrão e cartão como alternativa.**

O argumento não é "Stripe é melhor que PayPal". É que **o método de pagamento importa muito mais que o gateway**. Cartão custa aproximadamente 3% em qualquer lugar. ACH custa 0,8% com teto de $5 — e o teto é o que muda o jogo, porque os tickets da CA Tempo são altos ($350 a $600). Num Full Camp de $600, a taxa de ACH é de $4,80 contra $17,70 no cartão.

O PayPal simplesmente não oferece um equivalente de débito bancário direto para comerciantes nos EUA nessa faixa de preço. Essa é a razão técnica da recomendação.

### Fatores além da taxa

| Critério | Stripe | PayPal |
|----------|--------|--------|
| Débito bancário barato (ACH) | ✅ 0,8% teto $5 | ❌ não oferece equivalente |
| Qualidade da API e do SDK | ✅ referência do mercado | 🟡 mais burocrática |
| Componentes prontos de checkout | ✅ Checkout, Elements, Payment Links | 🟡 mais limitados |
| Parcelamento nativo | ✅ Billing + Klarna | ✅ Pay Later |
| Confiança do consumidor americano | ✅ alta (Apple Pay, Google Pay, Link) | ✅ alta |
| Congelamento de conta | 🟡 raro | 🔴 histórico ruim de retenção de fundos |
| Painel financeiro e conciliação | ✅ excelente | 🟡 razoável |
| Portabilidade dos dados | ✅ exporta tokens de cartão | 🟡 mais difícil |

### Como usar sem pagar taxa desnecessária

Duas decisões de implementação que economizam dinheiro:

1. **Não usar Stripe Invoicing.** Ele cobra +0,4% por fatura paga. Nós geramos a fatura na nossa plataforma (tabela `invoices`) e usamos apenas PaymentIntent ou Checkout Session para cobrar. A funcionalidade de fatura é nossa; a Stripe só move o dinheiro.
2. **Não usar Stripe Billing para parcelamento simples.** Ele cobra +0,7% do volume. Para dividir um camp de $600 em três parcelas, criamos três cobranças agendadas com o método salvo, controladas pela nossa tabela `payment_plans`. Stripe Billing só entraria se houvesse assinatura mensal recorrente de verdade.

---

## 4. UX de pagamento que empurra para o ACH

A recomendação só vira economia se as famílias efetivamente usarem ACH. A tela de checkout precisa induzir isso sem parecer que está empurrando:

```
┌─ Pagamento · CA Tempo Full Camp Pass · $600,00 ────────────┐
│                                                             │
│  ● Conta bancária (ACH)                    RECOMENDADO      │
│    Conexão instantânea e segura via Plaid                   │
│    Você paga exatamente $600,00                             │
│                                                             │
│  ○ Cartão de crédito ou débito                              │
│    $600,00 + $17,70 de taxa de conveniência = $617,70       │
│                                                             │
│  ○ Apple Pay / Google Pay                                   │
│    $600,00 + $17,70 de taxa de conveniência = $617,70       │
│                                                             │
│  ○ Pagar em dinheiro no primeiro dia                        │
│    Sujeito a confirmação do coach                           │
│                                                             │
│                                          [Continuar]        │
└─────────────────────────────────────────────────────────────┘
```

### Sobre a taxa de conveniência no cartão

Repassar a taxa de cartão ao cliente (surcharging) é permitido na maior parte dos estados americanos, com regras: precisa ser divulgada claramente antes da compra, não pode ultrapassar o custo real do processamento, exige notificação prévia às bandeiras, e alguns estados restringem ou proíbem. **Connecticut e Massachusetts proíbem** o surcharge em cartão de crédito, e a Califórnia tem regras específicas. Também não se pode aplicar surcharge em cartão de **débito**, apenas crédito.

Três observações práticas:

1. A CA Tempo aparenta operar na Flórida, onde o surcharge é permitido com divulgação adequada — **mas isso precisa ser confirmado com um contador ou advogado local antes de ativar.**
2. Existe uma alternativa juridicamente mais segura: dar **desconto por pagamento em ACH** em vez de cobrar taxa no cartão. É o mesmo diferencial de preço, apresentado de forma que é permitida em todos os estados e por todas as bandeiras. **É o que eu recomendo.**
3. A plataforma implementa o mecanismo como uma configuração (`organizations.settings.surcharge`), desligada por padrão. A decisão comercial e jurídica é do cliente.

---

## 5. Arquitetura de pagamento (à prova de troca de gateway)

A escolha do gateway fica isolada atrás de uma interface. Se em um ano o PayPal fizer uma proposta melhor, troca-se o adaptador sem tocar em nada do resto.

```typescript
// packages/domain/billing/gateway.ts
export interface PaymentGateway {
  createCheckout(params: CheckoutParams): Promise<CheckoutSession>
  createPaymentIntent(params: IntentParams): Promise<PaymentIntent>
  refund(paymentId: string, amountCents?: number): Promise<Refund>
  savePaymentMethod(customerId: string): Promise<SetupIntent>
  chargeStoredMethod(params: ChargeParams): Promise<Payment>
  verifyWebhook(payload: string, signature: string): WebhookEvent
}

// Implementações
// lib/stripe/gateway.ts  → StripeGateway   (Fase 4)
// lib/paypal/gateway.ts  → PayPalGateway   (se e quando necessário)
// lib/offline/gateway.ts → OfflineGateway  (dinheiro, cheque, Zelle)
```

Nenhum código de domínio importa `stripe` diretamente. Toda a lógica de desconto, crédito e parcelamento vive em `packages/domain/billing`, testada sem rede.

### Fluxo do webhook

```
Stripe → POST /api/webhooks/stripe
           ├ verifica assinatura (STRIPE_WEBHOOK_SECRET)
           ├ INSERT em webhook_events  ← unique(provider, event_id)
           │    └ se já existe: retorna 200 e para  ◀── idempotência
           ├ processa por tipo:
           │    payment_intent.succeeded  → cria payment, atualiza invoice, envia recibo
           │    payment_intent.payment_failed → notifica, inicia régua de cobrança
           │    charge.refunded           → cria refund, ajusta invoice
           │    charge.dispute.created    → alerta o admin
           └ marca processed_at
```

A `unique (provider, event_id)` não é detalhe: a Stripe reenvia eventos quando não recebe 200 rapidamente. Sem isso, um pagamento de $600 pode ser creditado duas vezes na fatura.

### Segurança
Nenhum dado de cartão passa pelo nosso servidor em momento nenhum. Usamos Stripe Checkout (página hospedada) ou Stripe Elements (iframe), o que mantém a operação no escopo **PCI DSS SAQ A** — o nível mais leve de conformidade, sem auditoria.

---

## 6. Métodos offline continuam existindo

Arthur combinou pagar em dinheiro, e muitas famílias fazem o mesmo. A plataforma não força ninguém a pagar online. A diferença é que o pagamento em dinheiro **também vira registro** — fatura, recibo por e-mail e histórico — em vez do check verde na planilha.

Métodos suportados: dinheiro, cheque (com número de referência), Zelle, Venmo pessoal, crédito em conta.

Custo: zero. Se a operação continuar majoritariamente em dinheiro, ótimo — a economia é total. O objetivo do módulo online é atender quem prefere pagar pelo celular às 23h e reduzir a inadimplência, não substituir o dinheiro.

---

## 7. Instrumentação da decisão

A tabela `payments` tem uma coluna `fee_cents` justamente para isto: registrar a taxa real de cada transação. Em três meses de operação, o relatório "taxa por método" mostra exatamente quanto cada caminho custou, com dados da própria CA Tempo:

```
Julho 2026 · Taxas por método
ACH        42 pagamentos  $14.700 processados  $118 em taxas  (0,80%)
Cartão     18 pagamentos   $5.400 processados  $162 em taxas  (3,00%)
Dinheiro   23 pagamentos   $7.100 processados    $0 em taxas
                                        Total:  $280

Se todos os cartões tivessem sido ACH: $43  →  economia potencial de $119 no mês
```

Isso transforma a decisão que ficou em aberto na reunião em algo que se revisita com evidência, não com opinião.

---

## 8. Ação recomendada

1. **Carlos abre uma conta Stripe** em nome da CA Tempo Training (precisa de EIN ou SSN, conta bancária e dados do negócio). Gratuito, sem mensalidade, leva cerca de 15 minutos.
2. Habilitar **ACH Direct Debit** no dashboard (requer verificação da conta bancária).
3. Manter o PayPal existente, se houver, como opção secundária — o adaptador pode ser adicionado depois sem retrabalho.
4. **Confirmar com contador/advogado local** se o desconto por ACH (recomendado) ou o surcharge no cartão é o caminho, dada a jurisdição.
5. Revisar os números deste documento em 90 dias com dados reais da tabela `payments`.

> **Nota:** as taxas citadas foram verificadas nas páginas oficiais em julho de 2026 e estão sujeitas a alteração pelas processadoras. Antes de fechar a decisão, confirme nas páginas de preço vigentes.
