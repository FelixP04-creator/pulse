import { MICRO_REFERENCE, sumNutrients, type MealItem, type NutrientKey } from './nutrition.ts';
import type { Evidence } from './tips.ts';

/**
 * BIOVERFÜGBARKEIT – regelbasierte Einordnung
 * --------------------------------------------
 * Die Menge eines Nährstoffs im Essen ist nicht die Menge, die der Körper aufnimmt. Dieses Modul erkennt in einer
 * Mahlzeit bekannte FÖRDERER und HEMMER und beschreibt qualitativ, was das bedeutet. Es rechnet bewusst KEINE
 * „aufgenommenen Milligramm“ aus: Die individuelle Aufnahme hängt von Versorgungsstatus, Darmgesundheit, Medikamenten,
 * Zubereitung und Mahlzeitenkombination ab und lässt sich aus einem Foto nicht bestimmen.
 *
 * Grundlage sind weithin anerkannte Zusammenhänge der Ernährungsphysiologie (z. B. Hämeisen vs. Nicht-Hämeisen,
 * Vitamin C und Eisen, Phytat/Oxalat und Mineralstoffe, Fett und fettlösliche Vitamine, Garen und Carotinoide).
 * Jeder Befund trägt eine Evidenzstufe. Es werden keine Nahrungsergänzungsmittel dosiert.
 */

export type Availability = 'good' | 'mixed' | 'limited';

export interface BioFinding {
  id: string;
  nutrient: NutrientKey | 'protein' | 'carotenoids';
  label: string;
  availability: Availability;
  /** Was in dieser Mahlzeit passiert */
  summary: string;
  /** Konkrete, alltagstaugliche Verbesserung (leer, wenn nichts nötig) */
  improve: string;
  evidence: Evidence;
}

const has = (items: MealItem[], pred: (i: MealItem) => boolean) => items.filter(pred);
const idIn = (ids: string[]) => (i: MealItem) => !!i.foodId && ids.includes(i.foodId);
const named = (list: MealItem[]) => list.map((i) => i.name).slice(0, 3).join(', ');
const mg = (items: MealItem[], k: NutrientKey) => items.reduce((a, i) => a + (i.per100g[k] * i.grams) / 100, 0);

const PHYTATE_RICH = ['oats', 'bread_whole', 'lentils', 'almonds', 'rice'];
const OXALATE_RICH = ['spinach'];
const VIT_C_RICH = ['orange', 'orange_juice', 'broccoli', 'tomato', 'spinach', 'carrot', 'apple'];
const HEME_IRON = ['beef_mince_raw', 'liver_raw', 'chicken', 'salmon', 'shrimp'];
const PLANT_IRON = ['spinach', 'lentils', 'oats', 'bread_whole', 'almonds', 'broccoli', 'rice'];
const FAT_SOURCE = ['olive_oil', 'butter', 'coconut_oil', 'avocado', 'almonds', 'egg', 'salmon', 'gouda', 'milk', 'greek_yogurt', 'beef_mince_raw', 'liver_raw'];
const CAROTENOID = ['carrot', 'tomato', 'spinach', 'broccoli'];
const FAT_SOL_VEG = ['carrot', 'spinach', 'broccoli', 'tomato'];

/** Menge Fett der Mahlzeit in g – Faustwert: ab ~3–5 g gilt die Aufnahme fettlöslicher Stoffe als nicht limitiert. */
const fatG = (items: MealItem[]) => sumNutrients(items).fat;

