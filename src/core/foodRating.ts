import { clamp, round } from './stats.ts';
import { MICRO_KEYS, MICRO_REFERENCE, NUTRIENT_META, sumNutrients, type FoodTag, type MealItem } from './nutrition.ts';
import type { Component } from './types.ts';

/**
 * ESSENS-BEWERTUNG (Nährstoffdichte-Rating, 0–100 → 1–5 Sterne)
 * ----------------------------------------------------------------
 * Nach gängigen Ernährungsleitlinien (u. a. DGE/WHO-Größenordnungen) – ein app-eigenes, transparentes Modell,
 * KEINE medizinische Aussage und KEIN Urteil über einzelne Lebensmittel („gut/schlecht“). Eine einzelne Mahlzeit
 * sagt wenig; entscheidend ist das Gesamtbild über Wochen.
 *
 * Teilwerte (0–100) und Gewichte:
 *   Protein            20 %  = min(100, g Protein je 100 kcal / 8 · 100)
 *   Ballaststoffe      15 %  = min(100, g Ballaststoffe je 100 kcal / 2 · 100)
 *   Mikronährstoffe    30 %  = Mittel über 12 Vitamine/Mineralstoffe von min(1, Anteil an der EU-Tagesreferenz / Energieanteil
 *                              an 2000 kcal) – also „deckt das Essen seinen Energieanteil der Tagesreferenz?“
 *   Verarbeitungsgrad  15 %  = 100 · (1 − Energieanteil ultra-verarbeitet − 0,5 · Energieanteil verarbeitet)
 *   Zugesetzter Zucker 10 %  = 100 − 50 · (Energieanteil Zucker aus verarbeiteten Produkten / 10 %), min. 0
 *   Gesättigte Fette   10 %  = 100 − 50 · (Energieanteil gesättigter Fette / 10 %), min. 0
 * Sterne = Punkte / 20, auf halbe Sterne gerundet, mindestens 1.
 * Unter 30 kcal wird nicht bewertet (z. B. Wasser, Kaffee).
 */

export const RATING_MODEL_VERSION = 'nutrient-density-v1';
export const MIN_KCAL_FOR_RATING = 30;

export interface FoodRatingOk {
  status: 'ok';
  /** 0–100 */
  score: number;
  /** 1–5 in Halbschritten */
  stars: number;
  label: string;
  components: Component[];
  /** Neutrale, kurze Hinweise – nie beschämend. */
  highlights: string[];
  gaps: string[];
}
export interface FoodRatingNone {
  status: 'insufficient';
  reason: string;
}
export type FoodRating = FoodRatingOk | FoodRatingNone;

export function starsFor(score: number): number {
  return Math.max(1, Math.round((score / 20) * 2) / 2);
}

export function ratingLabel(score: number): string {
  if (score >= 80) return 'Sehr nährstoffreich';
  if (score >= 60) return 'Nährstoffreich';
  if (score >= 40) return 'Solide Basis';
  if (score >= 20) return 'Eher energiedicht';
  return 'Wenig Nährstoffe pro Kalorie';
}

