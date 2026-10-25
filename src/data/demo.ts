import { addDays, clamp, round } from '../core/stats.ts';
import type { DailyMetrics, SleepNight, Workout } from '../core/types.ts';

/**
 * DEMO-DATEN
 * ----------
 * Vollständig synthetisch, deterministisch (gleicher Seed → gleiche Daten) und in der UI immer als „Demo“ gekennzeichnet.
 * Enthält absichtlich einzelne Lücken, damit der Umgang mit fehlenden Daten sichtbar getestet wird.
 */

export interface Dataset {
  origin: 'demo' | 'google-health' | 'manual';
  days: DailyMetrics[];
  nights: SleepNight[];
  workouts: Workout[];
  /** Zeitpunkt der letzten erfolgreichen Synchronisierung (ISO) – bei Demo-Daten nicht vorhanden. */
  lastSyncAt?: string;
}

/** Kleiner deterministischer Zufallsgenerator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Annähernd normalverteilt (Summe von 4 Gleichverteilungen, σ≈1). */
const gauss = (r: () => number) => ((r() + r() + r() + r()) - 2) * 1.7320508;

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(Math.round(min % 60))}`;

export function generateDemoDataset(today: string, numDays = 400, seed = 42): Dataset {
  const r = rng(seed);
  const days: DailyMetrics[] = [];
  const nights: SleepNight[] = [];
  const workouts: Workout[] = [];
  const types = ['Laufen', 'Radfahren', 'Krafttraining', 'Schwimmen', 'Intervalltraining'];

  let prevStrain = 0;
  for (let i = numDays - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = So
    const weekend = dow === 0 || dow === 6;
    const progress = 1 - i / numDays; // 0 → 1 über den Zeitraum

    // Training (≈ 4 Tage/Woche)
    let strainToday = 0;
    if (r() < (weekend ? 0.55 : 0.5) && i > 0) {
      const type = types[Math.floor(r() * types.length)];
      const dur = Math.round(35 + r() * 55);
      const hard = r() < 0.3;
      const z: [number, number, number, number, number] = hard
        ? [Math.round(dur * 0.1), Math.round(dur * 0.25), Math.round(dur * 0.3), Math.round(dur * 0.25), Math.round(dur * 0.1)]
        : [Math.round(dur * 0.25), Math.round(dur * 0.45), Math.round(dur * 0.25), Math.round(dur * 0.05), 0];
      strainToday = z.reduce((a, m, k) => a + m * (k + 1), 0);
      workouts.push({
        id: `demo-w-${date}`,
        source: 'device',
        type,
        start: `${date}T${hm(r() < 0.5 ? 7 * 60 + 15 : 18 * 60 + 10)}:00`,
        durationMin: dur,
        avgHr: Math.round(128 + (hard ? 22 : 8) + gauss(r) * 3),
        maxHr: Math.round(158 + (hard ? 22 : 6) + gauss(r) * 3),
        zoneMinutes: z,
      });
    }

    // Schlaf der Nacht vor `date`
    const bedMin = 22 * 60 + 50 + (weekend ? 55 : 0) + gauss(r) * 25;
    const sleepLen = clamp(7 * 60 + 25 + (weekend ? 35 : 0) + gauss(r) * 38 - (prevStrain > 350 ? -10 : 0), 300, 640);
    const awake = Math.round(25 + r() * 25);
    const asleep = Math.round(sleepLen - awake);
    const skipNight = r() < 0.025 && i > 3; // gelegentlich fehlt eine Nacht
    if (!skipNight) {
      const startDate = addDays(date, -1);
      const startClock = bedMin >= 1440 ? hm(bedMin - 1440) : hm(bedMin);
      const startDay = bedMin >= 1440 ? date : startDate;
      const endMin = bedMin + sleepLen;
      const deep = Math.round(asleep * (0.16 + gauss(r) * 0.02));
      const rem = Math.round(asleep * (0.21 + gauss(r) * 0.02));
      nights.push({
        date,
        start: `${startDay}T${startClock}:00`,
        end: `${date}T${hm(endMin - 1440)}:00`,
        inBedMin: Math.round(sleepLen),
        asleepMin: asleep,
        stages: { awakeMin: awake, deepMin: deep, remMin: rem, lightMin: asleep - deep - rem },
      });
    }

    // Tageswerte
    const fatigue = clamp(prevStrain / 400, 0, 1.2);
    const sleepFactor = clamp((asleep - 420) / 120, -1.5, 1);
    const skipDay = r() < 0.03 && i > 3;
    if (!skipDay) {
      const steps = Math.round(clamp(8200 + gauss(r) * 2600 + (strainToday > 0 ? 2200 : 0), 1500, 22000));
      const active = Math.round(clamp(38 + gauss(r) * 14 + strainToday * 0.12, 5, 200));
      days.push({
        date,
        restingHr: round(clamp(54 - progress * 1.5 + fatigue * 2.2 - sleepFactor * 1.0 + gauss(r) * 1.1, 40, 80), 0),
        hrvMs: round(clamp(63 + progress * 5 - fatigue * 7 + sleepFactor * 4 + gauss(r) * 5, 20, 140), 0),
        respRate: round(clamp(15 + gauss(r) * 0.4, 11, 20), 1),
        spo2: round(clamp(96.5 + gauss(r) * 0.6, 91, 100), 1),
        skinTempDevC: round(gauss(r) * 0.25 + fatigue * 0.1, 2),
        steps,
        activeMinutes: active,
        azm: Math.round(clamp(active * 0.55 + strainToday * 0.08, 0, 300)),
        vo2max: i % 2 === 0 ? round(43.5 + progress * 1.6 + gauss(r) * 0.2, 1) : undefined,
      });
    }
    prevStrain = strainToday;
  }

  // VO2max wird vom Gerät nicht täglich geliefert – Lücken sind normal.
  return { origin: 'demo', days, nights, workouts };
}
