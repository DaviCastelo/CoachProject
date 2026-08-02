'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandLogo } from '@/components/brand-logo';

export default function MfaPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    async function checkMfa() {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find((f) => f.status === 'verified');
      if (verified) {
        router.replace('/coach');
      }
    }
    checkMfa();
  }, [router]);

  async function startEnroll() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator App',
    });

    setLoading(false);
    if (enrollError) {
      setError(enrollError.message);
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setEnrolling(true);
  }

  async function verifyMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;

    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError) {
      setError(challengeError.message);
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: verifyCode,
    });

    setLoading(false);
    if (verifyError) {
      setError(verifyError.message);
    } else {
      router.replace('/coach');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md accent-border-top shadow-lg shadow-accent-500/5">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <BrandLogo size={56} />
          </div>
          <CardTitle>{t('mfaTitle')}</CardTitle>
          <CardDescription>{t('mfaSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {!enrolling ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('mfaRequired')}</p>
              <Button onClick={startEnroll} disabled={loading} className="w-full">
                {t('mfaEnroll')}
              </Button>
            </div>
          ) : (
            <form onSubmit={verifyMfa} className="space-y-4">
              {qrCode && (
                <div
                  className="flex justify-center"
                  dangerouslySetInnerHTML={{ __html: qrCode }}
                />
              )}
              <div className="space-y-2">
                <Label htmlFor="code">{t('mfaVerify')}</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {t('mfaVerify')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
