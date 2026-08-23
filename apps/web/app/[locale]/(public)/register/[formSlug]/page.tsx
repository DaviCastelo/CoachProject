import { notFound } from 'next/navigation';
import { parseFormSchema } from '@ca-tempo/domain';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveWaiverTemplateId } from './registration-helpers';
import { RegisterForm, type ProgramOption, type WaiverInfo } from './register-form';
import { AthleticCard } from '@/components/athletic-card';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string; formSlug: string }>;
};

export default async function RegisterPage({ params }: PageProps) {
  const { formSlug } = await params;
  const svc = createServiceClient();

  const { data: form } = await svc
    .from('forms')
    .select('id, organization_id, name, description, status, success_message, requires_waiver')
    .eq('slug', formSlug)
    .eq('status', 'published')
    .maybeSingle();

  if (!form) notFound();

  const { data: version } = await svc
    .from('form_versions')
    .select('id, schema, version')
    .eq('form_id', form.id)
    .not('published_at', 'is', null)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!version) notFound();

  const schema = parseFormSchema(version.schema);

  const { data: program } = await svc
    .from('programs')
    .select('id, waiver_template_id')
    .eq('form_id', form.id)
    .eq('status', 'published')
    .maybeSingle();

  let options: ProgramOption[] = [];
  if (program) {
    const { data: opts } = await svc
      .from('program_options')
      .select('id, name, description, price_cents')
      .eq('program_id', program.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    options = (opts ?? []) as ProgramOption[];
  }

  let waiver: WaiverInfo | null = null;
  if (form.requires_waiver) {
    const templateId = await resolveWaiverTemplateId(svc, form.organization_id, program);
    if (templateId) {
      const { data: tpl } = await svc
        .from('waiver_templates')
        .select('id, name, body_markdown')
        .eq('id', templateId)
        .eq('is_active', true)
        .maybeSingle();
      if (tpl) waiver = { id: tpl.id, name: tpl.name, body: tpl.body_markdown };
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <AthleticCard className="accent-border-top p-6">
        <h1 className="mb-1 font-display text-3xl uppercase tracking-wide">{form.name}</h1>
        {form.description ? (
          <p className="mb-6 text-muted-foreground">{form.description}</p>
        ) : null}

        <RegisterForm
          formVersionId={version.id}
          schema={schema}
          successMessage={form.success_message}
          options={options}
          waiver={waiver}
        />
      </AthleticCard>
    </main>
  );
}
