import { addDays, clamp, isPlausible, mean, round, stdev } from './stats.ts';
import type { Component, Provenance, Quality, ScoreResult, SleepNight, UserProfile } from './types.ts';

/**
 * SCHLAF – Berechnungen
 * ---------------------
 * Schlafbedarf (Schätzung, keine Diagnose):
 *   1. persönliches Ziel (profile.sleepTargetMin), sonst
 *   2. allgemeine Altersempfehlung (Mittelpunkt des empfohlenen Bereichs):
 *        < 18 Jahre: 540 min (8–10 h) · 18–64: 480 min (7–9 h) · ≥ 65: 450 min (7–8 h)
 *      ohne Altersangabe: 480 min.
 *
 * Schlafwert (0–100) = gewichteter Mittelwert verfügbarer Teilwerte:
 *   Dauer        60 %  = min(100, Schlafzeit / Bedarf · 100)
 *   Konsistenz   25 %  = 100 · (1 − min(1, σ_Zeiten / 90 min)), σ_Zeiten = Mittel aus σ(Bettzeit) und σ(Aufwachzeit)
 *                        über die letzten 14 Tage, benötigt ≥ 5 Nächte
 *   Effizienz    15 %  = Schlafzeit / Zeit im Bett – nur wenn die Quelle die Schlafzeit tatsächlich liefert
 * Fehlende Teilwerte → Gewichte werden anteilig umverteilt, Qualität sinkt.
 */

export const CONSISTENCY_WINDOW_DAYS = 14;
export const MIN_NIGHTS_CONSISTENCY = 5;
export const CONSISTENCY_SIGMA_FULL_PENALTY_MIN = 90;

export function sleepNeedMin(profile: UserProfile = {}): { minutes: number; provenance: Provenance; basis: string } {
  if (profile.sleepTargetMin && profile.sleepTargetMin > 0) {
    return { minutes: profile.sleepTargetMin, provenance: 'manual', basis: 'Dein persönliches Schlafziel' };
  }
  const age = profile.age;
  if (age !== undefined && age < 18) return { minutes: 540, provenance: 'estimated', basis: 'Allgemeine Empfehlung für unter 18-Jährige (8–10 h)' };
  if (age !== undefined && age >= 65) return { minutes: 450, provenance: 'estimated', basis: 'Allgemeine Empfehlung ab 65 Jahren (7–8 h)' };
  return { minutes: 480, provenance: 'estimated', basis: age === undefined ? 'Allgemeine Empfehlung für Erwachsene (7–9 h), ohne Altersangabe' : 'Allgemeine Empfehlung für Erwachsene (7–9 h)' };
}

/** Minuten seit 12:00 Uhr (kontinuierlich über Mitternacht). Liest die lokale Uhrzeit direkt aus dem ISO-String. */
export function shiftedClockMinutes(iso: string): number | undefined {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return undefined;
  const min = Number(m[1]) * 60 + Number(m[2]);
  return (min - 720 + 1440) % 1440;
}

export function asleepMinutes(n: SleepNight): number | undefined {
  const v = n.asleepMin ?? n.inBedMin;
  return isPlausible('sleepAsleepMin', v) ? v : undefined;
}

export function sleepEfficiency(n: SleepNight): number | undefined {
  if (n.asleepMin === undefined || n.asleepIsEstimate || n.inBedMin <= 0) return undefined;
  if (n.asleepMin > n.inBedMin + 1) return undefined; // unplausibel
  return clamp(n.asleepMin / n.inBedMin, 0, 1);
}

export interface Consistency {
  /** 0–100 */
  score: number;
  sigmaBedMin: number;
  sigmaWakeMin: number;
  nights: number;
}

export function sleepConsistency(nights: SleepNight[], asOf: string): Consistency | undefined {
  const from = addDays(asOf, -(CONSISTENCY_WINDOW_DAYS - 1));
  const win = nights.filter((n) => n.date >= from && n.date <= asOf);
  const bed = win.map((n) => shiftedClockMinutes(n.start)).filter((x): x is number => x !== undefined);
  const wake = win.map((n) => shiftedClockMinutes(n.end)).filter((x): x is number => x !== undefined);
  if (win.length < MIN_NIGHTS_CONSISTENCY || bed.length < MIN_NIGHTS_CONSISTENCY || wake.length < MIN_NIGHTS_CONSISTENCY) return undefined;
  const sb = stdev(bed) as number;
  const sw = stdev(wake) as number;
  const sigma = (sb + sw) / 2;
  return {
    score: round(100 * (1 - clamp(sigma / CONSISTENCY_SIGMA_FULL_PENALTY_MIN, 0, 1)), 1),
    sigmaBedMin: round(sb, 1),
    sigmaWakeMin: round(sw, 1),
    nights: win.length,
  };
}

