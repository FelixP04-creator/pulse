import { baselineFor, MIN_BASELINE_DAYS, zScore } from './baselines.ts';
import { asleepMinutes, sleepConsistency, sleepNeedMin } from './sleep.ts';
import { clamp, isPlausible, round } from './stats.ts';
import type { Component, DailyMetrics, Provenance, Quality, ScoreResult, SleepNight, UserProfile } from './types.ts';

/**
 * RECOVERY (Erholungswert, 0–100) – app-eigenes, nicht-diagnostisches Modell
 * -------------------------------------------------------------------------
 * Teilwerte (jeweils 0–100):
 *   HRV            40 %  = 50 + 20·z   (z = (HRV − Basis)/Streuung, auf ±2,5 begrenzt → 0…100); höher = besser
 *   Ruhepuls       25 %  = 50 − 20·z   (z analog; niedriger als die eigene Basis = besser)
 *   Schlafdauer    25 %  = min(100, Schlafzeit / Bedarf · 100)
 *   Regelmäßigkeit 10 %  = Schlafkonsistenz (siehe sleep.ts); fehlt sie, werden Gewichte umverteilt
 *
 * Persönliche Basis: Median + robuste Streuung der letzten 60 Tage vor dem Tag (≥ 14 gültige Werte).
 * Ohne HRV-Basis, Ruhepuls-Basis, Tageswerte oder Schlaf der Nacht wird KEIN Score berechnet.
 *
 * Die Bänder (niedrig/mittel/hoch) sind reine Anzeigekategorien relativ zur eigenen Basis. Ein niedriger Wert
 * ist keine Aussage über Gesundheit oder Krankheit – Schlafmangel, Alkohol, Training, Stress, Reisen oder
 * Sensorrauschen können ihn beeinflussen.
 */

export const RECOVERY_WEIGHTS = { hrv: 0.4, rhr: 0.25, sleep: 0.25, consistency: 0.1 } as const;
const Z_CAP = 2.5;

export type RecoveryBand = 'low' | 'moderate' | 'high';

export function recoveryBand(score: number): RecoveryBand {
  return score < 34 ? 'low' : score < 67 ? 'moderate' : 'high';
}

export function recoveryScore(
  days: DailyMetrics[],
  nights: SleepNight[],
  asOf: string,
  profile: UserProfile = {},
): ScoreResult {
  const today = days.find((d) => d.date === asOf);
  const night = nights.find((n) => n.date === asOf);
  const hrvBase = baselineFor(days, 'hrvMs', asOf);
  const rhrBase = baselineFor(days, 'restingHr', asOf);
  const asleep = night ? asleepMinutes(night) : undefined;

  const missing: string[] = [];
  if (!isPlausible('hrvMs', today?.hrvMs)) missing.push('HRV von heute');
  if (!isPlausible('restingHr', today?.restingHr)) missing.push('Ruhepuls von heute');
  if (asleep === undefined) missing.push('Schlaf der letzten Nacht');
  if (!hrvBase) missing.push(`HRV-Basis (mind. ${MIN_BASELINE_DAYS} Tage)`);
  if (!rhrBase) missing.push(`Ruhepuls-Basis (mind. ${MIN_BASELINE_DAYS} Tage)`);
  if (missing.length > 0) {
    return {
      status: 'insufficient',
      reason: `Nicht genügend Daten: ${missing.join(', ')}.`,
      have: 5 - missing.length,
      need: 5,
    };
  }

  const hrv = today!.hrvMs as number;
  const rhr = today!.restingHr as number;
  const zH = Math.max(-Z_CAP, Math.min(Z_CAP, zScore(hrv, hrvBase!)));
  const zR = Math.max(-Z_CAP, Math.min(Z_CAP, zScore(rhr, rhrBase!)));
  const need = sleepNeedMin(profile).minutes;
  const sleepProv: Provenance = night!.asleepIsEstimate || night!.asleepMin === undefined ? 'estimated' : 'calculated';

  const raw: Array<Omit<Component, 'weight'> & { w: number }> = [
    {
      key: 'hrv',
      label: 'HRV',
      score: round(clamp(50 + 20 * zH, 0, 100), 1),
      w: RECOVERY_WEIGHTS.hrv,
      detail: `${round(hrv, 0)} ms im Vergleich zu deinem Ausgangswert von ${round(hrvBase!.center, 0)} ms (${hrvBase!.n} Tage).`,
      provenance: 'calculated',
    },
    {
      key: 'rhr',
      label: 'Ruhepuls',
      score: round(clamp(50 - 20 * zR, 0, 100), 1),
      w: RECOVERY_WEIGHTS.rhr,
      detail: `${round(rhr, 0)} bpm im Vergleich zu deinem Ausgangswert von ${round(rhrBase!.center, 0)} bpm (${rhrBase!.n} Tage).`,
      provenance: 'calculated',
    },
    {
      key: 'sleep',
      label: 'Schlafdauer',
      score: round(clamp((asleep! / need) * 100, 0, 100), 1),
      w: RECOVERY_WEIGHTS.sleep,
      detail: `${Math.round(asleep!)} min Schlaf bei einem geschätzten Bedarf von ${need} min.`,
      provenance: sleepProv,
    },
  ];
  const cons = sleepConsistency(nights, asOf);
  if (cons) {
    raw.push({
      key: 'consistency',
      label: 'Schlafregelmäßigkeit',
      score: cons.score,
      w: RECOVERY_WEIGHTS.consistency,
      detail: `Bett- und Aufwachzeiten schwanken im Mittel um ±${Math.round((cons.sigmaBedMin + cons.sigmaWakeMin) / 2)} min.`,
      provenance: 'calculated',
    });
  }
  const wsum = raw.reduce((a, c) => a + c.w, 0);
  const components: Component[] = raw.map(({ w, ...c }) => ({ ...c, weight: round(w / wsum, 4) }));
  const value = round(components.reduce((a, c) => a + c.score * c.weight, 0));

  const notes: string[] = [];
  if (!cons) notes.push('Schlafregelmäßigkeit fehlt (zu wenige Nächte) – die anderen Teilwerte wurden stärker gewichtet.');
  if (sleepProv === 'estimated') notes.push('Die Schlafzeit ist angenähert, weil die Quelle keine genaue Schlafzeit liefert.');
  const quality: Quality = cons && sleepProv === 'calculated' && hrvBase!.n >= 30 && rhrBase!.n >= 30 ? 'high' : hrvBase!.n >= 21 ? 'medium' : 'low';
  return { status: 'ok', value, provenance: 'calculated', quality, components, notes };
}

/** Faktoren sortiert nach Einfluss auf die Abweichung von 50 (für „wichtigste Einflussfaktoren“). */
export function recoveryDrivers(r: ScoreResult): Component[] {
  if (r.status !== 'ok') return [];
  return [...r.components].sort((a, b) => Math.abs(b.score - 50) * b.weight - Math.abs(a.score - 50) * a.weight);
}
