import { timingSafeEqual } from '../_shared/crypto.ts';
import { env, jsonResponse } from '../_shared/env.ts';

/**
 * POST – Benachrichtigungen der Google Health API (Subscriber-Endpunkt).
 *
 * Dokumentiert (24.10.2026): Der Endpunkt muss HTTPS sein, wird bei `subscribers.create` verifiziert, Google sendet den
 * konfigurierten `Authorization`-Header mit, das JSON ist signiert (Header `GOOGLE-HEALTH-API-SIGNATURE`, ECDSA P-256).
 *
 * NICHT dokumentiert bzw. nicht verifizierbar: Aufbau der Nachricht und woher der öffentliche Schlüssel stammt.
 * Daher: (1) Authorization-Header wird zeitkonstant geprüft, (2) die Signaturprüfung ist an einen konfigurierten
 * Schlüssel gebunden und noch NICHT implementiert → ohne Verifizierung wird nur quittiert, es werden KEINE Daten
 * verarbeitet. Die eigentliche Synchronisierung erfolgt über den manuellen/geplanten Sync (siehe README).
 * Sobald Nachrichtenformat und Schlüsselbezug geklärt sind, hier den Sync anstoßen.
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  const expected = env('WEBHOOK_AUTHORIZATION', false);
  if (!expected) return jsonResponse({ error: 'not_configured' }, 503);
  if (!timingSafeEqual(req.headers.get('authorization') ?? '', expected)) return jsonResponse({ error: 'unauthorized' }, 401);
  // Body bewusst nicht ausgewertet (siehe Kommentar oben); schnelle Quittung verhindert Wiederholungen durch Google.
  await req.arrayBuffer();
  return jsonResponse({ received: true, processed: false });
});
