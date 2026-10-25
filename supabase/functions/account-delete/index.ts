import { revokeToken } from '../_shared/client.ts';
import { decryptSecret } from '../_shared/crypto.ts';
import { CORS_HEADERS, env, jsonResponse, safeError } from '../_shared/env.ts';
import { adminClient, requireUser } from '../_shared/supabase.ts';

/**
 * POST { confirm: "DELETE" } – löscht das Konto unwiderruflich: Google-Zugriff widerrufen, danach auth.users löschen
 * (ON DELETE CASCADE entfernt alle Tabellen, siehe Migration).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  try {
    const u = await requireUser(req);
    if (u instanceof Response) return u;
    const body = await req.json().catch(() => null);
    if (body?.confirm !== 'DELETE') return jsonResponse({ error: 'confirmation_required' }, 400);
    const admin = adminClient();

    const { data: conn } = await admin.from('wearable_connections').select('id').eq('user_id', u.userId).maybeSingle();
    if (conn) {
      const { data: sec } = await admin.from('wearable_secrets').select('enc_refresh_token').eq('connection_id', conn.id).maybeSingle();
      if (sec) await revokeToken(await decryptSecret(sec.enc_refresh_token, env('TOKEN_ENCRYPTION_KEY'))).catch(() => false);
    }
    const { error } = await admin.auth.admin.deleteUser(u.userId);
    if (error) throw new Error('Konto konnte nicht gelöscht werden.');
    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: safeError(e) }, 500);
  }
});
