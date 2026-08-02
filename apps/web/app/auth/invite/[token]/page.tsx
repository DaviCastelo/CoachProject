import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandLogo } from '@/components/brand-logo';

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const t = await getTranslations('auth');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/auth/invite/${token}`);
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id, status, organization_id')
    .eq('id', token)
    .eq('user_id', user.id)
    .eq('status', 'invited')
    .maybeSingle();

  async function acceptInvite() {
    'use server';
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('memberships')
      .update({ status: 'active', accepted_at: new Date().toISOString() })
      .eq('id', token)
      .eq('user_id', user.id);
    redirect('/coach');
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md accent-border-top shadow-lg shadow-accent-500/5">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <BrandLogo size={56} />
          </div>
          <CardTitle>{t('inviteTitle')}</CardTitle>
          <CardDescription>
            {membership ? t('inviteDescription') : t('inviteInvalid')}
          </CardDescription>
        </CardHeader>
        {membership && (
          <CardContent>
            <form action={acceptInvite}>
              <Button type="submit" className="w-full">
                {t('inviteAccept')}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
