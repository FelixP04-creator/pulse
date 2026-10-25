import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeBioavailability, bioSummary } from '../src/core/bioavailability.ts';
import { coachAnswer, detectIntent, type CoachContext } from '../src/core/coach.ts';
import { foodById, itemFromFood, type Meal, type MealItem } from '../src/core/nutrition.ts';
import { recoveryScore } from '../src/core/recovery.ts';
import { sleepScore } from '../src/core/sleep.ts';
import { dailyStrain } from '../src/core/strain.ts';
import { generateDemoDataset } from '../src/data/demo.ts';

const T = '2026-10-24';
const item = (id: string, grams?: number, patch: Partial<MealItem> = {}): MealItem => ({ ...itemFromFood(foodById(id)!, grams), ...patch });
const ids = (items: MealItem[], opts = {}) => analyzeBioavailability(items, opts).map((f) => f.id);

describe('Bioverfügbarkeit', () => {
  it('Linsen allein: Eisen eingeschränkt, Vitamin-C-Tipp; mit Orange: besser', () => {
    const plain = analyzeBioavailability([item('lentils', 200)]).find((f) => f.id === 'iron-plant')!;
    assert.equal(plain.availability, 'limited');
    assert.match(plain.improve, /Vitamin-C/);
    const withC = analyzeBioavailability([item('lentils', 200), item('orange', 150)]).find((f) => f.id === 'iron-plant')!;
    assert.equal(withC.availability, 'mixed');
    assert.match(withC.summary, /Vitamin C/);
  });
  it('Kaffee zur eisenreichen Mahlzeit wird erkannt', () => {
    const f = analyzeBioavailability([item('lentils', 200), item('coffee', 200)]).find((x) => x.id === 'iron-plant')!;
    assert.match(f.summary, /Kaffee/);
  });
  it('Häm-Eisen aus Fleisch: gut', () => {
    assert.equal(analyzeBioavailability([item('beef_mince_raw', 150)]).find((f) => f.id === 'iron-heme')!.availability, 'good');
  });
  it('Spinat: Oxalat begrenzt Calcium; Milchprodukte: Calcium gut', () => {
    assert.equal(analyzeBioavailability([item('spinach', 100)]).find((f) => f.id === 'calcium-oxalate')!.availability, 'limited');
    assert.equal(analyzeBioavailability([item('milk', 250)]).find((f) => f.id === 'calcium-dairy')!.availability, 'good');
  });
  it('Karotte ohne Fett: Hinweis auf Fett; mit Olivenöl: gut', () => {
    assert.ok(ids([item('carrot', 100)]).includes('fat-soluble'));
    const w = analyzeBioavailability([item('carrot', 100, { state: 'cooked' }), item('olive_oil', 10)]);
    assert.ok(w.some((f) => f.id === 'fat-soluble-ok' && f.availability === 'good'));
  });
  it('rohe Eier: Eiweiß-Hinweis mit Evidenzstufe; gegarte nicht', () => {
    const f = analyzeBioavailability([item('egg', 120, { state: 'raw' })]).find((x) => x.id === 'raw-egg')!;
    assert.equal(f.availability, 'limited');
    assert.match(f.improve, /garen|gar/i);
    assert.ok(!ids([item('egg', 120, { state: 'cooked' })]).includes('raw-egg'));
  });
  it('rohes Fleisch: Hinweis auf Infektionsrisiko, keine Heilversprechen', () => {
    const f = analyzeBioavailability([item('beef_mince_raw', 150)]).find((x) => x.id === 'raw-meat')!;
    assert.match(f.improve, /Schwangere/);
    assert.ok(!/heil|krebs/i.test(f.summary + f.improve));
  });
  it('Hafer/Reis ohne tierisches Zink: Phytat-Hinweis', () => assert.ok(ids([item('oats', 80)]).includes('zinc-phytate')));
  it('Vitamin C geht beim Kochen verloren', () => assert.ok(ids([item('broccoli', 150)]).includes('vitc-heat')));
  it('leere Mahlzeit → keine Befunde; Zusammenfassung ohne Messversprechen', () => {
    assert.deepEqual(analyzeBioavailability([]), []);
    assert.match(bioSummary(analyzeBioavailability([item('lentils', 200)])), /keine Messung/);
  });
  it('keine Befunde enthalten Dosierungen', () => {
    const all = analyzeBioavailability([item('lentils', 200), item('spinach', 100), item('carrot', 100), item('egg', 100, { state: 'raw' }), item('beef_mince_raw'), item('liver_raw'), item('salmon'), item('coffee')]);
    for (const f of all) assert.ok(!/\b\d+\s?(mg|µg|IE|IU)\b/i.test(f.summary + f.improve), f.id);
    for (const f of all) assert.ok(['solid', 'moderate', 'preliminary', 'speculative'].includes(f.evidence));
  });
});

