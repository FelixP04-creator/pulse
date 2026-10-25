// deno-lint-ignore-file no-explicit-any
import { GoogleApiError, refreshAccessToken, type OAuthConfig } from './client.ts';
import { decryptSecret, encryptSecret } from './crypto.ts';
import { env } from './env.ts';

export const oauthConfig = (): OAuthConfig => ({
  clientId: env('GOOGLE_CLIENT_ID'),
  clientSecret: env('GOOGLE_CLIENT_SECRET'),
  redirectUri: env('GOOGLE_REDIRECT_URI'), // https://<project>.functions.supabase.co/google-health-oauth-callback
});

export class NeedsReauthError extends Error {}

/**
 * Liefert ein gültiges Access-Token. Refresh-Tokens liegen nur verschlüsselt in `wearable_secrets`.
 * Bei `invalid_grant` (Zugriff widerrufen/abgelaufen) wird die Verbindung auf `needs_reauth` gesetzt.
 */
export async function getAccessToken(admin: any, connectionId: string, force = false): Promise<string> {
  const key = env('TOKEN_ENCRYPTION_KEY');
  const { data: sec, error } = await admin.from('wearable_secrets').select('*').eq('connection_id', connectionId).single();
  if (error || !sec) throw new NeedsReauthError('Keine gespeicherte Verbindung.');

  const stillValid = !force && sec.enc_access_token && sec.access_expires_at && Date.parse(sec.access_expires_at) - Date.now() > 60_000;
  if (stillValid) return decryptSecret(sec.enc_access_token, key);

  const refresh = await decryptSecret(sec.enc_refresh_token, key);
  try {
    const t = await refreshAccessToken(oauthConfig(), refresh);
    await admin.from('wearable_secrets').update({
      enc_access_token: await encryptSecret(t.accessToken, key),
      access_expires_at: new Date(Date.now() + t.expiresInSec * 1000).toISOString(),
      // Google gibt bei Refresh meist kein neues Refresh-Token aus; falls doch, ersetzen wir es.
      ...(t.refreshToken ? { enc_refresh_token: await encryptSecret(t.refreshToken, key) } : {}),
      updated_at: new Date().toISOString(),
    }).eq('connection_id', connectionId);
    return t.accessToken;
  } catch (e) {
    if (e instanceof GoogleApiError && e.code === 'invalid_grant') {
      await admin.from('wearable_connections').update({ status: 'needs_reauth', last_error: 'Zugriff wurde widerrufen oder ist abgelaufen.' }).eq('id', connectionId);
      throw new NeedsReauthError('Erneute Anmeldung nötig.');
    }
    throw e;
  }
}
