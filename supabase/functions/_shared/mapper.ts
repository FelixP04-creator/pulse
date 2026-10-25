import type { DailyMetricsRow, SleepRow, WorkoutRow } from './types.ts';

/**
 * Abbildung von Google-Health-DataPoints auf PULSE-Zeilen.
 *
 * WICHTIG – Verifikationsstatus (siehe docs/GOOGLE_HEALTH_SETUP.md):
 *  Durch die offizielle Referenz BELEGT (Feldnamen/Typen):
 *    steps.count (string/int64), steps.interval
 *    dailyRestingHeartRate.date + .beatsPerMinute (string/int64)
 *    dailyHeartRateVariability.date + .averageHeartRateVariabilityMilliseconds
 *    heartRateVariability.rmssd (ms) · oxygenSaturation.percentage (0–100)
 *  NICHT in der gelesenen Dokumentation belegt (hier defensiv über Kandidatenlisten gelöst):
 *    dailyRespiratoryRate, dailyOxygenSaturation, dailySleepTemperatureDerivations, dailyVo2Max,
 *    activeMinutes, activeZoneMinutes, sleep.stages/summary, exercise-Metriken, Format der Zivilzeit.
 *  Findet der Mapper kein Feld, setzt er KEINEN Wert (nie einen erfundenen) und meldet eine Warnung. Beim ersten
 *  Test mit einem echten Konto verraten die Warnungen, welche Felder angepasst werden müssen.
 */

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Liest einen (ggf. verschachtelten, per Punkt getrennten) Pfad. */
export function getPath(o: unknown, path: string): unknown {
  let cur: unknown = o;
  for (const k of path.split('.')) {
    if (!isObj(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

export function toNumber(x: unknown): number | undefined {
  if (typeof x === 'number') return Number.isFinite(x) ? x : undefined;
  if (typeof x === 'string' && x.trim() !== '') {
    const n = Number(x);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function pickNumber(o: unknown, candidates: readonly string[]): number | undefined {
  for (const c of candidates) {
    const n = toNumber(getPath(o, c));
    if (n !== undefined) return n;
  }
  return undefined;
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** google.type.Date ({year,month,day}) oder "YYYY-MM-DD[...]" → "YYYY-MM-DD" */
export function civilDate(x: unknown): string | undefined {
  if (typeof x === 'string') return /^\d{4}-\d{2}-\d{2}/.test(x) ? x.slice(0, 10) : undefined;
  if (isObj(x)) {
    if (isObj(x.date)) return civilDate(x.date);
    const y = toNumber(x.year), m = toNumber(x.month), d = toNumber(x.day);
    if (y && m && d) return `${y}-${p2(m)}-${p2(d)}`;
  }
  return undefined;
}

/** Zivilzeit → "YYYY-MM-DDTHH:MM:SS" (lokale Uhrzeit ohne Offset). */
export function civilDateTime(x: unknown): string | undefined {
  if (typeof x === 'string') return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(x) ? x.slice(0, 19).padEnd(19, ':00').slice(0, 19) : undefined;
  if (!isObj(x)) return undefined;
  const dateObj = isObj(x.date) ? x.date : x;
  const timeObj = isObj(x.time) ? x.time : x;
  const date = civilDate(dateObj);
  if (!date) return undefined;
  const h = toNumber(timeObj.hours) ?? 0, mi = toNumber(timeObj.minutes) ?? 0, s = toNumber(timeObj.seconds) ?? 0;
  return `${date}T${p2(h)}:${p2(mi)}:${p2(s)}`;
}

interface Interval {
  startLocal?: string;
  endLocal?: string;
  startMs?: number;
  endMs?: number;
  /** Startzeit stammt nicht aus der Zivilzeit (nur UTC verfügbar). */
  startFallback: boolean;
  endFallback: boolean;
  usedUtcFallback: boolean;
}

export function readInterval(i: unknown): Interval {
  if (!isObj(i)) return { startFallback: false, endFallback: false, usedUtcFallback: false };
  const sRaw = i.startTime ?? i.start_time, eRaw = i.endTime ?? i.end_time;
  const sMs = typeof sRaw === 'string' ? Date.parse(sRaw) : NaN;
  const eMs = typeof eRaw === 'string' ? Date.parse(eRaw) : NaN;
  const cs = civilDateTime(i.civilStartTime ?? i.civil_start_time);
  const ce = civilDateTime(i.civilEndTime ?? i.civil_end_time);
  const fb = (raw: unknown) => (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw) ? raw.slice(0, 19) : undefined);
  const startLocal = cs ?? fb(sRaw);
  const endLocal = ce ?? fb(eRaw);
  return {
    startLocal,
    endLocal,
    startMs: Number.isFinite(sMs) ? sMs : undefined,
    endMs: Number.isFinite(eMs) ? eMs : undefined,
    startFallback: !cs && !!startLocal,
    endFallback: !ce && !!endLocal,
    usedUtcFallback: (!cs && !!startLocal) || (!ce && !!endLocal),
  };
}

const minutesBetween = (i: Interval): number | undefined =>
  i.startMs !== undefined && i.endMs !== undefined && i.endMs > i.startMs ? Math.round((i.endMs - i.startMs) / 60000) : undefined;

// ---------------------------------------------------------------------------
// Tageswerte
// ---------------------------------------------------------------------------

export interface MapOutput<T> {
  rows: T;
  warnings: string[];
}

const CAND = {
  respRate: ['breathsPerMinute', 'averageBreathsPerMinute', 'fullSleepBreathsPerMinute', 'respiratoryRate', 'value'],
  spo2: ['averagePercentage', 'averageOxygenSaturationPercentage', 'percentage', 'oxygenSaturation.percentage', 'average', 'value'],
  skinTemp: ['nightlyTemperatureDeviationCelsius', 'deviationCelsius', 'relativeTemperatureCelsius', 'temperatureDeviationCelsius', 'nightlyRelativeCelsius', 'value'],
  vo2: ['vo2Max', 'vo2MaxMillilitersPerKilogramPerMinute', 'vo2MaxMlPerKgPerMin', 'estimatedVo2Max', 'value'],
  active: ['totalMinutes', 'minutes', 'activeMinutes', 'count', 'value'],
  azm: ['activeZoneMinutes', 'totalMinutes', 'minutes', 'count', 'value'],
} as const;

/**
 * Setzt die Werte eines Datenpunkts in die Tabelle `acc` (Schlüssel = Datum).
 * `typeId` ist die kebab-case-ID des Datentyps; `point` ist das DataPoint-Objekt der API.
 */
export function applyPoint(acc: Map<string, DailyMetricsRow>, typeId: string, point: Obj, warnings: string[]): void {
  const row = (date: string) => {
    let r = acc.get(date);
    if (!r) acc.set(date, (r = { date }));
    return r;
  };
  const warn = (msg: string) => {
    if (!warnings.includes(msg)) warnings.push(msg);
  };

  switch (typeId) {
    case 'daily-resting-heart-rate': {
      const d = point.dailyRestingHeartRate;
      const date = civilDate(isObj(d) ? d.date : undefined);
      const v = isObj(d) ? toNumber(d.beatsPerMinute) : undefined;
      if (!date || v === undefined) return warn(`${typeId}: Datum oder beatsPerMinute fehlt`);
      row(date).restingHr = v;
      return;
    }
    case 'daily-heart-rate-variability': {
      const d = point.dailyHeartRateVariability;
      const date = civilDate(isObj(d) ? d.date : undefined);
      const v = isObj(d) ? toNumber(d.averageHeartRateVariabilityMilliseconds) : undefined;
      if (!date) return warn(`${typeId}: Datum fehlt`);
      if (v !== undefined) row(date).hrvMs = v; // andere Kennzahlen (entropy etc.) werden bewusst nicht genutzt
      return;
    }
    case 'daily-respiratory-rate':
    case 'daily-oxygen-saturation':
    case 'daily-sleep-temperature-derivations':
    case 'daily-vo2-max': {
      const field = { 'daily-respiratory-rate': 'dailyRespiratoryRate', 'daily-oxygen-saturation': 'dailyOxygenSaturation', 'daily-sleep-temperature-derivations': 'dailySleepTemperatureDerivations', 'daily-vo2-max': 'dailyVo2Max' }[typeId]!;
      const d = point[field];
      const date = civilDate(isObj(d) ? d.date : undefined);
      if (!date) return warn(`${typeId}: Datum fehlt`);
      const cands = { 'daily-respiratory-rate': CAND.respRate, 'daily-oxygen-saturation': CAND.spo2, 'daily-sleep-temperature-derivations': CAND.skinTemp, 'daily-vo2-max': CAND.vo2 }[typeId];
      const v = pickNumber(d, cands);
      if (v === undefined) return warn(`${typeId}: kein bekanntes Wertfeld gefunden (Antwortschema prüfen)`);
      const r = row(date);
      if (typeId === 'daily-respiratory-rate') r.respRate = v;
      else if (typeId === 'daily-oxygen-saturation') r.spo2 = v;
      else if (typeId === 'daily-sleep-temperature-derivations') r.skinTempDevC = v;
      else r.vo2max = v;
      return;
    }
    case 'steps':
    case 'active-minutes':
    case 'active-zone-minutes': {
      const field = { steps: 'steps', 'active-minutes': 'activeMinutes', 'active-zone-minutes': 'activeZoneMinutes' }[typeId]!;
      const d = point[field];
      if (!isObj(d)) return warn(`${typeId}: leerer Datenpunkt`);
      const iv = readInterval(d.interval);
      const date = iv.startLocal?.slice(0, 10);
      if (!date) return warn(`${typeId}: Intervall ohne lesbaren Startzeitpunkt`);
      if (iv.startFallback) warn(`${typeId}: Zivilzeit fehlt, Tageszuordnung nutzt die UTC-Zeit des Intervalls (kann um bis zu einen Tag abweichen)`);
      const v = typeId === 'steps' ? toNumber(d.count) : pickNumber(d, typeId === 'active-minutes' ? CAND.active : CAND.azm);
      if (v === undefined) return warn(`${typeId}: kein bekanntes Wertfeld gefunden (Antwortschema prüfen)`);
      const r = row(date);
      if (typeId === 'steps') r.steps = (r.steps ?? 0) + v;
      else if (typeId === 'active-minutes') r.activeMinutes = (r.activeMinutes ?? 0) + v;
      else r.azm = (r.azm ?? 0) + v;
      return;
    }
    default:
      return warn(`${typeId}: kein Mapper vorhanden`);
  }
}

// ---------------------------------------------------------------------------
// Schlaf
// ---------------------------------------------------------------------------

function stageKind(raw: unknown): 'awake' | 'light' | 'deep' | 'rem' | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.toUpperCase();
  if (s.includes('DEEP')) return 'deep';
  if (s.includes('REM')) return 'rem';
  if (s.includes('LIGHT')) return 'light';
  if (s.includes('AWAKE') || s.includes('WAKE')) return 'awake';
  return undefined;
}

function stageMinutes(st: unknown): number | undefined {
  if (!isObj(st)) return undefined;
  const direct = pickNumber(st, ['durationMinutes', 'minutes']);
  if (direct !== undefined) return direct;
  const secs = pickNumber(st, ['durationSeconds', 'seconds']);
  if (secs !== undefined) return secs / 60;
  const iv = readInterval(isObj(st.interval) ? st.interval : st);
  return minutesBetween(iv);
}

/** Wählt je Aufwach-Tag die längste Aufzeichnung als „Nacht“ (kurze Nickerchen werden ignoriert). */
export function mapSleep(points: Obj[]): MapOutput<SleepRow[]> {
  const warnings: string[] = [];
  const byDate = new Map<string, SleepRow>();
  for (const p of points) {
    const s = p.sleep;
    if (!isObj(s)) continue;
    const iv = readInterval(s.interval);
    const inBed = minutesBetween(iv);
    const date = iv.endLocal?.slice(0, 10);
    if (!iv.startLocal || !iv.endLocal || inBed === undefined || !date) {
      warnings.push('sleep: Intervall unvollständig – Datenpunkt übersprungen');
      continue;
    }
    if (iv.usedUtcFallback && !warnings.some((w) => w.includes('Zivilzeit'))) warnings.push('sleep: Zivilzeit fehlt – Uhrzeiten basieren auf UTC');

    // Phasen: nur übernehmen, wenn ALLE Einträge sicher lesbar sind
    let stages: SleepRow['stages'];
    const arr = Array.isArray(s.stages) ? s.stages : [];
    if (arr.length > 0) {
      const t = { awake: 0, light: 0, deep: 0, rem: 0 };
      let valid = true;
      for (const st of arr) {
        const kind = stageKind(isObj(st) ? (st.type ?? st.stage) : undefined);
        const m = stageMinutes(st);
        if (!kind || m === undefined) { valid = false; break; }
        t[kind] += m;
      }
      if (valid) stages = { awakeMin: Math.round(t.awake), lightMin: Math.round(t.light), deepMin: Math.round(t.deep), remMin: Math.round(t.rem) };
      else warnings.push('sleep: Phasen nicht eindeutig lesbar – Phasen werden nicht angezeigt');
    }

    let asleep: number | undefined;
    let estimate = false;
    const fromSummary = pickNumber(s.summary, ['minutesAsleep', 'asleepMinutes', 'totalMinutesAsleep']);
    if (fromSummary !== undefined) asleep = Math.round(fromSummary);
    else if (stages) asleep = Math.max(0, inBed - stages.awakeMin);
    else { asleep = undefined; estimate = true; }

    const row: SleepRow = {
      date,
      providerId: typeof p.name === 'string' ? p.name : `${iv.startLocal}`,
      startLocal: iv.startLocal,
      endLocal: iv.endLocal,
      inBedMin: inBed,
      asleepMin: asleep,
      asleepIsEstimate: estimate,
      stages,
    };
    const prev = byDate.get(date);
    if (!prev || row.inBedMin > prev.inBedMin) byDate.set(date, row);
  }
  return { rows: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)), warnings };
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

const EXERCISE_LABELS: Record<string, string> = {
  RUNNING: 'Laufen', WALKING: 'Gehen', BIKING: 'Radfahren', CYCLING: 'Radfahren', SWIMMING: 'Schwimmen', HIKING: 'Wandern',
  WEIGHTLIFTING: 'Krafttraining', STRENGTH_TRAINING: 'Krafttraining', YOGA: 'Yoga', HIIT: 'Intervalltraining', ELLIPTICAL: 'Crosstrainer', ROWING: 'Rudern',
};

export function mapExercises(points: Obj[]): MapOutput<WorkoutRow[]> {
  const warnings: string[] = [];
  const rows: WorkoutRow[] = [];
  for (const p of points) {
    const e = p.exercise;
    if (!isObj(e)) continue;
    const iv = readInterval(e.interval);
    const dur = minutesBetween(iv);
    if (!iv.startLocal || dur === undefined) {
      warnings.push('exercise: Intervall unvollständig – Datenpunkt übersprungen');
      continue;
    }
    const raw = typeof e.exerciseType === 'string' ? e.exerciseType : isObj(e.exerciseType) ? String(e.exerciseType.type ?? '') : '';
    const key = raw.toUpperCase().replace(/^EXERCISE_TYPE_/, '');
    rows.push({
      providerId: typeof p.name === 'string' ? p.name : iv.startLocal,
      type: EXERCISE_LABELS[key] ?? (raw ? raw.charAt(0) + raw.slice(1).toLowerCase().replace(/_/g, ' ') : 'Training'),
      startLocal: iv.startLocal,
      startUtc: iv.startMs !== undefined ? new Date(iv.startMs).toISOString() : undefined,
      endUtc: iv.endMs !== undefined ? new Date(iv.endMs).toISOString() : undefined,
      durationMin: dur,
      avgHr: pickNumber(e, ['metricsSummary.averageHeartRateBeatsPerMinute', 'averageHeartRateBeatsPerMinute', 'metrics.averageHeartRateBeatsPerMinute']),
      maxHr: pickNumber(e, ['metricsSummary.maxHeartRateBeatsPerMinute', 'maxHeartRateBeatsPerMinute', 'metrics.maxHeartRateBeatsPerMinute']),
    });
  }
  return { rows, warnings };
}

/** Minutenmittel aus Herzfrequenz-Datenpunkten (heartRate.sampleTime.physicalTime + beatsPerMinute). */
export function heartRatePerMinute(points: Obj[]): number[] {
  const buckets = new Map<number, number[]>();
  for (const p of points) {
    const h = p.heartRate;
    if (!isObj(h)) continue;
    const bpm = toNumber(h.beatsPerMinute);
    const t = getPath(h, 'sampleTime.physicalTime') ?? getPath(h, 'sample_time.physical_time');
    const ms = typeof t === 'string' ? Date.parse(t) : NaN;
    if (bpm === undefined || !Number.isFinite(ms)) continue;
    const k = Math.floor(ms / 60000);
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(bpm);
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v.reduce((a, b) => a + b, 0) / v.length);
}

/** Entspricht src/core/strain.ts → zoneMinutesFromHr (Paritätstest in tests/integration.test.ts). */
export function zoneMinutesFromHr(bpmPerMinute: number[], hrMax: number, hrRest: number): [number, number, number, number, number] {
  const z: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  const hrr = hrMax - hrRest;
  if (!(hrr > 20)) return z;
  const lows = [0.5, 0.6, 0.7, 0.8, 0.9];
  for (const bpm of bpmPerMinute) {
    if (!Number.isFinite(bpm)) continue;
    const frac = (bpm - hrRest) / hrr;
    for (let i = 4; i >= 0; i--) {
      if (frac >= lows[i]) { z[i] += 1; break; }
    }
  }
  return z;
}
