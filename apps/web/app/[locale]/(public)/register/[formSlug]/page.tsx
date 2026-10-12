import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { parseFormSchema } from '@ca-tempo/domain';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import { Link, routing } from '@/i18n/routing';
import { resolveWaiverTemplateId } from './registration-helpers';
import { RegisterForm, type KnownAthlete, type KnownGuardian, type ProgramOption, type WaiverInfo } from './register-form';
import { AthleticCard } from '@/components/athletic-card';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string; formSlug: string }>;
};

export default async function RegisterPage({ params }: PageProps) {
  const { locale, formSlug } = await params;
  const t = await getTranslations('register');
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

  const family = await loadKnownFamily(form.organization_id);
  const returnPath =
    locale === routing.defaultLocale
      ? `/register/${formSlug}`
      : `/${locale}/register/${formSlug}`;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <AthleticCard className="accent-border-top overflow-visible p-6">
        <h1 className="mb-1 font-display text-3xl uppercase tracking-wide">{form.name}</h1>
        {form.description ? (
          <p className="mb-6 text-muted-foreground">{form.description}</p>
        ) : null}

        {family.signedIn ? null : (
          <p className="mb-6 text-sm">
            <Link
              href={{ pathname: '/login', query: { redirect: returnPath } }}
              className="font-medium text-accent-700 underline-offset-4 hover:underline dark:text-accent-500"
            >
              {t('alreadyWithUs')}
            </Link>
          </p>
        )}

        <RegisterForm
          formVersionId={version.id}
          schema={schema}
          successMessage={form.success_message}
          options={options}
          waiver={waiver}
          knownAthletes={family.athletes}
          knownGuardian={family.guardian}
        />
      </AthleticCard>
    </main>
  );
}

async function loadKnownFamily(organizationId: string): Promise<{
  signedIn: boolean;
  athletes: KnownAthlete[];
  guardian: KnownGuardian | null;
}> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { signedIn: false, athletes: [], guardian: null };

  // auth_athlete_ids(), não a leitura de staff: coach logado não vê o elenco inteiro.
  const [{ data: familyIds }, { data: guardianRow }] = await Promise.all([
    db.rpc('auth_athlete_ids'),
    db
      .from('guardians')
      .select('first_name, last_name, email')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  const ids = familyIds ?? [];
  const { data: athleteRows } =
    ids.length === 0
      ? { data: [] }
      : await db
          .from('athletes')
          .select('id, first_name, last_name, date_of_birth')
          .in('id', ids)
          .eq('organization_id', organizationId)
          .is('deleted_at', null)
          .order('first_name');

  const athletes = ((athleteRows ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
  }[]).map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
  }));

  const guardian = guardianRow as {
    first_name: string;
    last_name: string;
    email: string;
  } | null;

  return {
    signedIn: true,
    athletes,
    guardian: guardian?.email
      ? {
          firstName: guardian.first_name,
          lastName: guardian.last_name,
          email: guardian.email,
        }
      : null,
  };
}