describe('Coach (regelbasiert)', () => {
  const d = generateDemoDataset(T);
  const meals: Meal[] = [{ id: 'm', date: T, type: 'lunch', items: [item('lentils', 200), item('spinach', 80), item('coffee', 200)] }];
  const ctx: CoachContext = {
    asOf: T, days: d.days, nights: d.nights, profile: {}, recovery: recoveryScore(d.days, d.nights, T), sleep: sleepScore(d.nights, T), strain: dailyStrain(d.workouts, T),
    meals, lens: 'peat', rules: { prefer: [], avoid: [] }, month: 10, hourOfDay: 15,
  };
  it('erkennt Absichten', () => {
    assert.equal(detectIntent('Ich glaube ich habe Diabetes'), 'diagnosis');
    assert.equal(detectIntent('Wie hoch ist die Dosierung von Magnesium?'), 'supplement');
    assert.equal(detectIntent('Wird das Eisen aus Linsen aufgenommen?'), 'bioavailability');
    assert.equal(detectIntent('Wie war mein Schlaf?'), 'sleep');
    assert.equal(detectIntent('Warum ist meine HRV niedrig'), 'recovery');
    assert.equal(detectIntent('hallo'), 'help');
  });
  it('Diagnose und Dosierung werden abgelehnt', () => {
    const a = coachAnswer('Habe ich Diabetes?', ctx);
    assert.match(a.text, /nichts diagnostizieren|keine Krankheiten/);
    assert.equal(a.kind, 'rule_based');
    const s = coachAnswer('Wie viel Eisen soll ich als Kapsel nehmen?', ctx);
    assert.match(s.text, /Dosierungen/);
    assert.ok(!/\b\d+\s?(mg|µg)\b/i.test(s.text));
  });
  it('Bioverfügbarkeits-Antwort nennt Hemmer, Verbesserung und Perspektive mit Vorbehalt', () => {
    const a = coachAnswer('Was wird von meinem Essen gut aufgenommen?', ctx);
    assert.match(a.text, /Bioverfügbarkeit/);
    assert.match(a.text, /Eisen/);
    assert.match(a.text, /Perspektive „Ray Peat“/);
    assert.match(a.text, /umstritten/);
    assert.match(a.disclaimer, /keine KI-Analyse/);
  });
  it('ohne Mahlzeiten: ehrliche Antwort statt erfundener Werte', () => {
    const a = coachAnswer('Was habe ich gegessen?', { ...ctx, meals: [] });
    assert.match(a.text, /noch keine Mahlzeiten/);
  });
  it('Datenlücken werden offengelegt', () => {
    const a = coachAnswer('Wie war mein Schlaf?', { ...ctx, nights: ctx.nights.slice(0, 5), sleep: sleepScore(ctx.nights.slice(0, 5), T), meals: [] });
    assert.ok(a.dataGaps.some((g) => g.includes('fehlen noch einige Nächte')));
    assert.ok(a.dataGaps.some((g) => g.includes('Mahlzeiten')));
  });
  it('Schlaf-/Erholungs-/Trend-Antworten enthalten Werte aus den Daten', () => {
    assert.match(coachAnswer('Wie war mein Schlaf?', ctx).text, /Schlafwert/);
    assert.match(coachAnswer('Wie ist meine Erholung?', ctx).text, /Erholungswert/);
    assert.match(coachAnswer('Wie war die letzte Woche, Trend?', ctx).text, /Ruhepuls|HRV/);
  });
  it('Antworten sind reproduzierbar', () => assert.deepEqual(coachAnswer('Wie war mein Schlaf?', ctx), coachAnswer('Wie war mein Schlaf?', ctx)));
});

import { buildAiContext, coachReply } from '../src/core/coachRouter.ts';
describe('Coach-Router', () => {
  const d = generateDemoDataset(T);
  const ctx: CoachContext = { asOf: T, days: d.days, nights: d.nights, profile: {}, recovery: recoveryScore(d.days, d.nights, T), sleep: sleepScore(d.nights, T), strain: dailyStrain(d.workouts, T), meals: [{ id: 'm', date: T, type: 'lunch', items: [item('lentils', 200)] }], lens: 'peat', rules: { prefer: [], avoid: [] } };
  it('Notfall hat Vorrang vor allem anderen', () => {
    const r = coachReply('Ich habe Brustschmerzen, wird mein Eisen aufgenommen?', ctx);
    assert.equal(r.urgent, true);
    assert.match(r.text, /112/);
  });
  it('Bioverfügbarkeit → Ernährungsantwort; Schlaf → Standardantwort; beides regelbasiert', () => {
    assert.match(coachReply('Wird das Eisen gut aufgenommen?', ctx).text, /Bioverfügbarkeit/);
    assert.match(coachReply('Wie war mein Schlaf?', ctx).text, /Schlafwert/);
    assert.equal(coachReply('Wie war mein Schlaf?', ctx).kind, 'rule_based');
  });
  it('KI-Kontext enthält keine Rohdaten-Zeitreihen', () => {
    const c = buildAiContext(ctx) as Record<string, unknown>;
    assert.ok(!('days' in c) && !('nights' in c));
    assert.ok(JSON.stringify(c).length < 2000);
  });
});
