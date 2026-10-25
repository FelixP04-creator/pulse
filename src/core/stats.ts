/** Kleine, getestete Statistikfunktionen. Alle ignorieren nicht-endliche Werte. */

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export const finite = (xs: Array<number | undefined | null>): number[] =>
  xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));

export function mean(xs: number[]): number | undefined {
  const v = finite(xs);
  if (v.length === 0) return undefined;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function median(xs: number[]): number | undefined {
  const v = finite(xs).sort((a, b) => a - b);
  if (v.length === 0) return undefined;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Stichproben-Standardabweichung (n−1). */
export function stdev(xs: number[]): number | undefined {
  const v = finite(xs);
  if (v.length < 2) return undefined;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}

/** Median absolute deviation, skaliert (×1.4826) damit vergleichbar mit σ bei Normalverteilung. */
export function robustSigma(xs: number[]): number | undefined {
  const v = finite(xs);
  const med = median(v);
  if (med === undefined || v.length < 2) return undefined;
  const mad = median(v.map((x) => Math.abs(x - med)));
  return mad === undefined ? undefined : mad * 1.4826;
}

export function round(x: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

/** Plausibilitätsbereiche zur Erkennung von Sensorartefakten – KEINE medizinischen Grenzwerte. */
export const PLAUSIBLE = {
  restingHr: [25, 140],
  hrvMs: [5, 400],
  respRate: [5, 45],
  spo2: [70, 100],
  skinTempDevC: [-5, 5],
  steps: [0, 100_000],
  activeMinutes: [0, 1440],
  azm: [0, 1440],
  vo2max: [10, 90],
  sleepAsleepMin: [20, 960],
} as const;

export type PlausibleKey = keyof typeof PLAUSIBLE;

export function isPlausible(key: PlausibleKey, v: number | undefined): v is number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return false;
  const [lo, hi] = PLAUSIBLE[key];
  return v >= lo && v <= hi;
}

// ---- Datumshilfen (kalenderbasiert, zeitzonenunabhängig) -----------------

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Alle Tage im Intervall [from, to] inklusive. */
export function dateRange(from: string, to: string): string[] {
  const n = daysBetween(from, to);
  return n < 0 ? [] : Array.from({ length: n + 1 }, (_, i) => addDays(from, i));
}
