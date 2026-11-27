'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { AthleticCard } from '@/components/athletic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMoney } from '@/lib/format-money';
import { createProgram, type ProgramListItem, type LinkableForm } from './actions';
import { PROGRAM_TYPES } from './constants';
import { ChoiceSelect } from '@/components/ui/choice-select';

type Props = {
  programs: ProgramListItem[];
  forms: LinkableForm[];
  canManage: boolean;
};

export function ProgramsClient({ programs, forms, canManage }: Props) {
  const t = useTranslations('coachPrograms');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('camp');
  const [formId, setFormId] = useState<string>('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createProgram({ name, type, formId: formId || null });
      if (res.ok) {
        toast.success(t('created'));
        router.push(`/coach/programs/${res.id}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  function faixaDePreco(p: ProgramListItem): string {
    if (p.minPriceCents === null || p.maxPriceCents === null) return t('noPrice');
    if (p.minPriceCents === p.maxPriceCents) return formatMoney(p.minPriceCents, locale);
    return `${formatMoney(p.minPriceCents, locale)} – ${formatMoney(p.maxPriceCents, locale)}`;
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        open ? (
          <AthleticCard className="p-5">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="program-name">{t('nameLabel')}</Label>
                <Input
                  id="program-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="program-type">{t('typeLabel')}</Label>
                <ChoiceSelect
                  id="program-type"
                  value={type}
                  onValueChange={setType}
                  options={PROGRAM_TYPES.map((v) => ({ value: v, label: t(`type_${v}`) }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="program-form">{t('formLabel')}</Label>
                <ChoiceSelect
                  id="program-form"
                  value={formId}
                  onValueChange={setFormId}
                  options={[
                    { value: '', label: t('formNone') },
                    ...forms.map((f) => ({
                      value: f.id,
                      disabled: !!f.takenBy,
                      label: f.name + (f.takenBy ? ` · ${t('formTaken', { program: f.takenBy })}` : ''),
                    })),
                  ]}
                />
                <p className="text-xs text-muted-foreground">{t('formHelp')}</p>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={pending}>
                  {pending ? t('creating') : t('createAction')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t('cancel')}
                </Button>
              </div>
            </form>
          </AthleticCard>
        ) : (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('newProgram')}
          </Button>
        )
      ) : null}

      {programs.length === 0 ? (
        <AthleticCard className="p-8 text-center">
          <p className="font-medium">{t('emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('emptyBody')}</p>
        </AthleticCard>
      ) : (
        <ul className="space-y-3">
          {programs.map((p) => (
            <li key={p.id}>
              <Link href={`/coach/programs/${p.id}`} className="block">
                <AthleticCard className="p-4 transition-colors hover:bg-muted/40">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        <Badge variant={p.status === 'published' ? 'success' : 'secondary'}>
                          {t(`status_${p.status}`)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{t(`type_${p.type}`)}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t('optionCount', { count: p.optionCount })}
                        {p.formName ? ` · ${t('linkedTo', { form: p.formName })}` : ''}
                      </p>
                    </div>

                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular-nums">{faixaDePreco(p)}</span>
                    </span>
                  </div>

                  {/* Programa sem preço é o estado que faz a fatura não sair na
                      aprovação, e nada na tela de inscrições explica isso. */}
                  {p.optionCount === 0 ? (
                    <p className="mt-3 flex items-start gap-1.5 text-xs text-warning">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {t('noPriceWarning')}
                    </p>
                  ) : null}
                </AthleticCard>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
