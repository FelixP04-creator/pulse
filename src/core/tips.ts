import type { LensId } from './foodRating.ts';
import { sumNutrients, type Meal } from './nutrition.ts';
import { shiftedClockMinutes } from './sleep.ts';
import type { ScoreResult, SleepNight } from './types.ts';

/**
 * BIOHACKING-TIPPS (Wellness, keine Medizin)
 * ------------------------------------------
 * Datengetriebene, vorsichtige Anregungen zum Ausprobieren. Jeder Tipp trägt eine Evidenzstufe:
 *   solid        – konsistente Befunde, breiter Konsens
 *   moderate     – mehrere Studien, aber begrenzt/uneinheitlich
 *   preliminary  – erste Hinweise, kleine oder überwiegend Beobachtungsstudien
 *   speculative  – Hypothese bzw. Ansatz einer bestimmten Ernährungsperspektive, nicht belegt
 * Keine Dosierungen für Nahrungsergänzungsmittel, keine Medikamentenhinweise, keine Diagnosen.
 */

export type Evidence = 'solid' | 'moderate' | 'preliminary' | 'speculative';
export type TipArea = 'sleep' | 'recovery' | 'strain' | 'nutrition' | 'hydration' | 'stress';

export interface Tip {
  id: string;
  area: TipArea;
  title: string;
  body: string;
  /** Warum gerade jetzt (Bezug zu den eigenen Daten). */
  because: string;
  evidence: Evidence;
  perspective?: LensId;
}

export const EVIDENCE_LABEL: Record<Evidence, string> = { solid: 'Gut belegt', moderate: 'Teilweise belegt', preliminary: 'Erste Hinweise', speculative: 'Spekulativ' };

export interface TipContext {
  asOf: string;
  sleep?: ScoreResult;
  recovery?: ScoreResult;
  strain?: ScoreResult;
  /** Ø Strain der letzten 3 Tage */
  strain3dAvg?: number;
  nights: SleepNight[];
  meals: Meal[];
  hydrationMlToday?: number;
  /** Lokale Stunde (0–23) */
  hourOfDay?: number;
  lens?: LensId;
  /** Sonnenarme Monate (Okt–Mär) auf der Nordhalbkugel */
  month?: number;
}

const val = (r?: ScoreResult) => (r && r.status === 'ok' ? r.value : undefined);

