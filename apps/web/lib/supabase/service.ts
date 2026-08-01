import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase com a service role — **apenas server-side** (Server Actions,
 * Route Handlers, crons). Ignora RLS, então NUNCA importar em código client.
 *
 * Usado pelo pipeline de inscrição pública (escritas transacionais) e para ler
 * conteúdo público no servidor. Mantido sem o generic `Database` por enquanto;
 * tipar após rodar `supabase gen types typescript` para as tabelas da Fase 2.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL');
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
