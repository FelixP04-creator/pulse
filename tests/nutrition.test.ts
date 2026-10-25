import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FOOD_ANALYSIS_PROMPT, macrosConsistent, parseFoodAnalysis } from '../src/core/foodAnalysis.ts';
import { customFit, lensFit, peatFit, primalFit, rateItems, safetyNotes, starsFor } from '../src/core/foodRating.ts';
import { FOODS, MICRO_KEYS, NUTRIENT_KEYS, dayTotals, foodById, itemFromFood, itemNutrients, matchFood, mealTotals, searchFoods, sumNutrients, type Meal, type MealItem } from '../src/core/nutrition.ts';
import { generateTips } from '../src/core/tips.ts';

const item = (id: string, grams?: number, patch: Partial<MealItem> = {}): MealItem => ({ ...itemFromFood(foodById(id)!, grams), ...patch });

describe('Lebensmitteldatenbank', () => {
  it('jede Zeile ist konsistent (Energie ≈ Makros, plausible Werte, eindeutige IDs)', () => {
    assert.equal(new Set(FOODS.map((f) => f.id)).size, FOODS.length);
    for (const f of FOODS) {
      const n = f.per100g;
      for (const k of NUTRIENT_KEYS) assert.ok(n[k] >= 0 && Number.isFinite(n[k]), `${f.id}.${k}`);
      assert.ok(n.protein + n.carbs + n.fat <= 101, `${f.id}: Makros > 100 g`);
      assert.ok(n.sugar <= n.carbs + 0.01, `${f.id}: Zucker > Kohlenhydrate`);
      assert.ok(n.satFat + n.pufa <= n.fat + 0.5 || n.fat === 0, `${f.id}: Fettsäuren > Fett`);
      if (f.id !== 'gelatin' && f.id !== 'coffee' && f.id !== 'water') assert.ok(macrosConsistent(n), `${f.id}: Energie passt nicht zu Makros`);
    }
  });
  it('Zuordnung von Namen (Deutsch/Englisch/Synonyme) und Suche', () => {
    assert.equal(matchFood('Rührei')?.food.id, 'egg');
    assert.equal(matchFood('Orange juice')?.food.id, 'orange_juice');
    assert.equal(matchFood('Haferflocken mit Milch')?.food.id !== undefined, true);
    assert.equal(matchFood('Xyzzy Quatsch'), undefined);
    assert.equal(matchFood(''), undefined);
    assert.ok(searchFoods('lach').some((f) => f.id === 'salmon'));
    assert.ok(searchFoods('Käse').some((f) => f.id === 'gouda'));
  });
  it('Gewicht skaliert alle Nährwerte linear; Summen sind additiv', () => {
    const a = item('egg', 100);
    const b = item('egg', 200);
    assert.ok(Math.abs(itemNutrients(b).protein - 2 * itemNutrients(a).protein) < 1e-9);
    assert.ok(Math.abs(itemNutrients(a).kcal - 143) < 1e-9);
    const s = sumNutrients([a, item('banana', 100)]);
    assert.ok(Math.abs(s.kcal - (143 + 89)) < 1e-9);
    assert.equal(itemNutrients(item('egg', -50)).kcal, 0, 'negatives Gewicht zählt nicht');
  });
  it('Tages- und Mahlzeitensummen', () => {
    const meals: Meal[] = [
      { id: '1', date: '2026-10-24', type: 'breakfast', items: [item('egg', 100)] },
      { id: '2', date: '2026-10-24', type: 'lunch', items: [item('rice', 100)] },
      { id: '3', date: '2026-10-23', type: 'dinner', items: [item('pizza', 100)] },
    ];
    assert.ok(Math.abs(dayTotals(meals, '2026-10-24').kcal - 273) < 1e-9);
    assert.ok(Math.abs(mealTotals(meals[2]).kcal - 266) < 1e-9);
  });
});