export function generateTips(c: TipContext): Tip[] {
  const tips: Tip[] = [];
  const sleepV = val(c.sleep);
  const recV = val(c.recovery);

  const consistency = c.sleep && c.sleep.status === 'ok' ? c.sleep.components.find((x) => x.key === 'consistency')?.score : undefined;
  if (consistency !== undefined && consistency < 75) {
    tips.push({ id: 'fixed-wake', area: 'sleep', evidence: 'moderate', title: 'Feste Aufstehzeit testen',
      body: 'Probiere eine Woche lang eine möglichst gleiche Aufstehzeit (±30 min) und 10–30 Minuten Tageslicht kurz nach dem Aufstehen. Die Aufstehzeit stabilisiert den Rhythmus meist stärker als die Einschlafzeit.',
      because: `Deine Schlafzeiten waren zuletzt unregelmäßig (Regelmäßigkeit ${Math.round(consistency)}/100).` });
  }

  if (sleepV !== undefined && sleepV < 60) {
    tips.push({ id: 'caffeine-cutoff', area: 'sleep', evidence: 'moderate', title: 'Koffein-Schluss prüfen',
      body: 'Versuche, Koffein etwa 8 Stunden vor der Schlafenszeit zu beenden, und beobachte 1–2 Wochen, ob sich dein Schlafwert verändert. Die Empfindlichkeit ist individuell verschieden.',
      because: `Dein Schlafwert lag bei ${sleepV}.` });
  }

  if (recV !== undefined && recV < 34) {
    tips.push({ id: 'low-recovery-day', area: 'recovery', evidence: 'moderate', title: 'Heute eher locker',
      body: 'Ein niedriger Wert ist kein Krankheitszeichen. Er kann von wenig Schlaf, Alkohol, hartem Training, Stress oder Reisen kommen. Ein lockerer Tag (Spaziergang, Mobilität, leichtes Zone-2-Training) und früheres Zubettgehen sind eine sinnvolle Option. Hältst du dich über mehrere Tage schlecht oder fühlst dich krank, sprich mit einer Ärztin oder einem Arzt.',
      because: `Dein Erholungswert lag bei ${recV} und damit unter deinem üblichen Bereich.` });
    tips.push({ id: 'alcohol', area: 'recovery', evidence: 'solid', title: 'Alkohol und Erholung',
      body: 'Alkohol am Abend senkt in Studien typischerweise die HRV und verschlechtert den Schlaf. Wenn du den Effekt an dir selbst sehen willst, vergleiche Nächte mit und ohne Alkohol in deinen Daten.',
      because: 'Alkohol ist einer der stärksten bekannten Einflussfaktoren auf nächtliche HRV und Ruhepuls.' });
  }

  if (c.strain3dAvg !== undefined && recV !== undefined && c.strain3dAvg >= 12 && recV < 50) {
    tips.push({ id: 'load-vs-recovery', area: 'strain', evidence: 'moderate', title: 'Belastung und Erholung ausgleichen',
      body: 'Nach mehreren fordernden Tagen helfen oft ein bis zwei leichtere Einheiten, Proteinzufuhr verteilt über den Tag und eine etwas längere Schlafphase.',
      because: `Ø Belastung der letzten 3 Tage: ${c.strain3dAvg.toFixed(1)} bei Erholung ${recV}.` });
  }

  const today = c.meals.filter((m) => m.date === c.asOf);
  const breakfast = today.find((m) => m.type === 'breakfast');
  if (breakfast) {
    const p = sumNutrients(breakfast.items).protein;
    if (p < 20) {
      tips.push({ id: 'breakfast-protein', area: 'nutrition', evidence: 'preliminary', title: 'Etwas mehr Protein am Morgen',
        body: 'Eine Verteilung von etwa 20–40 g Protein auf die Hauptmahlzeiten wird häufig für Sättigung und Muskelerhalt empfohlen. Ei, Quark, Joghurt oder Fisch sind einfache Quellen.',
        because: `Dein Frühstück enthielt ca. ${Math.round(p)} g Protein.` });
    }
  }

  const dinner = today.find((m) => m.type === 'dinner' && m.time);
  const avgBed = c.nights.slice(-14).map((n) => shiftedClockMinutes(n.start)).filter((x): x is number => x !== undefined);
  if (dinner?.time && avgBed.length >= 5) {
    const [h, m] = dinner.time.split(':').map(Number);
    const dinnerShifted = (h * 60 + m - 720 + 1440) % 1440;
    const bed = avgBed.reduce((a, b) => a + b, 0) / avgBed.length;
    if (bed - dinnerShifted < 120 && bed - dinnerShifted >= 0) {
      tips.push({ id: 'last-meal', area: 'nutrition', evidence: 'preliminary', title: 'Abstand zwischen Abendessen und Schlaf',
        body: 'Manche Menschen schlafen besser, wenn die letzte größere Mahlzeit 2–3 Stunden vor dem Zubettgehen liegt. Teste es probeweise und vergleiche deinen Schlafwert – es ist keine Regel für alle.',
        because: 'Dein Abendessen lag weniger als 2 Stunden vor deiner üblichen Schlafenszeit.' });
    }
  }

  if ((c.hourOfDay ?? 0) >= 14 && (c.hydrationMlToday ?? 0) < 800) {
    tips.push({ id: 'hydration', area: 'hydration', evidence: 'moderate', title: 'Flüssigkeit über den Tag verteilen',
      body: 'Trinke über den Tag verteilt, statt abends nachzuholen – so stört es den Schlaf weniger. Wie viel du brauchst, hängt von Hitze, Training und Ernährung ab; Durst und helle Urinfarbe sind brauchbare Anhaltspunkte.',
      because: `Bisher erfasst: ${c.hydrationMlToday ?? 0} ml.` });
  }

  if (c.month !== undefined && (c.month >= 10 || c.month <= 3)) {
    tips.push({ id: 'vitamin-d', area: 'nutrition', evidence: 'moderate', title: 'Vitamin D im Winterhalbjahr',
      body: 'In Mitteleuropa bildet die Haut zwischen Oktober und März kaum Vitamin D. Ob du etwas brauchst, lässt sich über den Blutspiegel klären. Lass dich dazu ärztlich beraten, bevor du Nahrungsergänzung nimmst.',
      because: 'Sonnenarme Jahreszeit.' });
  }

  if (recV !== undefined && recV < 50 || (sleepV !== undefined && sleepV < 60)) {
    tips.push({ id: 'breathing', area: 'stress', evidence: 'moderate', title: '5 Minuten langsames Atmen',
      body: 'Atme 5 Minuten lang ruhig etwa 5–6 Mal pro Minute (z. B. 4 s ein, 6 s aus). Das kann den Puls senken und beim Abschalten vor dem Schlafen helfen. Bei Schwindel oder Unwohlsein sofort aufhören.',
      because: 'Ein einfacher, risikoarmer Ansatz zur Entspannung.' });
  }

  // Perspektiven – immer als solche gekennzeichnet
  if (c.lens === 'peat') {
    tips.push({ id: 'peat-protein-combo', area: 'nutrition', evidence: 'speculative', perspective: 'peat', title: 'Perspektive Ray Peat: Zucker nicht „nackt“ essen',
      body: 'Wer in dieser Perspektive Obst, Saft oder Honig nutzt, kann sie mit Protein (z. B. Quark, Käse) kombinieren – das dämpft Blutzuckerspitzen, wie auch gängige Ernährungsberatung rät. Gelatine/Kollagen allein ist ein unvollständiges Protein (wenig Tryptophan) und sollte mit anderen Eiweißquellen ergänzt werden.',
      because: 'Du hast die Peat-Perspektive aktiviert. Ihre Kernthesen sind nicht durch kontrollierte Studien belegt.' });
  }
  if (c.lens === 'primal') {
    tips.push({ id: 'primal-safety', area: 'nutrition', evidence: 'speculative', perspective: 'primal', title: 'Perspektive Aajonus Vonderplanitz: Sicherheit zuerst',
      body: 'Wenn du rohe tierische Lebensmittel isst, sind Frische, lückenlose Kühlkette, saubere Küchenhygiene (getrennte Bretter, Hände waschen) und vertrauenswürdige Quellen entscheidend. Schwangere, Kinder, ältere und immungeschwächte Menschen sollten darauf verzichten. Gesundheitliche Heilversprechen dieser Ernährungsweise sind nicht belegt.',
      because: 'Du hast die Primal-Perspektive aktiviert.' });
  }
  if (c.lens === 'custom') {
    tips.push({ id: 'custom-lens', area: 'nutrition', evidence: 'speculative', perspective: 'custom', title: 'Eigene Perspektive: Beobachte, was bei dir wirkt',
      body: 'Führe einen Ansatz 2–4 Wochen konsequent durch und vergleiche Schlafwert, Erholung und Energie-Check-ins – so findest du heraus, ob er für dich passt, unabhängig von Versprechen anderer.',
      because: 'Du hast eine eigene Perspektive aktiviert.' });
  }

  return tips.slice(0, 6);
}
