/** Postgres insufficient_privilege / Supabase RLS policy violation. */
export function isRlsViolation(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42501') return true;
  const msg = error.message?.toLowerCase() ?? '';
  return msg.includes('row-level security') || msg.includes('row level security');
}

/**
 * Decodes the `role` claim from a LEGACY Supabase JWT (anon / service_role).
 *
 * Chaves no formato novo (`sb_secret_` / `sb_publishable_`) não são JWT e não
 * têm claim nenhuma — para elas, quem distingue é o prefixo. Ver
 * `checkServiceRoleConfig`.
 */
export function decodeSupabaseJwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      role?: string;
    };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export type ServiceRoleStatus =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'same_as_anon' | 'not_service_role' };

/**
 * Validates SUPABASE_SERVICE_ROLE_KEY without hitting the database.
 *
 * Aceita os DOIS formatos de chave do Supabase:
 *
 *   `sb_secret_…` / `sb_publishable_…`  formato novo, opaco, sem JWT
 *   `eyJ…`                              formato legado, com a role no payload
 *
 * Este projeto usa o formato novo, e a versão anterior desta função só
 * conhecia o legado: decodificava, não achava claim nenhuma e devolvia
 * `not_service_role`. O /api/health passou a reportar `degraded` com uma
 * chave perfeitamente válida. Health check que mente é pior do que não
 * existir, porque mascara queda real e treina quem olha a ignorá-lo.
 */
export function checkServiceRoleConfig(): ServiceRoleStatus {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!serviceKey) return { ok: false, reason: 'missing' };

  if (anonKey && serviceKey === anonKey) {
    return { ok: false, reason: 'same_as_anon' };
  }

  // Formato novo: o prefixo é a única distinção. Checar a publicável primeiro
  // evita que um `sb_publishable_` passe por engano.
  if (serviceKey.startsWith('sb_publishable_')) {
    return { ok: false, reason: 'not_service_role' };
  }
  if (serviceKey.startsWith('sb_secret_')) {
    return { ok: true };
  }

  // Formato legado.
  const role = decodeSupabaseJwtRole(serviceKey);
  if (role !== 'service_role') {
    return { ok: false, reason: 'not_service_role' };
  }

  return { ok: true };
}
