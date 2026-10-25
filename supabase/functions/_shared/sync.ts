import { DATA_TYPES, FITBIT_AIR_DATA_TYPES, initialStatus, SCOPES, type DataTypeSpec } from './catalog.ts';
import { dailyFilter, GoogleApiError, GoogleHealthClient, intervalFilter, sleepFilter } from './client.ts';
import { applyPoint, heartRatePerMinute, mapExercises, mapSleep, zoneMinutesFromHr } from './mapper.ts';
import type { DailyMetricsRow, DataTypeStatus, SleepRow, WorkoutRow } from './types.ts';

/** Kalendertag + n (rein kalenderbasiert). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export interface SyncInput {
  client: GoogleHealthClient;
  /** Erster Tag (inklusive), YYYY-MM-DD */
  from: string;
  /** Letzter Tag (inklusive), YYYY-MM-DD */
  to: string;
  grantedScopes: readonly string[];
  deviceTypes?: ReadonlySet<string>;
  /** Für die Zonenberechnung der Trainings. */
  hrMax?: number;
  /** Intervall-Datentypen (Schritte etc.) werden in Blöcken dieser Länge abgefragt. */
  intervalChunkDays?: number;
  /** Maximal so viele Trainings je Sync bekommen Herzfrequenzzonen (schont das Rate-Limit). */
  maxZoneLookups?: number;
}

export interface SyncOutput {
  daily: DailyMetricsRow[];
  sleep: SleepRow[];
  workouts: WorkoutRow[];
  status: Record<string, DataTypeStatus>;
  warnings: string[];
  requests: number;
  /** true, wenn der Lauf wegen Rate-Limit vorzeitig beendet wurde. */
  rateLimited: boolean;
}

function classify(e: unknown): DataTypeStatus {
  if (e instanceof GoogleApiError) {
    if (e.status === 403 || e.code === 'PERMISSION_DENIED') return { state: 'missing_scope', count: 0, message: 'Zugriff verweigert – Berechtigung fehlt oder wurde widerrufen.' };
    if (e.status === 429) return { state: 'error', count: 0, message: 'Rate-Limit erreicht – später erneut versuchen.' };
    if (e.status === 401) return { state: 'error', count: 0, message: 'Anmeldung abgelaufen – erneut verbinden.' };
    return { state: 'error', count: 0, message: e.message };
  }
  return { state: 'error', count: 0, message: e instanceof Error ? e.message : 'Unbekannter Fehler' };
}

async function fetchType(spec: DataTypeSpec, client: GoogleHealthClient, from: string, to: string, chunkDays: number) {
  const toEx = addDays(to, 1);
  if (spec.kind === 'daily') return client.listWithFilter(spec.id, spec.field, (f) => dailyFilter(f, from, toEx));
  if (spec.kind === 'session') {
    // sleep/exercise: Seitengröße ist laut Doku auf 25 begrenzt → Paginierung übernimmt listAll
    const build = spec.id === 'sleep' ? sleepFilter : intervalFilter;
    return client.listWithFilter(spec.id, spec.field, (f) => build(f, from, toEx), 25);
  }
  const out: Array<Record<string, unknown>> = [];
  for (let s = from; s <= to; s = addDays(s, chunkDays)) {
    const e = addDays(s, chunkDays);
    const end = e > toEx ? toEx : e;
    out.push(...(await client.listWithFilter(spec.id, spec.field, (f) => intervalFilter(f, s, end), 10000)));
  }
  return out;
}

export async function runSync(input: SyncInput): Promise<SyncOutput> {
  const deviceTypes = input.deviceTypes ?? FITBIT_AIR_DATA_TYPES;
  const status = initialStatus(input.grantedScopes, deviceTypes);
  const warnings: string[] = [];
  const acc = new Map<string, DailyMetricsRow>();
  let sleep: SleepRow[] = [];
  let workouts: WorkoutRow[] = [];
  let rateLimited = false;

  for (const spec of DATA_TYPES) {
    if (status[spec.id].state !== 'not_requested') continue;
    if (rateLimited) {
      status[spec.id] = { state: 'error', count: 0, message: 'Wegen Rate-Limit übersprungen – beim nächsten Sync erneut.' };
      continue;
    }
    try {
      const points = await fetchType(spec, input.client, input.from, input.to, input.intervalChunkDays ?? 7);
      if (points.length === 0) {
        status[spec.id] = { state: 'no_data', count: 0, message: 'Für diesen Zeitraum liefert das Gerät keine Daten.' };
        continue;
      }
      if (spec.id === 'sleep') {
        const m = mapSleep(points);
        sleep = m.rows;
        warnings.push(...m.warnings);
      } else if (spec.id === 'exercise') {
        const m = mapExercises(points);
        workouts = m.rows;
        warnings.push(...m.warnings);
      } else {
        for (const p of points) applyPoint(acc, spec.id, p, warnings);
      }
      status[spec.id] = { state: 'ok', count: points.length };
    } catch (e) {
      status[spec.id] = classify(e);
      if (e instanceof GoogleApiError && e.status === 429) rateLimited = true;
      if (e instanceof GoogleApiError && e.status === 401) {
        // Token endgültig ungültig → restliche Abfragen sind sinnlos
        rateLimited = true;
      }
    }
  }

  // Herzfrequenzzonen für Trainings (nur wenn möglich und erlaubt)
  const canZones = !rateLimited && input.hrMax && input.grantedScopes.includes(SCOPES.metrics) && deviceTypes.has('heart-rate');
  if (canZones && workouts.length > 0) {
    const daily = [...acc.values()];
    let budget = input.maxZoneLookups ?? 10;
    for (const w of [...workouts].sort((a, b) => b.startLocal.localeCompare(a.startLocal))) {
      if (budget <= 0) break;
      if (!w.startUtc || !w.endUtc) continue;
      const rest = daily.filter((d) => d.restingHr !== undefined && d.date <= w.startLocal.slice(0, 10)).sort((a, b) => b.date.localeCompare(a.date))[0]?.restingHr;
      if (rest === undefined) continue;
      budget--;
      try {
        const build = (f: string) => `${f}.sample_time.physical_time >= "${w.startUtc}" AND ${f}.sample_time.physical_time < "${w.endUtc}"`;
        const pts = await input.client.listWithFilter('heart-rate', 'heartRate', build, 10000);
        const perMin = heartRatePerMinute(pts);
        if (perMin.length >= Math.max(5, w.durationMin * 0.5)) w.zoneMinutes = zoneMinutesFromHr(perMin, input.hrMax!, rest);
        else warnings.push(`Training ${w.startLocal}: zu wenige Herzfrequenzwerte für Zonen`);
      } catch (e) {
        if (e instanceof GoogleApiError && e.status === 429) { rateLimited = true; break; }
        warnings.push(`Training ${w.startLocal}: Herzfrequenz nicht abrufbar (${e instanceof Error ? e.message : 'Fehler'})`);
      }
    }
  }

  return {
    daily: [...acc.values()].sort((a, b) => a.date.localeCompare(b.date)),
    sleep,
    workouts,
    status,
    warnings,
    requests: input.client.requestCount,
    rateLimited,
  };
}