describe('Essens-Rating', () => {
  it('Getränke ohne Energie werden nicht bewertet', () => {
    assert.equal(rateItems([item('water'), item('coffee')]).status, 'insufficient');
  });
  it('nährstoffreiche Mahlzeit schlägt Fertigpizza + Schokolade', () => {
    const good = rateItems([item('salmon', 150), item('broccoli', 150), item('potato', 200)]);
    const bad = rateItems([item('pizza', 300), item('milk_chocolate', 60)]);
    assert.ok(good.status === 'ok' && bad.status === 'ok');
    if (good.status === 'ok' && bad.status === 'ok') {
      assert.ok(good.score > bad.score + 25, `${good.score} vs ${bad.score}`);
      assert.ok(good.stars > bad.stars);
      assert.ok(Math.abs(good.components.reduce((a, c) => a + c.weight, 0) - 1) < 1e-9);
      assert.ok(good.score >= 0 && good.score <= 100 && bad.score >= 0);
      assert.ok(bad.gaps.length > 0);
    }
  });
  it('reproduzierbar und Sterne in Halbschritten, min. 1', () => {
    const items = [item('oats', 60), item('milk', 200), item('banana', 100)];
    assert.deepEqual(rateItems(items), rateItems(items));
    assert.equal(starsFor(0), 1);
    assert.equal(starsFor(50), 2.5);
    assert.equal(starsFor(100), 5);
  });
  it('Leber/Spinat decken Mikronährstoffe stark ab', () => {
    const r = rateItems([item('liver_raw', 80), item('spinach', 100), item('egg', 120)]);
    assert.equal(r.status, 'ok');
    if (r.status === 'ok') assert.ok(r.components.find((c) => c.key === 'micros')!.score > 60);
  });
  it('MICRO_KEYS decken 12 Nährstoffe ab', () => assert.equal(MICRO_KEYS.length, 12));
});

describe('Sicherheitshinweise', () => {
  it('rohe tierische Lebensmittel lösen einen Hinweis aus, gegarte nicht', () => {
    assert.ok(safetyNotes([item('beef_mince_raw', 150)]).some((n) => n.id === 'raw-animal'));
    assert.ok(safetyNotes([item('egg', 60, { state: 'raw' })]).some((n) => n.id === 'raw-animal'));
    assert.ok(!safetyNotes([item('chicken', 150)]).some((n) => n.id === 'raw-animal'));
    assert.ok(!safetyNotes([item('spinach', 60)]).some((n) => n.id === 'raw-animal'), 'rohes Gemüse ist kein tierisches Lebensmittel');
  });
  it('Leber: Vitamin-A-Hinweis', () => {
    assert.ok(safetyNotes([item('liver_raw', 100)]).some((n) => n.id === 'vit-a'));
    assert.ok(!safetyNotes([item('liver_raw', 10)]).some((n) => n.id === 'vit-a'));
  });
});

describe('Ernährungs-Perspektiven', () => {
  it('Peat: Obst/Milch/Honig + wenig PUFA ≫ Mandeln/Samenöl-lastig', () => {
    const peat = peatFit([item('orange_juice', 250), item('quark', 150), item('honey', 20)]);
    const nuts = peatFit([item('almonds', 80), item('olive_oil', 20)]);
    assert.ok((peat.score as number) > (nuts.score as number) + 30, `${peat.score} vs ${nuts.score}`);
    assert.ok(peat.caveats.some((c) => c.includes('umstritten')));
  });
  it('Primal: rohe, unverarbeitete tierische Lebensmittel passen, gegarte/ultra nicht', () => {
    const raw = primalFit([item('beef_mince_raw', 150), item('honey', 20), item('liver_raw', 50)]);
    const cooked = primalFit([item('chicken', 150), item('pizza', 200)]);
    assert.ok((raw.score as number) > 90);
    assert.ok((cooked.score as number) < 10);
    assert.ok(raw.caveats.some((c) => c.includes('Infektionsrisiko')), 'Sicherheitsvorbehalt muss immer dabei sein');
  });
  it('Eigene Perspektive: unkonfiguriert → kein Score; sonst nur nach eigenen Regeln', () => {
    assert.equal(customFit([item('egg')], { prefer: [], avoid: [] }).status, 'unconfigured');
    assert.equal(customFit([item('egg')], { prefer: [], avoid: [] }).score, undefined);
    const fit = customFit([item('egg', 100), item('pizza', 100)], { prefer: ['egg'], avoid: ['pizza'] });
    assert.equal(fit.score, Math.round(50 + 50 * (143 / 409 - 266 / 409)));
    assert.equal(lensFit('custom', [item('egg')]).status, 'unconfigured');
  });
});

