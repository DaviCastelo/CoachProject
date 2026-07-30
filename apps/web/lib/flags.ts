import { createClient } from '@/lib/supabase/server';

export async function getFlag(orgId: string, key: string, fallback = true): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('org_settings')
    .select('value')
    .eq('organization_id', orgId)
    .eq('key', key)
    .maybeSingle();

  if (!data) return fallback;
  return data.value === true || data.value === 'true';
}
