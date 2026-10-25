import { revokeToken } from '../_shared/client.ts';
import { decryptSecret } from '../_shared/crypto.ts';
import { CORS_HEADERS, env, jsonResponse, safeError } from '../_shared/env.ts';
import { adminClient, requireUser } from '../_shared/supabase.ts';

/** POST { deleteData?: boolean } – widerruft den Google-Zugriff, löscht Tokens; optional auch importierte Daten. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  try {
    const u = await requireUser(req);
    if (u instanceof Response) return u;
    const body = await req.json().catch(() => ({}));
    const admin = adminClient();
    const { data: conn } = await admin.from('wearable_connections').select('id').eq('user_id', u.userId).eq('provider', 'google_health').maybeSingle();
    let revoked = false;
    if (conn) {
      const { data: sec } = await admin.from('wearable_secrets').select('enc_refresh_token').eq('connection_id', conn.id).maybeSingle();
      if (sec) revoked = await revokeToken(await decryptSecret(sec.enc_refresh_token, env('TOKEN_ENCRYPTION_KEY'))).catch(() => false);
      await admin.from('wearable_connections').delete().eq('id', conn.id); // cascade löscht wearable_secrets
    }
    if (body?.deleteData === true) {
      await admin.from('daily_metrics').delete().eq('user_id', u.userId).eq('source', 'google_health');
      await admin.from('sleep_sessions').delete().eq('user_id', u.userId).eq('source', 'google_health');
      await admin.from('workouts').delete().eq('user_id', u.userId).eq('source', 'device');
    }
    return jsonResponse({ ok: true, revokedAtGoogle: revoked });
  } catch (e) {
    return jsonResponse({ error: safeError(e) }, 500);
  }
});
