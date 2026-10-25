import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { MealAnalysis } from '../src/components/MealAnalysis';
import { Bar, Button, Card, Chip, DemoBanner, Disclaimer, Field, H2, P, Row, Screen, Stars } from '../src/components/ui';
import { LENS_META, rateItems, type LensId } from '../src/core/foodRating';
import { dayTotals, FOODS, MEAL_LABEL, MEAL_TYPES, proteinRange } from '../src/core/nutrition';
import { addDays } from '../src/core/stats';
import { EVIDENCE_LABEL, generateTips } from '../src/core/tips';
import { fmtDate, fmtNum } from '../src/lib/format';
import { useApp } from '../src/state/AppState';
import { useTheme } from '../src/theme/ThemeProvider';

const LENSES: Array<{ id: LensId | 'none'; label: string }> = [{ id: 'none', label: 'Keine' }, { id: 'peat', label: 'Ray Peat' }, { id: 'primal', label: 'Aajonus Vonderplanitz' }, { id: 'custom', label: 'Mace Woodville / eigene' }];
const TAG_CHOICES = ['fruit', 'juice', 'dairy', 'animal', 'organ', 'seafood', 'vegetable', 'legume', 'nut', 'grain', 'egg', 'honey', 'sweetener', 'oil_seed', 'fat_saturated'];
const TAG_LABEL: Record<string, string> = { fruit: 'Obst', juice: 'Saft', dairy: 'Milchprodukte', animal: 'Tierisch', organ: 'Innereien', seafood: 'Meeresfrüchte', vegetable: 'Gemüse', legume: 'Hülsenfrüchte', nut: 'Nüsse', grain: 'Getreide', egg: 'Eier', honey: 'Honig', sweetener: 'Süßungsmittel', oil_seed: 'Samenöle', fat_saturated: 'Ges. Fette' };

