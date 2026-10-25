import { addDays, clamp, finite, round } from './stats.ts';
import type { Component, DailyMetrics, Provenance, Quality, ScoreResult, UserProfile, Workout } from './types.ts';

/**
 * BELASTUNG (Strain, Skala 0–21) – app-eigenes Modell
 * ---------------------------------------------------
 * ACHTUNG: Dies ist KEIN WHOOP-Strain und nicht damit vergleichbar. Die Skala 0–21 ist lediglich eine
 * gewählte Darstellung der Trainingsbelastung.
 *
 * 1. Trainingslast je Einheit (Edwards-TRIMP):
 *      Last = Σ (Minuten in Zone i · i), i = 1…5
 *    Zonen = Prozent der Herzfrequenzreserve (HRR = HRmax − Ruhepuls):
 *      Z1 50–60 %, Z2 60–70 %, Z3 70–80 %, Z4 80–90 %, Z5 ≥ 90 %. Unter 50 % zählt nicht.
 * 2. Fehlen Zonen, aber eine subjektive Anstrengung (RPE 1–10) vorliegt (Foster, session-RPE):
 *      Last ≈ Dauer(min) · RPE · 0,5     → als Schätzung gekennzeichnet.
 * 3. Tageslast = Summe der Einheiten des Kalendertags. Abbildung auf 0–21 (sättigend):
 *      Strain = 21 · (1 − e^(−Last / 250))
 *    Beispiele: 60 min Zone 3 → Last 180 → ≈ 10,8 · 90 min gemischt hart → Last ≈ 400 → ≈ 16,8.
 *
 * Alltagsaktivität (Schritte, aktive Minuten) fließt NICHT in den Strain ein und wird getrennt dargestellt.
 */

export const STRAIN_K = 250;
export const STRAIN_MAX = 21;
export const ZONE_LOWER_BOUNDS_HRR = [0.5, 0.6, 0.7, 0.8, 0.9] as const;

/** Tanaka-Schätzung: HRmax ≈ 208 − 0,7 · Alter. Nur Schätzung, individuell abweichend. */
export function estimateHrMax(profile: UserProfile): { value: number; provenance: Provenance } | undefined {
  if (profile.hrMax && profile.hrMax > 100) return { value: profile.hrMax, provenance: 'manual' };
  if (profile.age && profile.age > 5) return { value: round(208 - 0.7 * profile.age), provenance: 'estimated' };
  return undefined;
}

/** Zonenminuten aus Minuten-Herzfrequenzwerten (je Wert = 1 Minute). */
export function zoneMinutesFromHr(
  bpmPerMinute: number[],
  hrMax: number,
  hrRest: number,
): [number, number, number, number, number] {
  const z: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  const hrr = hrMax - hrRest;
  if (!(hrr > 20)) return z;
  for (const bpm of finite(bpmPerMinute)) {
    const frac = (bpm - hrRest) / hrr;
    for (let i = 4; i >= 0; i--) {
      if (frac >= ZONE_LOWER_BOUNDS_HRR[i]) {
        z[i] += 1;
        break;
      }
    }
  }
  return z;
}

export const edwardsLoad = (zm: readonly number[]): number => zm.reduce((a, m, i) => a + Math.max(0, m) * (i + 1), 0);
export const rpeLoad = (durationMin: number, rpe: number): number => Math.max(0, durationMin) * clamp(rpe, 1, 10) * 0.5;

export function strainFromLoad(load: number): number {
  return round(STRAIN_MAX * (1 - Math.exp(-Math.max(0, load) / STRAIN_K)), 1);
}

export interface WorkoutLoad {
  workoutId: string;
  load: number;
  provenance: Provenance;
}

export function workoutLoad(w: Workout): WorkoutLoad | undefined {
  if (w.zoneMinutes && w.zoneMinutes.some((m) => m > 0)) {
    return { workoutId: w.id, load: edwardsLoad(w.zoneMinutes), provenance: w.source === 'manual' ? 'manual' : 'calculated' };
  }
  if (w.rpe !== undefined && w.durationMin > 0) {
    return { workoutId: w.id, load: rpeLoad(w.durationMin, w.rpe), provenance: 'estimated' };
  }
  return undefined;
}

const dayOf = (w: Workout) => w.start.slice(0, 10);

