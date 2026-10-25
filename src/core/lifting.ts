import { addDays, clamp, round } from './stats.ts';
import type { Workout } from './types.ts';

/**
 * SCIENCE-BASED LIFTING – Krafttraining auf Basis des Forschungsstands
 * --------------------------------------------------------------------
 * Alles hier ist Orientierung für gesunde Erwachsene, keine individuelle Trainings- oder medizinische Beratung.
 * Richtwerte sind Bandbreiten aus Übersichtsarbeiten (siehe docs/LIFTING.md); die Studienlage ist nicht in
 * jedem Punkt eindeutig und wird bei neuen Arbeiten angepasst. Nichts davon ist ein persönlich validiertes Modell.
 *
 * Grundprinzipien (Evidenz in Klammern, siehe EVIDENCE):
 *  - Wöchentliches Volumen: grob 10–20 „harte“ Sätze je Muskelgruppe (moderat belegt; Dosis-Wirkung mit abnehmendem Zusatznutzen).
 *  - Nähe zum Muskelversagen: meist 0–3 Wiederholungen „in Reserve“ (RIR) (moderat).
 *  - Frequenz: jede Muskelgruppe ca. 2× pro Woche, bei gleichem Volumen ist die Verteilung zweitrangig (moderat).
 *  - Wiederholungsbereiche: Hypertrophie über ca. 5–30 Wdh. bei ausreichender Anstrengung ähnlich (moderat); Maximalkraft profitiert von schwereren Lasten.
 *  - Progression: stetige Steigerung von Wiederholungen/Last (Doppelte Progression) (praxisbewährt, gut plausibel).
 */

import { EVIDENCE, MUSCLES, exerciseById, regionLoad, type Evidence, type Exercise, type Muscle } from './exercises.ts';
export * from './exercises.ts';

export interface LiftSet {
  reps: number;
  weightKg: number;
  /** Wiederholungen in Reserve (0 = Muskelversagen). */
  rir?: number;
  warmup?: boolean;
}
export interface LiftEntry { exerciseId: string; sets: LiftSet[] }
export interface LiftSession { id: string; date: string; durationMin?: number; entries: LiftEntry[]; notes?: string }

const validSet = (s: LiftSet): boolean => Number.isFinite(s.reps) && s.reps >= 1 && s.reps <= 100 && Number.isFinite(s.weightKg) && s.weightKg >= 0 && s.weightKg <= 1000;

/** Prüft eine Satz-Eingabe. Gibt eine verständliche Fehlermeldung oder undefined zurück. */
export function validateSet(s: LiftSet): string | undefined {
  if (!Number.isFinite(s.reps) || s.reps < 1 || s.reps > 100) return 'Wiederholungen müssen zwischen 1 und 100 liegen.';
  if (!Number.isFinite(s.weightKg) || s.weightKg < 0 || s.weightKg > 1000) return 'Gewicht muss zwischen 0 und 1000 kg liegen.';
  if (s.rir !== undefined && (!Number.isFinite(s.rir) || s.rir < 0 || s.rir > 10)) return 'Wiederholungen in Reserve müssen zwischen 0 und 10 liegen.';
  return undefined;
}

/**
 * Geschätztes Einwiederholungsmaximum (e1RM). Epley: w·(1 + r/30). Nur bis 12 Wdh. sinnvoll (darüber unzuverlässig → undefined).
 * Bei bekannter RIR zählt die Zahl der „möglichen“ Wiederholungen (reps + RIR). Eine Schätzung, kein Test.
 */
export function e1rm(s: LiftSet): number | undefined {
  if (!validSet(s) || s.warmup || s.weightKg <= 0) return undefined;
  const r = s.reps + (s.rir !== undefined ? clamp(s.rir, 0, 5) : 0);
  if (r > 12) return undefined;
  return round(s.weightKg * (1 + r / 30), 1);
}

export function bestE1rm(sets: LiftSet[]): number | undefined {
  let best: number | undefined;
  for (const s of sets) {
    const v = e1rm(s);
    if (v !== undefined && (best === undefined || v > best)) best = v;
  }
  return best;
}

/** Ein „harter Satz“ zählt zum Volumen: kein Aufwärmsatz und höchstens 4 Wdh. vor dem Versagen (fehlende RIR → zählt, aber als Annahme). */
export const HARD_SET_MAX_RIR = 4;
export function isHardSet(s: LiftSet): boolean {
  return validSet(s) && !s.warmup && (s.rir === undefined || s.rir <= HARD_SET_MAX_RIR);
}

