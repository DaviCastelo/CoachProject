'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { slugify, ensureUniqueSlug } from '@ca-tempo/domain';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { isProgramType, isProgramStatus } from './constants';

/**
 * Programas e seus preços.
 *
 * Esta tela não existia, e a falta dela quebrava a cobrança inteira sem
 * fazer barulho: o preço de uma inscrição sai da OPÇÃO DE PROGRAMA que a
 * família escolhe no formulário, e não havia como criar programa nem opção
 * por lugar nenhum do app. Só por SQL.
 *
 * O efeito aparecia lá na frente, na forma mais confusa possível: a inscrição
 * entrava, a aprovação acontecia, e a fatura simplesmente não saía, porque
 * `create_invoice_for_registration` desiste quieto quando não há preço. Em
 * produção, 9 das 10 inscrições estavam nesse estado.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

export type ProgramListItem = {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  optionCount: number;
  /** Null quando o programa ainda não tem opção: é o estado que não cobra. */
  minPriceCents: number | null;
  maxPriceCents: number | null;
  formName: string | null;
};

export type ProgramOption = {
  id: string;
  name: string;
  priceCents: number;
  capacity: number | null;
  isActive: boolean;
  /** Quantas inscrições já escolheram esta opção. Zero permite apagar. */
  registrationCount: number;
};

export type ProgramDetail = {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  description: string | null;
  startsOn: string | null;
  endsOn: string | null;
  capacity: number | null;
  formId: string | null;
  options: ProgramOption[];
};

export type LinkableForm = {
  id: string;
  name: string;
  status: string;
  requiresPayment: boolean;
  /** Nome do programa PUBLICADO que já usa este formulário, se houver. */
  takenBy: string | null;
};

async function db(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function listPrograms(): Promise<ProgramListItem[]> {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const sb = await db();

  const { data } = await sb
    .from('programs')
    .select('id, slug, name, type, status, form_id, program_options(price_cents)')
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: false });

  const rows = data ?? [];

  // Os nomes dos formulários vêm numa consulta só: um `join` por linha aqui
  // seria uma ida ao banco por programa.
  const formIds = rows.map((r) => r.form_id as string | null).filter((v): v is string => !!v);
  const nameByForm = new Map<string, string>();

  if (formIds.length > 0) {
    const { data: forms } = await sb
      .from('forms')
      .select('id, name')
      .eq('organization_id', ctx.orgId)
      .in('id', formIds);
    for (const f of forms ?? []) nameByForm.set(f.id as string, f.name as string);
  }

  return rows.map((row) => {
    const precos = ((row.program_options as { price_cents: number }[] | null) ?? []).map(
      (o) => o.price_cents,
    );

    return {
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      type: row.type as string,
      status: row.status as string,
      optionCount: precos.length,
      minPriceCents: precos.length > 0 ? Math.min(...precos) : null,
      maxPriceCents: precos.length > 0 ? Math.max(...precos) : null,
      formName: row.form_id ? (nameByForm.get(row.form_id as string) ?? null) : null,
    };
  });
}

export async function getProgram(id: string): Promise<ProgramDetail | null> {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const sb = await db();

  const { data: row } = await sb
    .from('programs')
    .select(
      'id, slug, name, type, status, description, starts_on, ends_on, capacity, form_id',
    )
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .maybeSingle();

  if (!row) return null;

  const { data: opts } = await sb
    .from('program_options')
    .select('id, name, price_cents, capacity, is_active, sort_order')
    .eq('program_id', id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const options = opts ?? [];

  // Uma opção já escolhida por alguma inscrição não pode ser apagada: a FK
  // é `on delete set null`, então apagar não dá erro, só desliga o preço de
  // inscrições existentes em silêncio.
  const usoPorOpcao = new Map<string, number>();
  if (options.length > 0) {
    const { data: regs } = await sb
      .from('registrations')
      .select('program_option_id')
      .eq('organization_id', ctx.orgId)
      .in(
        'program_option_id',
        options.map((o) => o.id as string),
      );
    for (const r of regs ?? []) {
      const k = r.program_option_id as string;
      usoPorOpcao.set(k, (usoPorOpcao.get(k) ?? 0) + 1);
    }
  }

  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    type: row.type as string,
    status: row.status as string,
    description: (row.description as string | null) ?? null,
    startsOn: (row.starts_on as string | null) ?? null,
    endsOn: (row.ends_on as string | null) ?? null,
    capacity: (row.capacity as number | null) ?? null,
    formId: (row.form_id as string | null) ?? null,
    options: options.map((o) => ({
      id: o.id as string,
      name: o.name as string,
      priceCents: o.price_cents as number,
      capacity: (o.capacity as number | null) ?? null,
      isActive: o.is_active as boolean,
      registrationCount: usoPorOpcao.get(o.id as string) ?? 0,
    })),
  };
}

