/**
 * Teste de fumaça do webhook da Stripe, ponta a ponta.
 *
 * Cria uma organização descartável, emite uma fatura, cobra de verdade na
 * Stripe em modo de teste e confere se o webhook fechou a fatura sozinho.
 * Apaga tudo no final, inclusive se falhar no meio.
 *
 * Pré-requisitos:
 *   1. pnpm dev rodando
 *   2. stripe listen --events ... --forward-to localhost:3000/api/webhooks/stripe
 *   3. STRIPE_WEBHOOK_SECRET no .env.local com o whsec_ que o listen imprimiu
 *
 * Uso:  node scripts/webhook-smoke-test.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const here = path.dirname(fileURLToPath(import.meta.url));
const envText = fs.readFileSync(path.join(here, '..', '.env.local'), 'utf8');

/** Lê do .env.local sem imprimir valor nenhum. */
function env(name) {
  const match = envText.match(new RegExp(`^${name}=(.*)$`, 'm'));
  if (!match) throw new Error(`Falta ${name} no .env.local`);
  return match[1].trim().replace(/^["']|["']$/g, '');
}

const db = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});
const stripe = new Stripe(env('STRIPE_SECRET_KEY'));

const resultados = [];
function check(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  resultados.push({ nome, obtido: String(obtido), esperado: String(esperado), ok });
}

/** Espera o webhook chegar. Ele é assíncrono: a Stripe entrega quando entrega. */
async function esperarPor(fn, descricao, timeoutMs = 25000) {
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 700));
  }
  console.error(`  ! esgotou o tempo esperando: ${descricao}`);
  return false;
}

let orgId = null;

