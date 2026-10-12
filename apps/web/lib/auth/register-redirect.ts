/**
 * Volta do login só para o formulário de inscrição.
 *
 * Qualquer outro caminho (outro site, //, query) é ignorado. O login normal
 * continua indo para /auth/home ou /coach.
 */

const LOCALES = ['en', 'pt-BR', 'es'] as const;

export function safeRegisterPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\') || value.includes('://') || value.includes('?') || value.includes('#')) {
    return null;
  }

  let path = value;
  for (const locale of LOCALES) {
    const prefix = `/${locale}`;
    if (path === prefix) return null;
    if (path.startsWith(`${prefix}/`)) {
      path = path.slice(prefix.length);
      break;
    }
  }

  if (path === '/register' || path.startsWith('/register/')) return value;
  return null;
}
