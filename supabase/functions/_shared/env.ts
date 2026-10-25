/**
 * Zentrale Server-Konfiguration. ALLE Geheimnisse stammen aus Edge-Function-Secrets
 * (`supabase secrets set …`) und werden nie an Clients gesendet.
 */
declare const Deno: { env: { get(k: string): string | undefined } };

export function env(name: string, required = true): string {
  const v = Deno.env.get(name);
  if (!v && required) throw new Error(`Fehlende Konfiguration: ${name}`);
  return v ?? '';
}

export const CORS_HEADERS = {
  'access-control-allow-origin': '*', // Auth erfolgt per JWT im Header, keine Cookies
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } });
}

/** Fehlertexte an Clients enthalten nie Tokens oder interne Details. */
export function safeError(e: unknown, fallback = 'Interner Fehler'): string {
  return e instanceof Error && e.message && !/token|secret|key/i.test(e.message) ? e.message : fallback;
}