export function rateItems(items: MealItem[]): FoodRating {
  const real = items.filter((i) => i.grams > 0);
  const t = sumNutrients(real);
  if (t.kcal < MIN_KCAL_FOR_RATING) return { status: 'insufficient', reason: 'Zu wenig Energie für eine sinnvolle Bewertung (z. B. nur Getränke).' };

  const kcalOf = (it: MealItem) => (it.per100g.kcal * it.grams) / 100;
  const share = (pred: (i: MealItem) => boolean) => real.filter(pred).reduce((a, i) => a + kcalOf(i), 0) / t.kcal;

  const proteinPer100 = (t.protein / t.kcal) * 100;
  const fiberPer100 = (t.fiber / t.kcal) * 100;
  const energyShare = t.kcal / 2000;
  const microScores = MICRO_KEYS.map((k) => clamp(t[k] / (MICRO_REFERENCE[k] as number) / energyShare, 0, 1));
  const microAvg = microScores.reduce((a, b) => a + b, 0) / microScores.length;
  const ultra = share((i) => i.processing === 'ultra');
  const proc = share((i) => i.processing === 'processed');
  const addedSugarKcal = real.filter((i) => i.processing !== 'whole').reduce((a, i) => a + (i.per100g.sugar * i.grams) / 100 * 4, 0);
  const sugarShare = addedSugarKcal / t.kcal;
  const satShare = (t.satFat * 9) / t.kcal;

  const raw: Array<Omit<Component, 'weight'> & { w: number }> = [
    { key: 'protein', label: 'Protein', w: 0.2, score: round(clamp((proteinPer100 / 8) * 100, 0, 100), 1), provenance: 'calculated', detail: `${round(t.protein, 0)} g Protein (${round(proteinPer100, 1)} g je 100 kcal)` },
    { key: 'fiber', label: 'Ballaststoffe', w: 0.15, score: round(clamp((fiberPer100 / 2) * 100, 0, 100), 1), provenance: 'calculated', detail: `${round(t.fiber, 1)} g Ballaststoffe` },
    { key: 'micros', label: 'Vitamine & Mineralstoffe', w: 0.3, score: round(microAvg * 100, 1), provenance: 'estimated', detail: 'Anteil der EU-Tagesreferenz im Verhältnis zur Energie (12 Mikronährstoffe)' },
    { key: 'processing', label: 'Verarbeitungsgrad', w: 0.15, score: round(clamp(100 * (1 - ultra - 0.5 * proc), 0, 100), 1), provenance: 'calculated', detail: `${Math.round(ultra * 100)} % der Energie aus stark verarbeiteten Produkten` },
    { key: 'sugar', label: 'Zugesetzter Zucker', w: 0.1, score: round(clamp(100 - 50 * (sugarShare / 0.1), 0, 100), 1), provenance: 'estimated', detail: `${Math.round(sugarShare * 100)} % der Energie als Zucker aus verarbeiteten Produkten` },
    { key: 'satfat', label: 'Gesättigte Fette', w: 0.1, score: round(clamp(100 - 50 * (satShare / 0.1), 0, 100), 1), provenance: 'calculated', detail: `${Math.round(satShare * 100)} % der Energie` },
  ];
  const components: Component[] = raw.map(({ w, ...c }) => ({ ...c, weight: w }));
  const score = round(components.reduce((a, c) => a + c.score * c.weight, 0));

  const highlights: string[] = [];
  const gaps: string[] = [];
  if (components[0].score >= 80) highlights.push('Viel Protein im Verhältnis zur Energie.');
  if (components[1].score >= 70) highlights.push('Gute Ballaststoffmenge.');
  if (components[3].score >= 90) highlights.push('Überwiegend wenig verarbeitete Lebensmittel.');
  const strongMicros = MICRO_KEYS.filter((k) => t[k] / (MICRO_REFERENCE[k] as number) / energyShare >= 1).map((k) => NUTRIENT_META[k].label);
  if (strongMicros.length) highlights.push(`Deckt seinen Energieanteil bei: ${strongMicros.slice(0, 4).join(', ')}${strongMicros.length > 4 ? ' u. a.' : ''}.`);
  if (components[0].score < 40) gaps.push('Wenig Protein – eine Eiweißquelle würde die Mahlzeit ergänzen.');
  if (components[1].score < 30) gaps.push('Wenig Ballaststoffe – Gemüse, Hülsenfrüchte oder Vollkorn könnten helfen.');
  if (components[4].score < 50) gaps.push('Relativ viel Zucker aus verarbeiteten Produkten.');
  const weakMicros = MICRO_KEYS.filter((k) => t[k] / (MICRO_REFERENCE[k] as number) / energyShare < 0.25).map((k) => NUTRIENT_META[k].label);
  if (weakMicros.length >= 5) gaps.push('Viele Vitamine/Mineralstoffe sind hier kaum enthalten – über den Tag ausgleichbar.');

  return { status: 'ok', score, stars: starsFor(score), label: ratingLabel(score), components, highlights, gaps };
}

// ---------------------------------------------------------------------------
// Sicherheitshinweise (unabhängig von jeder Ernährungsperspektive)
// ---------------------------------------------------------------------------

export interface SafetyNote {
  id: string;
  text: string;
}

