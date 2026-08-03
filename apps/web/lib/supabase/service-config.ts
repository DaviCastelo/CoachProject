/** Postgres insufficient_privilege / Supabase RLS policy violation. */
export function isRlsViolation(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42501') return true;
  const msg = error.message?.toLowerCase() ?? '';
  return msg.includes('row-level security') || msg.includes('row level security');
}

/** Decodes the `role` claim from a Supabase JWT (anon / service_role). */
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

/** Validates SUPABASE_SERVICE_ROLE_KEY without hitting the database. */
export function checkServiceRoleConfig(): ServiceRoleStatus {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!serviceKey) return { ok: false, reason: 'missing' };

  if (anonKey && serviceKey === anonKey) {
    return { ok: false, reason: 'same_as_anon' };
  }

  const role = decodeSupabaseJwtRole(serviceKey);
  if (role !== 'service_role') {
    return { ok: false, reason: 'not_service_role' };
  }

  return { ok: true };
}
