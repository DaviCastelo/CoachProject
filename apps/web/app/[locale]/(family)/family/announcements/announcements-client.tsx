'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { markAnnouncementRead, type FamilyAnnouncement } from '../actions';
import { getAttachmentUrl } from '../../../(coach)/coach/announcements/actions';
import { AnnouncementAttachments } from '@/components/announcement-attachments';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AthleticCard } from '@/components/athletic-card';
import { EmptyState } from '@/components/empty-state';
import { formatDateTime } from '@/lib/format-datetime';
import { FieldError } from '@/components/ui/field-error';

type Props = Readonly<{ announcements: FamilyAnnouncement[] }>;

export function FamilyAnnouncementsClient({ announcements }: Props) {
  const t = useTranslations('family');
  const locale = useLocale();
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
      <EmptyState namespace="family" titleKey="noAnnouncements" iconName="clipboard" />
    );
  }

  return (
    <div className="space-y-3">
      <FieldError>{error}</FieldError>
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
                  {formatDateTime(a.sentAt, locale)}
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