export function safetyNotes(items: MealItem[]): SafetyNote[] {
  const notes: SafetyNote[] = [];
  const rawAnimal = items.filter((i) => i.state === 'raw' && i.tags.includes('animal'));
  if (rawAnimal.length) {
    notes.push({
      id: 'raw-animal',
      text: 'Rohe tierische Lebensmittel (Fleisch, Fisch, Eier, unpasteurisierte Milch) können Krankheitserreger wie Salmonellen, Listerien oder EHEC enthalten. Behörden wie das BfR raten besonders Schwangeren, Kleinkindern, älteren und immungeschwächten Menschen davon ab.',
    });
  }
  const liver = items.find((i) => i.tags.includes('organ') && (i.per100g.vitA * i.grams) / 100 > 2000);
  if (liver) {
    notes.push({ id: 'vit-a', text: `${liver.name}: sehr hoher Vitamin-A-Gehalt. In der Schwangerschaft wird vom Verzehr von Leber abgeraten; auch sonst sollte sie nicht täglich in größeren Mengen gegessen werden.` });
  }
  const sodium = items.reduce((a, i) => a + (i.per100g.sodiumMg * i.grams) / 100, 0);
  if (sodium > 2000) notes.push({ id: 'sodium', text: 'Diese Mahlzeit enthält bereits viel Natrium (Salz).' });
  return notes;
}

// ---------------------------------------------------------------------------
// Ernährungs-Perspektiven (Ray Peat, Aajonus Vonderplanitz, eigene Regeln)
// ---------------------------------------------------------------------------

export type LensId = 'peat' | 'primal' | 'custom';

export const LENS_META: Record<LensId, { name: string; blurb: string; caveat: string }> = {
  peat: {
    name: 'Ray Peat',
    blurb: 'Schwerpunkte laut gängigen Zusammenfassungen: leicht verdauliche Kohlenhydrate (Obst, Saft, Honig, Zucker), Milchprodukte/Calcium, Schalentiere, Gelatine, gesättigte Fette, möglichst wenig mehrfach ungesättigte Fette (Samenöle, Nüsse).',
    caveat: 'Peats Thesen sind durch kontrollierte Studien nicht belegt und in der Ernährungswissenschaft umstritten. Viel freier Zucker und Saft ohne Ballaststoffe gelten nach gängigen Leitlinien als eher ungünstig. Die Anzeige beschreibt nur Übereinstimmung mit der Perspektive – kein Gesundheitsurteil.',
  },
  primal: {
    name: 'Aajonus Vonderplanitz („Primal Diet“)',
    blurb: 'Schwerpunkte laut Wikipedia: überwiegend rohe tierische Lebensmittel (rohes Fleisch, rohe Eier, Rohmilchprodukte, rohe Fette) sowie Rohsäfte und unerhitzter Honig.',
    caveat: 'Die Ernährungsweise wurde nie in kontrollierten Studien geprüft; Heilversprechen (z. B. bei Krebs) sind nicht belegt. Rohe tierische Lebensmittel bergen ein reales Infektionsrisiko. Wer krank, schwanger oder immungeschwächt ist, sollte sie meiden und ärztlichen Rat einholen. Die Anzeige beschreibt nur Übereinstimmung – keine Empfehlung.',
  },
  custom: {
    name: 'Mace Woodville / eigene Regeln',
    blurb: 'Zu Mace Woodville konnte ich keine verlässlichen, überprüfbaren Quellen finden (zwei Suchen ohne Treffer). Deshalb ordne ich ihm keine Aussagen zu. Trage hier die Prinzipien, denen du folgen willst, selbst ein: Lebensmittel oder Gruppen, die du bevorzugen oder meiden möchtest.',
    caveat: 'Die Bewertung folgt ausschließlich deinen eigenen Regeln und gibt keine Position von Mace Woodville wieder.',
  },
};

export interface LensFit {
  lens: LensId;
  status: 'ok' | 'unconfigured';
  /** 0–100 Übereinstimmung */
  score?: number;
  points: string[];
  caveats: string[];
}

const PEAT_FRIENDLY: FoodTag[] = ['fruit', 'juice', 'dairy', 'seafood', 'organ', 'honey', 'egg', 'fat_saturated'];

