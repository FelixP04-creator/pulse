import { analyzeBioavailability } from './bioavailability.ts';
import { lensFit, rateItems, safetyNotes, LENS_META, type CustomRules, type LensId } from './foodRating.ts';
import { dayTotals, MEAL_LABEL, NUTRIENT_META, type Meal, type MealItem } from './nutrition.ts';
import { recoveryDrivers } from './recovery.ts';
import { sleepDebt } from './sleep.ts';
import { generateTips, EVIDENCE_LABEL, type Tip } from './tips.ts';
import type { ScoreResult, DailyMetrics, SleepNight, UserProfile } from './types.ts';
import { baselineFor } from './baselines.ts';
import { addDays, mean } from './stats.ts';

/**
 * REGELBASIERTER COACH (lokaler Fallback, kein KI-Modell)
 * -------------------------------------------------------
 * Antworten sind IMMER als „regelbasiert“ gekennzeichnet. Der Coach
 *  - erklärt Werte anhand der eigenen Daten,
 *  - legt Datenlücken offen,
 *  - stellt keine Diagnosen, empfiehlt keine Medikamente oder Nahrungsergänzung mit Dosierung,
 *  - nennt zu jeder Empfehlung die Begründung.
 */

export interface CoachContext {
  asOf: string;
  days: DailyMetrics[];
  nights: SleepNight[];
  profile: UserProfile;
  recovery: ScoreResult;
  sleep: ScoreResult;
  strain: ScoreResult;
  vitalityValue?: number;
  meals: Meal[];
  lens: LensId;
  rules: CustomRules;
  hydrationMlToday?: number;
  month?: number;
  hourOfDay?: number;
  strain3dAvg?: number;
}

export interface CoachAnswer {
  kind: 'rule_based';
  title: string;
  text: string;
  dataGaps: string[];
  tips: Tip[];
  disclaimer: string;
}

export const DISCLAIMER = 'Regelbasierte Antwort, keine KI-Analyse. Kein medizinischer Rat; bei Beschwerden wende dich an eine Ärztin oder einen Arzt.';

export type Intent = 'diagnosis' | 'supplement' | 'bioavailability' | 'nutrition' | 'sleep' | 'recovery' | 'strain' | 'trend' | 'help';

const has = (q: string, ...w: string[]) => w.some((x) => q.includes(x));

export function detectIntent(question: string): Intent {
  const q = question.toLowerCase();
  if (has(q, 'diagnos', 'krank', 'krebs', 'diabetes', 'herzinfarkt', 'depress', 'medikament', 'tablette', 'arzneimittel')) return 'diagnosis';
  if (has(q, 'supplement', 'nahrungsergänzung', 'kapsel', 'dosis', 'dosier', 'pulver', 'einnehmen')) return 'supplement';
  if (has(q, 'bioverfüg', 'aufnahme', 'aufgenommen', 'absorb', 'verfügbar', 'hemm', 'eisen', 'zink', 'calcium', 'vitamin', 'mineral')) return 'bioavailability';
  if (has(q, 'essen', 'mahlzeit', 'ernähr', 'protein', 'kalorie', 'frühstück', 'mittag', 'abend', 'snack', 'ray peat', 'vonderplanitz', 'woodville', 'makro')) return 'nutrition';
  if (has(q, 'schlaf', 'einschlaf', 'aufwach', 'müde')) return 'sleep';
  if (has(q, 'erhol', 'recovery', 'hrv', 'ruhepuls', 'puls')) return 'recovery';
  if (has(q, 'training', 'belastung', 'strain', 'sport', 'laufen')) return 'strain';
  if (has(q, 'trend', 'woche', 'verlauf', 'entwicklung', 'zusammenfass')) return 'trend';
  return 'help';
}

function trendLine(days: DailyMetrics[], asOf: string, key: 'restingHr' | 'hrvMs', label: string, unit: string, higherIsBetter: boolean): string | undefined {
  const week = days.filter((d) => d.date > addDays(asOf, -7) && d.date <= asOf).map((d) => d[key]).filter((v): v is number => v !== undefined);
  const base = baselineFor(days, key, addDays(asOf, -6));
  if (week.length < 4 || !base) return undefined;
  const m = mean(week) as number;
  const diff = m - base.center;
  if (Math.abs(diff) < base.spread * 0.5) return `${label} liegt diese Woche mit Ø ${m.toFixed(0)} ${unit} im Rahmen deines üblichen Bereichs (${base.center.toFixed(0)} ${unit}).`;
  const better = higherIsBetter ? diff > 0 : diff < 0;
  return `${label} liegt diese Woche mit Ø ${m.toFixed(0)} ${unit} ${diff > 0 ? 'über' : 'unter'} deinem persönlichen Durchschnitt (${base.center.toFixed(0)} ${unit}) – das ist ${better ? 'eher günstig' : 'eher ein Zeichen für höhere Belastung'}, aber kein Befund.`;
}