export interface MuscleVolume { muscle: Muscle; direct: number; indirect: number; effective: number; sessions: number; status: VolumeStatus }
export type VolumeStatus = 'none' | 'low' | 'productive' | 'high';

/**
 * Wochenvolumen je Muskel. Direkt = Sätze mit Muskel als Hauptziel (zählt 1,0), indirekt = Hilfsmuskel (zählt 0,5 – gängige Konvention,
 * kein Naturgesetz). effective = direkt + 0,5 · indirekt. Fenster: die 7 Tage bis einschließlich `date`.
 */
export function weeklyVolume(sessions: LiftSession[], date: string): MuscleVolume[] {
  const from = addDays(date, -6);
  const acc = new Map<Muscle, { d: number; i: number; days: Set<string> }>();
  for (const m of MUSCLES) acc.set(m, { d: 0, i: 0, days: new Set() });
  for (const ss of sessions) {
    if (ss.date < from || ss.date > date) continue;
    for (const e of ss.entries) {
      const ex = exerciseById(e.exerciseId);
      if (!ex) continue;
      const hard = e.sets.filter(isHardSet).length;
      if (!hard) continue;
      for (const m of ex.primary) { const a = acc.get(m)!; a.d += hard; a.days.add(ss.date); }
      for (const m of ex.secondary) { const a = acc.get(m)!; a.i += hard; a.days.add(ss.date); }
    }
  }
  return MUSCLES.map((m) => {
    const a = acc.get(m)!;
    const effective = a.d + 0.5 * a.i;
    return { muscle: m, direct: a.d, indirect: a.i, effective, sessions: a.days.size, status: volumeStatus(effective) };
  });
}

/** Einordnung der effektiven Wochensätze. Grenzen sind grobe Richtwerte (moderat belegt), keine harten Schwellen. */
export function volumeStatus(effectiveSets: number): VolumeStatus {
  if (effectiveSets <= 0) return 'none';
  if (effectiveSets < 6) return 'low';
  if (effectiveSets <= 20) return 'productive';
  return 'high';
}
export const VOLUME_TEXT: Record<VolumeStatus, string> = {
  none: 'Diese Woche noch nicht trainiert.',
  low: 'Eher wenig – zum Erhalt reicht das oft, für Muskelaufbau meist zu wenig.',
  productive: 'Im üblichen Zielbereich (ca. 6–20 effektive Sätze).',
  high: 'Sehr viel – der Zusatznutzen nimmt ab, Erholung und Gelenke im Blick behalten.',
};

export interface ProgressionAdvice {
  action: 'increase_load' | 'add_reps' | 'hold' | 'reduce' | 'no_data';
  nextWeightKg?: number;
  targetReps?: number;
  reason: string;
  evidence: Evidence;
}

/**
 * Doppelte Progression: Erreichen alle harten Arbeitssätze die obere Wiederholungsgrenze bei RIR ≤ Ziel-RIR → Last um die kleinste
 * Stufe erhöhen und wieder bei der unteren Grenze beginnen. Sonst gleiche Last, +1 Wiederholung anpeilen. Fällt der Satz unter die untere
 * Grenze, Last leicht senken. Das ist eine Heuristik und ersetzt weder Körpergefühl noch Trainer.
 */
export function progressionAdvice(lastSets: LiftSet[], ex: Exercise, targetRir = 2): ProgressionAdvice {
  const work = lastSets.filter((s) => validSet(s) && !s.warmup);
  if (!work.length) return { action: 'no_data', reason: 'Noch keine Arbeitssätze zu dieser Übung.', evidence: 'preliminary' };
  const [lo, hi] = ex.repRange;
  const w = Math.max(...work.map((s) => s.weightKg));
  const top = work.filter((s) => s.weightKg === w);
  const minReps = Math.min(...top.map((s) => s.reps));
  const rirOk = top.every((s) => s.rir === undefined || s.rir >= 0);
  if (top.length >= 2 && minReps >= hi && top.every((s) => s.rir === undefined || s.rir <= targetRir) && rirOk) {
    return { action: 'increase_load', nextWeightKg: round(w + ex.increment, 2), targetReps: lo, reason: `Alle Sätze bei ${minReps}+ Wdh. (obere Grenze ${hi}) – Last um ${ex.increment} kg erhöhen und wieder bei ${lo} Wdh. beginnen.`, evidence: 'preliminary' };
  }
  if (minReps < lo) {
    return { action: 'reduce', nextWeightKg: round(Math.max(0, w - ex.increment), 2), targetReps: lo, reason: `Schwächster Satz unter ${lo} Wdh. – Last leicht senken, bis der Bereich ${lo}–${hi} sauber klappt.`, evidence: 'preliminary' };
  }
  if (top.some((s) => s.rir !== undefined && s.rir > 3)) {
    return { action: 'hold', nextWeightKg: w, targetReps: minReps, reason: 'Sätze waren sehr weit vom Versagen entfernt (RIR > 3) – näher heranarbeiten, bevor die Last steigt.', evidence: 'moderate' };
  }
  return { action: 'add_reps', nextWeightKg: w, targetReps: Math.min(hi, minReps + 1), reason: `Gleiche Last, im Schnitt eine Wiederholung mehr anpeilen (Ziel ${Math.min(hi, minReps + 1)}).`, evidence: 'preliminary' };
}

