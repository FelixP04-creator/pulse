import { addDays, finite, isPlausible, median, robustSigma, type PlausibleKey } from './stats.ts';
import type { DailyMetrics } from './types.ts';

/**
 * Persönliche Basiswerte.
 *
 * Basis = Median der letzten `windowDays` Tage VOR dem betrachteten Tag (der Tag selbst
 * fließt nie in seine eigene Basis ein). Streuung = robuste σ (MAD·1,4826) mit Untergrenze,
 * damit sehr stabile Verläufe keine absurd großen z-Werte erzeugen.
 *
 * Mindestanforderung: MIN_BASELINE_DAYS gültige (plausible) Werte. Darunter gibt es
 * keinen Basiswert – und damit keinen Score.
 */
export const BASELINE_WINDOW_DAYS = 60;
export const MIN_BASELINE_DAYS = 14;

export interface Baseline {
  center: number;
  spread: number;
  n: number;
}

/** Untergrenzen der Streuung (absolut oder relativ zum Median). */
const SPREAD_FLOOR: Partial<Record<PlausibleKey, { abs?: number; rel?: number }>> = {
  restingHr: { abs: 1.5 },
  hrvMs: { rel: 0.06 },
  respRate: { abs: 0.4 },
  spo2: { abs: 0.5 },
  skinTempDevC: { abs: 0.15 },
  vo2max: { abs: 0.5 },
};

export function baselineFor(
  days: DailyMetrics[],
  key: Extract<PlausibleKey, keyof DailyMetrics>,
  asOf: string,
  windowDays = BASELINE_WINDOW_DAYS,
): Baseline | undefined {
  const from = addDays(asOf, -windowDays);
  const vals = finite(
    days
      .filter((d) => d.date >= from && d.date < asOf)
      .map((d) => d[key] as number | undefined),
  ).filter((v) => isPlausible(key, v));
  if (vals.length < MIN_BASELINE_DAYS) return undefined;
  const center = median(vals) as number;
  const sigma = robustSigma(vals) ?? 0;
  const floor = SPREAD_FLOOR[key] ?? {};
  const spread = Math.max(sigma, floor.abs ?? 0, (floor.rel ?? 0) * Math.abs(center), 1e-6);
  return { center, spread, n: vals.length };
}

/** Standardisierte Abweichung (z-Wert), begrenzt auf ±3 gegen Ausreißer. */
export function zScore(value: number, base: Baseline): number {
  const z = (value - base.center) / base.spread;
  return Math.max(-3, Math.min(3, z));
}
