'use server';

import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseFormSchema, slugify, ensureUniqueSlug, type FormSchema } from '@ca-tempo/domain';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Local types (Phase 2 tables not yet in generated Database types)
// ---------------------------------------------------------------------------

type FormRow = {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  requires_waiver: boolean;
  requires_payment: boolean;
  success_message: string | null;
  redirect_url: string | null;
};

type FormVersionRow = {
  id: string;
  form_id: string;
  version: number;
  schema: unknown;
  published_at: string | null;
};

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateFormResult = { ok: true; id: string } | { ok: false; error: string };
export type PublishResult = { ok: true; version: number } | { ok: false; error: string };

export type FormMeta = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  requires_waiver: boolean;
  requires_payment: boolean;
  success_message: string | null;
  redirect_url: string | null;
};

export type FormVersionInfo = {
  id: string;
  version: number;
  schema: FormSchema;
  published_at: string | null;
};

export type FormDetail = {
  form: FormMeta;
  editableVersion: FormVersionInfo;
  publishedVersion: FormVersionInfo | null;
  hasDraft: boolean;
};

export type FormListItem = {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  publishedVersion: number | null;
  hasDraft: boolean;
};

const FORM_TYPES = ['registration', 'evaluation', 'survey', 'intake'] as const;
type FormType = (typeof FORM_TYPES)[number];

