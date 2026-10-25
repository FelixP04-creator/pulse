import type { SupabaseClient } from '@supabase/supabase-js';
import type { Dataset } from './demo';
import type { DailyMetrics, SleepNight, Workout } from '../core/types';

const n = (x: unknown): number | undefined => (x === null || x === undefined ? undefined : Number.isFinite(Number(x)) ? Number(x) : undefined);

export interface DataTypeStatusView {
  state: 'ok' | 'no_data' | 'unsupported_device' | 'missing_scope' | 'error' | 'not_requested';
  count: number;
  message?: string;
}

export interface ConnectionView {
  status: 'connected' | 'needs_reauth' | 'revoked' | 'error';
  lastSyncAt?: string;
  lastSyncStatus?: string;
  lastError?: string;
  detail?: Record<string, DataTypeStatusView>;
  scopes: string[];
}

/** Lädt die vom Server importierten Daten. Der Nutzer sieht nur seine eigenen Zeilen (RLS). */
export async function loadLiveDataset(sb: SupabaseClient): Promise<{ dataset: Dataset; connection?: ConnectionView }> {
  const [d, s, w, c] = await Promise.all([
    sb.from('daily_metrics').select('*').order('date', { ascending: true }).limit(800),
    sb.from('sleep_sessions').select('*').order('date', { ascending: true }).limit(800),
    sb.from('workouts').select('*').eq('source', 'device').order('start_local', { ascending: true }).limit(1500),
    sb.from('wearable_connections').select('*').eq('provider', 'google_health').maybeSingle(),
  ]);
  if (d.error) throw new Error('Tageswerte konnten nicht geladen werden.');
  if (s.error) throw new Error('Schlafdaten konnten nicht geladen werden.');
  if (w.error) throw new Error('Trainings konnten nicht geladen werden.');

  const days: DailyMetrics[] = (d.data ?? []).map((r: Record<string, unknown>) => ({
    date: String(r.date), restingHr: n(r.resting_hr), hrvMs: n(r.hrv_ms), respRate: n(r.resp_rate), spo2: n(r.spo2), skinTempDevC: n(r.skin_temp_dev_c),
    steps: n(r.steps), activeMinutes: n(r.active_minutes), azm: n(r.azm), vo2max: n(r.vo2max),
  }));
  const nights: SleepNight[] = (s.data ?? []).map((r: Record<string, unknown>) => {
    const stages = r.deep_min !== null && r.deep_min !== undefined
      ? { awakeMin: n(r.awake_min) ?? 0, lightMin: n(r.light_min) ?? 0, deepMin: n(r.deep_min) ?? 0, remMin: n(r.rem_min) ?? 0 } : undefined;
    return { date: String(r.date), start: String(r.start_local), end: String(r.end_local), inBedMin: Number(r.in_bed_min), asleepMin: n(r.asleep_min), asleepIsEstimate: Boolean(r.asleep_is_estimate), stages };
  });
  const workouts: Workout[] = (w.data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id), source: 'device', type: String(r.type), start: String(r.start_local), durationMin: Number(r.duration_min), avgHr: n(r.avg_hr), maxHr: n(r.max_hr),
    zoneMinutes: Array.isArray(r.zone_min) && r.zone_min.length === 5 ? (r.zone_min as number[]).map(Number) as Workout['zoneMinutes'] : undefined,
  }));

  const cr = c.data as Record<string, unknown> | null;
  const connection: ConnectionView | undefined = cr ? {
    status: cr.status as ConnectionView['status'], lastSyncAt: (cr.last_sync_at as string | null) ?? undefined, lastSyncStatus: (cr.last_sync_status as string | null) ?? undefined,
    lastError: (cr.last_error as string | null) ?? undefined, detail: (cr.last_sync_detail as ConnectionView['detail']) ?? undefined, scopes: (cr.granted_scopes as string[]) ?? [],
  } : undefined;
  return { dataset: { origin: 'google-health', days, nights, workouts, lastSyncAt: connection?.lastSyncAt }, connection };
}
