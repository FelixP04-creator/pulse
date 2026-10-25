import type { Region } from './exercises.ts';

/**
 * KÖRPERFIGUR (stilisiert) – Geometrie für die Muskel-Anzeige
 * -----------------------------------------------------------
 * Koordinatensystem 200 × 380. Es sind nur die Formen der linken Bildhälfte (x < 100) hinterlegt; die rechte Hälfte entsteht durch
 * Spiegelung an x = 100. Pfade nutzen ausschließlich absolute Befehle (M L C Z) mit Koordinatenpaaren.
 * Die Figur ist eine vereinfachte Darstellung, keine anatomische Zeichnung; Lage und Größe der Regionen sind Annäherungen.
 */

export type View = 'front' | 'back';
export const BODY_W = 200;
export const BODY_H = 380;

/** Spiegelt einen Pfad (nur absolute M/L/C/Z mit Koordinatenpaaren) an x = 100. */
export function mirrorPath(d: string): string {
  return d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_m, x: string, y: string) => `${round1(BODY_W - Number(x))} ${y}`);
}
const round1 = (n: number): number => Math.round(n * 10) / 10;

const HEAD = 'M 100 12 C 109 12 116 19 116 28 C 116 37 109 44 100 44 C 91 44 84 37 84 28 C 84 19 91 12 100 12 Z';
const NECK = 'M 92 42 L 92 58 L 108 58 L 108 42 Z';
const TORSO = 'M 98 54 L 80 58 C 66 62 58 68 56 80 L 60 104 L 74 110 C 76 130 78 152 82 172 L 98 176 Z';
const ARM = 'M 56 74 C 46 78 40 98 38 118 C 36 138 35 150 33 162 C 29 182 25 200 22 212 L 32 216 C 37 200 42 184 48 168 C 54 150 57 132 61 112 C 63 98 63 84 61 76 Z';
const LEG = 'M 98 172 L 72 176 C 68 210 68 240 72 262 C 72 290 74 320 78 346 L 80 368 L 92 368 L 92 346 C 94 320 96 290 94 262 C 96 240 98 210 98 172 Z';

/** Grundfigur (Silhouette): linke Teile werden gespiegelt, Kopf und Hals einmalig. */
export const SILHOUETTE: { once: string[]; halves: string[] } = { once: [HEAD, NECK], halves: [TORSO, ARM, LEG] };

const DELT_CAP = 'M 74 68 C 64 68 56 74 54 84 C 52 92 52 98 54 104 L 62 104 C 64 94 70 86 78 80 Z';
const DELT_SIDE = 'M 54 72 C 46 76 42 88 42 100 L 50 102 C 50 92 52 84 58 76 Z';
const ARM_OUTER = 'M 41 104 C 38 116 36 130 35 148 L 45 148 C 46 134 48 118 50 104 Z';
const ARM_INNER = 'M 50 104 C 48 118 45 134 45 148 L 54 148 C 55 134 58 120 61 106 Z';
const FOREARM = 'M 44 152 L 38 176 L 32 214 L 24 211 L 30 176 L 36 154 Z';

