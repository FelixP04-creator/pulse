import { addDays, mean } from './stats.ts';
import { sleepConsistency } from './sleep.ts';
import { generateTips, EVIDENCE_LABEL, type TipContext } from './tips.ts';
import type { DailyMetrics, ScoreResult, SleepNight } from './types.ts';

/**
 * REGELBASIERTER COACH (lokal, ohne KI)
 * -------------------------------------
 * Wird genutzt, wenn kein KI-Schlüssel konfiguriert ist oder keine Einwilligung vorliegt. Jede Antwort ist als
 * „regelbasiert“ gekennzeichnet und nennt Datenlücken. Keine Diagnosen, keine Medikamente.
 */

export interface CoachContext extends TipContext {
  days: DailyMetrics[];
  vitality?: { status: string; value?: number };
}

export interface CoachAnswer {
  kind: 'rule_based';
  answer: string;
  /** Welche Messwerte die Antwort stützen – für Nachvollziehbarkeit. */
  basis: string[];
  urgent?: boolean;
}

const URGENT = /(brustschmerz|brustenge|atemnot|luftnot|ohnmacht|bewusstlos|herzrasen|lähmung|blut im|schlaganfall|herzinfarkt)/i;
const SELF_HARM = /(suizid|umbringen|selbstmord|nicht mehr leben|mir etwas antun|selbstverletz)/i;
const MEDICAL = /(diagnose|krank|krebs|diabetes|medikament|tablette|dosis|dosierung|symptom|bluthochdruck|vorhofflimmern|arrhythmie)/i;

function weekVsBase(days: DailyMetrics[], asOf: string, key: 'restingHr' | 'hrvMs') {
  const wk = days.filter((d) => d.date > addDays(asOf, -7) && d.date <= asOf).map((d) => d[key]).filter((x): x is number => x !== undefined);
  const base = days.filter((d) => d.date <= addDays(asOf, -7) && d.date > addDays(asOf, -35)).map((d) => d[key]).filter((x): x is number => x !== undefined);
  if (wk.length < 4 || base.length < 14) return undefined;
  const a = mean(wk) as number;
  const b = mean(base) as number;
  return { week: a, base: b, diff: a - b, nWeek: wk.length, nBase: base.length };
}

const val = (r?: ScoreResult) => (r && r.status === 'ok' ? r.value : undefined);

