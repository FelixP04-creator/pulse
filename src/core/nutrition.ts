/**
 * ERNÄHRUNG – Datenmodell, Lebensmitteldatenbank, Summen
 * ------------------------------------------------------
 * Alle Nährwerte sind pro 100 g angegeben und stammen aus der Größenordnung gängiger Nährwertdatenbanken
 * (USDA FoodData Central / BLS). Es sind NÄHERUNGSWERTE für typische Produkte, keine Laborwerte: Sorte, Zubereitung,
 * Reife und Marke verändern sie spürbar. Portionsgewichte aus Fotos sind Schätzungen mit hoher Unsicherheit.
 *
 * Referenzwerte für Mikronährstoffe: EU-Nährstoffbezugswerte (NRV, VO (EU) 1169/2011) bzw. gängige Referenzaufnahmen.
 * Sie dienen nur der Einordnung und sind keine individuelle Bedarfsaussage.
 */

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Frühstück', lunch: 'Mittagessen', dinner: 'Abendessen', snack: 'Snacks' };

export const NUTRIENT_KEYS = [
  'kcal', 'protein', 'carbs', 'fat', 'sugar', 'fiber', 'satFat', 'pufa', 'sodiumMg',
  'vitA', 'vitC', 'vitD', 'vitE', 'vitK', 'b12', 'folate', 'iron', 'zinc', 'magnesium', 'potassium', 'calcium',
] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export type Nutrients = Record<NutrientKey, number>;

export const NUTRIENT_META: Record<NutrientKey, { label: string; unit: string }> = {
  kcal: { label: 'Energie', unit: 'kcal' }, protein: { label: 'Protein', unit: 'g' }, carbs: { label: 'Kohlenhydrate', unit: 'g' },
  fat: { label: 'Fett', unit: 'g' }, sugar: { label: 'davon Zucker', unit: 'g' }, fiber: { label: 'Ballaststoffe', unit: 'g' },
  satFat: { label: 'gesättigte Fettsäuren', unit: 'g' }, pufa: { label: 'mehrfach ungesättigte FS', unit: 'g' }, sodiumMg: { label: 'Natrium', unit: 'mg' },
  vitA: { label: 'Vitamin A', unit: 'µg' }, vitC: { label: 'Vitamin C', unit: 'mg' }, vitD: { label: 'Vitamin D', unit: 'µg' },
  vitE: { label: 'Vitamin E', unit: 'mg' }, vitK: { label: 'Vitamin K', unit: 'µg' }, b12: { label: 'Vitamin B12', unit: 'µg' },
  folate: { label: 'Folat', unit: 'µg' }, iron: { label: 'Eisen', unit: 'mg' }, zinc: { label: 'Zink', unit: 'mg' },
  magnesium: { label: 'Magnesium', unit: 'mg' }, potassium: { label: 'Kalium', unit: 'mg' }, calcium: { label: 'Calcium', unit: 'mg' },
};

/** EU-Nährstoffbezugswerte (Tagesreferenz). */
export const MICRO_REFERENCE: Partial<Record<NutrientKey, number>> = {
  vitA: 800, vitC: 80, vitD: 5, vitE: 12, vitK: 75, b12: 2.5, folate: 200, iron: 14, zinc: 10, magnesium: 375, potassium: 2000, calcium: 800,
};
export const MICRO_KEYS = Object.keys(MICRO_REFERENCE) as NutrientKey[];

export const zeroNutrients = (): Nutrients => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as Nutrients;

export type Processing = 'whole' | 'processed' | 'ultra';
export type FoodTag =
  | 'fruit' | 'juice' | 'dairy' | 'animal' | 'organ' | 'seafood' | 'vegetable' | 'legume' | 'nut' | 'grain'
  | 'fat_saturated' | 'oil_seed' | 'sweetener' | 'egg' | 'drink' | 'honey';

export interface FoodEntry {
  id: string;
  name: string;
  /** zusätzliche Suchbegriffe (DE/EN) */
  aliases: string[];
  tags: FoodTag[];
  processing: Processing;
  /** Zustand, auf den sich die Werte beziehen */
  basis: 'roh' | 'gegart' | 'unverarbeitet' | 'zubereitet';
  defaultGrams: number;
  per100g: Nutrients;
}

const N = (a: number[]): Nutrients => {
  if (a.length !== NUTRIENT_KEYS.length) throw new Error(`Nährwertzeile hat ${a.length} statt ${NUTRIENT_KEYS.length} Werte`);
  return Object.fromEntries(NUTRIENT_KEYS.map((k, i) => [k, a[i]])) as Nutrients;
};

