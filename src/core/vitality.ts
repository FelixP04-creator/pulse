import { baselineFor, zScore, type Baseline } from './baselines.ts';
import { sleepConsistency, sleepNeedMin, asleepMinutes } from './sleep.ts';
import { addDays, clamp, finite, isPlausible, mean, median, round, type PlausibleKey } from './stats.ts';
import { WEEKLY_ACTIVE_MINUTES_GUIDELINE } from './strain.ts';
import type { Component, DailyMetrics, Quality, ScoreResult, SleepNight, UserProfile } from './types.ts';

/**
 * VITALITÄTSINDEX (0–100) – app-eigener Indikator
 * -----------------------------------------------
 * KEIN biologisches Alter, KEINE medizinische Aussage, nicht klinisch validiert.
 * Er fasst Gewohnheiten und die Entwicklung deiner Wearable-Werte der letzten 28 Tage zusammen.
 *
 * Säule 1 – Gewohnheiten (absolut), Basisgewicht 60 %
 *   Schlafregelmäßigkeit  20 %   Konsistenzwert (siehe sleep.ts)
 *   Schlafdauer           15 %   Ø Schlafzeit der 28 Tage / Bedarf, max. 100
 *   Alltagsbewegung       25 %   Ø aktive Minuten pro Woche / 150 min (WHO-Mindestempfehlung), max. 100
 * Säule 2 – Entwicklung (relativ zu DEINER eigenen Vergangenheit), Basisgewicht 40 %
 *   Ruhepuls              15 %   50 − 20·z   (28-Tage-Median gegenüber den 90 Tagen davor; niedriger = besser)
 *   HRV                   15 %   50 + 20·z
 *   Cardio-Fitness (VO₂max)10 %  50 + 20·z   (Geräteschätzung)
 *   Ein Entwicklungs-Teilwert von 50 bedeutet „unverändert gegenüber deiner Ausgangslage“.
 *
 * Fehlen Teilwerte, werden die Gewichte anteilig umverteilt. Mindestanforderung: ≥ 14 Tage Verlauf, mindestens
 * 3 Teilwerte, davon mindestens einer aus Säule 1. Die angezeigte Unsicherheit (± Punkte) ist eine Heuristik:
 * ±(5 + 15 · (1 − Abdeckung)), keine statistische Konfidenzgrenze.
 */

export const VITALITY_WINDOW_DAYS = 28;
export const VITALITY_BASELINE_DAYS = 90;
export const VITALITY_MIN_HISTORY_DAYS = 14;

const BASE_WEIGHTS = {
  regularity: 0.2,
  duration: 0.15,
  activity: 0.25,
  rhr: 0.15,
  hrv: 0.15,
  vo2max: 0.1,
} as const;

type Raw = Omit<Component, 'weight'> & { w: number; pillar: 'habits' | 'trend' };

export interface VitalityOk {
  status: 'ok';
  value: number;
  /** Heuristische Unsicherheit in Punkten (±). */
  uncertainty: number;
  quality: Quality;
  coverage: number;
  historyDays: number;
  habits: number | undefined;
  trend: number | undefined;
  components: Array<Component & { pillar: 'habits' | 'trend' }>;
  notes: string[];
  provenance: 'calculated';
}

export type VitalityResult = VitalityOk | Extract<ScoreResult, { status: 'insufficient' }>;

function trendComponent(
  days: DailyMetrics[],
  key: Extract<PlausibleKey, keyof DailyMetrics>,
  asOf: string,
  sign: 1 | -1,
  minCurrent = 10,
): { score: number; base: Baseline; current: number } | undefined {
  const winStart = addDays(asOf, -(VITALITY_WINDOW_DAYS - 1));
  const base = baselineFor(days, key, winStart, VITALITY_BASELINE_DAYS);
  if (!base) return undefined;
  const cur = finite(days.filter((d) => d.date >= winStart && d.date <= asOf).map((d) => d[key] as number | undefined)).filter((v) =>
    isPlausible(key, v),
  );
  if (cur.length < minCurrent) return undefined;
  const current = median(cur) as number;
  const z = Math.max(-2.5, Math.min(2.5, zScore(current, base)));
  return { score: round(clamp(50 + sign * 20 * z, 0, 100), 1), base, current };
}

