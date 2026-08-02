import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

/** Auth routes live outside [locale] — provide i18n for MFA etc. */
export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const messages = await getMessages();
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