export interface PersonalRecord { exerciseId: string; e1rm: number; date: string }
/** Bestes geschätztes 1RM je Übung über alle Einheiten. */
export function personalRecords(sessions: LiftSession[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  for (const ss of sessions) {
    for (const e of ss.entries) {
      const v = bestE1rm(e.sets);
      if (v === undefined) continue;
      const cur = best.get(e.exerciseId);
      if (!cur || v > cur.e1rm) best.set(e.exerciseId, { exerciseId: e.exerciseId, e1rm: v, date: ss.date });
    }
  }
  return [...best.values()].sort((a, b) => a.exerciseId.localeCompare(b.exerciseId));
}

export interface Tonnage { totalKg: number; hardSets: number; workSets: number }
export function sessionTonnage(s: LiftSession): Tonnage {
  let totalKg = 0, hardSets = 0, workSets = 0;
  for (const e of s.entries) for (const x of e.sets) {
    if (!validSet(x) || x.warmup) continue;
    workSets += 1;
    if (isHardSet(x)) hardSets += 1;
    totalKg += x.reps * x.weightKg;
  }
  return { totalKg: round(totalKg), hardSets, workSets };
}

/** Durchschnittliche Anstrengung der Einheit (RPE ≈ 10 − RIR); undefined, wenn nirgends eine RIR eingetragen wurde. */
export function sessionRpe(s: LiftSession): number | undefined {
  const r: number[] = [];
  for (const e of s.entries) for (const x of e.sets) if (validSet(x) && !x.warmup && x.rir !== undefined) r.push(10 - clamp(x.rir, 0, 10));
  return r.length ? round(r.reduce((a, b) => a + b, 0) / r.length, 1) : undefined;
}

/**
 * Wandelt eine Krafteinheit in ein Workout für die Belastungsberechnung (Dauer × RPE-Schätzung, als „geschätzt“ gekennzeichnet).
 * Ohne Dauer oder Anstrengung → undefined (keine erfundene Belastung).
 */
export function liftSessionToWorkout(s: LiftSession): Workout | undefined {
  const rpe = sessionRpe(s);
  if (!s.durationMin || s.durationMin <= 0 || rpe === undefined) return undefined;
  return { id: `lift-${s.id}`, source: 'manual', type: 'Krafttraining', start: `${s.date}T12:00:00`, durationMin: s.durationMin, rpe, notes: s.notes };
}

export interface DeloadHint { suggest: boolean; reasons: string[]; evidence: Evidence }
/**
 * Hinweis auf eine leichtere Woche (Deload). Heuristik ohne belastbare Studienbasis für feste Intervalle:
 * Gründe sind mehrere Wochen am Stück ohne Pause, niedrige Erholung und fallende e1RM-Trends.
 */
export function deloadHint(input: { weeksSinceDeload?: number; recoveryAvg7d?: number; e1rmDeclineLifts?: number }): DeloadHint {
  const reasons: string[] = [];
  if (input.weeksSinceDeload !== undefined && input.weeksSinceDeload >= 6) reasons.push(`Seit ${input.weeksSinceDeload} Wochen keine leichtere Woche.`);
  if (input.recoveryAvg7d !== undefined && input.recoveryAvg7d < 45) reasons.push(`Erholung im Wochenschnitt niedrig (${Math.round(input.recoveryAvg7d)}).`);
  if (input.e1rmDeclineLifts !== undefined && input.e1rmDeclineLifts >= 2) reasons.push(`Bei ${input.e1rmDeclineLifts} Übungen sinkt das geschätzte 1RM.`);
  return { suggest: reasons.length >= 2, reasons, evidence: 'preliminary' };
}

export interface LiftingTip { id: string; title: string; body: string; evidence: Evidence }
export const LIFTING_TIPS: readonly LiftingTip[] = [
  { id: 'volume', title: 'Volumen dosieren', body: 'Für Muskelaufbau sind etwa 10–20 harte Sätze je Muskelgruppe und Woche ein üblicher Zielbereich. Fang eher am unteren Ende an und steigere nur, wenn Fortschritt und Erholung stimmen.', evidence: 'moderate' },
  { id: 'proximity', title: 'Nah ans Versagen, aber nicht immer', body: 'Die meisten Arbeitssätze mit 0–3 Wiederholungen in Reserve; Isolationsübungen dürfen näher ans Versagen, schwere Grundübungen lieber etwas weiter weg.', evidence: 'moderate' },
  { id: 'frequency', title: 'Zweimal pro Woche', body: 'Jede Muskelgruppe etwa zweimal pro Woche zu trainieren verteilt das Volumen gut. Bei gleicher Satzzahl ist die genaue Verteilung zweitrangig.', evidence: 'moderate' },
  { id: 'reps', title: 'Breiter Wiederholungsbereich', body: 'Für Muskelaufbau funktionieren etwa 5–30 Wiederholungen, wenn der Satz anstrengend genug ist. Für maximale Kraft lohnen sich zusätzlich schwerere Sätze (1–6 Wdh.).', evidence: 'moderate' },
  { id: 'rest', title: 'Ausreichend Pause', body: 'Bei Grundübungen sind rund 2–3 Minuten Satzpause oft sinnvoll, bei Isolationsübungen genügen häufig 1–2 Minuten.', evidence: 'moderate' },
  { id: 'protein', title: 'Protein', body: 'Für Muskelaufbau liegt der in Meta-Analysen gefundene Nutzen etwa bei 1,6 g Protein pro kg Körpergewicht und Tag; mehr bringt im Mittel wenig zusätzlich. Bei Nierenerkrankungen vorher ärztlich klären.', evidence: 'solid' },
  { id: 'sleep', title: 'Schlaf unterstützt Training', body: 'Regelmäßiger, ausreichender Schlaf hängt mit besserer Leistung und Erholung zusammen. Das passt zu deinem Schlaf- und Erholungswert in dieser App – ein Zusammenhang, keine Garantie.', evidence: 'moderate' },
  { id: 'progress', title: 'Fortschritt messen', body: 'Notiere Last, Wiederholungen und RIR. Steigt das geschätzte 1RM über Wochen, funktioniert dein Plan – unabhängig von der Tagesform.', evidence: 'preliminary' },
  { id: 'safety', title: 'Sicherheit', body: 'Wärm dich auf, nutze Safety-Arme oder einen Spotter bei schweren Grundübungen und brich bei stechenden Schmerzen ab. Bei Beschwerden ärztlich abklären lassen.', evidence: 'solid' },
];

/** Anzahl Übungen, deren bestes e1RM in der letzten Einheit niedriger war als in der Einheit davor (mind. 2 Einheiten nötig). Einzelne Einbrüche sind normal (Tagesform). */
export function e1rmDeclines(sessions: LiftSession[]): number {
  const byEx = new Map<string, Array<{ date: string; v: number }>>();
  for (const ss of sessions) for (const e of ss.entries) {
    const v = bestE1rm(e.sets);
    if (v === undefined) continue;
    const a = byEx.get(e.exerciseId) ?? [];
    a.push({ date: ss.date, v });
    byEx.set(e.exerciseId, a);
  }
  let n = 0;
  for (const a of byEx.values()) {
    if (a.length < 2) continue;
    a.sort((x, y) => x.date.localeCompare(y.date));
    if (a[a.length - 1].v < a[a.length - 2].v) n += 1;
  }
  return n;
}

/** Regionen-Last der letzten 7 Tage (gewichtete harte Sätze) für die Körperfigur. */
export function weeklyRegionLoad(sessions: LiftSession[], date: string): ReturnType<typeof regionLoad> {
  const from = addDays(date, -6);
  const entries = sessions
    .filter((s) => s.date >= from && s.date <= date)
    .flatMap((s) => s.entries.map((e) => ({ exerciseId: e.exerciseId, hardSets: e.sets.filter(isHardSet).length })));
  return regionLoad(entries);
}
