'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { parseAmountToCents } from '@ca-tempo/domain';
import { Link } from '@/i18n/routing';
import { AthleticCard } from '@/components/athletic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMoney } from '@/lib/format-money';
import {
  updateProgram,
  createOption,
  updateOption,
  deleteOption,
  type ProgramDetail,
  type LinkableForm,
} from '../actions';
import { PROGRAM_TYPES, PROGRAM_STATUSES } from '../constants';

type Props = { program: ProgramDetail; forms: LinkableForm[]; canManage: boolean };

/**
 * Valor digitado em dólares vira centavos sem passar por float.
 * `parseFloat('0.29') * 100` dá 28.999999999999996, e um centavo perdido por
 * linha num módulo de cobrança vira diferença de caixa no fim do mês.
 */
function precoParaCentavos(texto: string): number | null {
  const cents = parseAmountToCents(texto);
  if (cents === null || cents < 1) return null;
  return cents;
}

export function ProgramDetailClient({ program, forms, canManage }: Props) {
  const t = useTranslations('coachPrograms');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(program.name);
  const [type, setType] = useState(program.type);
  const [status, setStatus] = useState(program.status);
  const [formId, setFormId] = useState(program.formId ?? '');
  const [description, setDescription] = useState(program.description ?? '');
  const [startsOn, setStartsOn] = useState(program.startsOn ?? '');
  const [endsOn, setEndsOn] = useState(program.endsOn ?? '');
  const [capacity, setCapacity] = useState(
    program.capacity === null ? '' : String(program.capacity),
  );
  const [heroImageUrl, setHeroImageUrl] = useState(program.heroImageUrl ?? '');

  // Edição no próprio lugar. Mudar o preço de uma opção NÃO mexe em fatura
  // já emitida: a fatura copia o valor no momento da emissão. O que muda é
  // o que vale daqui para a frente.
  const [editando, setEditando] = useState<string | null>(null);
  const [edNome, setEdNome] = useState('');
  const [edPreco, setEdPreco] = useState('');
  const [edVaga, setEdVaga] = useState('');

  const [novoNome, setNovoNome] = useState('');
  const [novoPreco, setNovoPreco] = useState('');
  const [novaVaga, setNovaVaga] = useState('');

  function salvarPrograma(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProgram(program.id, {
        name,
        type,
        status,
        formId: formId || null,
        description: description || null,
        startsOn: startsOn || null,
        endsOn: endsOn || null,
        capacity: capacity.trim() === '' ? null : Number(capacity),
        heroImageUrl,
      });
      if (res.ok) {
        toast.success(t('saved'));
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function adicionarOpcao(e: React.FormEvent) {
    e.preventDefault();
    const cents = precoParaCentavos(novoPreco);
    if (cents === null) {
      toast.error(t('priceInvalid'));
      return;
    }
    startTransition(async () => {
      const res = await createOption(program.id, {
        name: novoNome,
        priceCents: cents,
        capacity: novaVaga.trim() === '' ? null : Number(novaVaga),
      });
      if (res.ok) {
        toast.success(t('optionCreated'));
        setNovoNome('');
        setNovoPreco('');
        setNovaVaga('');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function abrirEdicao(o: ProgramDetail['options'][number]) {
    setEditando(o.id);
    setEdNome(o.name);
    setEdPreco((o.priceCents / 100).toFixed(2));
    setEdVaga(o.capacity === null ? '' : String(o.capacity));
  }

  function salvarEdicao(id: string) {
    const cents = precoParaCentavos(edPreco);
    if (cents === null) {
      toast.error(t('priceInvalid'));
      return;
    }
    startTransition(async () => {
      const res = await updateOption(id, {
        name: edNome,
        priceCents: cents,
        capacity: edVaga.trim() === '' ? null : Number(edVaga),
      });
      if (res.ok) {
        toast.success(t('optionSaved'));
        setEditando(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function alternarAtiva(id: string, isActive: boolean) {
    startTransition(async () => {
      const res = await updateOption(id, { isActive });
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  function apagar(id: string) {
    startTransition(async () => {
      const res = await deleteOption(id);
      if (res.ok) {
        toast.success(t('optionDeleted'));
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const semPreco = program.options.filter((o) => o.isActive).length === 0;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/coach/programs">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('backToList')}
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{program.name}</h1>
          <Badge variant={program.status === 'published' ? 'success' : 'secondary'}>
            {t(`status_${program.status}`)}
          </Badge>
        </div>
        <p className="mt-1 font-mono text-xs text-muted-foreground">/programs/{program.slug}</p>
      </div>

      {semPreco ? (
        <AthleticCard className="border-warning p-4">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            {t('noPriceWarningLong')}
          </p>
        </AthleticCard>
      ) : null}

      {/* ----------------------------- Preços ----------------------------- */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">{t('optionsTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('optionsHelp')}</p>

        {program.options.length > 0 ? (
          <AthleticCard className="overflow-hidden">
            <ul>
              {program.options.map((o) => (
                <li
                  key={o.id}
                  className={`flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 ${
                    o.isActive ? '' : 'opacity-60'
                  }`}
                >
                  {editando === o.id ? (
                    <span className="flex w-full flex-wrap items-end gap-3">
                      <span className="min-w-40 flex-1 space-y-1.5">
                        <Label htmlFor={`ed-name-${o.id}`}>{t('optionNameLabel')}</Label>
                        <Input
                          id={`ed-name-${o.id}`}
                          value={edNome}
                          onChange={(e) => setEdNome(e.target.value)}
                        />
                      </span>
                      <span className="w-32 space-y-1.5">
                        <Label htmlFor={`ed-price-${o.id}`}>{t('optionPriceLabel')}</Label>
                        <Input
                          id={`ed-price-${o.id}`}
                          value={edPreco}
                          onChange={(e) => setEdPreco(e.target.value)}
                          inputMode="decimal"
                        />
                      </span>
                      <span className="w-28 space-y-1.5">
                        <Label htmlFor={`ed-cap-${o.id}`}>{t('optionCapacityLabel')}</Label>
                        <Input
                          id={`ed-cap-${o.id}`}
                          value={edVaga}
                          onChange={(e) => setEdVaga(e.target.value)}
                          placeholder={t('optionCapacityPlaceholder')}
                          inputMode="numeric"
                        />
                      </span>
                      <Button type="button" disabled={pending} onClick={() => salvarEdicao(o.id)}>
                        {pending ? t('saving') : t('saveAction')}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setEditando(null)}>
                        {t('cancel')}
                      </Button>
                    </span>
                  ) : (
                    <>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{o.name}</span>
                      {o.isActive ? null : (
                        <Badge variant="secondary">{t('optionInactive')}</Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {o.capacity === null
                        ? t('optionNoCapacity')
                        : t('optionCapacity', { count: o.capacity })}
                      {o.registrationCount > 0
                        ? ` · ${t('optionInUse', { count: o.registrationCount })}`
                        : ''}
                    </span>
                  </span>

                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatMoney(o.priceCents, locale)}
                  </span>

                  {canManage ? (
                    <span className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => abrirEdicao(o)}
                      >
                        {t('edit')}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => alternarAtiva(o.id, !o.isActive)}
                      >
                        {o.isActive ? t('deactivate') : t('activate')}
                      </Button>

                      {/* Só aparece em opção que ninguém escolheu. Apagar uma
                          em uso não daria erro: desligaria o preço das
                          inscrições existentes em silêncio. */}
                      {o.registrationCount === 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => apagar(o.id)}
                          aria-label={t('deleteOptionAria', { name: o.name })}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </span>
                  ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </AthleticCard>
        ) : null}

        {canManage ? (
          <AthleticCard className="p-4">
            <form onSubmit={adicionarOpcao} className="flex flex-wrap items-end gap-3">
              <div className="min-w-40 flex-1 space-y-1.5">
                <Label htmlFor="opt-name">{t('optionNameLabel')}</Label>
                <Input
                  id="opt-name"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder={t('optionNamePlaceholder')}
                  required
                />
              </div>

              <div className="w-32 space-y-1.5">
                <Label htmlFor="opt-price">{t('optionPriceLabel')}</Label>
                <Input
                  id="opt-price"
                  value={novoPreco}
                  onChange={(e) => setNovoPreco(e.target.value)}
                  placeholder="600.00"
                  inputMode="decimal"
                  required
                />
              </div>

              <div className="w-28 space-y-1.5">
                <Label htmlFor="opt-cap">{t('optionCapacityLabel')}</Label>
                <Input
                  id="opt-cap"
                  value={novaVaga}
                  onChange={(e) => setNovaVaga(e.target.value)}
                  placeholder={t('optionCapacityPlaceholder')}
                  inputMode="numeric"
                />
              </div>

              <Button type="submit" disabled={pending}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('addOption')}
              </Button>
            </form>
          </AthleticCard>
        ) : null}
      </section>

      {/* ---------------------------- Programa ---------------------------- */}
      {canManage ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">{t('settingsTitle')}</h2>

          <AthleticCard className="p-5">
            <form onSubmit={salvarPrograma} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">{t('nameLabel')}</Label>
                <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="p-type">{t('typeLabel')}</Label>
                  <select
                    id="p-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {PROGRAM_TYPES.map((v) => (
                      <option key={v} value={v}>
                        {t(`type_${v}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="p-status">{t('statusLabel')}</Label>
                  <select
                    id="p-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {PROGRAM_STATUSES.map((v) => (
                      <option key={v} value={v}>
                        {t(`status_${v}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-form">{t('formLabel')}</Label>
                <select
                  id="p-form"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">{t('formNone')}</option>
                  {forms.map((f) => (
                    <option key={f.id} value={f.id} disabled={!!f.takenBy}>
                      {f.name}
                      {f.takenBy ? ` — ${t('formTaken', { program: f.takenBy })}` : ''}
                      {f.requiresPayment ? '' : ` — ${t('formNotPaid')}`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">{t('formHelp')}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p-starts">{t('startsOnLabel')}</Label>
                  <Input
                    id="p-starts"
                    type="date"
                    value={startsOn}
                    onChange={(e) => setStartsOn(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-ends">{t('endsOnLabel')}</Label>
                  <Input
                    id="p-ends"
                    type="date"
                    value={endsOn}
                    onChange={(e) => setEndsOn(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-cap">{t('capacityLabel')}</Label>
                  <Input
                    id="p-cap"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder={t('optionCapacityPlaceholder')}
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-desc">{t('descriptionLabel')}</Label>
                <textarea
                  id="p-desc"
                  className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Sem este campo a coluna `hero_image_url` existia no banco e
                  nenhuma tela escrevia nela: todo programa caía no sorteio
                  entre quatro fotos de banco, e dois programas de nome
                  parecido saíam com a mesma. */}
              <div className="space-y-1.5">
                <Label htmlFor="p-photo">{t('heroImageLabel')}</Label>
                <Input
                  id="p-photo"
                  value={heroImageUrl}
                  onChange={(e) => setHeroImageUrl(e.target.value)}
                  placeholder="/images/gallery-1.webp"
                  aria-describedby="p-photo-help"
                />
                <p id="p-photo-help" className="text-xs text-muted-foreground">
                  {t('heroImageHelp')}
                </p>
              </div>

              <Button type="submit" disabled={pending}>
                {pending ? t('saving') : t('saveAction')}
              </Button>
            </form>
          </AthleticCard>
        </section>
      ) : null}
    </div>
  );
}
