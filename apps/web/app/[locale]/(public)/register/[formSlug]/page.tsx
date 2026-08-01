import { notFound } from 'next/navigation';
import Image from 'next/image';
import { parseFormSchema } from '@ca-tempo/domain';
import { createServiceClient } from '@/lib/supabase/service';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { RegisterForm, type ProgramOption, type WaiverInfo } from './register-form';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string; formSlug: string }>;
};

export default async function RegisterPage({ params }: PageProps) {
  const { formSlug } = await params;
  const svc = createServiceClient();

  const { data: form } = await svc
    .from('forms')
    .select('id, name, description, status, success_message, requires_waiver')
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

  // Programa vinculado a este formulário (para pass e waiver)
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
  if (form.requires_waiver && program?.waiver_template_id) {
    const { data: tpl } = await svc
      .from('waiver_templates')
      .select('id, name, body_markdown')
      .eq('id', program.waiver_template_id)
      .eq('is_active', true)
      .maybeSingle();
    if (tpl) waiver = { id: tpl.id, name: tpl.name, body: tpl.body_markdown };
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <Image src="/icons/shield.svg" alt="CA Tempo" width={32} height={32} />
          <span className="font-display text-lg uppercase tracking-wide">CA Tempo</span>
        </div>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
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
      </main>
    </div>
  );
}
