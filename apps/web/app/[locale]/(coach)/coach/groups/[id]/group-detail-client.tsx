'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  UserPlus,
  UserMinus,
  UserCog,
  Users,
  AlertTriangle,
  ArrowRightLeft,
  Search,
  Star,
} from 'lucide-react';
import { buildGroupTree, flattenGroupTree } from '@ca-tempo/domain';
import {
  addGroupMembers,
  removeGroupMember,
  moveGroupMember,
  addGroupCoach,
  removeGroupCoach,
  listAssignableAthletes,
  type GroupDetail,
  type GroupListItem,
} from '../actions';
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
  group: GroupDetail;
  allGroups: GroupListItem[];
  orgCoaches: { id: string; name: string; email: string | null }[];
  canManage: boolean;
}>;

type Assignable = { id: string; name: string; dateOfBirth: string };

export function GroupDetailClient({ group, allGroups, orgCoaches, canManage }: Props) {
  const t = useTranslations('groups');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'roster' | 'coaches'>('roster');

  // Adicionar atletas
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<Assignable[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Mover atleta
  const [moving, setMoving] = useState<{ athleteId: string; name: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>('');

  const [coachToAdd, setCoachToAdd] = useState<string>('');

  const otherGroups = useMemo(
    () => flattenGroupTree(buildGroupTree(allGroups)).filter((g) => g.id !== group.id),
    [allGroups, group.id],
  );

  useEffect(() => {
    if (!addOpen) return;
    setLoadingCandidates(true);
    const timer = setTimeout(() => {
      void listAssignableAthletes(group.id, search).then((list) => {
        setCandidates(list);
        setLoadingCandidates(false);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [addOpen, search, group.id]);

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        onOk?.();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const availableCoaches = orgCoaches.filter(
    (c) => !group.coaches.some((gc) => gc.coachId === c.id),
  );

  return (
    <div className="space-y-5">
      <Link
        href="/coach/groups"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToGroups')}
      </Link>

      <div>
        {group.parentName ? (
          <p className="text-eyebrow text-accent-500">{group.parentName}</p>
        ) : null}
        <h1 className="font-display text-3xl uppercase tracking-wide">{group.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {group.ageGroup ? <Badge variant="outline">{group.ageGroup}</Badge> : null}
          <Badge variant={group.status === 'active' ? 'success' : 'secondary'}>{group.status}</Badge>
          <span className="text-sm text-muted-foreground">
            {t('capacityLabel', { used: group.members.length, total: group.capacity })}
          </span>
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {/* Abas */}
      <div className="flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('roster')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${
            tab === 'roster'
              ? 'border-accent-500 text-foreground'
              : 'border-transparent text-muted-foreground'
          }`}
        >
          <Users className="h-4 w-4" />
          {t('tabRoster')} ({group.members.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('coaches')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${
            tab === 'coaches'
              ? 'border-accent-500 text-foreground'
              : 'border-transparent text-muted-foreground'
          }`}
        >
          <UserCog className="h-4 w-4" />
          {t('tabCoaches')} ({group.coaches.length})
        </button>
      </div>

      {tab === 'roster' ? (
        <div className="space-y-3">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" />
            {t('addPlayers')}
          </Button>

          {group.members.length === 0 ? (
            <p className="rounded-md border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
              {t('emptyRoster')}
            </p>
          ) : (
            group.members.map((m) => (
              <AthleticCard key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {m.firstName} {m.lastName}
                    </span>
                    {m.status !== 'active' ? (
                      <Badge variant="secondary">{m.status}</Badge>
                    ) : null}
                    {m.allergies || m.medicalNotes ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs text-warning"
                        title={[m.allergies, m.medicalNotes].filter(Boolean).join(' · ')}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {t('medicalAlert')}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {m.dateOfBirth ? `${t('dob')} ${m.dateOfBirth}` : ''}
                  </p>
                  {m.otherGroups.length > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('alsoIn')}: {m.otherGroups.join(', ')}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      setMoving({ athleteId: m.athleteId, name: `${m.firstName} ${m.lastName}` });
                      setMoveTarget('');
                    }}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    {t('move')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('removeFromGroup')}
                    disabled={pending}
                    onClick={() => run(() => removeGroupMember(group.id, m.athleteId))}
                  >
                    <UserMinus className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </AthleticCard>
            ))
          )}
          <p className="text-xs text-muted-foreground">{t('removeHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {canManage ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1 space-y-1.5">
                <Label>{t('addCoach')}</Label>
                <Select value={coachToAdd} onValueChange={setCoachToAdd}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectCoach')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCoaches.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                disabled={pending || !coachToAdd}
                onClick={() =>
                  run(() => addGroupCoach(group.id, coachToAdd), () => setCoachToAdd(''))
                }
              >
                <UserPlus className="h-4 w-4" />
                {t('add')}
              </Button>
            </div>
          ) : null}

          {group.coaches.length === 0 ? (
            <p className="rounded-md border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
              {t('emptyCoaches')}
            </p>
          ) : (
            group.coaches.map((c) => (
              <AthleticCard key={c.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{c.fullName}</span>
                    {c.isLead ? (
                      <Badge variant="outline">
                        <Star className="mr-1 h-3 w-3" />
                        {t('lead')}
                      </Badge>
                    ) : null}
                  </div>
                  {c.email ? (
                    <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                  ) : null}
                </div>
                {canManage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('removeCoach')}
                    disabled={pending}
                    onClick={() => run(() => removeGroupCoach(group.id, c.coachId))}
                  >
                    <UserMinus className="h-4 w-4 text-danger" />
                  </Button>
                ) : null}
              </AthleticCard>
            ))
          )}
          <p className="text-xs text-muted-foreground">{t('coachPermissionHint')}</p>
        </div>
      )}

      {/* Adicionar atletas */}
      <Dialog open={addOpen} onOpenChange={(o) => !pending && setAddOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('addPlayers')}</DialogTitle>
            <DialogDescription>{t('addPlayersHint')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                placeholder={t('searchAthletes')}
                className="pl-9"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="max-h-[45vh] space-y-1 overflow-y-auto">
              {loadingCandidates ? (
                <p className="p-3 text-sm text-muted-foreground">{t('loading')}</p>
              ) : candidates.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">{t('noAthletesFound')}</p>
              ) : (
                candidates.map((a) => (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-accent-500"
                      checked={picked.has(a.id)}
                      onChange={() => togglePick(a.id)}
                    />
                    <span className="flex-1">{a.name}</span>
                    <span className="text-xs text-muted-foreground">{a.dateOfBirth}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              disabled={pending || picked.size === 0}
              onClick={() =>
                run(
                  () => addGroupMembers(group.id, [...picked]),
                  () => {
                    setAddOpen(false);
                    setPicked(new Set());
                    setSearch('');
                  },
                )
              }
            >
              {pending ? t('saving') : t('addSelected', { count: picked.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mover atleta */}
      <Dialog open={moving !== null} onOpenChange={(o) => !pending && !o && setMoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('moveTitle')}</DialogTitle>
            <DialogDescription>{t('moveBody', { name: moving?.name ?? '' })}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label>{t('targetGroup')}</Label>
            <Select value={moveTarget} onValueChange={setMoveTarget}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectGroup')} />
              </SelectTrigger>
              <SelectContent>
                {otherGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {'— '.repeat(g.depth)}
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setMoving(null)} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              disabled={pending || !moveTarget || !moving}
              onClick={() =>
                moving &&
                run(
                  () => moveGroupMember(moving.athleteId, group.id, moveTarget),
                  () => setMoving(null),
                )
              }
            >
              {pending ? t('saving') : t('move')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
