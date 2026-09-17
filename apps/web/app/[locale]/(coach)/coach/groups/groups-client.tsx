'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Users, UserCog, Plus, Trash2, ChevronRight, CornerDownRight, Star } from 'lucide-react';
import { buildGroupTree, flattenGroupTree } from '@ca-tempo/domain';
import { createGroup, deleteGroup, type GroupListItem } from './actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AthleticCard } from '@/components/athletic-card';
import { EmptyState } from '@/components/empty-state';
import { FieldError } from '@/components/ui/field-error';
import { ResponsiveFormOverlay } from '@/components/ui/responsive-form-overlay';
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

type Props = Readonly<{ groups: GroupListItem[]; canManage: boolean }>;

export function GroupsClient({ groups, canManage }: Props) {
  const t = useTranslations('groups');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('__none__');
  const [ageGroup, setAgeGroup] = useState('');

  const [toDelete, setToDelete] = useState<GroupListItem | null>(null);

  // A árvore vem do domínio (testada): pai antes dos filhos, com profundidade.
  const ordered = useMemo(() => flattenGroupTree(buildGroupTree(groups)), [groups]);

  function submitCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createGroup({
        name,
        parentGroupId: parentId === '__none__' ? null : parentId,
        ageGroup: ageGroup || null,
      });
      if (res.ok) {
        toast.success(t('create'));
        setCreateOpen(false);
        setName('');
        setParentId('__none__');
        setAgeGroup('');
        router.refresh();
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteGroup(toDelete.id);
      if (res.ok) {
        toast.success(t('delete'));
        setToDelete(null);
        router.refresh();
      } else {
        const msg =
          res.error === 'has_subgroups'
            ? t('deleteBlockedSubgroups')
            : res.error === 'has_members'
              ? t('deleteBlockedMembers')
              : res.error;
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          {t('newGroup')}
        </Button>
      ) : null}

      {ordered.length === 0 ? (
        <EmptyState
          namespace="groups"
          titleKey="emptyTitle"
          descriptionKey="emptyDescription"
          iconName="grid"
        />
      ) : (
        <div className="space-y-2">
          {ordered.map((g) => (
            <div key={g.id} style={{ marginLeft: `${g.depth * 1.5}rem` }}>
              <AthleticCard
                className={`flex items-center justify-between gap-3 p-4 ${
                  g.isMine ? 'border-l-2 border-l-accent-500' : ''
                }`}
              >
                <Link href={`/coach/groups/${g.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                  {g.depth > 0 ? (
                    <CornerDownRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : null}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{g.name}</span>
                      {g.isMine ? (
                        <Badge variant="success">
                          <Star className="mr-1 h-3 w-3" />
                          {t('myGroup')}
                        </Badge>
                      ) : null}
                      {g.ageGroup ? <Badge variant="outline">{g.ageGroup}</Badge> : null}
                      {g.status !== 'active' ? (
                        <Badge variant="secondary">{g.status}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {t('memberCount', { count: g.memberCount })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <UserCog className="h-3.5 w-3.5" />
                        {t('coachCount', { count: g.coachCount })}
                      </span>
                    </p>
                  </div>
                </Link>

                <div className="flex shrink-0 items-center gap-1">
                  {canManage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('delete')}
                      onClick={() => {
                        setError(null);
                        setToDelete(g);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  ) : null}
                  <Link href={`/coach/groups/${g.id}`} aria-label={g.name}>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                </div>
              </AthleticCard>
            </div>
          ))}
        </div>
      )}

      <ResponsiveFormOverlay
        open={createOpen}
        onOpenChange={(o) => !pending && setCreateOpen(o)}
        title={t('newGroup')}
        description={t('newGroupHint')}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={submitCreate} disabled={pending || !name.trim()}>
              {pending ? t('saving') : t('create')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">{t('name')}</Label>
            <Input
              id="group-name"
              value={name}
              placeholder={t('namePlaceholder')}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(error && createOpen)}
              aria-describedby={error && createOpen ? 'group-name-error' : undefined}
            />
            <FieldError id="group-name-error">{createOpen ? error : null}</FieldError>
          </div>

          <div className="space-y-1.5">
            <Label>{t('parentGroup')}</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t('noParent')}</SelectItem>
                {ordered.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {'— '.repeat(g.depth)}
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('parentGroupHint')}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="group-age">{t('ageGroup')}</Label>
            <Input
              id="group-age"
              value={ageGroup}
              placeholder="U12"
              onChange={(e) => setAgeGroup(e.target.value)}
            />
          </div>
        </div>
      </ResponsiveFormOverlay>

      {/* Apagar grupo */}
      <Dialog open={toDelete !== null} onOpenChange={(o) => !pending && !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteBody', { name: toDelete?.name ?? '' })}</DialogDescription>
          </DialogHeader>

          <FieldError>{toDelete ? error : null}</FieldError>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setToDelete(null)} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDelete}
              disabled={pending}
            >
              {pending ? t('saving') : t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