// Reihenfolge: kcal, protein, carbs, fat, sugar, fiber, satFat, pufa, sodiumMg, vitA, vitC, vitD, vitE, vitK, b12, folate, iron, zinc, magnesium, potassium, calcium
const F = (id: string, name: string, aliases: string[], tags: FoodTag[], processing: Processing, basis: FoodEntry['basis'], defaultGrams: number, v: number[]): FoodEntry =>
  ({ id, name, aliases, tags, processing, basis, defaultGrams, per100g: N(v) });

export const FOODS: readonly FoodEntry[] = [
  F('egg', 'Hühnerei', ['ei', 'eier', 'egg', 'rührei', 'spiegelei'], ['animal', 'egg'], 'whole', 'unverarbeitet', 60, [143, 12.6, 0.7, 9.5, 0.4, 0, 3.1, 1.9, 142, 160, 0, 2.0, 1.0, 0.3, 0.89, 47, 1.75, 1.29, 12, 138, 56]),
  F('oats', 'Haferflocken', ['hafer', 'oats', 'porridge', 'müsli'], ['grain'], 'whole', 'roh', 50, [379, 13.2, 67.7, 6.5, 1, 10.1, 1.1, 2.2, 6, 0, 0, 0, 0.4, 2, 0, 32, 4.3, 3.6, 138, 362, 52]),
  F('milk', 'Vollmilch', ['milch', 'milk', 'rohmilch'], ['dairy', 'animal', 'drink'], 'whole', 'unverarbeitet', 250, [61, 3.2, 4.8, 3.3, 4.8, 0, 1.9, 0.2, 43, 46, 0, 0.1, 0.1, 0.3, 0.45, 5, 0.03, 0.37, 10, 132, 113]),
  F('greek_yogurt', 'Griechischer Joghurt (3,5–10 % Fett)', ['joghurt', 'yogurt', 'yoghurt', 'skyr'], ['dairy', 'animal'], 'whole', 'unverarbeitet', 150, [97, 9, 3.9, 5, 3.6, 0, 3.3, 0.2, 35, 27, 0.5, 0, 0.1, 0.2, 0.75, 7, 0.04, 0.5, 11, 141, 110]),
  F('quark', 'Magerquark', ['quark', 'topfen', 'cottage cheese', 'hüttenkäse'], ['dairy', 'animal'], 'whole', 'unverarbeitet', 150, [67, 12, 4, 0.3, 4, 0, 0.2, 0, 40, 2, 0, 0, 0, 0, 0.5, 15, 0.1, 0.4, 11, 150, 100]),
  F('gouda', 'Käse (Gouda)', ['käse', 'cheese', 'gouda', 'emmentaler'], ['dairy', 'animal'], 'processed', 'unverarbeitet', 30, [356, 25, 2.2, 27, 2.2, 0, 17.6, 0.7, 819, 165, 0, 0.5, 0.2, 2.3, 1.5, 21, 0.2, 3.9, 29, 121, 700]),
  F('banana', 'Banane', ['banana'], ['fruit'], 'whole', 'roh', 120, [89, 1.1, 22.8, 0.3, 12.2, 2.6, 0.1, 0.1, 1, 3, 8.7, 0, 0.1, 0.5, 0, 20, 0.26, 0.15, 27, 358, 5]),
  F('apple', 'Apfel', ['apple'], ['fruit'], 'whole', 'roh', 150, [52, 0.3, 13.8, 0.2, 10.4, 2.4, 0, 0.1, 1, 3, 4.6, 0, 0.2, 2.2, 0, 3, 0.1, 0.04, 5, 107, 6]),
  F('orange', 'Orange', ['apfelsine', 'mandarine', 'clementine'], ['fruit'], 'whole', 'roh', 150, [47, 0.9, 11.8, 0.1, 9.4, 2.4, 0, 0, 0, 11, 53, 0, 0.2, 0, 0, 30, 0.1, 0.07, 10, 181, 40]),
  F('orange_juice', 'Orangensaft', ['oj', 'orange juice', 'saft', 'fruchtsaft'], ['fruit', 'juice', 'drink'], 'processed', 'unverarbeitet', 250, [45, 0.7, 10.4, 0.2, 8.4, 0.2, 0, 0.1, 1, 10, 50, 0, 0.04, 0.1, 0, 30, 0.2, 0.05, 11, 200, 11]),
  F('carrot', 'Karotte', ['möhre', 'karotten', 'carrot', 'mohrrübe'], ['vegetable'], 'whole', 'roh', 80, [41, 0.9, 9.6, 0.2, 4.7, 2.8, 0, 0.1, 69, 835, 5.9, 0, 0.7, 13.2, 0, 19, 0.3, 0.24, 12, 320, 33]),
  F('broccoli', 'Brokkoli (gegart)', ['broccoli'], ['vegetable'], 'whole', 'gegart', 150, [35, 2.4, 7.2, 0.4, 1.4, 3.3, 0.1, 0.2, 41, 77, 65, 0, 1.5, 141, 0, 108, 0.7, 0.7, 21, 293, 40]),
  F('spinach', 'Spinat (roh)', ['spinat', 'spinach', 'blattspinat'], ['vegetable'], 'whole', 'roh', 60, [23, 2.9, 3.6, 0.4, 0.4, 2.2, 0.1, 0.2, 79, 469, 28, 0, 2.0, 483, 0, 194, 2.7, 0.5, 79, 558, 99]),
  F('tomato', 'Tomate', ['tomaten', 'tomato'], ['vegetable', 'fruit'], 'whole', 'roh', 100, [18, 0.9, 3.9, 0.2, 2.6, 1.2, 0, 0.1, 5, 42, 14, 0, 0.5, 7.9, 0, 15, 0.3, 0.17, 11, 237, 10]),
  F('potato', 'Kartoffeln (gekocht)', ['kartoffel', 'potato', 'pellkartoffel', 'salzkartoffeln'], ['vegetable'], 'whole', 'gegart', 200, [87, 1.9, 20, 0.1, 0.9, 1.8, 0, 0, 4, 0, 13, 0, 0.04, 2, 0, 9, 0.3, 0.3, 22, 328, 5]),
  F('rice', 'Weißer Reis (gegart)', ['reis', 'rice'], ['grain'], 'processed', 'gegart', 180, [130, 2.7, 28, 0.3, 0.1, 0.4, 0.1, 0.1, 1, 0, 0, 0, 0.04, 0.1, 0, 3, 0.2, 0.5, 12, 35, 10]),
  F('pasta', 'Nudeln (gegart)', ['pasta', 'spaghetti', 'nudeln', 'penne'], ['grain'], 'processed', 'gegart', 200, [158, 5.8, 31, 0.9, 0.6, 1.8, 0.2, 0.3, 1, 0, 0, 0, 0.1, 0.3, 0, 7, 0.5, 0.5, 18, 44, 7]),
  F('bread_whole', 'Vollkornbrot', ['brot', 'bread', 'brötchen', 'toast'], ['grain'], 'processed', 'zubereitet', 60, [247, 13, 41, 3.4, 6, 7, 0.7, 1.6, 450, 0, 0, 0, 0.5, 7, 0, 42, 2.4, 1.8, 82, 250, 73]),
  F('lentils', 'Linsen (gegart)', ['linsen', 'lentils', 'hülsenfrüchte'], ['legume'], 'whole', 'gegart', 150, [116, 9, 20, 0.4, 1.8, 7.9, 0, 0.2, 2, 0, 1.5, 0, 0.1, 1.7, 0, 181, 3.3, 1.3, 36, 369, 19]),
  F('chicken', 'Hähnchenbrust (gegart)', ['huhn', 'hähnchen', 'chicken', 'geflügel', 'pute'], ['animal'], 'whole', 'gegart', 150, [165, 31, 0, 3.6, 0, 0, 1.0, 0.8, 74, 6, 0, 0.1, 0.3, 0.3, 0.34, 4, 1.0, 1.0, 29, 256, 15]),
  F('beef_mince_raw', 'Rinderhack, 10 % Fett (roh)', ['rind', 'hack', 'hackfleisch', 'beef', 'tartar', 'steak'], ['animal'], 'whole', 'roh', 150, [176, 20, 0, 10, 0, 0, 4.1, 0.4, 66, 0, 0, 0.1, 0.2, 1.5, 2.4, 6, 2.2, 4.8, 18, 318, 12]),
  F('liver_raw', 'Rinderleber (roh)', ['leber', 'liver', 'innereien'], ['animal', 'organ'], 'whole', 'roh', 60, [135, 20.4, 3.9, 3.6, 0, 0, 1.2, 0.6, 69, 4968, 1.3, 1.2, 0.4, 3.1, 59.3, 253, 4.9, 4, 18, 313, 5]),
  F('salmon', 'Lachs (Zucht, gegart)', ['lachs', 'salmon', 'fisch', 'fish', 'forelle'], ['animal', 'seafood'], 'whole', 'gegart', 150, [206, 22, 0, 12, 0, 0, 2.5, 3.9, 61, 12, 0, 11, 3.5, 0.1, 3.2, 25, 0.34, 0.64, 30, 384, 15]),
  F('shrimp', 'Garnelen (gegart)', ['garnele', 'shrimp', 'krabbe', 'meeresfrüchte', 'schalentiere'], ['animal', 'seafood'], 'whole', 'gegart', 100, [99, 24, 0.2, 0.3, 0, 0, 0.1, 0.1, 111, 54, 0, 0, 1.3, 0.3, 1.1, 3, 0.5, 1.6, 35, 259, 64]),
  F('avocado', 'Avocado', ['avocado'], ['fruit'], 'whole', 'roh', 100, [160, 2, 8.5, 14.7, 0.7, 6.7, 2.1, 1.8, 7, 7, 10, 0, 2.1, 21, 0, 81, 0.55, 0.64, 29, 485, 12]),
  F('almonds', 'Mandeln', ['mandel', 'almonds', 'nüsse', 'nuss', 'walnuss', 'cashew'], ['nut'], 'whole', 'unverarbeitet', 30, [579, 21.2, 21.6, 49.9, 4.4, 12.5, 3.8, 12.3, 1, 0, 0, 0, 25.6, 0, 0, 44, 3.7, 3.1, 270, 733, 269]),
  F('olive_oil', 'Olivenöl', ['olive oil', 'öl'], ['oil_seed'], 'processed', 'unverarbeitet', 10, [884, 0, 0, 100, 0, 0, 14, 11, 2, 0, 0, 0, 14.4, 60.2, 0, 0, 0.56, 0, 0, 1, 1]),
  F('butter', 'Butter', ['butter'], ['dairy', 'animal', 'fat_saturated'], 'processed', 'unverarbeitet', 10, [717, 0.9, 0.1, 81, 0.1, 0, 51, 3, 11, 684, 0, 1.5, 2.3, 7, 0.17, 3, 0.02, 0.09, 2, 24, 24]),
  F('coconut_oil', 'Kokosöl', ['kokosöl', 'coconut oil', 'kokosfett'], ['fat_saturated'], 'processed', 'unverarbeitet', 10, [862, 0, 0, 100, 0, 0, 82, 1.8, 0, 0, 0, 0, 0.1, 0.5, 0, 0, 0.04, 0, 0, 0, 0]),
  F('honey', 'Honig', ['honey', 'rohhonig'], ['sweetener', 'honey'], 'whole', 'unverarbeitet', 20, [304, 0.3, 82.4, 0, 82.1, 0.2, 0, 0, 4, 0, 0.5, 0, 0, 0, 0, 2, 0.4, 0.2, 2, 52, 6]),
  F('sugar', 'Haushaltszucker', ['zucker', 'sugar'], ['sweetener'], 'processed', 'unverarbeitet', 10, [387, 0, 100, 0, 100, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0.05, 0.01, 0, 2, 1]),
  F('gelatin', 'Gelatine', ['gelatin', 'kollagen', 'collagen', 'knochenbrühe'], ['animal'], 'processed', 'unverarbeitet', 10, [335, 86, 0, 0, 0, 0, 0, 0, 196, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 16, 0]),
  F('pizza', 'Pizza (Fertig-/Lieferpizza)', ['pizza'], ['grain'], 'ultra', 'zubereitet', 300, [266, 11, 33, 10, 3.6, 2.3, 4.5, 1.3, 598, 80, 1.5, 0.4, 1, 5, 0.5, 60, 2.5, 1.3, 24, 172, 188]),
  F('milk_chocolate', 'Milchschokolade', ['schokolade', 'chocolate', 'schoko', 'riegel'], ['sweetener'], 'ultra', 'zubereitet', 30, [535, 7.7, 59, 30, 52, 3.4, 18, 1, 79, 40, 0, 0, 0.5, 7, 0.6, 5, 2.3, 2.3, 63, 372, 189]),
  F('coffee', 'Kaffee, schwarz', ['kaffee', 'coffee', 'espresso'], ['drink'], 'whole', 'zubereitet', 200, [1, 0.1, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0.1, 0, 2, 0.01, 0.05, 3, 49, 2]),
  F('water', 'Wasser', ['water', 'mineralwasser', 'tee', 'tea'], ['drink'], 'whole', 'unverarbeitet', 250, [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 5]),
];