function gaps(c: CoachContext): string[] {
  const g: string[] = [];
  if (c.recovery.status === 'insufficient') g.push(c.recovery.reason);
  if (c.sleep.status === 'insufficient') g.push(c.sleep.reason);
  const missing = c.nights.filter((n) => n.date > addDays(c.asOf, -14)).length;
  if (missing < 10) g.push(`Für eine zuverlässigere Trendanalyse fehlen noch einige Nächte mit Messdaten (${missing} von 14).`);
  if (!c.meals.some((m) => m.date === c.asOf)) g.push('Für heute sind noch keine Mahlzeiten erfasst.');
  return g;
}

export function lastMealItems(meals: Meal[], asOf: string): MealItem[] {
  return meals.filter((m) => m.date === asOf).flatMap((m) => m.items);
}

export function coachAnswer(question: string, c: CoachContext): CoachAnswer {
  const intent = detectIntent(question);
  const tips = generateTips({ asOf: c.asOf, sleep: c.sleep, recovery: c.recovery, strain: c.strain, strain3dAvg: c.strain3dAvg, nights: c.nights, meals: c.meals, hydrationMlToday: c.hydrationMlToday, hourOfDay: c.hourOfDay, lens: c.lens === 'custom' && c.rules.prefer.length + c.rules.avoid.length === 0 ? undefined : c.lens, month: c.month });
  const dataGaps = gaps(c);
  const base = { kind: 'rule_based' as const, dataGaps, disclaimer: DISCLAIMER };

  if (intent === 'diagnosis') {
    return { ...base, title: 'Dazu kann ich nichts diagnostizieren', tips: [],
      text: 'Ich kann keine Krankheiten erkennen oder ausschließen und keine Medikamente einordnen. Deine Wearable-Werte sind Wellness-Daten und können durch viele Alltagsfaktoren schwanken. Wenn dich etwas beunruhigt – etwa anhaltend auffällige Werte, Beschwerden oder Fragen zu Medikamenten –, sprich bitte mit einer Ärztin oder einem Arzt. Ich kann dir gern erklären, wie sich deine Werte in letzter Zeit entwickelt haben.' };
  }

  if (intent === 'supplement') {
    return { ...base, title: 'Zu Nahrungsergänzung', tips: tips.filter((t) => t.id === 'vitamin-d'),
      text: 'Dosierungen für Nahrungsergänzungsmittel nenne ich nicht, weil der Bedarf individuell ist und von Blutwerten, Ernährung, Medikamenten und Vorerkrankungen abhängt. Sinnvoll ist, zuerst die Ernährung zu betrachten (Tab „Ernährung“ zeigt Lücken und Bioverfügbarkeit) und bei Verdacht auf einen Mangel den Spiegel ärztlich bestimmen zu lassen. Vitamin D, Eisen und B12 sind dabei die häufigsten Kandidaten.' };
  }

  if (intent === 'bioavailability' || intent === 'nutrition') {
    const items = lastMealItems(c.meals, c.asOf);
    if (items.length === 0) {
      return { ...base, title: 'Noch nichts erfasst', tips: [], text: 'Für heute habe ich noch keine Mahlzeiten. Fotografiere dein Essen oder trage es manuell ein – dann zeige ich dir Makros, Vitamine, Bewertung und welche Nährstoffe in der Kombination gut oder weniger gut aufgenommen werden.' };
    }
    const rating = rateItems(items);
    const bio = analyzeBioavailability(items);
    const totals = dayTotals(c.meals, c.asOf);
    const lines: string[] = [`Heute bisher: ${Math.round(totals.kcal)} kcal, ${Math.round(totals.protein)} g Protein, ${Math.round(totals.carbs)} g Kohlenhydrate, ${Math.round(totals.fat)} g Fett, ${Math.round(totals.fiber)} g Ballaststoffe.`];
    if (rating.status === 'ok') lines.push(`Nährstoffdichte-Bewertung: ${rating.stars} von 5 Sternen (${rating.label}).`);
    if (bio.length) {
      lines.push('Bioverfügbarkeit:');
      for (const f of bio.slice(0, 5)) lines.push(`• ${f.label} – ${f.availability === 'good' ? 'gut verfügbar' : f.availability === 'mixed' ? 'teilweise' : 'eingeschränkt'}: ${f.summary}${f.improve ? ' ' + f.improve : ''} (${EVIDENCE_LABEL[f.evidence]})`);
    } else lines.push('Bei den erfassten Lebensmitteln sind keine auffälligen Förderer oder Hemmer der Nährstoffaufnahme bekannt.');
    for (const s of safetyNotes(items)) lines.push(`Hinweis: ${s.text}`);
    if (c.lens !== 'custom' || c.rules.prefer.length + c.rules.avoid.length > 0) {
      const fit = lensFit(c.lens, items, c.rules);
      if (fit.status === 'ok' && fit.score !== undefined) lines.push(`Perspektive „${LENS_META[c.lens].name}“: ${fit.score} % Übereinstimmung. ${fit.caveats[0]}`);
    }
    return { ...base, title: intent === 'bioavailability' ? 'Was dein Körper aus dem Essen aufnehmen kann' : 'Deine Ernährung heute', text: lines.join('\n'), tips: tips.filter((t) => t.area === 'nutrition') };
  }

  if (intent === 'sleep') {
    const lines: string[] = [];
    if (c.sleep.status === 'ok') {
      lines.push(`Dein Schlafwert für heute: ${c.sleep.value}/100. Wichtigste Teile: ${c.sleep.components.map((x) => `${x.label} ${Math.round(x.score)}`).join(', ')}.`);
      for (const n of c.sleep.notes) lines.push(n);
    } else lines.push(c.sleep.reason);
    const debt = sleepDebt(c.nights, c.asOf, c.profile);
    if (debt) lines.push(`In den letzten 7 Tagen lagst du zusammengerechnet etwa ${Math.round(debt.debtMin / 60 * 10) / 10} h unter deinem geschätzten Bedarf von ${Math.round(debt.needMin / 60 * 10) / 10} h. Das ist eine Orientierung, kein Rückstand, den du „abarbeiten“ musst.`);
    return { ...base, title: 'Dein Schlaf', text: lines.join('\n'), tips: tips.filter((t) => t.area === 'sleep' || t.area === 'stress') };
  }

  if (intent === 'recovery') {
    const lines: string[] = [];
    if (c.recovery.status === 'ok') {
      lines.push(`Dein Erholungswert: ${c.recovery.value}/100. Die größten Einflüsse: ${recoveryDrivers(c.recovery).slice(0, 2).map((d) => `${d.label} (${d.detail})`).join('; ')}`);
      lines.push('Ein niedriger Wert bedeutet nicht, dass etwas nicht stimmt – er zeigt nur, wie sich dein Körper heute im Vergleich zu deinem eigenen Durchschnitt verhält.');
    } else lines.push(c.recovery.reason);
    return { ...base, title: 'Deine Erholung', text: lines.join('\n'), tips: tips.filter((t) => t.area === 'recovery' || t.area === 'stress') };
  }

  if (intent === 'strain') {
    const lines = c.strain.status === 'ok' ? [`Belastung heute: ${c.strain.value} von 21 (app-eigene Skala, nicht mit anderen Anbietern vergleichbar).`, ...c.strain.notes] : [c.strain.reason];
    return { ...base, title: 'Deine Belastung', text: lines.join('\n'), tips: tips.filter((t) => t.area === 'strain' || t.area === 'recovery') };
  }

  if (intent === 'trend') {
    const lines = [trendLine(c.days, c.asOf, 'restingHr', 'Dein Ruhepuls', 'bpm', false), trendLine(c.days, c.asOf, 'hrvMs', 'Deine HRV', 'ms', true)].filter((x): x is string => !!x);
    if (c.vitalityValue !== undefined) lines.push(`Vitalitätsindex: ${c.vitalityValue}/100 (app-eigener Indikator, kein biologisches Alter).`);
    if (lines.length === 0) lines.push('Für eine Trendaussage fehlen noch Daten.');
    return { ...base, title: 'Deine letzten Wochen', text: lines.join('\n'), tips: tips.slice(0, 3) };
  }

  return { ...base, title: 'Wobei kann ich helfen?', tips: tips.slice(0, 3),
    text: 'Frag mich zum Beispiel: „Wie war mein Schlaf?“, „Warum ist meine Erholung niedrig?“, „Was habe ich heute gegessen und was wird davon gut aufgenommen?“ oder „Wie haben sich meine Werte diese Woche entwickelt?“. Ich nenne dir dazu immer die Datengrundlage und sage, wo Daten fehlen.' };
}

/** Alle Modelle: Namen für Anzeige */
export const MEAL_NAMES = MEAL_LABEL;
export const NUTRIENT_LABELS = NUTRIENT_META;
