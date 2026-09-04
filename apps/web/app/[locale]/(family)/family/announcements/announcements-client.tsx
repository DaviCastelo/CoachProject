'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Megaphone } from 'lucide-react';
import { markAnnouncementRead, type FamilyAnnouncement } from '../actions';
import { getAttachmentUrl } from '../../../(coach)/coach/announcements/actions';
import { AnnouncementAttachments } from '@/components/announcement-attachments';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AthleticCard } from '@/components/athletic-card';

type Props = Readonly<{ announcements: FamilyAnnouncement[] }>;

export function FamilyAnnouncementsClient({ announcements }: Props) {
  const t = useTranslations('family');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function openAttachment(id: string) {
    setError(null);
    const url = await getAttachmentUrl(id);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else setError(t('attachmentUnavailable'));
  }

  const unread = announcements.filter((a) => !a.readAt);

  if (announcements.length === 0) {
    return (
      <AthleticCard className="p-6 text-center">
        <Megaphone className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('noAnnouncements')}</p>
      </AthleticCard>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {unread.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('unreadCount', { count: unread.length })}
        </p>
      ) : null}

      {announcements.map((a) => (
        <AthleticCard
          key={a.id}
          className={`p-4 ${!a.readAt ? 'border-l-2 border-l-accent-500' : ''}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{a.title}</p>
                {!a.readAt ? <Badge variant="warning">{t('new')}</Badge> : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>

              <AnnouncementAttachments attachments={a.attachments} onOpen={openAttachment} />

              {a.sentAt ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(a.sentAt).toLocaleString()}
                </p>
              ) : null}
            </div>

            {!a.readAt ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await markAnnouncementRead(a.id);
                    router.refresh();
                  })
                }
              >
                {t('markRead')}
              </Button>
            ) : null}
          </div>
        </AthleticCard>
      ))}
    </div>
  );
}