export const foodById = (id: string): FoodEntry | undefined => FOODS.find((f) => f.id === id);

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Einfache, nachvollziehbare Zuordnung eines (KI- oder Nutzer-)Namens zu einem Datenbankeintrag. */
export function matchFood(query: string): { food: FoodEntry; score: number } | undefined {
  const q = norm(query);
  if (!q) return undefined;
  const qTokens = new Set(q.split(' '));
  let best: { food: FoodEntry; score: number } | undefined;
  for (const f of FOODS) {
    const names = [f.name, ...f.aliases].map(norm);
    let s = 0;
    for (const n of names) {
      if (n === q) s = Math.max(s, 1);
      else if (n.length >= 3 && (q.includes(n) || n.includes(q))) s = Math.max(s, 0.8);
      else {
        const nt = n.split(' ');
        const overlap = nt.filter((t) => t.length >= 3 && qTokens.has(t)).length;
        if (overlap > 0) s = Math.max(s, 0.5 * (overlap / nt.length) + 0.2);
      }
    }
    if (s > 0 && (!best || s > best.score)) best = { food: f, score: s };
  }
  return best && best.score >= 0.5 ? best : undefined;
}

export function searchFoods(query: string, limit = 8): FoodEntry[] {
  const q = norm(query);
  if (!q) return FOODS.slice(0, limit);
  return FOODS.map((f) => {
    const names = [f.name, ...f.aliases].map(norm);
    const s = names.some((n) => n.startsWith(q)) ? 2 : names.some((n) => n.includes(q) || q.includes(n)) ? 1 : 0;
    return { f, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.f);
}

// ---------------------------------------------------------------------------
// Mahlzeiten
// ---------------------------------------------------------------------------

export type ItemSource = 'ai' | 'database' | 'manual';
export type FoodState = 'raw' | 'cooked' | 'n/a';

export interface MealItem {
  id: string;
  name: string;
  grams: number;
  /** Nährwerte pro 100 g */
  per100g: Nutrients;
  source: ItemSource;
  /** Verlässlichkeit der Erkennung/Schätzung 0–1 (nur bei KI) */
  confidence?: number;
  /** Zustand: roh/gegart (für Hinweise zu Rohverzehr) */
  state: FoodState;
  processing: Processing;
  tags: FoodTag[];
  /** Referenz auf Datenbankeintrag, falls zugeordnet */
  foodId?: string;
  /** true, wenn die Nährwerte selbst vom Modell geschätzt wurden (nicht aus der Datenbank) */
  nutrientsEstimated?: boolean;
}

export interface Meal {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  type: MealType;
  /** Lokale Uhrzeit "HH:MM" */
  time?: string;
  items: MealItem[];
  note?: string;
}

export function itemFromFood(food: FoodEntry, grams = food.defaultGrams, source: ItemSource = 'database', id = `${food.id}-${Math.random().toString(36).slice(2, 8)}`): MealItem {
  return { id, name: food.name, grams, per100g: { ...food.per100g }, source, state: /roh/.test(food.basis) ? 'raw' : /gegart/.test(food.basis) ? 'cooked' : 'n/a', processing: food.processing, tags: [...food.tags], foodId: food.id };
}

export function itemNutrients(it: MealItem): Nutrients {
  const f = Math.max(0, it.grams) / 100;
  const out = zeroNutrients();
  for (const k of NUTRIENT_KEYS) out[k] = it.per100g[k] * f;
  return out;
}

export function sumNutrients(items: MealItem[]): Nutrients {
  const t = zeroNutrients();
  for (const it of items) {
    const n = itemNutrients(it);
    for (const k of NUTRIENT_KEYS) t[k] += n[k];
  }
  return t;
}

export const mealTotals = (m: Meal): Nutrients => sumNutrients(m.items);
export const dayTotals = (meals: Meal[], date: string): Nutrients => sumNutrients(meals.filter((m) => m.date === date).flatMap((m) => m.items));

/** Anteil an der Tagesreferenz in Prozent (nur Mikronährstoffe). */
export function microCoverage(n: Nutrients): Array<{ key: NutrientKey; pct: number }> {
  return MICRO_KEYS.map((key) => ({ key, pct: (n[key] / (MICRO_REFERENCE[key] as number)) * 100 }));
}

/** Allgemeiner Proteinrichtwert (kein persönlicher Bedarf): 0,8 g/kg (DGE-Referenz) bis ca. 1,6 g/kg bei aktiven Personen. */
export function proteinRange(weightKg: number): { low: number; high: number } {
  return { low: Math.round(weightKg * 0.8), high: Math.round(weightKg * 1.6) };
}
