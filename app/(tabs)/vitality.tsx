import React, { useMemo, useState } from 'react';
import { LineChart } from '../../src/components/charts';
import { Bar, Card, DemoBanner, Disclaimer, Field, H1, H2, InsufficientCard, Metric, P, ProvenanceBadge, Row, Screen } from '../../src/components/ui';
import { addDays } from '../../src/core/stats';
import { physiologicalAgeIndicator, vitalitySeries } from '../../src/core/vitality';
import { useApp } from '../../src/state/AppState';
import { useTheme } from '../../src/theme/ThemeProvider';
import { scoreColor } from '../../src/theme/tokens';

export default function Vitality() {
  const { state, update, today, dataset, scores } = useApp();
  const t = useTheme();
  const [ageText, setAgeText] = useState(state.profile.age ? String(state.profile.age) : '');
  const v = scores.vitality;
  const last = dataset.days.filter((d) => d.vo2max !== undefined).slice(-1)[0];
  const pa = physiologicalAgeIndicator({ calendarAge: state.profile.age, vo2max: last?.vo2max });
  const series = useMemo(() => vitalitySeries(dataset.days, dataset.nights, today, 7, 26, state.profile).map((p) => ({ label: p.date.slice(5), value: p.value })), [dataset, today, state.profile]);
  const hist = dataset.days.length ? dataset.days[0].date : addDays(today, 0);

  return (
    <Screen banner={state.mode === 'demo' ? <DemoBanner /> : undefined}>
      <H1>Vitalität</H1>
      <P dim>Dieser Bereich zeigt keinen „echten“ Biologisches-Alter-Wert. Das lässt sich aus Wearable-Daten allein nicht zuverlässig bestimmen. Stattdessen gibt es zwei getrennte, ehrlich gekennzeichnete Anzeigen.</P>

      {v.status === 'ok' ? (
        <>
          <Metric title="Vitalitätsindex (app-eigen)" value={v.value} unit="/ 100" color={scoreColor(t, v.value)} provenance="calculated"
            caption={`± ${v.uncertainty} Punkte (Heuristik) · Datenqualität: ${v.quality === 'high' ? 'hoch' : v.quality === 'medium' ? 'mittel' : 'gering'} · ${v.historyDays} Tage Verlauf`}
            explain="Fasst Gewohnheiten (Schlafregelmäßigkeit, Schlafdauer, Alltagsbewegung) mit der Entwicklung von Ruhepuls, HRV und – falls vorhanden – Cardio-Fitness der letzten 28 Tage gegenüber deiner eigenen Ausgangslage zusammen. 50 bedeutet bei den Entwicklungs-Teilen „unverändert“. Kein medizinisch validierter Wert, kein biologisches Alter." />
          <Card>
            <H2>Einfluss der Messwerte</H2>
            {v.habits !== undefined ? <P dim small>Gewohnheiten gesamt: {v.habits} · Entwicklung gesamt: {v.trend ?? '–'}</P> : null}
            {v.components.map((c) => (
              <React.Fragment key={c.key}>
                <Bar label={c.label} pct={c.score} color={scoreColor(t, c.score)} right={`${Math.round(c.score)} · Gewicht ${Math.round(c.weight * 100)} %`} />
                <Row><P dim small>{c.detail}</P><ProvenanceBadge kind={c.provenance} /></Row>
              </React.Fragment>
            ))}
            {v.notes.map((x) => <P key={x} dim small>{x}</P>)}
          </Card>
          <Card><H2>Entwicklung (wöchentlich)</H2><LineChart points={series} color={t.chart[3]} yRange={[0, 100]} unit="/100" caption={`Verlauf seit ${hist}; Wochen ohne ausreichende Daten fehlen`} /></Card>
        </>
      ) : <InsufficientCard title="Vitalitätsindex" reason={v.reason} />}

      <Card>
        <H2>Physiologischer Altersindikator</H2>
        <Row><P dim small>Nicht diagnostisch</P><ProvenanceBadge kind="estimated" /></Row>
        {pa.status === 'ok'
          ? <P>{pa.ageYears} ± {pa.uncertaintyYears} Jahre (Modell {pa.modelId}; {pa.citation}; validiert für: {pa.validatedFor})</P>
          : <>
              <P>Derzeit nicht verfügbar.</P>
              {pa.reasons.map((x) => <P key={x} dim small>{x}</P>)}
            </>}
        <Field label="Kalenderalter (optional, bleibt auf deinem Gerät)" value={ageText} keyboardType="number-pad" placeholder="z. B. 38"
          onChangeText={(x) => { setAgeText(x); const n = Number(x); update({ profile: { ...state.profile, age: Number.isFinite(n) && n >= 10 && n <= 110 ? n : undefined } }); }} />
        <P dim small>Es soll niemand Angst vor dem Altern bekommen: Der Index beschreibt Gewohnheiten und Trends, die du beeinflussen kannst – ohne Versprechen zur „Verjüngung“.</P>
      </Card>

      <Card>
        <H2>Mögliche Verbesserungsbereiche</H2>
        {v.status === 'ok' ? [...v.components].sort((a, b) => a.score - b.score).slice(0, 2).map((c) => <P key={c.key}>• {c.label}: aktuell {Math.round(c.score)}/100. Kleine, gleichbleibende Schritte wirken über Wochen mehr als große Sprünge.</P>) : <P dim>Sobald genug Daten vorliegen, erscheinen hier die Bereiche mit dem größten Spielraum.</P>}
      </Card>
      <Disclaimer />
    </Screen>
  );
}