/** Authenticated client; RLS `forms_staff_all` applies via the coach JWT. */
async function getDb(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

function isFormType(value: string): value is FormType {
  return (FORM_TYPES as readonly string[]).includes(value);
}

function zodErrorMessage(err: ZodError): string {
  const first = err.issues[0];
  const path = first.path.length > 0 ? `${first.path.join('.')}: ` : '';
  return `Invalid schema: ${path}${first.message}`;
}

async function loadFormForOrg(formId: string, orgId: string): Promise<FormRow | null> {
  const db = await getDb();
  const { data } = await db
    .from('forms')
    .select(
      'id, organization_id, slug, name, description, type, status, requires_waiver, requires_payment, success_message, redirect_url',
    )
    .eq('id', formId)
    .eq('organization_id', orgId)
    .maybeSingle();
  return (data as FormRow | null) ?? null;
}

async function loadVersions(formId: string): Promise<FormVersionRow[]> {
  const db = await getDb();
  const { data } = await db
    .from('form_versions')
    .select('id, form_id, version, schema, published_at')
    .eq('form_id', formId)
    .order('version', { ascending: false });
  return (data ?? []) as FormVersionRow[];
}

function toVersionInfo(row: FormVersionRow): FormVersionInfo {
  return {
    id: row.id,
    version: row.version,
    schema: parseFormSchema(row.schema),
    published_at: row.published_at,
  };
}

function toFormMeta(row: FormRow): FormMeta {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    type: row.type,
    status: row.status,
    requires_waiver: row.requires_waiver,
    requires_payment: row.requires_payment,
    success_message: row.success_message,
    redirect_url: row.redirect_url,
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function createForm(input: {
  name: string;
  type: string;
  requires_waiver?: boolean;
  success_message?: string;
}): Promise<CreateFormResult> {
  const ctx = await requireRole(['owner', 'admin']);
  const db = await getDb();

  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Name is required.' };
  if (!isFormType(input.type)) return { ok: false, error: 'Invalid form type.' };

  const { data: existing } = await db
    .from('forms')
    .select('slug')
    .eq('organization_id', ctx.orgId);
  const slugs = ((existing ?? []) as { slug: string }[]).map((r) => r.slug);
  const baseSlug = slugify(name);
  if (!baseSlug) return { ok: false, error: 'Could not generate a valid slug from the name.' };
  const slug = ensureUniqueSlug(baseSlug, slugs);

  const { data: form, error: formError } = await db
    .from('forms')
    .insert({
      organization_id: ctx.orgId,
      slug,
      name,
      type: input.type,
      status: 'draft',
      requires_waiver: input.requires_waiver ?? false,
      success_message: input.success_message?.trim() || null,
    })
    .select('id')
    .single();

  if (formError || !form) {
    return { ok: false, error: formError?.message ?? 'Failed to create form.' };
  }

  const formId = (form as { id: string }).id;
  const { error: versionError } = await db.from('form_versions').insert({
    form_id: formId,
    version: 1,
    schema: { sections: [] },
    published_at: null,
  });

  if (versionError) {
    return { ok: false, error: versionError.message };
  }

  revalidatePath('/coach/forms');
  return { ok: true, id: formId };
}

export type SaveDraftMeta = {
  name?: string;
  description?: string | null;
  success_message?: string | null;
  requires_waiver?: boolean;
};

export async function saveDraft(
  formId: string,
  schema: unknown,
  meta?: SaveDraftMeta,
): Promise<ActionResult> {
  const ctx = await requireRole(['owner', 'admin']);
  const db = await getDb();

  const form = await loadFormForOrg(formId, ctx.orgId);
  if (!form) return { ok: false, error: 'Form not found.' };

  let parsed: FormSchema;
  try {
    parsed = parseFormSchema(schema);
  } catch (err) {
    if (err instanceof ZodError) return { ok: false, error: zodErrorMessage(err) };
    return { ok: false, error: 'Invalid schema.' };
  }

  if (meta) {
    const patch: Record<string, unknown> = {};
    if (meta.name !== undefined) patch.name = meta.name.trim();
    if (meta.description !== undefined) patch.description = meta.description;
    if (meta.success_message !== undefined) patch.success_message = meta.success_message;
    if (meta.requires_waiver !== undefined) patch.requires_waiver = meta.requires_waiver;
    if (Object.keys(patch).length > 0) {
      const { error } = await db
        .from('forms')
        .update(patch)
        .eq('id', formId)
        .eq('organization_id', ctx.orgId);
      if (error) return { ok: false, error: error.message };
    }
  }

  const versions = await loadVersions(formId);
  const latest = versions[0];

  if (latest && latest.published_at === null) {
    const { error } = await db
      .from('form_versions')
      .update({ schema: parsed })
      .eq('id', latest.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const nextVersion = latest ? latest.version + 1 : 1;
    const { error } = await db.from('form_versions').insert({
      form_id: formId,
      version: nextVersion,
      schema: parsed,
      published_at: null,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/coach/forms');
  revalidatePath(`/coach/forms/${formId}/edit`);
  return { ok: true };
}

export async function publishForm(formId: string): Promise<PublishResult> {
  const ctx = await requireRole(['owner', 'admin']);
  const db = await getDb();

  const form = await loadFormForOrg(formId, ctx.orgId);
  if (!form) return { ok: false, error: 'Form not found.' };

  const versions = await loadVersions(formId);
  const draft = versions.find((v) => v.published_at === null);
  if (!draft) return { ok: false, error: 'No draft version to publish.' };

  try {
    parseFormSchema(draft.schema);
  } catch (err) {
    if (err instanceof ZodError) return { ok: false, error: zodErrorMessage(err) };
    return { ok: false, error: 'Invalid schema.' };
  }

  const now = new Date().toISOString();
  const { error: versionError } = await db
    .from('form_versions')
    .update({ published_at: now })
    .eq('id', draft.id);
  if (versionError) return { ok: false, error: versionError.message };

  if (form.status !== 'published') {
    const { error: formError } = await db
      .from('forms')
      .update({ status: 'published' })
      .eq('id', formId)
      .eq('organization_id', ctx.orgId);
    if (formError) return { ok: false, error: formError.message };
  }

  revalidatePath('/coach/forms');
  revalidatePath(`/coach/forms/${formId}/edit`);
  return { ok: true, version: draft.version };
}

export async function getForm(formId: string): Promise<FormDetail | null> {
  const ctx = await requireRole(['owner', 'admin']);
  const form = await loadFormForOrg(formId, ctx.orgId);
  if (!form) return null;

  const versions = await loadVersions(formId);
  const draft = versions.find((v) => v.published_at === null);
  const latestPublished = versions.find((v) => v.published_at !== null);

  let editableVersion: FormVersionInfo;
  if (draft) {
    editableVersion = toVersionInfo(draft);
  } else if (latestPublished) {
    editableVersion = toVersionInfo(latestPublished);
  } else {
    const fallback = versions[versions.length - 1];
    if (!fallback) return null;
    editableVersion = toVersionInfo(fallback);
  }

  return {
    form: toFormMeta(form),
    editableVersion,
    publishedVersion: latestPublished ? toVersionInfo(latestPublished) : null,
    hasDraft: Boolean(draft),
  };
}

export async function deleteForm(formId: string): Promise<ActionResult> {
  const ctx = await requireRole(['owner', 'admin']);
  const db = await getDb();

  const form = await loadFormForOrg(formId, ctx.orgId);
  if (!form) return { ok: false, error: 'Form not found.' };

  // Protege dados: não apaga formulário que já recebeu inscrições (arquivar/fechar é o certo).
  const versions = await loadVersions(formId);
  const versionIds = versions.map((v) => v.id);
  if (versionIds.length > 0) {
    const { count, error: countError } = await db
      .from('form_submissions')
      .select('id', { count: 'exact', head: true })
      .in('form_version_id', versionIds);
    if (countError) return { ok: false, error: countError.message };
    if ((count ?? 0) > 0) return { ok: false, error: 'has_submissions' };
  }

  // form_versions tem ON DELETE CASCADE, então some junto com o formulário.
  const { error } = await db
    .from('forms')
    .delete()
    .eq('id', formId)
    .eq('organization_id', ctx.orgId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/coach/forms');
  return { ok: true };
}

export async function listForms(): Promise<FormListItem[]> {
  const ctx = await requireRole(['owner', 'admin']);
  const db = await getDb();

  const { data: formsData } = await db
    .from('forms')
    .select('id, slug, name, type, status')
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: false });

  const forms = (formsData ?? []) as Pick<FormRow, 'id' | 'slug' | 'name' | 'type' | 'status'>[];
  const items: FormListItem[] = [];

  for (const form of forms) {
    const versions = await loadVersions(form.id);
    const published = versions.find((v) => v.published_at !== null);
    const draft = versions.find((v) => v.published_at === null);
    items.push({
      id: form.id,
      slug: form.slug,
      name: form.name,
      type: form.type,
      status: form.status,
      publishedVersion: published?.version ?? null,
      hasDraft: Boolean(draft),
    });
  }

  return items;
}
