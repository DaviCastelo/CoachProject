import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { requireRole } from '@/lib/auth/guards';
import { listForms } from './actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

function statusVariant(status: string): 'secondary' | 'success' | 'outline' | 'danger' {
  if (status === 'published') return 'success';
  if (status === 'draft') return 'secondary';
  if (status === 'closed') return 'danger';
  return 'outline';
}

export default async function FormsPage() {
  await requireRole(['owner', 'admin']);
  const forms = await listForms();
  const t = await getTranslations('forms');

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-3xl uppercase tracking-wide">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle', { count: forms.length })}</p>
        </div>
        <Button asChild size="sm">
          <Link href="/coach/forms/new">{t('newForm')}</Link>
        </Button>
      </div>

      {forms.length === 0 ? (
        <Card className="p-6 text-center">
          <h2 className="mb-2 font-display text-xl uppercase tracking-wide">{t('emptyTitle')}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{t('emptyDescription')}</p>
          <Button asChild>
            <Link href="/coach/forms/new">{t('newForm')}</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {forms.map((form) => (
            <Card key={form.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium truncate">{form.name}</h2>
                    <Badge variant={statusVariant(form.status)}>
                      {form.status === 'published'
                        ? t('statusPublished')
                        : form.status === 'draft'
                          ? t('statusDraft')
                          : form.status}
                    </Badge>
                    {form.publishedVersion !== null ? (
                      <Badge variant="outline">{t('version', { version: form.publishedVersion })}</Badge>
                    ) : null}
                    {form.hasDraft && form.status === 'published' ? (
                      <Badge variant="warning">{t('unpublishedChanges')}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.type} · /register/{form.slug}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/coach/forms/${form.id}/edit`}>{t('edit')}</Link>
                  </Button>
                  {form.status === 'published' ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/register/${form.slug}`} target="_blank">
                        {t('viewPublic')}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
