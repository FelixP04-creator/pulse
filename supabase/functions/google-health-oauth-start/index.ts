import { buildAuthUrl } from '../_shared/client.ts';
import { REQUIRED_SCOPES } from '../_shared/catalog.ts';
import { signState } from '../_shared/crypto.ts';
import { CORS_HEADERS, env, jsonResponse, safeError } from '../_shared/env.ts';
import { adminClient, hasConsent, requireUser } from '../_shared/supabase.ts';
import { oauthConfig } from '../_shared/tokens.ts';

/** POST – liefert die Google-Anmelde-URL. Voraussetzung: Einwilligung `google_health_import`. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  try {
    const u = await requireUser(req);
    if (u instanceof Response) return u;
    const admin = adminClient();
    if (!(await hasConsent(admin, u.userId, 'google_health_import'))) return jsonResponse({ error: 'consent_required' }, 403);
    const state = await signState({ uid: u.userId, nonce: crypto.randomUUID(), exp: Math.floor(Date.now() / 1000) + 600 }, env('OAUTH_STATE_SECRET'));
    return jsonResponse({ url: buildAuthUrl(oauthConfig(), REQUIRED_SCOPES, state) });
  } catch (e) {
    return jsonResponse({ error: safeError(e) }, 500);
  }
});
