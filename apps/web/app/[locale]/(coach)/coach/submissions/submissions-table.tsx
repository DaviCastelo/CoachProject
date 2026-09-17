'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Eye, FileText, Users, KeyRound, EyeOff } from 'lucide-react';
import { buildGroupTree, flattenGroupTree } from '@ca-tempo/domain';
import { createAthleteAccount } from '@/lib/actions/athlete-account';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format-datetime';
import { FieldError } from '@/components/ui/field-error';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  setRegistrationStatus,
  getWaiverUrl,
  getRegistrationDetails,
  listGroupsForAssignment,
  approveRegistrationWithGroups,
  type RegistrationDetails,
  type AssignableGroup,
} from './actions';

export type SubmissionRow = {
  id: string;
  status: string;
  createdAt: string;
  athleteId: string | null;
  athleteName: string;
  dob: string | null;
  program: string | null;
  option: string | null;
  formId: string | null;
  formName: string | null;
  hasWaiver: boolean;
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-warning/15 text-warning',
  approved: 'bg-success/15 text-success',
  rejected: 'bg-danger/15 text-danger',
  canceled: 'bg-danger/15 text-danger',
  waitlisted: 'bg-info/15 text-info',
  completed: 'bg-muted text-muted-foreground',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        STATUS_STYLE[status] ?? 'bg-muted text-muted-foreground'
      }`}
    >
      {status}
    </span>
  );
}

function prettyLabel(key: string): string {
  const s = key.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function isSignatureDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/png');
}

function FormAnswerRow({ label, value }: { label: string; value: unknown }) {
  if (isSignatureDataUrl(value)) {
    return (
      <div className="col-span-full space-y-1 border-b border-border/50 py-1.5 last:border-0">
        <span className="text-muted-foreground">{label}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt={label}
          className="mt-1 max-h-24 rounded border border-input bg-white"
        />
      </div>
    );
  }

  return <DetailRow label={label} value={String(value)} />;
}

export function SubmissionsTable({
  rows,
  canApprove,
}: {
  rows: SubmissionRow[];
  canApprove: boolean;
}) {
  const router = useRouter();
  const t = useTranslations('submissions');
  const tg = useTranslations('groups');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [openRow, setOpenRow] = useState<SubmissionRow | null>(null);
  const [details, setDetails] = useState<RegistrationDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Atribuição de grupos na aprovação (brief §5).
  const [groupOptions, setGroupOptions] = useState<AssignableGroup[]>([]);
  const [pickedGroups, setPickedGroups] = useState<Set<string>>(new Set());

  // Mostra os grupos como árvore (pai antes dos filhos), igual à tela de grupos.
  const orderedGroupOptions = useMemo(
    () => flattenGroupTree(buildGroupTree(groupOptions)),
    [groupOptions],
  );

  // Criar acesso do atleta direto da inscrição
  const [athleteAccess, setAthleteAccess] = useState<{
    athleteId: string;
    name: string;
    email: string;
    password: string;
  } | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [accessDone, setAccessDone] = useState<string | null>(null);

  function submitAthleteAccess() {
    if (!athleteAccess) return;
    setError(null);
    startTransition(async () => {
      const res = await createAthleteAccount({
        athleteId: athleteAccess.athleteId,
        email: athleteAccess.email,
        temporaryPassword: athleteAccess.password,
      });
      if (!res.ok) {
        const map: Record<string, string> = {
          invalid_email: tg('errorInvalidEmail'),
          weak_password: tg('errorWeakPassword'),
          email_taken: tg('errorEmailTaken'),
          already_has_account: tg('errorAlreadyHasAccount'),
        };
        setError(map[res.error] ?? res.error);
        toast.error(map[res.error] ?? res.error);
        return;
      }
      setAccessDone(tg('athleteAccountReady'));
      toast.success(tg('athleteAccountReady'));
      setAthleteAccess(null);
      router.refresh();
    });
  }

  function openDetails(row: SubmissionRow) {
    setError(null);
    setOpenRow(row);
    setDetails(null);
    setPickedGroups(new Set());
    setLoadingDetails(true);
    void getRegistrationDetails(row.id).then((d) => {
      setDetails(d);
      setLoadingDetails(false);
    });
    void listGroupsForAssignment().then(setGroupOptions);
  }

  function toggleGroup(id: string) {
    setPickedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function approveWithGroups(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await approveRegistrationWithGroups(id, [...pickedGroups]);
      if (!res.ok) {
        setError(res.error);
      } else {
        setOpenRow(null);
        router.refresh();
      }
    });
  }

  function act(id: string, status: 'approved' | 'rejected') {
    setError(null);
    startTransition(async () => {
      const res = await setRegistrationStatus(id, status);
      if (!res.ok) {
        setError(res.error);
      } else {
        setOpenRow(null);
        router.refresh();
      }
    });
  }

  async function openWaiver(athleteId: string) {
    const url = await getWaiverUrl(athleteId);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else setError('No signed waiver PDF found for this athlete.');
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q && !r.athleteName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, statusFilter]);

  if (rows.length === 0) {
    return <p className="text-muted-foreground">{t('empty')}</p>;
  }

  // Agrupa as inscrições por formulário (mantém a ordem por data já vinda do servidor).
  const groups: { key: string; name: string; rows: SubmissionRow[] }[] = [];
  const groupIndex = new Map<string, number>();
  for (const r of filteredRows) {
    const key = r.formId ?? '__none__';
    let idx = groupIndex.get(key);
    if (idx === undefined) {
      idx = groups.length;
      groupIndex.set(key, idx);
      groups.push({ key, name: r.formName ?? 'Sem formulário', rows: [] });
    }
    groups[idx].rows.push(r);
  }

  const extraData = details
    ? Object.entries(details.data).filter(
        ([, v]) => v != null && v !== '' && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'),
      )
    : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
          className="sm:flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={t('filterStatus')}
          className="h-12 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">{t('allStatuses')}</option>
          {['pending', 'approved', 'rejected', 'waitlisted', 'canceled', 'completed'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {error && !athleteAccess ? <FieldError>{error}</FieldError> : null}
      {accessDone ? <p className="text-sm text-success">{accessDone}</p> : null}

      {filteredRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
      groups.map((g) => (
        <section key={g.key} className="space-y-2">
          <div className="flex items-center gap-2 pt-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
              {g.name}
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {g.rows.length}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {g.rows.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.athleteName}</span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {[r.program, r.option].filter(Boolean).join(' · ') || '—'}
                  {r.dob ? ` · ${t('dob')} ${r.dob}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(r.createdAt, locale)}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openDetails(r)}
                aria-label={t('viewAria', { name: r.athleteName })}
              >
                <Eye className="h-4 w-4" />
                {t('view')}
              </Button>
            </Card>
          ))}
        </section>
      ))
      )}

      <Dialog
        open={openRow !== null}
        onOpenChange={(o) => {
          if (!o) setOpenRow(null);
        }}
      >
        <DialogContent className="max-w-2xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{openRow?.athleteName}</DialogTitle>
            <DialogDescription>
              {[openRow?.formName, openRow?.program, openRow?.option]
                .filter(Boolean)
                .join(' · ') || 'Registration'}
              {openRow ? ` · ${openRow.status}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto text-sm">
            {loadingDetails ? (
              /* Esqueleto no formato do conteudo: evita o salto de layout que
                 um texto "Carregando" de uma linha provoca. */
              <div className="space-y-4" aria-busy="true">
                <Skeleton className="h-3 w-24" />
                <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex justify-between gap-4 py-1.5">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  ))}
                </div>
              </div>
            ) : !details ? (
              <p className="text-muted-foreground">Details not found.</p>
            ) : (
              <div className="space-y-4">
                {details.athlete ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Athlete
                    </p>
                    <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                      {Object.entries(details.athlete).map(([k, v]) => (
                        <DetailRow key={k} label={prettyLabel(k)} value={v} />
                      ))}
                    </div>
                  </div>
                ) : null}

                {extraData.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Form answers
                    </p>
                    <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                      {extraData.map(([k, v]) => (
                        <FormAnswerRow key={k} label={prettyLabel(k)} value={v} />
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Atribuição de grupos ao aprovar (brief §5: Registro → Usuário → Grupo → Roster) */}
                {canApprove && openRow?.status !== 'approved' ? (
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {tg('assignToGroups')}
                    </p>
                    {groupOptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{tg('noGroupsYet')}</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {orderedGroupOptions.map((g) => (
                          <label
                            key={g.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-2 py-1.5 text-sm"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-accent-500"
                              checked={pickedGroups.has(g.id)}
                              onChange={() => toggleGroup(g.id)}
                            />
                            <span className="truncate">
                              {'— '.repeat(g.depth)}
                              {g.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">{tg('assignHint')}</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <DialogFooter>
            {openRow?.athleteId ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openRow.athleteId && openWaiver(openRow.athleteId)}
                >
                  <FileText className="h-4 w-4" />
                  Waiver PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    setAthleteAccess({
                      athleteId: openRow.athleteId as string,
                      name: openRow.athleteName,
                      email: '',
                      password: '',
                    });
                  }}
                >
                  <KeyRound className="h-4 w-4" />
                  {tg('createAccess')}
                </Button>
              </>
            ) : null}
            {canApprove && openRow ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || openRow.status === 'approved'}
                  onClick={() => approveWithGroups(openRow.id)}
                >
                  {pending
                    ? '…'
                    : pickedGroups.size > 0
                      ? tg('approveAndAssign', { count: pickedGroups.size })
                      : 'Approve'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || openRow.status === 'rejected' || openRow.status === 'canceled'}
                  onClick={() => act(openRow.id, 'rejected')}
                >
                  Reject
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Criar acesso do atleta a partir da inscrição */}
      <Dialog
        open={athleteAccess !== null}
        onOpenChange={(o) => !pending && !o && setAthleteAccess(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tg('createAccessTitle')}</DialogTitle>
            <DialogDescription>
              {tg('createAccessHint', { name: athleteAccess?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sa-email">{tg('coachEmail')}</Label>
              <Input
                id="sa-email"
                type="email"
                autoComplete="off"
                placeholder="atleta@exemplo.com"
                value={athleteAccess?.email ?? ''}
                onChange={(e) =>
                  athleteAccess && setAthleteAccess({ ...athleteAccess, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sa-pw">{tg('temporaryPassword')}</Label>
              <div className="relative">
                <Input
                  id="sa-pw"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pr-10"
                  value={athleteAccess?.password ?? ''}
                  onChange={(e) =>
                    athleteAccess &&
                    setAthleteAccess({ ...athleteAccess, password: e.target.value })
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? tg('hidePassword') : tg('showPassword')}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{tg('temporaryPasswordHint')}</p>
            </div>

            {error ? <FieldError>{error}</FieldError> : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAthleteAccess(null)}
              disabled={pending}
            >
              {tg('cancel')}
            </Button>
            <Button
              size="sm"
              onClick={submitAthleteAccess}
              disabled={
                pending ||
                !athleteAccess?.email.trim() ||
                (athleteAccess?.password.length ?? 0) < 8
              }
            >
              <KeyRound className="h-4 w-4" />
              {pending ? tg('saving') : tg('createAccess')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
