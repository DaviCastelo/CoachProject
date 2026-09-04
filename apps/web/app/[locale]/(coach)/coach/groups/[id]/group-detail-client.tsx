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
  Eye,
  EyeOff,
  Megaphone,
  Settings2,
  KeyRound,
  Paperclip,
  X,
} from 'lucide-react';
import { buildGroupTree, flattenGroupTree } from '@ca-tempo/domain';
import {
  addGroupMembers,
  removeGroupMember,
  moveGroupMember,
  addGroupCoach,
  removeGroupCoach,
  listAssignableAthletes,
  createCoachAccount,
  updateGroup,
  setGroupCapacity,
  type GroupDetail,
  type GroupListItem,
} from '../actions';
import { sendGroupAnnouncement } from '../../announcements/actions';
import {
  createAthleteAccount,
  resetAthletePassword,
} from '@/lib/actions/athlete-account';
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

  // Editar grupo (inclui a quantidade de vagas)
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', ageGroup: '', capacity: '' });

  // Enviar aviso para este grupo
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [ann, setAnn] = useState({ title: '', body: '', includeSubgroups: false });
  const [files, setFiles] = useState<File[]>([]);
  const [sentInfo, setSentInfo] = useState<string | null>(null);

  // Criar acesso do atleta
  const [athleteAccount, setAthleteAccount] = useState<{
    athleteId: string;
    name: string;
    hasAccount: boolean;
    email: string;
    password: string;
  } | null>(null);

  function submitEdit() {
    setError(null);
    const capacity = Number(editForm.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      setError(t('errorCapacity'));
      return;
    }
    // O coach pode ajustar as vagas do grupo que treina; o resto é do admin.
    run(
      () =>
        canManage
          ? updateGroup(group.id, {
              name: editForm.name,
              ageGroup: editForm.ageGroup,
              capacity,
            })
          : setGroupCapacity(group.id, capacity),
      () => setEditOpen(false),
    );
  }

  function submitAnnouncement() {
    setError(null);
    setSentInfo(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('groupId', group.id);
      fd.set('title', ann.title);
      fd.set('body', ann.body);
      fd.set('includeSubgroups', String(ann.includeSubgroups));
      for (const f of files) fd.append('files', f);

      const res = await sendGroupAnnouncement(fd);
      if (!res.ok) {
        const map: Record<string, string> = {
          group_not_owned: t('errorNotYourGroup'),
          file_too_large: t('errorFileTooLarge'),
          file_type_not_allowed: t('errorFileType'),
          title_and_body_required: t('errorTitleBody'),
        };
        setError(map[res.error] ?? res.error);
        return;
      }
      setSentInfo(t('announcementSent', { count: res.recipients }));
      setAnnounceOpen(false);
      setAnn({ title: '', body: '', includeSubgroups: false });
      setFiles([]);
      router.refresh();
    });
  }

  function submitAthleteAccount() {
    if (!athleteAccount) return;
    setError(null);
    startTransition(async () => {
      const res = athleteAccount.hasAccount
        ? await resetAthletePassword(athleteAccount.athleteId, athleteAccount.password)
        : await createAthleteAccount({
            athleteId: athleteAccount.athleteId,
            email: athleteAccount.email,
            temporaryPassword: athleteAccount.password,
          });

      if (!res.ok) {
        const map: Record<string, string> = {
          invalid_email: t('errorInvalidEmail'),
          weak_password: t('errorWeakPassword'),
          email_taken: t('errorEmailTaken'),
          already_has_account: t('errorAlreadyHasAccount'),
        };
        setError(map[res.error] ?? res.error);
        return;
      }
      setSentInfo(t('athleteAccountReady'));
      setAthleteAccount(null);
      router.refresh();
    });
  }

  // Criar conta de um novo membro da equipe
  const [newCoachOpen, setNewCoachOpen] = useState(false);
  const [nc, setNc] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    role: 'coach' as 'coach' | 'staff' | 'admin',
    isLead: false,
    assignHere: true,
  });
  const [showPw, setShowPw] = useState(false);

  function submitNewCoach() {
    setError(null);
    startTransition(async () => {
      const res = await createCoachAccount({
        fullName: nc.fullName,
        email: nc.email,
        password: nc.password,
        phone: nc.phone,
        role: nc.role,
        addToGroupId: nc.assignHere ? group.id : undefined,
        isLead: nc.isLead,
      });
      if (!res.ok) {
        const map: Record<string, string> = {
          name_required: t('errorNameRequired'),
          invalid_email: t('errorInvalidEmail'),
          weak_password: t('errorWeakPassword'),
          email_taken: t('errorEmailTaken'),
        };
        setError(map[res.error] ?? res.error);
        return;
      }
      setNewCoachOpen(false);
      setNc({
        fullName: '',
        email: '',
        password: '',
        phone: '',
        role: 'coach',
        isLead: false,
        assignHere: true,
      });
      router.refresh();
    });
  }

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

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {group.parentName ? (
            <p className="text-eyebrow text-accent-500">{group.parentName}</p>
          ) : null}
          <h1 className="font-display text-3xl uppercase tracking-wide">{group.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {group.ageGroup ? <Badge variant="outline">{group.ageGroup}</Badge> : null}
            <Badge variant={group.status === 'active' ? 'success' : 'secondary'}>
              {group.status}
            </Badge>
            <span
              className={`text-sm ${
                group.members.length > group.capacity ? 'text-warning' : 'text-muted-foreground'
              }`}
            >
              {t('capacityLabel', { used: group.members.length, total: group.capacity })}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" onClick={() => setAnnounceOpen(true)}>
            <Megaphone className="h-4 w-4" />
            {t('sendAnnouncement')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditForm({
                name: group.name,
                ageGroup: group.ageGroup ?? '',
                capacity: String(group.capacity),
              });
              setError(null);
              setEditOpen(true);
            }}
          >
            <Settings2 className="h-4 w-4" />
            {canManage ? t('editGroup') : t('editCapacity')}
          </Button>
        </div>
      </div>

      {error && !editOpen && !announceOpen && !athleteAccount ? (
        <p className="text-sm text-danger">{error}</p>
      ) : null}
      {sentInfo ? <p className="text-sm text-success">{sentInfo}</p> : null}

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

                {/* flex-wrap em vez de shrink-0: sem isso a fileira estoura o
                    card e o último botão é cortado pelo overflow-hidden. */}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    aria-label={t('athleteAccess')}
                    onClick={() => {
                      setError(null);
                      setAthleteAccount({
                        athleteId: m.athleteId,
                        name: `${m.firstName} ${m.lastName}`,
                        hasAccount: m.hasAccount,
                        email: m.accountEmail ?? '',
                        password: '',
                      });
                    }}
                  >
                    <KeyRound className={`h-4 w-4 ${m.hasAccount ? 'text-success' : ''}`} />
                    {m.hasAccount ? t('resetAccess') : t('createAccess')}
                  </Button>
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
                    variant="outline"
                    size="icon"
                    className="h-12 w-12"
                    aria-label={t('removeFromGroup')}
                    title={t('removeFromGroup')}
                    disabled={pending}
                    onClick={() => run(() => removeGroupMember(group.id, m.athleteId))}
                  >
                    <UserMinus className="h-8 w-8 text-danger" />
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
            <div className="space-y-3 rounded-md border border-input p-3">
              {availableCoaches.length > 0 ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1 space-y-1.5">
                    <Label>{t('addExistingCoach')}</Label>
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
              ) : (
                <p className="text-sm text-muted-foreground">{t('noAvailableCoaches')}</p>
              )}

              <div className="flex items-center gap-2">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('or')}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setError(null);
                  setNewCoachOpen(true);
                }}
              >
                <UserPlus className="h-4 w-4" />
                {t('createCoachAccount')}
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
                    variant="outline"
                    size="icon"
                    className="h-12 w-12"
                    aria-label={t('removeCoach')}
                    title={t('removeCoach')}
                    disabled={pending}
                    onClick={() => run(() => removeGroupCoach(group.id, c.coachId))}
                  >
                    <UserMinus className="h-8 w-8 text-danger" />
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

      {/* Editar grupo (nome, faixa etária e VAGAS) */}
      <Dialog open={editOpen} onOpenChange={(o) => !pending && setEditOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{canManage ? t('editGroup') : t('editCapacity')}</DialogTitle>
            <DialogDescription>
              {canManage ? t('editGroupHint') : t('editCapacityHint')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {canManage ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="eg-name">{t('name')}</Label>
                  <Input
                    id="eg-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="eg-age">{t('ageGroup')}</Label>
                    <Input
                      id="eg-age"
                      value={editForm.ageGroup}
                      placeholder="U12"
                      onChange={(e) => setEditForm({ ...editForm, ageGroup: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="eg-cap">{t('capacity')}</Label>
                    <Input
                      id="eg-cap"
                      type="number"
                      min={1}
                      value={editForm.capacity}
                      onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="eg-cap">{t('capacity')}</Label>
                <Input
                  id="eg-cap"
                  type="number"
                  min={1}
                  value={editForm.capacity}
                  onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {t('capacityHint', { current: group.members.length })}
            </p>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={submitEdit} disabled={pending || !editForm.name.trim()}>
              {pending ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enviar aviso para este grupo (com anexos) */}
      <Dialog open={announceOpen} onOpenChange={(o) => !pending && setAnnounceOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('sendAnnouncementTo', { name: group.name })}</DialogTitle>
            <DialogDescription>{t('sendAnnouncementHint')}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            <div className="space-y-1.5">
              <Label htmlFor="an-title">{t('announcementTitle')}</Label>
              <Input
                id="an-title"
                value={ann.title}
                placeholder={t('announcementTitlePlaceholder')}
                onChange={(e) => setAnn({ ...ann, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="an-body">{t('message')}</Label>
              <textarea
                id="an-body"
                rows={5}
                value={ann.body}
                placeholder={t('messagePlaceholder')}
                onChange={(e) => setAnn({ ...ann, body: e.target.value })}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="an-files">{t('attachments')}</Label>
              <input
                id="an-files"
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:text-foreground"
              />
              <p className="text-xs text-muted-foreground">{t('attachmentsHint')}</p>
              {files.length > 0 ? (
                <ul className="space-y-1 pt-1">
                  {files.map((f) => (
                    <li
                      key={f.name}
                      className="flex items-center gap-2 rounded-md border border-input px-2 py-1 text-xs"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-muted-foreground">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        aria-label={t('removeFile')}
                        onClick={() => setFiles(files.filter((x) => x !== f))}
                        className="text-muted-foreground hover:text-danger"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-accent-500"
                checked={ann.includeSubgroups}
                onChange={(e) => setAnn({ ...ann, includeSubgroups: e.target.checked })}
              />
              {t('includeSubgroupsInAnnouncement')}
            </label>

            <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              {t('announcementAudienceNote')}
            </p>

            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnnounceOpen(false)}
              disabled={pending}
            >
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              onClick={submitAnnouncement}
              disabled={pending || !ann.title.trim() || !ann.body.trim()}
            >
              <Megaphone className="h-4 w-4" />
              {pending ? t('sending') : t('send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Acesso do atleta */}
      <Dialog
        open={athleteAccount !== null}
        onOpenChange={(o) => !pending && !o && setAthleteAccount(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {athleteAccount?.hasAccount ? t('resetAccessTitle') : t('createAccessTitle')}
            </DialogTitle>
            <DialogDescription>
              {athleteAccount?.hasAccount
                ? t('resetAccessHint', { name: athleteAccount?.name ?? '' })
                : t('createAccessHint', { name: athleteAccount?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="aa-email">{t('coachEmail')}</Label>
              <Input
                id="aa-email"
                type="email"
                autoComplete="off"
                value={athleteAccount?.email ?? ''}
                disabled={athleteAccount?.hasAccount}
                placeholder="atleta@exemplo.com"
                onChange={(e) =>
                  athleteAccount && setAthleteAccount({ ...athleteAccount, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="aa-pw">{t('temporaryPassword')}</Label>
              <div className="relative">
                <Input
                  id="aa-pw"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pr-10"
                  value={athleteAccount?.password ?? ''}
                  onChange={(e) =>
                    athleteAccount &&
                    setAthleteAccount({ ...athleteAccount, password: e.target.value })
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? t('hidePassword') : t('showPassword')}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{t('temporaryPasswordHint')}</p>
            </div>

            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAthleteAccount(null)}
              disabled={pending}
            >
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              onClick={submitAthleteAccount}
              disabled={
                pending ||
                (athleteAccount?.password?.length ?? 0) < 8 ||
                (!athleteAccount?.hasAccount && !athleteAccount?.email.trim())
              }
            >
              <KeyRound className="h-4 w-4" />
              {pending
                ? t('saving')
                : athleteAccount?.hasAccount
                  ? t('resetAccess')
                  : t('createAccess')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Criar conta de membro da equipe */}
      <Dialog open={newCoachOpen} onOpenChange={(o) => !pending && setNewCoachOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('createCoachAccount')}</DialogTitle>
            <DialogDescription>{t('createCoachHint')}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            <div className="space-y-1.5">
              <Label htmlFor="nc-name">{t('coachFullName')} *</Label>
              <Input
                id="nc-name"
                value={nc.fullName}
                placeholder={t('coachFullNamePlaceholder')}
                onChange={(e) => setNc({ ...nc, fullName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nc-email">{t('coachEmail')} *</Label>
                <Input
                  id="nc-email"
                  type="email"
                  autoComplete="off"
                  value={nc.email}
                  placeholder="coach@exemplo.com"
                  onChange={(e) => setNc({ ...nc, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-phone">{t('coachPhone')}</Label>
                <Input
                  id="nc-phone"
                  value={nc.phone}
                  placeholder="+1 555 000 0000"
                  onChange={(e) => setNc({ ...nc, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nc-pw">{t('coachPassword')} *</Label>
              <div className="relative">
                <Input
                  id="nc-pw"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={nc.password}
                  className="pr-10"
                  onChange={(e) => setNc({ ...nc, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPw ? t('hidePassword') : t('showPassword')}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
            </div>

            <div className="space-y-1.5">
              <Label>{t('coachRole')}</Label>
              <Select
                value={nc.role}
                onValueChange={(v) => setNc({ ...nc, role: v as 'coach' | 'staff' | 'admin' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coach">{t('roleCoach')}</SelectItem>
                  <SelectItem value="staff">{t('roleStaff')}</SelectItem>
                  <SelectItem value="admin">{t('roleAdmin')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t(`roleHint.${nc.role}`)}</p>
            </div>

            <div className="space-y-2 rounded-md border border-input p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-accent-500"
                  checked={nc.assignHere}
                  onChange={(e) => setNc({ ...nc, assignHere: e.target.checked })}
                />
                {t('assignToThisGroup', { name: group.name })}
              </label>
              {nc.assignHere ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-accent-500"
                    checked={nc.isLead}
                    onChange={(e) => setNc({ ...nc, isLead: e.target.checked })}
                  />
                  {t('markAsLead')}
                </label>
              ) : null}
            </div>

            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewCoachOpen(false)}
              disabled={pending}
            >
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              onClick={submitNewCoach}
              disabled={
                pending || !nc.fullName.trim() || !nc.email.trim() || nc.password.length < 8
              }
            >
              {pending ? t('saving') : t('createAccount')}
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
