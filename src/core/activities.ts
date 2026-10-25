import { round } from './stats.ts';

/**
 * AKTIVITÄTEN – Katalog und grobe Energieschätzung
 * ------------------------------------------------
 * MET-Werte sind gerundete Richtwerte nach Art des „Compendium of Physical Activities“. Tatsächliche Werte hängen von Tempo,
 * Gelände, Fitness und Körper ab. Die Kalorienangabe ist deshalb immer eine Schätzung (Genauigkeit grob ±30 % oder schlechter)
 * und wird nur mit eingetragenem Körpergewicht berechnet.
 */

export type ActivityCategory = 'ausdauer' | 'kraft' | 'sport' | 'beweglichkeit' | 'alltag';
export interface ActivityKind { id: string; label: string; category: ActivityCategory; met: Record<'leicht' | 'mittel' | 'hart', number> }

export const ACTIVITY_KINDS: readonly ActivityKind[] = [
  { id: 'walking', label: 'Gehen', category: 'alltag', met: { leicht: 2.8, mittel: 3.5, hart: 4.5 } },
  { id: 'hiking', label: 'Wandern', category: 'ausdauer', met: { leicht: 5, mittel: 6, hart: 7.5 } },
  { id: 'running', label: 'Laufen', category: 'ausdauer', met: { leicht: 7, mittel: 9.5, hart: 11.5 } },
  { id: 'cycling', label: 'Radfahren', category: 'ausdauer', met: { leicht: 4, mittel: 7, hart: 10 } },
  { id: 'swimming', label: 'Schwimmen', category: 'ausdauer', met: { leicht: 5, mittel: 7, hart: 9.5 } },
  { id: 'rowing', label: 'Rudern', category: 'ausdauer', met: { leicht: 4.5, mittel: 7, hart: 9 } },
  { id: 'strength', label: 'Krafttraining', category: 'kraft', met: { leicht: 3, mittel: 4.5, hart: 6 } },
  { id: 'hiit', label: 'Intervalltraining (HIIT)', category: 'kraft', met: { leicht: 6, mittel: 8, hart: 10 } },
  { id: 'football', label: 'Fußball', category: 'sport', met: { leicht: 5, mittel: 7, hart: 9 } },
  { id: 'tennis', label: 'Tennis / Padel', category: 'sport', met: { leicht: 5, mittel: 7, hart: 8.5 } },
  { id: 'climbing', label: 'Klettern', category: 'sport', met: { leicht: 5, mittel: 7, hart: 8.5 } },
  { id: 'dance', label: 'Tanzen', category: 'sport', met: { leicht: 3.5, mittel: 5, hart: 7 } },
  { id: 'yoga', label: 'Yoga', category: 'beweglichkeit', met: { leicht: 2, mittel: 2.8, hart: 4 } },
  { id: 'mobility', label: 'Mobilität / Dehnen', category: 'beweglichkeit', met: { leicht: 2, mittel: 2.5, hart: 3 } },
  { id: 'other', label: 'Sonstiges', category: 'alltag', met: { leicht: 3, mittel: 4.5, hart: 6 } },
];

export const CATEGORY_LABEL: Record<ActivityCategory, string> = { ausdauer: 'Ausdauer', kraft: 'Kraft', sport: 'Sport', beweglichkeit: 'Beweglichkeit', alltag: 'Alltag' };
export type Intensity = 'leicht' | 'mittel' | 'hart';

export const kindById = (id: string): ActivityKind | undefined => ACTIVITY_KINDS.find((k) => k.id === id);

/** Zuordnung der Anstrengung (RPE 1–10) zur Intensitätsstufe. */
export function intensityFromRpe(rpe: number): Intensity {
  return rpe <= 4 ? 'leicht' : rpe <= 7 ? 'mittel' : 'hart';
}

/** kcal ≈ MET · kg · Stunden (Brutto, inkl. Ruheumsatz). Ohne gültiges Gewicht oder Dauer → undefined. */
export function estimateKcal(kindId: string, intensity: Intensity, durationMin: number, weightKg: number | undefined): number | undefined {
  const k = kindById(kindId);
  if (!k || !(durationMin > 0) || !(durationMin <= 1440) || !weightKg || !(weightKg >= 25 && weightKg <= 300)) return undefined;
  return round(k.met[intensity] * weightKg * (durationMin / 60));
}

/** Findet die Aktivität zum gespeicherten Typtext (Workout.type), z. B. „Laufen“. */
export function kindFromLabel(label: string): ActivityKind | undefined {
  const l = label.trim().toLowerCase();
  return ACTIVITY_KINDS.find((k) => k.label.toLowerCase() === l);
}
