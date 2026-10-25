// deno-lint-ignore-file no-explicit-any
import { GoogleHealthClient } from '../_shared/client.ts';
import { CORS_HEADERS, jsonResponse, safeError } from '../_shared/env.ts';
import { addDays, runSync, type SyncOutput } from '../_shared/sync.ts';
import { adminClient, requireUser } from '../_shared/supabase.ts';
import { getAccessToken, NeedsReauthError } from '../_shared/tokens.ts';

/** Schreibt einen Sync-Lauf in die Tabellen. Geräte-Trainings werden nie mit manuellen vermischt (source). */
export async function persist(admin: any, userId: string, out: SyncOutput): Promise<void> {
  const num = (x: number | undefined) => (x === undefined ? null : x);
  const now = new Date().toISOString();
  if (out.daily.length) {
    const rows = out.daily.map((d) => ({
      user_id: userId, date: d.date, resting_hr: num(d.restingHr), hrv_ms: num(d.hrvMs), resp_rate: num(d.respRate), spo2: num(d.spo2),
      skin_temp_dev_c: num(d.skinTempDevC), steps: num(d.steps), active_minutes: num(d.activeMinutes), azm: num(d.azm), vo2max: num(d.vo2max),
      source: 'google_health', updated_at: now,
    }));
    const { error } = await admin.from('daily_metrics').upsert(rows, { onConflict: 'user_id,date' });
    if (error) throw new Error('daily_metrics: ' + error.message);
  }
  if (out.sleep.length) {
    const rows = out.sleep.map((s) => ({
      user_id: userId, provider_id: s.providerId, date: s.date, start_local: s.startLocal, end_local: s.endLocal, in_bed_min: s.inBedMin,
      asleep_min: num(s.asleepMin), asleep_is_estimate: s.asleepIsEstimate, awake_min: num(s.stages?.awakeMin), light_min: num(s.stages?.lightMin),
      deep_min: num(s.stages?.deepMin), rem_min: num(s.stages?.remMin), source: 'google_health', updated_at: now,
    }));
    const { error } = await admin.from('sleep_sessions').upsert(rows, { onConflict: 'user_id,provider_id' });
    if (error) throw new Error('sleep_sessions: ' + error.message);
  }
  if (out.workouts.length) {
    const rows = out.workouts.map((w) => ({
      user_id: userId, id: w.providerId, source: 'device', type: w.type, start_local: w.startLocal, duration_min: Math.max(1, w.durationMin),
      avg_hr: num(w.avgHr), max_hr: num(w.maxHr), zone_min: w.zoneMinutes ?? null, updated_at: now,
    }));
    const { error } = await admin.from('workouts').upsert(rows, { onConflict: 'user_id,id' });
    if (error) throw new Error('workouts: ' + error.message);
  }
}

export async function syncUser(admin: any, userId: string, days: number): Promise<{ ok: boolean; status?: SyncOutput['status']; warnings?: string[]; error?: string; needsReauth?: boolean }> {
  const { data: conn } = await admin.from('wearable_connections').select('*').eq('user_id', userId).eq('provider', 'google_health').maybeSingle();
  if (!conn) return { ok: false, error: 'not_connected' };
  if (conn.status === 'needs_reauth' || conn.status === 'revoked') return { ok: false, needsReauth: true, error: 'needs_reauth' };

  try {
    const { data: prof } = await admin.from('profiles').select('hr_max, birth_year').eq('user_id', userId).maybeSingle();
    const age = prof?.birth_year ? new Date().getUTCFullYear() - prof.birth_year : undefined;
    const hrMax = prof?.hr_max ?? (age ? Math.round(208 - 0.7 * age) : undefined);

    let token = await getAccessToken(admin, conn.id);
    const client = new GoogleHealthClient(token, { onUnauthorized: async () => (token = await getAccessToken(admin, conn.id, true)) });
    const to = new Date().toISOString().slice(0, 10);
    const out = await runSync({ client, from: addDays(to, -(days - 1)), to, grantedScopes: conn.granted_scopes, hrMax });
    await persist(admin, userId, out);

    const failed = Object.values(out.status).some((s) => s.state === 'error');
    await admin.from('wearable_connections').update({
      last_sync_at: out.rateLimited ? conn.last_sync_at : new Date().toISOString(),
      last_sync_status: out.rateLimited ? 'rate_limited' : failed ? 'partial' : 'ok',
      last_sync_detail: out.status, last_error: null, status: 'connected',
    }).eq('id', conn.id);
    return { ok: true, status: out.status, warnings: out.warnings };
  } catch (e) {
    if (e instanceof NeedsReauthError) return { ok: false, needsReauth: true, error: 'needs_reauth' };
    await admin.from('wearable_connections').update({ last_sync_status: 'error', last_error: safeError(e, 'Synchronisierung fehlgeschlagen') }).eq('id', conn.id);
    return { ok: false, error: safeError(e, 'sync_failed') };
  }
}

/** POST { days?: number } – manueller Sync (Standard 14 Tage, max. 90; Intervalldaten werden blockweise geladen). */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  const body = await req.json().catch(() => ({}));
  const days = Math.min(90, Math.max(1, Number(body?.days) || 14));
  const res = await syncUser(adminClient(), u.userId, days);
  return jsonResponse(res, res.ok ? 200 : res.needsReauth ? 409 : 502);
});
