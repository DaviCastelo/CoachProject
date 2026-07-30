import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
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
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Invitation</CardTitle>
          <CardDescription>
            {membership
              ? 'You have been invited to join CA Tempo Training.'
              : 'This invitation is invalid or has already been accepted.'}
          </CardDescription>
        </CardHeader>
        {membership && (
          <CardContent>
            <form action={acceptInvite}>
              <Button type="submit" className="w-full">
                Accept Invitation
              </Button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