export function peatFit(items: MealItem[]): LensFit {
  const t = sumNutrients(items);
  const caveats = [LENS_META.peat.caveat];
  if (t.kcal < MIN_KCAL_FOR_RATING) return { lens: 'peat', status: 'ok', points: ['Zu wenig Energie für eine Einordnung.'], caveats };
  const pufaShare = (t.pufa * 9) / t.kcal;
  const pufaScore = 100 * (1 - clamp(pufaShare / 0.06, 0, 1));
  const friendlyKcal = items.filter((i) => i.processing !== 'ultra' && (i.tags.some((g) => PEAT_FRIENDLY.includes(g)) || i.id.startsWith('sugar') || i.foodId === 'sugar' || i.foodId === 'gelatin')).reduce((a, i) => a + (i.per100g.kcal * i.grams) / 100, 0);
  const friendly = friendlyKcal / t.kcal;
  const points = [`Mehrfach ungesättigte Fette: ${round(pufaShare * 100, 1)} % der Energie (Perspektive: möglichst niedrig).`, `${Math.round(friendly * 100)} % der Energie stammen aus Lebensmitteln, die in dieser Perspektive bevorzugt werden.`];
  const rawLeafy = items.find((i) => i.state === 'raw' && i.tags.includes('vegetable') && /spinat|kohl|brokkoli|salat/i.test(i.name));
  if (rawLeafy) points.push(`${rawLeafy.name}: Peat rät nach gängigen Zusammenfassungen eher zu gegartem als zu rohem Gemüse.`);
  if (t.fiber / t.kcal * 100 < 0.5 && t.sugar > 25) caveats.push('Viel Zucker bei kaum Ballaststoffen: nach gängigen Leitlinien eher ungünstig.');
  return { lens: 'peat', status: 'ok', score: round(0.5 * pufaScore + 0.5 * friendly * 100), points, caveats };
}

export function primalFit(items: MealItem[]): LensFit {
  const t = sumNutrients(items);
  const caveats = [LENS_META.primal.caveat];
  if (t.kcal < MIN_KCAL_FOR_RATING) return { lens: 'primal', status: 'ok', points: ['Zu wenig Energie für eine Einordnung.'], caveats };
  const aligned = (i: MealItem) => {
    if (i.processing === 'ultra') return false;
    if (i.tags.includes('animal') && !i.tags.includes('dairy') && !i.tags.includes('egg') && i.state !== 'raw') return false; // Fleisch/Fisch: roh
    if ((i.tags.includes('dairy') || i.tags.includes('egg')) && i.state !== 'raw') return false;
    if (i.tags.includes('sweetener') && !i.tags.includes('honey')) return false;
    return true;
  };
  const kcal = (i: MealItem) => (i.per100g.kcal * i.grams) / 100;
  const share = items.filter(aligned).reduce((a, i) => a + kcal(i), 0) / t.kcal;
  const points = [`${Math.round(share * 100)} % der Energie stammen aus Lebensmitteln, die dieser Perspektive entsprechen (unverarbeitet, tierische Produkte roh).`];
  const cooked = items.filter((i) => i.tags.includes('animal') && i.state === 'cooked');
  if (cooked.length) points.push(`Gegart statt roh: ${cooked.map((c) => c.name).join(', ')}.`);
  return { lens: 'primal', status: 'ok', score: round(share * 100), points, caveats };
}

export interface CustomRules {
  /** Lebensmittel-IDs oder Tags, die bevorzugt werden */
  prefer: string[];
  /** Lebensmittel-IDs oder Tags, die gemieden werden */
  avoid: string[];
}

export function customFit(items: MealItem[], rules: CustomRules): LensFit {
  const caveats = [LENS_META.custom.caveat];
  if (rules.prefer.length === 0 && rules.avoid.length === 0) {
    return { lens: 'custom', status: 'unconfigured', points: ['Noch keine eigenen Regeln festgelegt.'], caveats };
  }
  const t = sumNutrients(items);
  if (t.kcal < MIN_KCAL_FOR_RATING) return { lens: 'custom', status: 'ok', points: ['Zu wenig Energie für eine Einordnung.'], caveats };
  const hit = (i: MealItem, list: string[]) => list.some((x) => i.foodId === x || (i.tags as string[]).includes(x));
  const kcal = (i: MealItem) => (i.per100g.kcal * i.grams) / 100;
  const pref = items.filter((i) => hit(i, rules.prefer)).reduce((a, i) => a + kcal(i), 0) / t.kcal;
  const avoid = items.filter((i) => hit(i, rules.avoid)).reduce((a, i) => a + kcal(i), 0) / t.kcal;
  return { lens: 'custom', status: 'ok', score: round(clamp(50 + 50 * (pref - avoid), 0, 100)), points: [`${Math.round(pref * 100)} % der Energie aus bevorzugten, ${Math.round(avoid * 100)} % aus zu meidenden Lebensmitteln.`], caveats };
}

export function lensFit(lens: LensId, items: MealItem[], rules: CustomRules = { prefer: [], avoid: [] }): LensFit {
  return lens === 'peat' ? peatFit(items) : lens === 'primal' ? primalFit(items) : customFit(items, rules);
}