export function dailyStrain(workouts: Workout[], date: string): ScoreResult {
  const todays = workouts.filter((w) => dayOf(w) === date);
  const loads = todays.map(workoutLoad).filter((l): l is WorkoutLoad => !!l);
  const unrated = todays.length - loads.length;
  const total = loads.reduce((a, l) => a + l.load, 0);
  const value = strainFromLoad(total);
  const components: Component[] = loads.map((l) => {
    const w = todays.find((x) => x.id === l.workoutId)!;
    return {
      key: l.workoutId,
      label: w.type,
      score: strainFromLoad(l.load),
      weight: total > 0 ? round(l.load / total, 4) : 0,
      detail: `${w.durationMin} min · Last ${Math.round(l.load)}${l.provenance === 'estimated' ? ' (aus Anstrengung geschätzt)' : ''}`,
      provenance: l.provenance,
    };
  });
  const notes: string[] = [];
  if (todays.length === 0) notes.push('Für diesen Tag ist keine Trainingseinheit erfasst.');
  if (unrated > 0) notes.push(`${unrated} Einheit(en) ohne Herzfrequenzzonen und ohne Anstrengungsangabe wurden nicht berücksichtigt.`);
  const anyEstimate = loads.some((l) => l.provenance === 'estimated');
  const anyManual = loads.some((l) => l.provenance === 'manual');
  const quality: Quality = todays.length === 0 || unrated > 0 ? 'low' : anyEstimate ? 'medium' : 'high';
  const provenance: Provenance = anyEstimate ? 'estimated' : anyManual ? 'manual' : 'calculated';
  return { status: 'ok', value, provenance, quality, components, notes };
}

export interface StrainDay {
  date: string;
  strain: number;
  load: number;
}

export function strainSeries(workouts: Workout[], asOf: string, days: number): StrainDay[] {
  const out: StrainDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(asOf, -i);
    const load = workouts
      .filter((w) => dayOf(w) === date)
      .map(workoutLoad)
      .filter((l): l is WorkoutLoad => !!l)
      .reduce((a, l) => a + l.load, 0);
    out.push({ date, strain: strainFromLoad(load), load: round(load) });
  }
  return out;
}

/** Zeit in Zonen über mehrere Tage (nur Einheiten mit Zonendaten). */
export function zoneTotals(workouts: Workout[], asOf: string, days: number): [number, number, number, number, number] {
  const from = addDays(asOf, -(days - 1));
  const t: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const w of workouts) {
    const d = dayOf(w);
    if (d < from || d > asOf || !w.zoneMinutes) continue;
    w.zoneMinutes.forEach((m, i) => (t[i] += m));
  }
  return t;
}

// ---- Alltagsaktivität (getrennt vom Strain) --------------------------------

/** Allgemeine Bewegungsempfehlung für Erwachsene: mind. 150 min moderate Aktivität pro Woche (WHO). */
export const WEEKLY_ACTIVE_MINUTES_GUIDELINE = 150;

export interface ActivitySummary {
  steps?: number;
  activeMinutes?: number;
  azm?: number;
  weekActiveMinutes?: number;
  weekDaysWithData: number;
  guidelineProgress?: number;
}

export function activitySummary(days: DailyMetrics[], asOf: string): ActivitySummary {
  const today = days.find((d) => d.date === asOf);
  const from = addDays(asOf, -6);
  const week = days.filter((d) => d.date >= from && d.date <= asOf && d.activeMinutes !== undefined);
  const weekActive = week.length ? week.reduce((a, d) => a + (d.activeMinutes as number), 0) : undefined;
  return {
    steps: today?.steps,
    activeMinutes: today?.activeMinutes,
    azm: today?.azm,
    weekActiveMinutes: weekActive,
    weekDaysWithData: week.length,
    guidelineProgress: weekActive === undefined || week.length < 4 ? undefined : clamp(weekActive / WEEKLY_ACTIVE_MINUTES_GUIDELINE, 0, 1.5),
  };
}

// ---- Belastung vs. Erholung -------------------------------------------------

export type LoadBalance = 'insufficient' | 'room' | 'balanced' | 'strained';

/**
 * Sehr grobe, vorsichtige Einordnung: Durchschnitt der letzten 3 Tage Strain gegen den heutigen Recovery-Score.
 * Dient nur als Denkanstoß und ist keine Trainingsanweisung.
 */
export function loadBalance(strain3dAvg: number | undefined, recovery: number | undefined): LoadBalance {
  if (strain3dAvg === undefined || recovery === undefined) return 'insufficient';
  if (recovery >= 67 && strain3dAvg < 12) return 'room';
  if (recovery < 34 && strain3dAvg >= 12) return 'strained';
  return 'balanced';
}
