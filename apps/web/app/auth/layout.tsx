import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

/** Auth routes live outside [locale] — provide i18n for MFA etc. */
export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={messages}>
      <div className="relative min-h-screen bg-ink-950">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(200, 162, 74, 0.15) 0%, transparent 60%)',
          }}
          aria-hidden="true"
        />
        <div className="relative z-10">{children}</div>
      </div>
    </NextIntlClientProvider>
  );
}