export function sleepScore(nights: SleepNight[], asOf: string, profile: UserProfile = {}): ScoreResult {
  const last = nights.find((n) => n.date === asOf);
  const asleep = last ? asleepMinutes(last) : undefined;
  if (!last || asleep === undefined) {
    return { status: 'insufficient', reason: 'Für diese Nacht liegt keine verwertbare Schlafaufzeichnung vor.', have: 0, need: 1 };
  }
  const need = sleepNeedMin(profile);
  const comps: Array<Omit<Component, 'weight'> & { w: number }> = [];
  const durScore = clamp((asleep / need.minutes) * 100, 0, 100);
  const durProv: Provenance = last.asleepIsEstimate || last.asleepMin === undefined ? 'estimated' : 'measured';
  comps.push({
    key: 'duration',
    label: 'Schlafdauer',
    score: round(durScore, 1),
    w: 0.6,
    detail: `${Math.round(asleep)} min Schlaf bei einem Bedarf von ca. ${need.minutes} min (${need.basis}).`,
    provenance: durProv,
  });
  const cons = sleepConsistency(nights, asOf);
  if (cons) {
    comps.push({
      key: 'consistency',
      label: 'Regelmäßigkeit',
      score: cons.score,
      w: 0.25,
      detail: `Streuung deiner Bettzeiten ±${Math.round(cons.sigmaBedMin)} min, der Aufwachzeiten ±${Math.round(cons.sigmaWakeMin)} min (letzte ${cons.nights} Nächte).`,
      provenance: 'calculated',
    });
  }
  const eff = sleepEfficiency(last);
  if (eff !== undefined) {
    comps.push({
      key: 'efficiency',
      label: 'Schlafeffizienz',
      score: round(eff * 100, 1),
      w: 0.15,
      detail: `${Math.round(eff * 100)} % der Zeit im Bett wurde laut Gerät geschlafen.`,
      provenance: 'calculated',
    });
  }
  const wsum = comps.reduce((a, c) => a + c.w, 0);
  const components: Component[] = comps.map(({ w, ...c }) => ({ ...c, weight: round(w / wsum, 4) }));
  const value = round(components.reduce((a, c) => a + c.score * c.weight, 0));
  const notes: string[] = [];
  if (!cons) notes.push(`Regelmäßigkeit fehlt: mindestens ${MIN_NIGHTS_CONSISTENCY} Nächte in den letzten ${CONSISTENCY_WINDOW_DAYS} Tagen nötig.`);
  if (eff === undefined) notes.push('Schlafeffizienz nicht berechenbar, da die Datenquelle keine verlässliche Schlafzeit zusätzlich zur Bettzeit liefert.');
  if (durProv === 'estimated') notes.push('Schlafzeit wurde aus der Bettzeit angenähert und ist daher eine Schätzung.');
  const quality: Quality = comps.length === 3 && durProv === 'measured' ? 'high' : comps.length >= 2 ? 'medium' : 'low';
  return { status: 'ok', value, provenance: durProv === 'measured' ? 'calculated' : 'estimated', quality, components, notes };
}

export interface SleepDebt {
  /** Summe der Unterschreitungen in Minuten (nur gezählte Nächte). */
  debtMin: number;
  nightsCounted: number;
  needMin: number;
}

/** Schlafdefizit der letzten 7 Tage (informativ, nicht „abzuarbeiten“). Benötigt ≥ 4 Nächte. */
export function sleepDebt(nights: SleepNight[], asOf: string, profile: UserProfile = {}): SleepDebt | undefined {
  const from = addDays(asOf, -6);
  const need = sleepNeedMin(profile).minutes;
  const vals = nights
    .filter((n) => n.date >= from && n.date <= asOf)
    .map((n) => asleepMinutes(n))
    .filter((x): x is number => x !== undefined);
  if (vals.length < 4) return undefined;
  return { debtMin: Math.round(vals.reduce((a, v) => a + Math.max(0, need - v), 0)), nightsCounted: vals.length, needMin: need };
}

export interface SleepPeriodSummary {
  nights: number;
  avgAsleepMin?: number;
  avgBedShifted?: number;
  avgWakeShifted?: number;
}

export function sleepSummary(nights: SleepNight[], asOf: string, days: number): SleepPeriodSummary {
  const from = addDays(asOf, -(days - 1));
  const win = nights.filter((n) => n.date >= from && n.date <= asOf);
  const a = win.map(asleepMinutes).filter((x): x is number => x !== undefined);
  const b = win.map((n) => shiftedClockMinutes(n.start)).filter((x): x is number => x !== undefined);
  const w = win.map((n) => shiftedClockMinutes(n.end)).filter((x): x is number => x !== undefined);
  return { nights: win.length, avgAsleepMin: mean(a), avgBedShifted: mean(b), avgWakeShifted: mean(w) };
}

/** Formatiert „shifted“-Minuten als Uhrzeit "HH:MM". */
export function formatShiftedClock(shifted: number): string {
  const min = (Math.round(shifted) + 720) % 1440;
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
