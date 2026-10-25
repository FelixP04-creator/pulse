import { exchangeCode } from '../_shared/client.ts';
import { REQUIRED_SCOPES } from '../_shared/catalog.ts';
import { encryptSecret, verifyState } from '../_shared/crypto.ts';
import { env } from '../_shared/env.ts';
import { adminClient } from '../_shared/supabase.ts';
import { oauthConfig } from '../_shared/tokens.ts';

/**
 * GET – Redirect-Ziel von Google (kein Nutzer-JWT; Identität kommt aus dem signierten `state`).
 * Speichert Tokens verschlüsselt und leitet per Deep-Link zurück in die App.
 */
const appLink = (q: string) => new Response(null, { status: 302, headers: { location: `${env('APP_DEEP_LINK', false) || 'pulse://data-sources'}?${q}` } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get('error')) return appLink('status=denied');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return appLink('status=invalid');
  try {
    const st = await verifyState(state, env('OAUTH_STATE_SECRET'));
    if (!st) return appLink('status=expired');

    const tokens = await exchangeCode(oauthConfig(), code);
    // Nur akzeptieren, wenn Google tatsächlich mindestens eine benötigte Berechtigung erteilt hat (Teil-Zustimmung möglich)
    const granted = tokens.scopes.filter((s) => REQUIRED_SCOPES.includes(s));
    if (granted.length === 0 || !tokens.refreshToken) return appLink('status=no_scopes');

    const admin = adminClient();
    const key = env('TOKEN_ENCRYPTION_KEY');
    const { data: conn, error } = await admin.from('wearable_connections').upsert(
      { user_id: st.uid, provider: 'google_health', status: 'connected', granted_scopes: granted, last_error: null },
      { onConflict: 'user_id,provider' },
    ).select('id').single();
    if (error || !conn) throw new Error('Verbindung konnte nicht gespeichert werden.');

    await admin.from('wearable_secrets').upsert({
      connection_id: conn.id,
      enc_refresh_token: await encryptSecret(tokens.refreshToken, key),
      enc_access_token: await encryptSecret(tokens.accessToken, key),
      access_expires_at: new Date(Date.now() + tokens.expiresInSec * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    return appLink(`status=connected&partial=${granted.length < REQUIRED_SCOPES.length ? 1 : 0}`);
  } catch {
    // Keine Details nach außen (könnten Tokens/Codes enthalten)
    return appLink('status=error');
  }
});