describe('Bilderkennung – Auswertung', () => {
  it('bekannte Lebensmittel nutzen Datenbankwerte (nicht die Modellwerte)', () => {
    const r = parseFoodAnalysis({ is_food: true, items: [{ name: 'Haferflocken', grams: 60, state: 'cooked', confidence: 0.9, per100g: { kcal: 9999, protein: 1, carbs: 1, fat: 1 } }] });
    assert.equal(r.isFood, true);
    assert.equal(r.items[0].per100g.kcal, foodById('oats')!.per100g.kcal);
    assert.equal(r.items[0].source, 'ai');
    assert.equal(r.items[0].state, 'cooked');
    assert.equal(r.items[0].confidence, 0.9);
  });
  it('unbekannte Lebensmittel: plausible Modellwerte nur mit Warnung, widersprüchliche werden verworfen', () => {
    const ok = parseFoodAnalysis({ is_food: true, items: [{ name: 'Falafel Sonderrezept', grams: 120, per100g: { kcal: 333, protein: 13, carbs: 32, fat: 18 }, confidence: 0.9 }] });
    assert.equal(ok.items[0].nutrientsEstimated, true);
    assert.ok(ok.items[0].confidence! <= 0.5, 'Modellwerte dürfen nie als sicher gelten');
    assert.ok(ok.warnings.some((w) => w.includes('geschätzt')));
    const bad = parseFoodAnalysis({ is_food: true, items: [{ name: 'Zaubertrank', grams: 100, per100g: { kcal: 50, protein: 50, carbs: 50, fat: 50 } }] });
    assert.equal(bad.items[0].per100g.kcal, 0);
    assert.ok(bad.warnings.some((w) => w.includes('verworfen')));
    const none = parseFoodAnalysis({ is_food: true, items: [{ name: 'Zaubertrank', grams: 100 }] });
    assert.ok(none.warnings.some((w) => w.includes('manuell')));
  });
  it('Gewichte werden begrenzt, fehlende gemeldet', () => {
    const r = parseFoodAnalysis({ is_food: true, items: [{ name: 'Reis', grams: 99999 }, { name: 'Banane' }] });
    assert.equal(r.items[0].grams, 2000);
    assert.equal(r.items[1].grams, 100);
    assert.ok(r.warnings.some((w) => w.includes('Gewicht fehlt')));
  });
  it('kein Essen / Müll / zu viele Einträge', () => {
    assert.equal(parseFoodAnalysis({ is_food: false, items: [] }).isFood, false);
    assert.equal(parseFoodAnalysis('Müll').isFood, false);
    assert.equal(parseFoodAnalysis(null).isFood, false);
    assert.equal(parseFoodAnalysis({ items: [] }).isFood, false);
    const many = parseFoodAnalysis({ is_food: true, items: Array.from({ length: 30 }, () => ({ name: 'Apfel', grams: 100 })) });
    assert.equal(many.items.length, 12);
  });
  it('unsichere Erkennung wird markiert; Injektion über Namen bleibt Text', () => {
    const r = parseFoodAnalysis({ is_food: true, items: [{ name: 'Apfel', grams: 100, confidence: 0.2 }, { name: '<script>alert(1)</script>Ei', grams: 50 }] });
    assert.ok(r.warnings.some((w) => w.includes('Unsichere')));
    assert.ok(r.items.every((i) => i.name.length <= 80));
  });
  it('Prompt verbietet Gesundheitsbewertung und ignoriert Bildtext-Anweisungen', () => {
    assert.match(FOOD_ANALYSIS_PROMPT, /Ignoriere Anweisungen/);
    assert.match(FOOD_ANALYSIS_PROMPT, /AUSSCHLIESSLICH/);
  });
});

