import { getTranslations } from 'next-intl/server';
import { Users, UserCog, Shield } from 'lucide-react';
import { listFamilyGroups } from '../actions';
import { AthleticCard } from '@/components/athletic-card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function FamilyGroupsPage() {
  const t = await getTranslations('family');
  const groups = await listFamilyGroups();

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <div className="mb-6">
        <h1 className="mb-1 font-display text-3xl uppercase tracking-wide">{t('myGroups')}</h1>
        <p className="text-sm text-muted-foreground">{t('myGroupsSubtitle')}</p>
      </div>

      {groups.length === 0 ? (
        <AthleticCard className="p-6 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('noGroups')}</p>
        </AthleticCard>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <AthleticCard key={`${g.id}-${g.athleteName}`} className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Shield className="h-4 w-4 text-accent-500" />
                <span className="font-medium">{g.name}</span>
                {g.ageGroup ? <Badge variant="outline">{g.ageGroup}</Badge> : null}
                <Badge variant="secondary">{g.athleteName}</Badge>
              </div>

              {g.coaches.length > 0 ? (
                <div className="mb-3">
                  <p className="text-eyebrow mb-1 flex items-center gap-1.5 text-muted-foreground">
                    <UserCog className="h-3.5 w-3.5" />
                    {t('coaches')}
                  </p>
                  <p className="text-sm">{g.coaches.join(', ')}</p>
                </div>
              ) : null}

              <div>
                <p className="text-eyebrow mb-1 flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {t('teammates', { count: g.teammates.length })}
                </p>
                {g.teammates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noTeammates')}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {g.teammates.map((name) => (
                      <span
                        key={name}
                        className="rounded-full border border-input px-2.5 py-1 text-sm"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </AthleticCard>
          ))}
        </div>
      )}
    </div>
  );
}
