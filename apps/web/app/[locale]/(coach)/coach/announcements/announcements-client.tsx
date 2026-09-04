'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Megaphone, Send, Users, Eye } from 'lucide-react';
import { buildGroupTree, flattenGroupTree } from '@ca-tempo/domain';
import {
  createAndSendAnnouncement,
  getAttachmentUrl,
  type AnnouncementListItem,
} from './actions';
import type { GroupListItem } from '../groups/actions';
import { AnnouncementAttachments } from '@/components/announcement-attachments';
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

type Props = Readonly<{
  announcements: AnnouncementListItem[];
  groups: GroupListItem[];
  canSend: boolean;
}>;

export function AnnouncementsClient({ announcements, groups, canSend }: Props) {
  const t = useTranslations('announcements');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [includeSubgroups, setIncludeSubgroups] = useState(false);

  const orderedGroups = useMemo(() => flattenGroupTree(buildGroupTree(groups)), [groups]);

  async function openAttachment(id: string) {
    setError(null);
    const url = await getAttachmentUrl(id);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else setError(t('attachmentUnavailable'));
  }

  function toggleGroup(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function send() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await createAndSendAnnouncement({
        title,
        body,
        groupIds: [...picked],
        includeSubgroups,
      });
      if (!res.ok) {
        setError(
          res.error === 'group_not_owned'
            ? t('errorNotYourGroup')
            : res.error === 'groups_required'
              ? t('errorGroupsRequired')
              : res.error,
        );
        return;
      }
      setSuccess(t('sentSuccess', { count: res.recipients }));
      setOpen(false);
      setTitle('');
      setBody('');
      setPicked(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canSend ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Megaphone className="h-4 w-4" />
          {t('newAnnouncement')}
        </Button>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {success ? <p className="text-sm text-success">{success}</p> : null}

      {announcements.length === 0 ? (
        <AthleticCard className="p-6 text-center">
          <Megaphone className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <h2 className="mb-2 font-display text-xl uppercase tracking-wide">{t('emptyTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('emptyDescription')}</p>
        </AthleticCard>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <AthleticCard key={a.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.title}</span>
                    <Badge variant={a.status === 'sent' ? 'success' : 'secondary'}>
                      {a.status === 'sent' ? t('statusSent') : t('statusDraft')}
                    </Badge>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>

                  <AnnouncementAttachments
                    attachments={a.attachments}
                    onOpen={openAttachment}
                  />

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {a.groupNames.join(', ') || '—'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Send className="h-3.5 w-3.5" />
                      {t('recipients', { count: a.recipientCount })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {t('readCount', { count: a.readCount })}
                    </span>
                    {a.sentAt ? <span>{new Date(a.sentAt).toLocaleString()}</span> : null}
                  </div>
                </div>
              </div>
            </AthleticCard>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('newAnnouncement')}</DialogTitle>
            <DialogDescription>{t('newAnnouncementHint')}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            <div className="space-y-1.5">
              <Label htmlFor="a-title">{t('announcementTitle')}</Label>
              <Input
                id="a-title"
                value={title}
                placeholder={t('titlePlaceholder')}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="a-body">{t('message')}</Label>
              <textarea
                id="a-body"
                value={body}
                rows={5}
                placeholder={t('messagePlaceholder')}
                onChange={(e) => setBody(e.target.value)}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('audience')}</Label>
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
              <p className="text-xs text-muted-foreground">{t('audienceHint')}</p>
            </div>

            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              onClick={send}
              disabled={pending || !title.trim() || !body.trim() || picked.size === 0}
            >
              <Send className="h-4 w-4" />
              {pending ? t('sending') : t('send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
