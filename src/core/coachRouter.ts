import { coachAnswer, detectIntent, DISCLAIMER, type CoachContext } from './coach.ts';
import { answerRuleBased } from './coachRules.ts';
import type { Tip } from './tips.ts';

/**
 * Einheitlicher regelbasierter Coach.
 * Reihenfolge: (1) Notfälle/Suizidgedanken → sofort Hilfe, keine Datenanalyse (coachRules),
 *              (2) Ernährung/Bioverfügbarkeit/Nahrungsergänzung/Diagnosefragen → coach.ts,
 *              (3) sonst Schlaf/Erholung/Belastung/Datenlage → coachRules.
 */
export interface CoachReply {
  kind: 'rule_based';
  title?: string;
  text: string;
  basis: string[];
  urgent: boolean;
  dataGaps: string[];
  tips: Tip[];
  disclaimer: string;
}

export function coachReply(question: string, ctx: CoachContext): CoachReply {
  const tipLens = ctx.lens === 'custom' && ctx.rules.prefer.length + ctx.rules.avoid.length === 0 ? undefined : ctx.lens;
  const r = answerRuleBased(question, { ...ctx, lens: tipLens });
  if (r.urgent) return { kind: 'rule_based', text: r.answer, basis: [], urgent: true, dataGaps: [], tips: [], disclaimer: '' };
  const intent = detectIntent(question);
  if (intent === 'bioavailability' || intent === 'nutrition' || intent === 'supplement' || intent === 'diagnosis') {
    const a = coachAnswer(question, ctx);
    return { kind: 'rule_based', title: a.title, text: a.text, basis: [], urgent: false, dataGaps: a.dataGaps, tips: a.tips, disclaimer: a.disclaimer };
  }
  return { kind: 'rule_based', text: r.answer, basis: r.basis, urgent: false, dataGaps: [], tips: [], disclaimer: DISCLAIMER };
}

/** Kompakter Kontext für die KI-Edge-Function: nur berechnete Werte, keine Rohdaten-Zeitreihen, keine Fotos. */
export function buildAiContext(ctx: CoachContext) {
  const v = (r: { status: string; value?: number }) => (r.status === 'ok' ? r.value : null);
  return {
    date: ctx.asOf,
    recovery: v(ctx.recovery as never), sleep: v(ctx.sleep as never), strain: v(ctx.strain as never), vitality: ctx.vitalityValue ?? null,
    strain3dAvg: ctx.strain3dAvg ?? null,
    nightsLast14: ctx.nights.filter((n) => n.date > new Date(Date.parse(ctx.asOf) - 14 * 864e5).toISOString().slice(0, 10)).length,
    perspective: ctx.lens,
    meals: ctx.meals.filter((m) => m.date === ctx.asOf).map((m) => ({ type: m.type, items: m.items.map((i) => ({ name: i.name, grams: i.grams, state: i.state })) })),
  };
}