export function analyzeBioavailability(items: MealItem[], opts: { coffeeOrTeaWithMeal?: boolean } = {}): BioFinding[] {
  const out: BioFinding[] = [];
  const real = items.filter((i) => i.grams > 0);
  if (real.length === 0) return out;
  const coffee = opts.coffeeOrTeaWithMeal || real.some(idIn(['coffee']));

  // --- Eisen ---------------------------------------------------------------
  const heme = has(real, idIn(HEME_IRON));
  const plantIron = has(real, idIn(PLANT_IRON));
  const vitC = has(real, idIn(VIT_C_RICH));
  const calciumHeavy = has(real, idIn(['milk', 'gouda', 'greek_yogurt', 'quark']));
  if (mg(real, 'iron') > 1.5 || plantIron.length > 0) {
    if (plantIron.length > 0 && heme.length === 0) {
      const notes: string[] = ['Pflanzliches Eisen (Nicht-Häm-Eisen) wird meist deutlich schlechter aufgenommen als Eisen aus Fleisch (Häm-Eisen).'];
      let availability: Availability = 'limited';
      if (vitC.length) { notes.push(`${named(vitC)} liefert Vitamin C, das die Aufnahme von Nicht-Häm-Eisen fördert.`); availability = 'mixed'; }
      if (coffee) notes.push('Kaffee/Tee zur Mahlzeit enthält Polyphenole, die die Eisenaufnahme senken können.');
      if (calciumHeavy.length) notes.push('Viel Calcium (Milchprodukte) in derselben Mahlzeit kann die Eisenaufnahme etwas bremsen.');
      const phyt = plantIron.filter(idIn(PHYTATE_RICH));
      if (phyt.length) notes.push(`${named(phyt)} enthält Phytat, das Eisen bindet.`);
      const tips: string[] = [];
      if (!vitC.length) tips.push('eine Vitamin-C-Quelle dazu (Paprika, Zitrusfrüchte, Beeren)');
      if (coffee) tips.push('Kaffee/Tee 1–2 Stunden Abstand zur Mahlzeit');
      if (phyt.length) tips.push('Einweichen, Keimen, Sauerteig oder Fermentation verringern Phytat');
      out.push({ id: 'iron-plant', nutrient: 'iron', label: 'Eisen', availability, summary: notes.join(' '), improve: tips.length ? `Mögliche Verbesserung: ${tips.join('; ')}.` : '', evidence: 'solid' });
    } else if (heme.length > 0) {
      const notes = [`${named(heme)} liefert Häm-Eisen, das vergleichsweise gut aufgenommen wird und weniger von Hemmstoffen abhängt.`];
      if (heme.some(idIn(['liver_raw']))) notes.push('Leber ist sehr eisen- und vitamin-A-reich – nicht täglich in großen Mengen.');
      out.push({ id: 'iron-heme', nutrient: 'iron', label: 'Eisen', availability: 'good', summary: notes.join(' '), improve: coffee ? 'Kaffee/Tee trotzdem besser mit etwas Abstand trinken.' : '', evidence: 'solid' });
    }
  }

  // --- Calcium / Oxalat -----------------------------------------------------
  const oxal = has(real, idIn(OXALATE_RICH));
  if (oxal.length) {
    out.push({
      id: 'calcium-oxalate', nutrient: 'calcium', label: 'Calcium & Eisen aus Spinat', availability: 'limited',
      summary: `${named(oxal)} enthält viel Oxalat. Das bindet Calcium (und Eisen) – nur ein kleiner Teil davon wird aufgenommen, obwohl die Tabellenwerte hoch sind.`,
      improve: 'Calcium besser aus Milchprodukten oder calciumreichem Mineralwasser decken; Spinat zu garen senkt den Oxalatgehalt etwas.', evidence: 'solid',
    });
  } else if (calciumHeavy.length) {
    out.push({
      id: 'calcium-dairy', nutrient: 'calcium', label: 'Calcium', availability: 'good',
      summary: `Calcium aus ${named(calciumHeavy)} wird in der Regel gut aufgenommen.`,
      improve: 'Vitamin D (Sonne, Fisch, Eier) unterstützt die Calcium-Aufnahme; auf mehrere Mahlzeiten verteilt wird es besser genutzt als in einer großen Portion.', evidence: 'solid',
    });
  }

  // --- Zink / Phytat --------------------------------------------------------
  const zincPlant = has(real, (i) => PHYTATE_RICH.includes(i.foodId ?? '') && i.per100g.zinc > 1);
  const zincAnimal = has(real, idIn(['beef_mince_raw', 'liver_raw', 'shrimp', 'egg', 'gouda', 'chicken']));
  if (zincPlant.length && zincAnimal.length === 0) {
    out.push({ id: 'zinc-phytate', nutrient: 'zinc', label: 'Zink', availability: 'limited', summary: `Zink aus ${named(zincPlant)} wird durch Phytat vermindert aufgenommen.`, improve: 'Einweichen, Keimen, Sauerteig oder Fermentation verringern Phytat; tierische Quellen (Fleisch, Meeresfrüchte, Eier, Käse) liefern besser verfügbares Zink.', evidence: 'solid' });
  } else if (zincAnimal.length && mg(real, 'zinc') > 2) {
    out.push({ id: 'zinc-animal', nutrient: 'zinc', label: 'Zink', availability: 'good', summary: `Zink aus ${named(zincAnimal)} ist vergleichsweise gut verfügbar.`, improve: '', evidence: 'solid' });
  }

  // --- Fettlösliche Vitamine & Carotinoide ---------------------------------
  const fatSolVeg = has(real, idIn(FAT_SOL_VEG));
  if (fatSolVeg.length) {
    const fat = fatG(real);
    const fatSources = has(real, idIn(FAT_SOURCE));
    if (fat < 4 || fatSources.length === 0) {
      out.push({ id: 'fat-soluble', nutrient: 'vitA', label: 'Fettlösliche Vitamine & Carotinoide', availability: 'limited',
        summary: `${named(fatSolVeg)} liefert Carotinoide sowie Vitamin K/E, die ohne etwas Fett im Darm deutlich schlechter aufgenommen werden.`,
        improve: 'Etwas Fett dazu (z. B. Olivenöl, Butter, Avocado, Nüsse oder Ei). Garen und Zerkleinern macht Carotinoide aus Möhren und Tomaten zusätzlich besser verfügbar.', evidence: 'solid' });
    } else {
      const carRaw = has(real, (i) => CAROTENOID.includes(i.foodId ?? '') && i.state === 'raw' && (i.foodId === 'carrot' || i.foodId === 'tomato'));
      out.push({ id: 'fat-soluble-ok', nutrient: 'vitA', label: 'Fettlösliche Vitamine & Carotinoide', availability: carRaw.length ? 'mixed' : 'good',
        summary: `Die Mahlzeit enthält Fett – das fördert die Aufnahme von Carotinoiden und Vitamin K/E aus ${named(fatSolVeg)}.`,
        improve: carRaw.length ? `${named(carRaw)} roh: Garen oder Zerkleinern erhöht die Verfügbarkeit von Carotinoiden (Lycopin, Beta-Carotin).` : '', evidence: 'solid' });
    }
  }

  // --- Vitamin D ------------------------------------------------------------
  if (mg(real, 'vitD') > 0.5) {
    out.push({ id: 'vitd-fat', nutrient: 'vitD', label: 'Vitamin D', availability: fatG(real) >= 4 ? 'good' : 'mixed', summary: 'Vitamin D ist fettlöslich und wird zusammen mit etwas Nahrungsfett besser aufgenommen.', improve: fatG(real) >= 4 ? '' : 'Mit einer fetthaltigen Mahlzeit einnehmen/essen.', evidence: 'moderate' });
  }

  // --- Vitamin C / Hitze ----------------------------------------------------
  const vitCCooked = has(real, (i) => i.state === 'cooked' && i.per100g.vitC > 10);
  if (vitCCooked.length) {
    out.push({ id: 'vitc-heat', nutrient: 'vitC', label: 'Vitamin C', availability: 'mixed', summary: `Vitamin C und Folat sind hitze- und wasserempfindlich. Beim Kochen von ${named(vitCCooked)} gehen Teile ins Kochwasser über.`, improve: 'Schonend dünsten oder dämpfen, kurze Garzeit, wenig Wasser – oder einen Teil roh essen.', evidence: 'solid' });
  }

  // --- B12 ------------------------------------------------------------------
  if (mg(real, 'b12') > 1) {
    out.push({ id: 'b12', nutrient: 'b12', label: 'Vitamin B12', availability: 'good', summary: 'Vitamin B12 stammt hier aus tierischen Lebensmitteln und ist darin gut verfügbar. Die Aufnahme hat allerdings eine Obergrenze pro Mahlzeit; mehrere kleinere Mengen über den Tag werden anteilig besser genutzt.', improve: '', evidence: 'moderate' });
  }

  // --- Protein / Kochen von Eiern ------------------------------------------
  const rawEgg = has(real, (i) => i.foodId === 'egg' && i.state === 'raw');
  if (rawEgg.length) {
    out.push({ id: 'raw-egg', nutrient: 'protein', label: 'Protein & Biotin aus rohen Eiern', availability: 'limited',
      summary: 'Das Eiweiß rohen Eis wird beim Menschen deutlich schlechter verdaut als gegartes (eine Studie fand etwa die Hälfte gegenüber rund 90 %). Rohes Eiklar enthält zudem Avidin, das Biotin bindet; Garen hebt das auf.',
      improve: 'Eier zu garen (z. B. weich gekocht) verbessert die Eiweißausnutzung und senkt das Salmonellenrisiko.', evidence: 'moderate' });
  }
  const rawMeat = has(real, (i) => i.state === 'raw' && i.tags.includes('animal') && !i.tags.includes('dairy') && !i.tags.includes('egg'));
  if (rawMeat.length) {
    out.push({ id: 'raw-meat', nutrient: 'protein', label: 'Rohes Fleisch/Fisch', availability: 'mixed',
      summary: `${named(rawMeat)} roh: Die Verdaulichkeit des Proteins ist nicht wesentlich besser als gegart; Garen erhöht sie teils sogar. Das Infektionsrisiko (Keime, Parasiten) ist bei Rohverzehr höher.`,
      improve: 'Wer roh essen möchte, achtet auf frische Ware aus verlässlicher Quelle, lückenlose Kühlung und Küchenhygiene. Für Schwangere, Kinder, Ältere und Immungeschwächte wird davon abgeraten.', evidence: 'moderate' });
  }

  // --- Magnesium / Phytat ---------------------------------------------------
  const magPlant = has(real, (i) => PHYTATE_RICH.includes(i.foodId ?? '') && i.per100g.magnesium > 60);
  if (magPlant.length && mg(real, 'magnesium') > 60) {
    out.push({ id: 'mag', nutrient: 'magnesium', label: 'Magnesium', availability: 'mixed', summary: `Magnesium aus ${named(magPlant)} wird gut genutzt, Phytat kann einen Teil binden. Insgesamt gilt Magnesium aus Vollkorn, Nüssen und Hülsenfrüchten als solide Quelle.`, improve: 'Fermentieren, Einweichen oder Sauerteig verringert Phytat.', evidence: 'moderate' });
  }

  return out;
}

/** Nährstoffe, deren Tabellenwert die Mahlzeit stark „schönt“ (hoher Wert, aber begrenzt verfügbar). */
export function overstatedNutrients(findings: BioFinding[]): string[] {
  return findings.filter((f) => f.availability === 'limited').map((f) => f.label);
}

export function bioSummary(findings: BioFinding[]): string {
  if (findings.length === 0) return 'Für diese Mahlzeit liegen keine auffälligen Förderer oder Hemmer vor.';
  const lim = findings.filter((f) => f.availability === 'limited').length;
  const good = findings.filter((f) => f.availability === 'good').length;
  return `${good} Nährstoffgruppe(n) gut verfügbar, ${lim} eingeschränkt. Qualitative Einschätzung – keine Messung der tatsächlichen Aufnahme.`;
}

/** Referenz: nur zur Anzeige „Tabellenwert vs. Verfügbarkeit“. */
export const refFor = (k: NutrientKey) => MICRO_REFERENCE[k];
