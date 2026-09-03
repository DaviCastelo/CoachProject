'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { CalendarPlus, CalendarDays, Check, X, Clock, Send, ChevronRight } from 'lucide-react';
import { buildGroupTree, flattenGroupTree } from '@ca-tempo/domain';
import { createSession, publishSession, type SessionListItem } from './actions';
import type { GroupListItem } from '../groups/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AthleticCard } from '@/components/athletic-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Props = Readonly<{
  sessions: SessionListItem[];
  groups: GroupListItem[];
  canEdit: boolean;
}>;

const EVENT_TYPES = ['training', 'match', 'tryout', 'meeting'] as const;

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function ScheduleClient({ sessions, groups, canEdit }: Props) {
  const t = useTranslations('schedule');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const now = new Date();
  const defaultStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  defaultStart.setMinutes(0, 0, 0);
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<string>('training');
  const [startsAt, setStartsAt] = useState(toLocalInput(defaultStart));
  const [endsAt, setEndsAt] = useState(toLocalInput(defaultEnd));
  const [fieldLabel, setFieldLabel] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [includeSubgroups, setIncludeSubgroups] = useState(false);

  const orderedGroups = useMemo(() => flattenGroupTree(buildGroupTree(groups)), [groups]);

  function toggleGroup(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createSession({
        title,
        eventType,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        fieldLabel,
        groupIds: [...picked],
        includeSubgroups,
      });
      if (!res.ok) {
        setError(
          res.error === 'groups_required'
            ? t('errorGroupsRequired')
            : res.error === 'invalid_time_range'
              ? t('errorTimeRange')
              : res.error,
        );
        return;
      }
      // Publica na sequência: gera os convites de RSVP.
      await publishSession(res.id);
      setOpen(false);
      setTitle('');
      setPicked(new Set());
      router.refresh();
    });
  }

  function publish(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await publishSession(id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const upcoming = sessions.filter((s) => new Date(s.endsAt) >= now);
  const past = sessions.filter((s) => new Date(s.endsAt) < now).reverse();

  return (
    <div className="space-y-4">
      {canEdit ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <CalendarPlus className="h-4 w-4" />
          {t('newEvent')}
        </Button>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {sessions.length === 0 ? (
        <AthleticCard className="p-6 text-center">
          <CalendarDays className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <h2 className="mb-2 font-display text-xl uppercase tracking-wide">{t('emptyTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('emptyDescription')}</p>
        </AthleticCard>
      ) : (
        <>
          <SessionSection
            label={t('upcoming')}
            items={upcoming}
            onPublish={publish}
            pending={pending}
            canEdit={canEdit}
          />
          <SessionSection
            label={t('past')}
            items={past}
            onPublish={publish}
            pending={pending}
            canEdit={false}
          />
        </>
      )}

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('newEvent')}</DialogTitle>
            <DialogDescription>{t('newEventHint')}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            <div className="space-y-1.5">
              <Label htmlFor="s-title">{t('eventTitle')}</Label>
              <Input
                id="s-title"
                value={title}
                placeholder={t('eventTitlePlaceholder')}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('eventType')}</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`eventTypes.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-start">{t('startsAt')}</Label>
                <Input
                  id="s-start"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-end">{t('endsAt')}</Label>
                <Input
                  id="s-end"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="s-field">{t('fieldLabel')}</Label>
              <Input
                id="s-field"
                value={fieldLabel}
                placeholder="Field 3"
                onChange={(e) => setFieldLabel(e.target.value)}
              />
            </div>

            {/* ★ Requisito central: escolher UM OU MAIS grupos */}
            <div className="space-y-1.5">
              <Label>{t('participatingGroups')}</Label>
              {orderedGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('noGroups')}</p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {orderedGroups.map((g) => (
                    <label
                      key={g.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-2 py-1.5 text-sm"
                      style={{ marginLeft: `${g.depth * 0.75}rem` }}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-accent-500"
                        checked={picked.has(g.id)}
                        onChange={() => toggleGroup(g.id)}
                      />
                      <span className="flex-1 truncate">{g.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t('memberCount', { count: g.memberCount })}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-accent-500"
                  checked={includeSubgroups}
                  onChange={(e) => setIncludeSubgroups(e.target.checked)}
                />
                {t('includeSubgroups')}
              </label>
            </div>

            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={submit} disabled={pending || !title.trim() || picked.size === 0}>
              {pending ? t('saving') : t('createAndPublish')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionSection({
  label,
  items,
  onPublish,
  pending,
  canEdit,
}: Readonly<{
  label: string;
  items: SessionListItem[];
  onPublish: (id: string) => void;
  pending: boolean;
  canEdit: boolean;
}>) {
  const t = useTranslations('schedule');
  if (items.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-eyebrow pt-2 text-muted-foreground">{label}</h2>
      {items.map((s) => (
        <AthleticCard key={s.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Link href={`/coach/schedule/${s.id}`} className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.title}</span>
                <Badge variant="outline">{t(`eventTypes.${s.eventType}`)}</Badge>
                {s.status === 'canceled' ? (
                  <Badge variant="danger">{t('canceled')}</Badge>
                ) : !s.publishedAt ? (
                  <Badge variant="warning">{t('draft')}</Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {new Date(s.startsAt).toLocaleString()} · {s.groupNames.join(', ') || '—'}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 text-success">
                  <Check className="h-3.5 w-3.5" />
                  {s.going}
                </span>
                <span className="inline-flex items-center gap-1 text-danger">
                  <X className="h-3.5 w-3.5" />
                  {s.notGoing}
                </span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {s.noReply}
                </span>
              </p>
            </Link>

            <div className="flex shrink-0 items-center gap-1">
              {canEdit && !s.publishedAt ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => onPublish(s.id)}
                >
                  <Send className="h-4 w-4" />
                  {t('publish')}
                </Button>
              ) : null}
              <Link href={`/coach/schedule/${s.id}`} aria-label={s.title}>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </AthleticCard>
      ))}
    </section>
  );
}
