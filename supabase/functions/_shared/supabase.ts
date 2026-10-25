// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2';
import { env, jsonResponse } from './env.ts';

/** Client mit Service-Role (umgeht RLS) – nur serverseitig, nur für geprüfte Nutzer-IDs verwenden. */
export const adminClient = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

/** Prüft das JWT aus dem Authorization-Header und liefert die Nutzer-ID. */
export async function requireUser(req: Request): Promise<{ userId: string; email?: string } | Response> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return jsonResponse({ error: 'unauthorized' }, 401);
  const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return jsonResponse({ error: 'unauthorized' }, 401);
  return { userId: data.user.id, email: data.user.email };
}

/** Neueste Einwilligung je Zweck muss „granted = true“ sein. */
export async function hasConsent(admin: any, userId: string, purpose: string): Promise<boolean> {
  const { data } = await admin.from('consents').select('granted').eq('user_id', userId).eq('purpose', purpose).order('created_at', { ascending: false }).limit(1);
  return !!data?.[0]?.granted;
}
