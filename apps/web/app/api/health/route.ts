import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return Response.json(
      { status: 'degraded', ts: new Date().toISOString(), reason: 'missing_config' },
      { status: 503 },
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('organizations').select('id').limit(1);

    return Response.json(
      { status: error ? 'degraded' : 'ok', ts: new Date().toISOString() },
      { status: error ? 503 : 200 },
    );
  } catch {
    return Response.json(
      { status: 'degraded', ts: new Date().toISOString(), reason: 'db_unreachable' },
      { status: 503 },
    );
  }
}
