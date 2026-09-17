'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { StaticImage } from '@/components/static-image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandLogo } from '@/components/brand-logo';

export default function LoginPage() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(
    searchParams.get('error') === 'unauthorized' ? t('unauthorized') : null,
  );

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function mapAuthError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('invalid') || lower.includes('credentials')) {
      return t('invalidCredentials');
    }
    return t('loginFailed');
  }

  async function handlePasswordLogin() {
    setLoading(true);
    setEmailError(null);
    setPasswordError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setPasswordError(mapAuthError(signInError.message));
    } else {
      window.location.assign('/auth/home');
    }
  }

  async function sendMagicLink() {
    if (!email) {
      setEmailError(t('emailRequired'));
      return;
    }
    setLoading(true);
    setEmailError(null);
    setPasswordError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    });

    setLoading(false);
    if (signInError) setEmailError(mapAuthError(signInError.message));
    else {
      setSent(true);
      toast.success(t('magicLinkSent'));
    }
  }

  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${siteUrl}/auth/callback` },
    });
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <main className="flex flex-1 items-center justify-center p-4 lg:p-8">
        <Card className="w-full max-w-md accent-border-top">
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
              <BrandLogo size={56} />
            </div>
            <CardTitle className="font-display uppercase tracking-wide">{t('loginTitle')}</CardTitle>
            <CardDescription>{sent ? t('magicLinkSent') : t('loginSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <p className="text-center text-muted-foreground">{t('magicLinkSent')}</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handlePasswordLogin();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? 'email-error' : undefined}
                  />
                  <FieldError id="email-error">{emailError}</FieldError>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t('password')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="pr-10"
                      aria-invalid={Boolean(passwordError)}
                      aria-describedby={passwordError ? 'password-error' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <FieldError id="password-error">{passwordError}</FieldError>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('signingIn') : t('login')}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">{t('orDivider')}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={sendMagicLink}
                  disabled={loading}
                >
                  {t('sendMagicLink')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleLogin}
                >
                  {t('continueWithGoogle')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>

      <div className="relative hidden min-h-dvh flex-1 lg:block">
        <StaticImage
          src="/images/hero-action-2.png"
          alt="Athletes in training"
          fill
          className="object-cover object-center"
          sizes="50vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-l from-background/80 to-transparent" />
      </div>
    </div>
  );
}
