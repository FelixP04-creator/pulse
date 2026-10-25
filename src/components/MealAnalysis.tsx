import React from 'react';
import { analyzeBioavailability, bioSummary } from '../core/bioavailability';
import { lensFit, LENS_META, rateItems, safetyNotes, type CustomRules, type LensId } from '../core/foodRating';
import { MICRO_KEYS, MICRO_REFERENCE, NUTRIENT_META, sumNutrients, type MealItem } from '../core/nutrition';
import { EVIDENCE_LABEL } from '../core/tips';
import { useTheme } from '../theme/ThemeProvider';
import { fmtNum } from '../lib/format';
import { Bar, Card, H2, P, Row, Stars } from './ui';

/** Gemeinsame Auswertung einer Mahlzeit oder eines Tages: Makros, Vitamine, Rating, Bioverfügbarkeit, Sicherheit, Perspektive. */
export function MealAnalysis({ items, lens, rules, compact }: { items: MealItem[]; lens?: LensId; rules: CustomRules; compact?: boolean }) {
  const t = useTheme();
  if (items.length === 0) return null;
  const n = sumNutrients(items);
  const rating = rateItems(items);
  const bio = analyzeBioavailability(items);
  const safety = safetyNotes(items);
  const fit = lens ? lensFit(lens, items, rules) : undefined;
  const dim = items.some((i) => i.nutrientsEstimated || i.per100g.kcal === 0);

  return (
    <>
      <Card>
        <Row><H2>Nährwerte</H2></Row>
        <P>{fmtNum(n.kcal)} kcal · Protein {fmtNum(n.protein, 1)} g · Kohlenhydrate {fmtNum(n.carbs, 1)} g (Zucker {fmtNum(n.sugar, 1)} g) · Fett {fmtNum(n.fat, 1)} g · Ballaststoffe {fmtNum(n.fiber, 1)} g</P>
        <P dim small>Richtwerte aus Nährwerttabellen für typische Produkte – Sorte, Zubereitung und Portionsgröße verändern sie. Gewichte aus Fotos sind Schätzungen.</P>
        {dim ? <P small>Für mindestens ein Lebensmittel fehlen Nährwerte (oder sie sind nur geschätzt). Die Summen sind dann unvollständig.</P> : null}
      </Card>

      <Card>
        <H2>Bewertung</H2>
        {rating.status === 'ok' ? (
          <>
            <Row><Stars value={rating.stars} /><P>{rating.label} · {rating.score}/100</P></Row>
            {rating.components.map((c) => <Bar key={c.key} label={c.label} pct={c.score} right={`${Math.round(c.score)} · ${Math.round(c.weight * 100)} %`} />)}
            {rating.highlights.map((x) => <P key={x} small>＋ {x}</P>)}
            {rating.gaps.map((x) => <P key={x} dim small>○ {x}</P>)}
            <P dim small>Nährstoffdichte-Rating nach app-eigenem, transparentem Modell. Eine einzelne Mahlzeit ist nicht „gut“ oder „schlecht“ – das Gesamtbild über Wochen zählt.</P>
          </>
        ) : <P dim>{rating.reason}</P>}
      </Card>

      <Card>
        <H2>Vitamine & Mineralstoffe</H2>
        {MICRO_KEYS.map((k) => {
          const pct = (n[k] / (MICRO_REFERENCE[k] as number)) * 100;
          return <Bar key={k} label={NUTRIENT_META[k].label} pct={pct} color={t.chart[1]} right={`${fmtNum(n[k], n[k] < 10 ? 1 : 0)} ${NUTRIENT_META[k].unit} · ${Math.round(pct)} %`} />;
        })}
        <P dim small>% der EU-Tagesreferenz (NRV). Das ist die Menge im Essen, nicht die aufgenommene Menge – siehe Bioverfügbarkeit.</P>
      </Card>

      <Card>
        <H2>Bioverfügbarkeit</H2>
        <P dim small>{bioSummary(bio)}</P>
        {bio.map((f) => (
          <Card key={f.id} style={{ backgroundColor: t.surfaceAlt }}>
            <P>{f.availability === 'good' ? '● ' : f.availability === 'mixed' ? '◐ ' : '○ '}{f.label} – {f.availability === 'good' ? 'gut verfügbar' : f.availability === 'mixed' ? 'teilweise verfügbar' : 'eingeschränkt verfügbar'}</P>
            <P dim small>{f.summary}</P>
            {f.improve ? <P small>Verbessern: {f.improve}</P> : null}
            <P dim small>Evidenz: {EVIDENCE_LABEL[f.evidence]}</P>
          </Card>
        ))}
      </Card>

      {safety.map((s) => <Card key={s.id} style={{ borderColor: t.warn, borderWidth: 1 }}><P>⚠ {s.text}</P></Card>)}

      {fit && lens ? (
        <Card>
          <H2>Perspektive: {LENS_META[lens].name}</H2>
          <P dim small>{LENS_META[lens].blurb}</P>
          {fit.status === 'ok' && fit.score !== undefined ? <Bar label="Übereinstimmung mit dieser Perspektive" pct={fit.score} right={`${fit.score} %`} /> : <P dim>{fit.points[0]}</P>}
          {fit.status === 'ok' ? fit.points.map((x) => <P key={x} small>{x}</P>) : null}
          {fit.caveats.map((x) => <P key={x} dim small>Hinweis: {x}</P>)}
          {compact ? null : <P dim small>Die Übereinstimmung ist kein Gesundheitsurteil.</P>}
        </Card>
      ) : null}
    </>
  );
}