export function vitalityIndex(days: DailyMetrics[], nights: SleepNight[], asOf: string, profile: UserProfile = {}): VitalityResult {
  const sorted = days.filter((d) => d.date <= asOf).map((d) => d.date).sort();
  const historyDays = sorted.length ? Math.round((Date.parse(asOf) - Date.parse(sorted[0])) / 86_400_000) + 1 : 0;
  if (historyDays < VITALITY_MIN_HISTORY_DAYS) {
    return {
      status: 'insufficient',
      reason: `Für den Vitalitätsindex werden mindestens ${VITALITY_MIN_HISTORY_DAYS} Tage Verlauf benötigt.`,
      have: Math.max(0, historyDays),
      need: VITALITY_MIN_HISTORY_DAYS,
    };
  }

  const raw: Raw[] = [];
  const winStart = addDays(asOf, -(VITALITY_WINDOW_DAYS - 1));

  const cons = sleepConsistency(nights, asOf);
  if (cons) {
    raw.push({ key: 'regularity', label: 'Schlafregelmäßigkeit', score: cons.score, w: BASE_WEIGHTS.regularity, pillar: 'habits', provenance: 'calculated',
      detail: `Bett- und Aufwachzeiten streuen um ±${Math.round((cons.sigmaBedMin + cons.sigmaWakeMin) / 2)} min.` });
  }

  const need = sleepNeedMin(profile).minutes;
  const asleepVals = nights.filter((n) => n.date >= winStart && n.date <= asOf).map(asleepMinutes).filter((x): x is number => x !== undefined);
  if (asleepVals.length >= 14) {
    const avg = mean(asleepVals) as number;
    raw.push({ key: 'duration', label: 'Schlafdauer', score: round(clamp((avg / need) * 100, 0, 100), 1), w: BASE_WEIGHTS.duration, pillar: 'habits', provenance: 'calculated',
      detail: `Ø ${Math.round(avg)} min pro Nacht bei einem Bedarf von ca. ${need} min (${asleepVals.length} Nächte).` });
  }

  const actVals = days.filter((d) => d.date >= winStart && d.date <= asOf && d.activeMinutes !== undefined && isPlausible('activeMinutes', d.activeMinutes)).map((d) => d.activeMinutes as number);
  if (actVals.length >= 14) {
    const perWeek = (actVals.reduce((a, b) => a + b, 0) / actVals.length) * 7;
    raw.push({ key: 'activity', label: 'Alltagsbewegung', score: round(clamp((perWeek / WEEKLY_ACTIVE_MINUTES_GUIDELINE) * 100, 0, 100), 1), w: BASE_WEIGHTS.activity, pillar: 'habits', provenance: 'calculated',
      detail: `Ø ${Math.round(perWeek)} aktive Minuten pro Woche (Mindestempfehlung: ${WEEKLY_ACTIVE_MINUTES_GUIDELINE}).` });
  }

  const rhr = trendComponent(days, 'restingHr', asOf, -1);
  if (rhr) raw.push({ key: 'rhr', label: 'Ruhepuls-Entwicklung', score: rhr.score, w: BASE_WEIGHTS.rhr, pillar: 'trend', provenance: 'calculated',
    detail: `28-Tage-Median ${round(rhr.current, 0)} bpm, davor ${round(rhr.base.center, 0)} bpm.` });
  const hrv = trendComponent(days, 'hrvMs', asOf, 1);
  if (hrv) raw.push({ key: 'hrv', label: 'HRV-Entwicklung', score: hrv.score, w: BASE_WEIGHTS.hrv, pillar: 'trend', provenance: 'calculated',
    detail: `28-Tage-Median ${round(hrv.current, 0)} ms, davor ${round(hrv.base.center, 0)} ms.` });
  const vo2 = trendComponent(days, 'vo2max', asOf, 1, 3);
  if (vo2) raw.push({ key: 'vo2max', label: 'Cardio-Fitness-Entwicklung', score: vo2.score, w: BASE_WEIGHTS.vo2max, pillar: 'trend', provenance: 'estimated',
    detail: `28-Tage-Median ${round(vo2.current, 1)} ml/kg/min (Geräteschätzung), davor ${round(vo2.base.center, 1)}.` });

  const habitCount = raw.filter((r) => r.pillar === 'habits').length;
  if (raw.length < 3 || habitCount < 1) {
    return {
      status: 'insufficient',
      reason: 'Es liegen noch zu wenige Teilwerte vor (mindestens 3, davon mindestens 1 Gewohnheits-Teilwert).',
      have: raw.length,
      need: 3,
    };
  }

  const wsum = raw.reduce((a, c) => a + c.w, 0);
  const coverage = round(wsum, 3);
  const components = raw.map(({ w, ...c }) => ({ ...c, weight: round(w / wsum, 4) }));
  const value = round(components.reduce((a, c) => a + c.score * c.weight, 0));
  const pillarMean = (p: 'habits' | 'trend') => {
    const cs = components.filter((c) => c.pillar === p);
    const ws = cs.reduce((a, c) => a + c.weight, 0);
    return ws > 0 ? round(cs.reduce((a, c) => a + c.score * c.weight, 0) / ws) : undefined;
  };
  const notes: string[] = [];
  const present = new Set(raw.map((r) => r.key));
  for (const [k, label] of [['regularity', 'Schlafregelmäßigkeit'], ['duration', 'Schlafdauer'], ['activity', 'Alltagsbewegung'], ['rhr', 'Ruhepuls-Entwicklung'], ['hrv', 'HRV-Entwicklung'], ['vo2max', 'Cardio-Fitness-Entwicklung']] as const) {
    if (!present.has(k)) notes.push(`${label} fehlt (zu wenige Daten) – Gewichte wurden umverteilt.`);
  }
  const quality: Quality = coverage >= 0.85 && historyDays >= 60 ? 'high' : coverage >= 0.6 ? 'medium' : 'low';
  return {
    status: 'ok',
    value,
    uncertainty: round(5 + 15 * (1 - coverage)),
    quality,
    coverage,
    historyDays,
    habits: pillarMean('habits'),
    trend: pillarMean('trend'),
    components,
    notes,
    provenance: 'calculated',
  };
}