export async function listLinkableForms(currentProgramId?: string): Promise<LinkableForm[]> {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const sb = await db();

  const { data: forms } = await sb
    .from('forms')
    .select('id, name, status, requires_payment')
    .eq('organization_id', ctx.orgId)
    .eq('type', 'registration')
    .order('name', { ascending: true });

  const { data: programas } = await sb
    .from('programs')
    .select('id, name, form_id, status')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'published')
    .not('form_id', 'is', null);

  const ocupados = new Map<string, string>();
  for (const p of programas ?? []) {
    if (p.id === currentProgramId) continue;
    ocupados.set(p.form_id as string, p.name as string);
  }

  return (forms ?? []).map((f) => ({
    id: f.id as string,
    name: f.name as string,
    status: f.status as string,
    requiresPayment: f.requires_payment as boolean,
    takenBy: ocupados.get(f.id as string) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

/**
 * Dois programas PUBLICADOS no mesmo formulário é ambíguo de um jeito que não
 * dá erro: `submit_public_registration` resolve o programa com
 * `where form_id = ... and status = 'published' limit 1`, sem ordenação. A
 * inscrição sairia com o preço de um ou de outro, conforme o humor do banco.
 */
async function formularioLivre(
  sb: SupabaseClient,
  orgId: string,
  formId: string,
  ignorarProgramaId?: string,
): Promise<string | null> {
  const { data } = await sb
    .from('programs')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('form_id', formId)
    .eq('status', 'published');

  const outro = (data ?? []).find((p) => p.id !== ignorarProgramaId);
  return outro ? (outro.name as string) : null;
}

export async function createProgram(input: {
  name: string;
  type: string;
  formId?: string | null;
}): Promise<CreateResult> {
  const ctx = await requireRole(['owner', 'admin']);
  const sb = await db();

  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Dê um nome ao programa.' };
  if (!isProgramType(input.type)) return { ok: false, error: 'Tipo de programa inválido.' };

  const { data: existentes } = await sb
    .from('programs')
    .select('slug')
    .eq('organization_id', ctx.orgId);

  const base = slugify(name);
  if (!base) return { ok: false, error: 'O nome não gera um endereço válido.' };
  const slug = ensureUniqueSlug(
    base,
    ((existentes ?? []) as { slug: string }[]).map((r) => r.slug),
  );

  // Nasce como rascunho de propósito: programa sem preço não deveria aparecer
  // para a família, e preço é a próxima coisa que a pessoa vai cadastrar.
  const { data, error } = await sb
    .from('programs')
    .insert({
      organization_id: ctx.orgId,
      slug,
      name,
      type: input.type,
      status: 'draft',
      form_id: input.formId || null,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Não foi possível criar.' };

  revalidatePath('/[locale]/coach/programs', 'page');
  return { ok: true, id: data.id as string };
}

export async function updateProgram(
  id: string,
  patch: {
    name?: string;
    type?: string;
    status?: string;
    formId?: string | null;
    description?: string | null;
    startsOn?: string | null;
    endsOn?: string | null;
    capacity?: number | null;
  },
): Promise<ActionResult> {
  const ctx = await requireRole(['owner', 'admin']);
  const sb = await db();

  const { data: atual } = await sb
    .from('programs')
    .select('id, status, form_id')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .maybeSingle();

  if (!atual) return { ok: false, error: 'Programa não encontrado.' };

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return { ok: false, error: 'Dê um nome ao programa.' };
    row.name = name;
  }
  if (patch.type !== undefined) {
    if (!isProgramType(patch.type)) return { ok: false, error: 'Tipo de programa inválido.' };
    row.type = patch.type;
  }
  if (patch.status !== undefined) {
    if (!isProgramStatus(patch.status)) return { ok: false, error: 'Situação inválida.' };
    row.status = patch.status;
  }
  if (patch.formId !== undefined) row.form_id = patch.formId || null;
  if (patch.description !== undefined) row.description = patch.description || null;
  if (patch.startsOn !== undefined) row.starts_on = patch.startsOn || null;
  if (patch.endsOn !== undefined) row.ends_on = patch.endsOn || null;
  if (patch.capacity !== undefined) row.capacity = patch.capacity ?? null;

  const statusFinal = (row.status as string | undefined) ?? (atual.status as string);
  const formFinal =
    patch.formId !== undefined ? patch.formId || null : (atual.form_id as string | null);

  if (statusFinal === 'published' && formFinal) {
    const conflito = await formularioLivre(sb, ctx.orgId, formFinal, id);
    if (conflito) {
      return {
        ok: false,
        error: `O programa "${conflito}" já usa este formulário e está publicado. Dois programas publicados no mesmo formulário fazem a inscrição sair com o preço errado.`,
      };
    }
  }

  // Publicar sem preço é publicar uma inscrição que não cobra nada. O guard da
  // aprovação sai quieto nesse caso, e a fatura nunca aparece.
  if (statusFinal === 'published') {
    const { count } = await sb
      .from('program_options')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', id)
      .eq('is_active', true);

    if (!count) {
      return {
        ok: false,
        error: 'Cadastre ao menos uma opção com preço antes de publicar.',
      };
    }
  }

  const { error } = await sb
    .from('programs')
    .update(row)
    .eq('id', id)
    .eq('organization_id', ctx.orgId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]/coach/programs', 'page');
  revalidatePath('/[locale]/coach/programs/[id]', 'page');
  return { ok: true };
}

export async function createOption(
  programId: string,
  input: { name: string; priceCents: number; capacity?: number | null },
): Promise<ActionResult> {
  const ctx = await requireRole(['owner', 'admin']);
  const sb = await db();

  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Dê um nome à opção.' };
  if (!Number.isInteger(input.priceCents) || input.priceCents < 1) {
    return {
      ok: false,
      error: 'O preço precisa ser maior que zero. Para programa gratuito, deixe o formulário sem cobrança.',
    };
  }

  const { data: prog } = await sb
    .from('programs')
    .select('id')
    .eq('id', programId)
    .eq('organization_id', ctx.orgId)
    .maybeSingle();

  if (!prog) return { ok: false, error: 'Programa não encontrado.' };

  const { count } = await sb
    .from('program_options')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId);

  const { error } = await sb.from('program_options').insert({
    organization_id: ctx.orgId,
    program_id: programId,
    name,
    price_cents: input.priceCents,
    capacity: input.capacity ?? null,
    sort_order: count ?? 0,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]/coach/programs/[id]', 'page');
  revalidatePath('/[locale]/coach/programs', 'page');
  return { ok: true };
}

export async function updateOption(
  id: string,
  patch: { name?: string; priceCents?: number; capacity?: number | null; isActive?: boolean },
): Promise<ActionResult> {
  const ctx = await requireRole(['owner', 'admin']);
  const sb = await db();

  const row: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return { ok: false, error: 'Dê um nome à opção.' };
    row.name = name;
  }
  if (patch.priceCents !== undefined) {
    if (!Number.isInteger(patch.priceCents) || patch.priceCents < 1) {
      return { ok: false, error: 'O preço precisa ser maior que zero.' };
    }
    row.price_cents = patch.priceCents;
  }
  if (patch.capacity !== undefined) row.capacity = patch.capacity ?? null;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;

  if (Object.keys(row).length === 0) return { ok: true };

  const { error } = await sb
    .from('program_options')
    .update(row)
    .eq('id', id)
    .eq('organization_id', ctx.orgId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]/coach/programs/[id]', 'page');
  revalidatePath('/[locale]/coach/programs', 'page');
  return { ok: true };
}

/**
 * Só apaga opção que ninguém escolheu.
 *
 * A FK de `registrations.program_option_id` é `on delete set null`: apagar
 * uma opção em uso NÃO dá erro, só desliga o preço daquelas inscrições sem
 * avisar ninguém. Quem já tem histórico se desativa, não se apaga.
 */
export async function deleteOption(id: string): Promise<ActionResult> {
  const ctx = await requireRole(['owner', 'admin']);
  const sb = await db();

  const { count } = await sb
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.orgId)
    .eq('program_option_id', id);

  if (count && count > 0) {
    return {
      ok: false,
      error: `${count} inscrição(ões) já escolheram esta opção. Desative em vez de apagar, para não apagar o preço do histórico delas.`,
    };
  }

  const { error } = await sb
    .from('program_options')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.orgId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]/coach/programs/[id]', 'page');
  revalidatePath('/[locale]/coach/programs', 'page');
  return { ok: true };
}