export const REGION_SHAPES: Record<View, Array<{ region: Region; d: string }>> = {
  front: [
    { region: 'traps_upper', d: 'M 96 52 L 84 56 L 66 66 L 76 66 L 96 62 Z' },
    { region: 'delt_side', d: DELT_SIDE },
    { region: 'delt_front', d: DELT_CAP },
    { region: 'chest_clav', d: 'M 98 70 L 82 72 C 78 74 76 78 76 82 L 98 82 Z' },
    { region: 'chest_sternal', d: 'M 98 82 L 76 82 C 75 88 76 93 80 97 L 98 97 Z' },
    { region: 'chest_lower', d: 'M 98 97 L 80 97 C 84 103 90 106 98 106 Z' },
    { region: 'abs_rectus', d: 'M 97 110 L 97 172 L 89 172 C 87 152 87 128 89 110 Z' },
    { region: 'obliques', d: 'M 87 110 L 79 114 C 75 132 78 152 83 170 L 88 170 C 86 152 86 128 87 110 Z' },
    { region: 'biceps_short', d: ARM_INNER },
    { region: 'biceps_long', d: 'M 41 104 C 38 116 36 128 35.6 130 L 46 130 C 46 122 48 114 50 104 Z' },
    { region: 'brachialis', d: 'M 36 130 C 35.6 138 35 144 35 148 L 45 148 C 45 142 45.5 136 46 130 Z' },
    { region: 'brachioradialis', d: 'M 35 150 L 36 154 L 30 176 L 36 176 L 44 152 Z' },
    { region: 'forearm_flex', d: 'M 36 178 L 33 214 L 24 211 L 30 178 Z' },
    { region: 'quads_vasti', d: 'M 72 178 C 68 208 68 240 72 262 L 82 262 C 82 236 82 206 84 176 Z' },
    { region: 'quads_rf', d: 'M 84 176 C 82 206 82 236 82 262 L 90 262 C 91 236 91 206 92 176 Z' },
    { region: 'adductors', d: 'M 92 176 C 91 206 91 236 90 262 L 95 255 C 97 240 97 210 97 176 Z' },
  ],
  back: [
    { region: 'traps_upper', d: 'M 98 50 L 90 54 L 66 66 L 80 78 L 98 90 Z' },
    { region: 'delt_side', d: DELT_SIDE },
    { region: 'delt_rear', d: DELT_CAP },
    { region: 'back_mid', d: 'M 98 90 L 80 78 L 78 96 C 84 104 92 108 98 110 Z' },
    { region: 'back_lats', d: 'M 78 98 C 72 112 74 132 86 152 L 98 152 L 98 110 C 90 108 82 104 78 98 Z' },
    { region: 'erectors', d: 'M 97 112 L 97 170 L 90 170 C 88 150 88 130 91 112 Z' },
    { region: 'tri_short', d: ARM_OUTER },
    { region: 'tri_long', d: ARM_INNER },
    { region: 'forearm_ext', d: FOREARM },
    { region: 'glutes', d: 'M 98 172 L 98 212 C 86 218 74 208 72 190 C 72 178 84 170 98 172 Z' },
    { region: 'abductors', d: 'M 73 182 C 76 172 88 168 97 172 L 97 182 C 88 180 80 182 74 192 Z' },
    { region: 'hams', d: 'M 97 218 C 88 222 76 218 72 224 C 69 238 71 252 75 262 L 95 262 C 96 246 97 230 97 218 Z' },
    { region: 'calf_gastroc', d: 'M 82 268 C 76 280 75 296 79 312 L 92 312 C 94 296 94 280 92 268 Z' },
    { region: 'calf_soleus', d: 'M 79 312 C 79 322 81 330 84 338 L 90 338 C 92 330 94 322 92 312 Z' },
  ],
};

export interface BodyShape { region?: Region; d: string }

/** Alle Formen einer Ansicht (links + gespiegelt rechts) in Zeichenreihenfolge. */
export function bodyShapes(view: View): { base: string[]; regions: Array<{ region: Region; d: string }> } {
  const base = [...SILHOUETTE.once, ...SILHOUETTE.halves, ...SILHOUETTE.halves.map(mirrorPath)];
  const regions = REGION_SHAPES[view].flatMap((s) => [{ region: s.region, d: s.d }, { region: s.region, d: mirrorPath(s.d) }]);
  return { base, regions };
}

/** Welche Ansicht zeigt eine Region (eine Region kann in beiden vorkommen, z. B. Schulter-Seite). */
export function viewsOf(region: Region): View[] {
  return (['front', 'back'] as View[]).filter((v) => REGION_SHAPES[v].some((s) => s.region === region));
}

/** Farbintensität 0–1 für eine Last (gewichtete harte Sätze), gesättigt bei `full`. */
export function heat(load: number | undefined, full = 8): number {
  if (!load || load <= 0) return 0;
  return Math.min(1, Math.max(0.18, load / full));
}