export function answerRuleBased(question: string, c: CoachContext): CoachAnswer {
  const q = question.toLowerCase();

  if (SELF_HARM.test(q)) {
    return { kind: 'rule_based', urgent: true, basis: [], answer: 'Das klingt sehr belastend, und du verdienst Unterstützung von Menschen. Wenn du dich in Gefahr fühlst, wähle bitte sofort den Notruf 112. Die Telefonseelsorge ist kostenlos und rund um die Uhr erreichbar: 0800 111 0 111 oder 0800 111 0 222. Ich bin kein Ersatz für professionelle Hilfe – bitte melde dich dort oder bei einer vertrauten Person.' };
  }
  if (URGENT.test(q)) {
    return { kind: 'rule_based', urgent: true, basis: [], answer: 'Diese Beschwerden können ernst sein und lassen sich nicht über App-Daten beurteilen. Bei akuten Beschwerden wähle bitte den Notruf 112 oder suche umgehend ärztliche Hilfe auf.' };
  }

  const basis: string[] = [];
  const parts: string[] = [];
  const rec = val(c.recovery), slp = val(c.sleep);

  const wantsSleep = /(schlaf|einschlaf|müde|nacht)/.test(q);
  const wantsRec = /(erhol|recovery|hrv|ruhepuls|puls|fit)/.test(q);
  const wantsTrain = /(training|belastung|strain|sport|ruhetag|workout)/.test(q);
  const wantsFood = /(essen|ernähr|mahlzeit|protein|trinken|wasser|peat|vonderplanitz|woodville|biohack|vitamin)/.test(q);
  const wantsData = /(daten|sync|verbind|fehlt|genau|zuverlässig)/.test(q);
  const general = !(wantsSleep || wantsRec || wantsTrain || wantsFood || wantsData);

  if (wantsRec || general) {
    if (rec !== undefined) {
      basis.push(`Erholung ${rec}`);
      parts.push(`Dein Erholungswert liegt heute bei ${rec} von 100 – relativ zu deinen eigenen Durchschnittswerten, nicht zu anderen Menschen.`);
    } else if (c.recovery?.status === 'insufficient') {
      parts.push(`Für den Erholungswert fehlen noch Daten. ${c.recovery.reason}`);
    }
    const rhr = weekVsBase(c.days, c.asOf, 'restingHr');
    if (rhr) {
      basis.push(`Ruhepuls Ø7d ${rhr.week.toFixed(1)} vs. Ø4Wo ${rhr.base.toFixed(1)}`);
      parts.push(Math.abs(rhr.diff) < 1 ? 'Dein Ruhepuls liegt diese Woche im Bereich deines persönlichen Durchschnitts.' : rhr.diff > 0 ? `Deine Ruheherzfrequenz liegt diese Woche etwa ${rhr.diff.toFixed(1)} bpm über deinem persönlichen Durchschnitt. Mögliche Einflüsse sind Schlafmangel, Alkohol, Training, Stress oder ein Infekt – eine Diagnose lässt sich daraus nicht ableiten.` : `Deine Ruheherzfrequenz liegt diese Woche etwa ${Math.abs(rhr.diff).toFixed(1)} bpm unter deinem Durchschnitt.`);
    } else parts.push('Für einen verlässlichen Vergleich des Ruhepulses fehlen noch einige Tage mit Messdaten.');
    const hrv = weekVsBase(c.days, c.asOf, 'hrvMs');
    if (hrv) {
      basis.push(`HRV Ø7d ${hrv.week.toFixed(0)} vs. Ø4Wo ${hrv.base.toFixed(0)}`);
      parts.push(`HRV: Ø ${hrv.week.toFixed(0)} ms diese Woche gegenüber ${hrv.base.toFixed(0)} ms in den Wochen davor. Einzelne Tage schwanken stark – der Trend zählt.`);
    }
  }

  if (wantsSleep || general) {
    if (slp !== undefined) {
      basis.push(`Schlafwert ${slp}`);
      parts.push(`Dein Schlafwert der letzten Nacht: ${slp} von 100.`);
    } else parts.push('Für die letzte Nacht liegt keine verwertbare Schlafaufzeichnung vor.');
    const cons = sleepConsistency(c.nights, c.asOf);
    if (cons) {
      basis.push(`Regelmäßigkeit ${Math.round(cons.score)}`);
      parts.push(cons.score < 75 ? 'Deine Schlafzeiten waren in den letzten Tagen weniger regelmäßig – eine feste Aufstehzeit ist oft der wirksamste erste Schritt.' : 'Deine Schlafzeiten sind recht regelmäßig – das ist eine gute Basis.');
    } else parts.push('Für die Regelmäßigkeit fehlen noch Nächte (mindestens 5 in 14 Tagen).');
  }

  if (wantsTrain) {
    const s = val(c.strain);
    if (s !== undefined) { basis.push(`Belastung ${s}`); parts.push(`Deine heutige Trainingsbelastung beträgt ${s} von 21 (app-eigene Skala).`); }
    if (c.strain3dAvg !== undefined && rec !== undefined) parts.push(c.strain3dAvg >= 12 && rec < 50 ? 'Nach mehreren fordernden Tagen mit niedriger Erholung kann ein lockerer Tag sinnvoll sein – das ist eine Anregung, keine Vorgabe.' : 'Belastung und Erholung wirken derzeit im Gleichgewicht. Höre zusätzlich auf dein Körpergefühl.');
  }

  if (wantsData) {
    parts.push(`Aktuell liegen ${c.days.length} Tage mit Messwerten und ${c.nights.length} Nächte vor. Scores werden erst mit ausreichend persönlichem Verlauf angezeigt (mindestens 14 Tage); Lücken werden nicht aufgefüllt.`);
  }

  if (MEDICAL.test(q)) parts.push('Medizinische Fragen kann ich nicht beantworten oder diagnostizieren. Bitte sprich dazu mit einer Ärztin oder einem Arzt.');

  const tips = generateTips(c).filter((t) => (wantsFood ? t.area === 'nutrition' || t.area === 'hydration' : true)).slice(0, wantsFood ? 3 : 1);
  for (const t of tips) parts.push(`Idee (${EVIDENCE_LABEL[t.evidence]}): ${t.title}. ${t.body}`);

  parts.push('Hinweis: Dies ist eine regelbasierte Auswertung, keine KI-Analyse und keine medizinische Beratung.');
  return { kind: 'rule_based', answer: parts.join('\n\n'), basis };
}
