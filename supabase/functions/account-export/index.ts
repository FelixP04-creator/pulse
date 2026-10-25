import { CORS_HEADERS, jsonResponse, safeError } from '../_shared/env.ts';
import { adminClient, requireUser } from '../_shared/supabase.ts';

/** GET/POST – vollständiger Datenexport (Art. 15/20 DSGVO) als JSON. Tokens/Geheimnisse sind NIE enthalten. */
const TABLES = ['profiles', 'consents', 'wearable_connections', 'daily_metrics', 'sleep_sessions', 'workouts', 'daily_scores', 'personal_baselines', 'checkins', 'habits', 'habit_logs', 'hydration_logs', 'meals', 'meal_items', 'ai_insights'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  try {
    const u = await requireUser(req);
    if (u instanceof Response) return u;
    const admin = adminClient();
    const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), userId: u.userId };
    for (const t of TABLES) {
      const { data, error } = await admin.from(t).select('*').eq('user_id', u.userId).limit(100000);
      if (error) throw new Error(`Export fehlgeschlagen (${t})`);
      out[t] = t === 'wearable_connections' ? (data ?? []).map(({ id: _id, ...r }: Record<string, unknown>) => r) : data;
    }
    return jsonResponse(out);
  } catch (e) {
    return jsonResponse({ error: safeError(e) }, 500);
  }
});