export default function Nutrition() {
  const { state, update, today } = useApp();
  const t = useTheme();
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const meals = state.meals.filter((m) => m.date === date);
  const items = meals.flatMap((m) => m.items);
  const totals = dayTotals(state.meals, date);
  const water = state.hydration[date] ?? 0;
  const lens = state.lens;
  const range = state.profile.weightKg ? proteinRange(state.profile.weightKg) : undefined;
  const tips = useMemo(() => generateTips({ asOf: date, nights: [], meals: state.meals, hydrationMlToday: water, hourOfDay: date === today ? new Date().getHours() : 20, lens: lens === 'custom' && !state.customRules.prefer.length && !state.customRules.avoid.length ? undefined : lens, month: new Date().getMonth() + 1 }).filter((x) => x.area === 'nutrition' || x.area === 'hydration'), [date, state.meals, water, lens, state.customRules, today]);

  const toggle = (list: 'prefer' | 'avoid', tag: string) => {
    const cur = state.customRules[list];
    const other = list === 'prefer' ? 'avoid' : 'prefer';
    update({ customRules: { ...state.customRules, [list]: cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag], [other]: state.customRules[other].filter((x) => x !== tag) } });
  };

  return (
    <Screen banner={state.mode === 'demo' ? <DemoBanner /> : undefined}>
      <Row><Chip label="◀" onPress={() => setDate(addDays(date, -1))} /><P>{fmtDate(date)}</P><Chip label="▶" active={false} onPress={() => (date < today ? setDate(addDays(date, 1)) : undefined)} /></Row>

      <Card>
        <H2>Tagesübersicht</H2>
        <P>{fmtNum(totals.kcal)} kcal · Protein {fmtNum(totals.protein)} g · KH {fmtNum(totals.carbs)} g · Fett {fmtNum(totals.fat)} g · Ballaststoffe {fmtNum(totals.fiber)} g</P>
        {range ? <P dim small>Allgemeine Orientierung für Protein bei {state.profile.weightKg} kg: etwa {range.low}–{range.high} g pro Tag (0,8–1,6 g/kg). Kein persönlicher Bedarf.</P> : <P dim small>Mit deinem Gewicht (Einstellungen) kann ich eine allgemeine Proteinorientierung zeigen.</P>}
        {items.length ? <Button kind="ghost" title={showAnalysis ? 'Tagesanalyse ausblenden' : 'Tagesanalyse: Vitamine, Bewertung, Bioverfügbarkeit'} onPress={() => setShowAnalysis((s) => !s)} /> : null}
        <P dim small>Keine Kalorienziele oder Diäten – die App zeigt, was in deinem Essen steckt.</P>
      </Card>
      {showAnalysis ? <MealAnalysis items={items} lens={lens} rules={state.customRules} /> : null}

      {MEAL_TYPES.map((type) => {
        const ms = meals.filter((m) => m.type === type);
        return (
          <Card key={type}>
            <Row><H2>{MEAL_LABEL[type]}</H2></Row>
            {ms.length === 0 ? <P dim>Noch nichts erfasst.</P> : ms.map((m) => {
              const r = rateItems(m.items);
              const kcal = m.items.reduce((a, i) => a + (i.per100g.kcal * i.grams) / 100, 0);
              const prot = m.items.reduce((a, i) => a + (i.per100g.protein * i.grams) / 100, 0);
              return (
                <Card key={m.id} style={{ backgroundColor: t.surfaceAlt }} onPress={() => router.push({ pathname: '/meal/edit', params: { id: m.id } })} label={`${MEAL_LABEL[type]} bearbeiten`}>
                  <P>{m.items.map((i) => `${i.name} ${Math.round(i.grams)} g`).join(' · ')}</P>
                  <P dim small>{Math.round(kcal)} kcal · {Math.round(prot)} g Protein{m.time ? ` · ${m.time} Uhr` : ''}{m.items.some((i) => i.source === 'ai') ? ' · per Foto erkannt' : ''}</P>
                  {r.status === 'ok' ? <Row><Stars value={r.stars} /><P dim small>{r.label}</P></Row> : null}
                </Card>
              );
            })}
            <Button kind="ghost" title={`${MEAL_LABEL[type]} hinzufügen (Foto oder manuell)`} onPress={() => router.push({ pathname: '/meal/edit', params: { type, date } })} />
          </Card>
        );
      })}

      <Card>
        <H2>Flüssigkeit</H2>
        <Bar label="Getrunken" pct={Math.min(100, (water / 2000) * 100)} right={`${water} ml`} color={t.chart[1]} />
        <Row wrap>
          {[200, 250, 500].map((ml) => <Chip key={ml} label={`+${ml} ml`} onPress={() => update({ hydration: { ...state.hydration, [date]: water + ml } })} />)}
          <Chip label="Zurücksetzen" onPress={() => update({ hydration: { ...state.hydration, [date]: 0 } })} />
        </Row>
        <P dim small>Wie viel du brauchst, hängt von Hitze, Training und Ernährung ab. Die Balkenmarke (2 Liter) ist nur eine grobe Orientierung.</P>
      </Card>

      <Card>
        <H2>Ernährungs-Perspektive</H2>
        <P dim small>Optional: Zeigt, wie gut deine Mahlzeiten zu einer bestimmten Ernährungsweise passen – inklusive Hinweis auf die Studienlage. Das ist keine Empfehlung und keine Gesundheitsbewertung.</P>
        <Row wrap>{LENSES.map((l) => <Chip key={l.id} label={l.label} active={(lens ?? 'none') === l.id} onPress={() => update({ lens: l.id === 'none' ? undefined : l.id })} />)}</Row>
        {lens ? <><P small>{LENS_META[lens].blurb}</P><P dim small>{LENS_META[lens].caveat}</P></> : null}
        {lens === 'custom' ? (
          <>
            <P small>Bevorzugen:</P>
            <Row wrap>{TAG_CHOICES.map((tag) => <Chip key={'p' + tag} label={TAG_LABEL[tag]} active={state.customRules.prefer.includes(tag)} onPress={() => toggle('prefer', tag)} />)}</Row>
            <P small>Meiden:</P>
            <Row wrap>{TAG_CHOICES.map((tag) => <Chip key={'a' + tag} label={TAG_LABEL[tag]} active={state.customRules.avoid.includes(tag)} onPress={() => toggle('avoid', tag)} />)}</Row>
            <P dim small>Hinweis: Für Mace Woodville liegen mir keine verlässlichen Quellen vor – lege hier selbst fest, welchen Prinzipien du folgen möchtest. Die App ordnet ihm keine Aussagen zu.</P>
          </>
        ) : null}
      </Card>

      {tips.length ? (
        <Card>
          <H2>Biohacking-Anregungen</H2>
          {tips.map((x) => <P key={x.id}>• {x.title} <P dim small>({EVIDENCE_LABEL[x.evidence]})</P>{'\n'}<P dim small>{x.body} Warum: {x.because}</P></P>)}
        </Card>
      ) : null}
      <P dim small>Datenbank: {FOODS.length} Lebensmittel mit Richtwerten pro 100 g. Mahlzeiten werden lokal auf diesem Gerät gespeichert.</P>
      <Disclaimer />
    </Screen>
  );
}