try {
  // ---------------------------------------------------------------- setup
  const { data: org, error: orgErr } = await db
    .from('organizations')
    .insert({ name: 'SMOKE TEST (apagar)', slug: `smoke-${crypto.randomUUID()}` })
    .select('id')
    .single();
  if (orgErr) throw new Error(`criar org: ${orgErr.message}`);
  orgId = org.id;

  const { data: hh } = await db
    .from('households')
    .insert({ organization_id: orgId, name: 'Smoke' })
    .select('id')
    .single();

  const { data: ath } = await db
    .from('athletes')
    .insert({
      organization_id: orgId,
      household_id: hh.id,
      first_name: 'Smoke',
      last_name: 'Test',
      date_of_birth: '2015-01-01',
      status: 'active',
    })
    .select('id')
    .single();

  const { data: inv, error: invErr } = await db
    .from('invoices')
    .insert({
      organization_id: orgId,
      athlete_id: ath.id,
      household_id: hh.id,
      number: 'SMOKE-0001',
      status: 'open',
      subtotal_cents: 60000,
      total_cents: 60000,
      memo: 'Full Camp Pass',
    })
    .select('id')
    .single();
  if (invErr) throw new Error(`criar fatura: ${invErr.message}`);

  console.log(`\nFatura de teste criada: $600,00 em aberto\n`);

  // ------------------------------------------------- 1. cobrança no cartão
  console.log('1. Cobrando $600 no cartão de teste...');
  const intent = await stripe.paymentIntents.create({
    amount: 60000,
    currency: 'usd',
    payment_method: 'pm_card_visa',
    payment_method_types: ['card'],
    confirm: true,
    metadata: { invoice_id: inv.id, organization_id: orgId },
  });
  check('Stripe confirmou a cobrança', intent.status, 'succeeded');

  const quitou = await esperarPor(async () => {
    const { data } = await db.from('invoices').select('status').eq('id', inv.id).single();
    return data?.status === 'paid';
  }, 'o webhook fechar a fatura');

  check('webhook fechou a fatura sozinho', quitou ? 'paid' : 'nao fechou', 'paid');

  const { data: pagamentos } = await db
    .from('payments')
    .select('id, status, method, fee_cents, external_id')
    .eq('invoice_id', inv.id);

  check('gravou exatamente um pagamento', pagamentos?.length ?? 0, 1);
  check('status do pagamento', pagamentos?.[0]?.status, 'succeeded');
  check('identificou o método', pagamentos?.[0]?.method, 'card');
  check('amarrou ao PaymentIntent certo', pagamentos?.[0]?.external_id, intent.id);
  check(
    'gravou a taxa real da Stripe',
    pagamentos?.[0]?.fee_cents > 0 ? 'sim' : `nao (${pagamentos?.[0]?.fee_cents})`,
    'sim',
  );

  if (pagamentos?.[0]?.fee_cents) {
    const taxa = (pagamentos[0].fee_cents / 100).toFixed(2);
    console.log(`   taxa cobrada pela Stripe: $${taxa} (nosso cálculo previa $17,70)`);
  }

  // ------------------------------------- 2. reenvio do mesmo evento
  console.log('\n2. Reenviando o mesmo evento três vezes...');
  const { data: evento } = await db
    .from('webhook_events')
    .select('event_id, payload')
    .eq('type', 'payment_intent.succeeded')
    .order('received_at', { ascending: false })
    .limit(1)
    .single();

  if (evento) {
    for (let i = 0; i < 3; i++) {
      const { error } = await db.from('webhook_events').insert({
        provider: 'stripe',
        event_id: evento.event_id,
        type: 'payment_intent.succeeded',
        payload: evento.payload,
      });
      check(`reenvio ${i + 1} barrado pela trava de idempotência`, error?.code ?? 'passou', '23505');
    }
  }

  const { data: depois } = await db.from('payments').select('id').eq('invoice_id', inv.id);
  check('continua com um pagamento só', depois?.length ?? 0, 1);

  const { data: saldo } = await db
    .from('invoice_balances')
    .select('paid_cents, balance_cents')
    .eq('invoice_id', inv.id)
    .single();
  check('valor pago não dobrou', saldo?.paid_cents, 60000);
  check('saldo zerado', saldo?.balance_cents, 0);

  // ------------------------------------------- 3. cartão recusado
  console.log('\n3. Cobrando com cartão que o banco recusa...');
  const { data: inv2 } = await db
    .from('invoices')
    .insert({
      organization_id: orgId,
      athlete_id: ath.id,
      number: 'SMOKE-0002',
      status: 'open',
      subtotal_cents: 35000,
      total_cents: 35000,
    })
    .select('id')
    .single();

  let recusou = false;
  try {
    await stripe.paymentIntents.create({
      amount: 35000,
      currency: 'usd',
      payment_method: 'pm_card_chargeDeclined',
      payment_method_types: ['card'],
      confirm: true,
      metadata: { invoice_id: inv2.id, organization_id: orgId },
    });
  } catch {
    recusou = true;
  }
  check('Stripe recusou a cobrança', recusou ? 'recusou' : 'passou', 'recusou');

  await new Promise((r) => setTimeout(r, 6000));

  const { data: inv2Depois } = await db
    .from('invoices')
    .select('status')
    .eq('id', inv2.id)
    .single();
  check('fatura recusada NÃO foi quitada', inv2Depois?.status, 'open');
} catch (erro) {
  console.error('\nERRO:', erro.message);
  resultados.push({ nome: 'execução do teste', obtido: erro.message, esperado: 'sem erro', ok: false });
} finally {
  if (orgId) {
    await db.from('organizations').delete().eq('id', orgId);
    console.log('\nDados de teste apagados.');
  }
}

console.log('\n================ RESULTADO ================');
for (const r of resultados) {
  console.log(
    `${r.ok ? 'OK  ' : 'FALHOU'}  ${r.nome}` + (r.ok ? '' : `  (obtido: ${r.obtido}, esperado: ${r.esperado})`),
  );
}
const falhas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} passaram`);
process.exit(falhas > 0 ? 1 : 0);