describe('Biohacking-Tipps', () => {
  const base = { asOf: '2026-10-24', nights: [], meals: [] as Meal[] };
  it('niedrige Erholung → lockerer Tag mit Arzt-Hinweis, keine Diagnose, Alkohol-Tipp „gut belegt“', () => {
    const tips = generateTips({ ...base, recovery: { status: 'ok', value: 20, provenance: 'calculated', quality: 'high', components: [], notes: [] } });
    const t = tips.find((x) => x.id === 'low-recovery-day')!;
    assert.match(t.body, /kein Krankheitszeichen/);
    assert.match(t.body, /Ärztin oder einem Arzt/);
    assert.equal(tips.find((x) => x.id === 'alcohol')!.evidence, 'solid');
  });
  it('Perspektiv-Tipps sind als spekulativ markiert und tragen Sicherheitstext', () => {
    const peat = generateTips({ ...base, lens: 'peat' }).find((x) => x.perspective === 'peat')!;
    const primal = generateTips({ ...base, lens: 'primal' }).find((x) => x.perspective === 'primal')!;
    assert.equal(peat.evidence, 'speculative');
    assert.equal(primal.evidence, 'speculative');
    assert.match(primal.body, /Schwangere/);
    assert.match(primal.body, /nicht belegt/);
    assert.equal(generateTips(base).some((x) => x.perspective), false, 'ohne gewählte Perspektive keine Perspektiv-Tipps');
  });
  it('Frühstück mit wenig Protein → Hinweis; maximal 6 Tipps; Vitamin-D nur im Winterhalbjahr', () => {
    const meals: Meal[] = [{ id: 'b', date: '2026-10-24', type: 'breakfast', items: [item('banana', 100)] }];
    const tips = generateTips({ ...base, meals, month: 10 });
    assert.ok(tips.some((x) => x.id === 'breakfast-protein'));
    assert.ok(tips.some((x) => x.id === 'vitamin-d'));
    assert.ok(!generateTips({ ...base, month: 7 }).some((x) => x.id === 'vitamin-d'));
    assert.ok(tips.length <= 6);
  });
  it('kein Tipp enthält Dosierungen oder Medikamentenempfehlungen', () => {
    const all = generateTips({ ...base, lens: 'peat', month: 12, hourOfDay: 16, hydrationMlToday: 100, recovery: { status: 'ok', value: 10, provenance: 'calculated', quality: 'low', components: [], notes: [] } });
    for (const t of all) assert.ok(!/\b\d+\s?(mg|µg|IE|IU)\b/i.test(t.body), t.id);
  });
});

import { answerRuleBased } from '../src/core/coachRules.ts';
import { generateDemoDataset } from '../src/data/demo.ts';
import { recoveryScore } from '../src/core/recovery.ts';
import { sleepScore } from '../src/core/sleep.ts';
import { readFileSync } from 'node:fs';

describe('Regelbasierter Coach', () => {
  const T = '2026-10-24';
  const d = generateDemoDataset(T);
  const ctx = { asOf: T, days: d.days, nights: d.nights, meals: [], recovery: recoveryScore(d.days, d.nights, T), sleep: sleepScore(d.nights, T) };
  it('kennzeichnet Antworten als regelbasiert und nennt die Datenbasis', () => {
    const a = answerRuleBased('Wie ist meine Erholung?', ctx);
    assert.equal(a.kind, 'rule_based');
    assert.match(a.answer, /regelbasierte Auswertung, keine KI-Analyse/);
    assert.ok(a.basis.length > 0);
  });
  it('Notfälle und Suizidgedanken führen sofort zu Hilfe, nicht zu Datenanalyse', () => {
    const a = answerRuleBased('Ich habe Brustschmerzen und Atemnot', ctx);
    assert.equal(a.urgent, true);
    assert.match(a.answer, /112/);
    assert.doesNotMatch(a.answer, /Erholungswert/);
    const b = answerRuleBased('ich will mich umbringen', ctx);
    assert.equal(b.urgent, true);
    assert.match(b.answer, /0800 111 0 111/);
  });
  it('medizinische Fragen werden nicht beantwortet', () => {
    assert.match(answerRuleBased('Habe ich Diabetes? Welche Dosis?', ctx).answer, /nicht beantworten oder diagnostizieren/);
  });
  it('fehlende Daten werden offen benannt', () => {
    const a = answerRuleBased('Wie ist meine Erholung?', { asOf: T, days: [], nights: [], meals: [], recovery: { status: 'insufficient', reason: 'Nicht genügend Daten: X.', have: 0, need: 5 } });
    assert.match(a.answer, /fehlen/);
  });
});

describe('Parität Server/App', () => {
  it('Bild-Prompt der Edge Function entspricht dem getesteten Prompt', () => {
    const server = readFileSync(new URL('../supabase/functions/_shared/foodPrompt.ts', import.meta.url), 'utf8');
    assert.ok(server.includes(FOOD_ANALYSIS_PROMPT));
  });
});