export interface VitalityPoint {
  date: string;
  value: number;
}

/** Verlauf: Index an `count` Stichtagen im Abstand `stepDays` (rückwärts von asOf). Tage ohne ausreichende Daten entfallen. */
export function vitalitySeries(days: DailyMetrics[], nights: SleepNight[], asOf: string, stepDays: number, count: number, profile: UserProfile = {}): VitalityPoint[] {
  const out: VitalityPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = addDays(asOf, -i * stepDays);
    const r = vitalityIndex(days, nights, d, profile);
    if (r.status === 'ok') out.push({ date: d, value: r.value });
  }
  return out;
}

// ---- Physiologischer Altersindikator (streng gesperrt) ------------------------

export interface AgeModelInput {
  calendarAge?: number;
  vo2max?: number;
  restingHr?: number;
  hrvMs?: number;
}

/** Ein Modell darf nur eingebunden werden, wenn es wissenschaftlich dokumentiert und validiert ist. */
export interface ValidatedAgeModel {
  id: string;
  /** Quellenangabe (Publikation / Validierungsstudie). */
  citation: string;
  /** Population, für die das Modell validiert wurde (z. B. Altersbereich, Geschlecht, Messmethode). */
  validatedFor: string;
  requiredInputs: Array<keyof AgeModelInput>;
  estimate(input: AgeModelInput): { ageYears: number; uncertaintyYears: number };
}

export type PhysiologicalAge =
  | { status: 'unavailable'; reasons: string[] }
  | { status: 'ok'; ageYears: number; uncertaintyYears: number; modelId: string; citation: string; validatedFor: string; provenance: 'estimated' };

/**
 * Liefert nur dann einen Zahlenwert, wenn (a) ein validiertes Modell registriert ist, (b) alle benötigten Eingaben
 * vorliegen und plausibel sind. PULSE liefert standardmäßig KEIN Modell mit – deshalb ist der Indikator
 * zunächst „nicht verfügbar“. Das ist Absicht: Aus HRV, Ruhepuls und Schlaf allein lässt sich kein biologisches Alter
 * zuverlässig bestimmen.
 */
export function physiologicalAgeIndicator(input: AgeModelInput, model?: ValidatedAgeModel): PhysiologicalAge {
  const reasons: string[] = [];
  if (!model) {
    reasons.push('Es ist kein wissenschaftlich validiertes Modell eingebunden. Ein Alterswert würde Genauigkeit vortäuschen, die Wearable-Daten allein nicht hergeben.');
    if (input.calendarAge === undefined) reasons.push('Das Kalenderalter wurde nicht angegeben.');
    return { status: 'unavailable', reasons };
  }
  if (!model.citation.trim() || !model.validatedFor.trim()) {
    return { status: 'unavailable', reasons: ['Das Modell enthält keine Quellen- oder Validierungsangabe und wird daher nicht verwendet.'] };
  }
  for (const k of model.requiredInputs) {
    if (input[k] === undefined || !Number.isFinite(input[k] as number)) reasons.push(`Benötigte Eingabe fehlt: ${k}.`);
  }
  if (input.vo2max !== undefined && !isPlausible('vo2max', input.vo2max)) reasons.push('Der VO₂max-Wert ist unplausibel.');
  if (reasons.length) return { status: 'unavailable', reasons };
  const e = model.estimate(input);
  if (!Number.isFinite(e.ageYears) || !Number.isFinite(e.uncertaintyYears) || e.uncertaintyYears <= 0) {
    return { status: 'unavailable', reasons: ['Das Modell lieferte kein gültiges Ergebnis mit Unsicherheitsangabe.'] };
  }
  return { status: 'ok', ageYears: round(e.ageYears, 1), uncertaintyYears: round(e.uncertaintyYears, 1), modelId: model.id, citation: model.citation, validatedFor: model.validatedFor, provenance: 'estimated' };
}
