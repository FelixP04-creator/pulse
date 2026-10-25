import React, { useMemo, useState } from 'react';
import { LineChart } from '../../src/components/charts';
import { Bar, Card, DemoBanner, H1, H2, InsufficientCard, Metric, P, Row, Screen, Disclaimer } from '../../src/components/ui';
import { RangeChips } from '../../src/components/RangeChips';
import { baselineFor } from '../../src/core/baselines';
import { recoveryBand, recoveryDrivers } from '../../src/core/recovery';
import { generateTips, EVIDENCE_LABEL } from '../../src/core/tips';
import { chartDays, metricSeries, recoverySeries, type RangeId } from '../../src/lib/series';
import { useApp } from '../../src/state/AppState';
import { useTheme } from '../../src/theme/ThemeProvider';
import { scoreColor } from '../../src/theme/tokens';

const BAND = { low: 'unter deinem üblichen Bereich', moderate: 'im mittleren Bereich', high: 'im oberen Bereich' } as const;

export default function Recovery() {
  const { state, today, dataset, scores } = useApp();
  const t = useTheme();
  const [range, setRange] = useState<RangeId>('30');
  const n = chartDays(range);
  const r = scores.recovery;
  const series = useMemo(() => ({
    rec: recoverySeries(dataset.days, dataset.nights, today, n, state.profile),
    hrv: metricSeries(dataset.days, 'hrvMs', today, n),
    rhr: metricSeries(dataset.days, 'restingHr', today, n),
  }), [dataset, today, n, state.profile]);
  const hrvBase = baselineFor(dataset.days, 'hrvMs', today);
  const rhrBase = baselineFor(dataset.days, 'restingHr', today);
  const tips = generateTips({ asOf: today, sleep: scores.sleep, recovery: r, strain: scores.strain, strain3dAvg: scores.strain3dAvg, nights: dataset.nights, meals: state.meals, month: new Date().getMonth() + 1, hourOfDay: new Date().getHours() }).filter((x) => x.area === 'recovery' || x.area === 'stress' || x.area === 'sleep').slice(0, 3);

  return (
    <Screen banner={state.mode === 'demo' ? <DemoBanner /> : undefined}>
      <H1>Erholung</H1>
      {r.status === 'ok' ? (
        <>
          <Metric title="Recovery-Score" value={r.value} unit="/ 100" color={scoreColor(t, r.value)} provenance={r.provenance} caption={`${BAND[recoveryBand(r.value)]} · Datenqualität: ${r.quality === 'high' ? 'hoch' : r.quality === 'medium' ? 'mittel' : 'gering'}`}
            explain="Gewichtet: HRV 40 %, Ruhepuls 25 %, Schlafdauer 25 %, Schlafregelmäßigkeit 10 %. HRV und Ruhepuls werden mit deinem Median der letzten 60 Tage verglichen. Ein niedriger Wert ist keine Krankheitsaussage – Alkohol, Stress, Training, Reisen oder Sensorrauschen wirken mit." />
          <Card>
            <H2>Einflussfaktoren</H2>
            {recoveryDrivers(r).map((c) => <Bar key={c.key} label={c.label} pct={c.score} color={scoreColor(t, c.score)} right={`${Math.round(c.score)} · ${Math.round(c.weight * 100)} %`} />)}
            {recoveryDrivers(r).map((c) => <P key={c.key + 'd'} dim small>{c.label}: {c.detail}</P>)}
            {r.notes.map((x) => <P key={x} dim small>{x}</P>)}
          </Card>
        </>
      ) : <InsufficientCard title="Recovery-Score" reason={r.reason} />}

      <RangeChips value={range} onChange={setRange} history={dataset.days.length} today={today} days={dataset.days} />
      <Card><H2>Erholungsverlauf</H2><LineChart points={series.rec} color={t.chart[0]} yRange={[0, 100]} unit="/100" caption={`${n} Tage – Lücken bleiben leer, es wird nichts aufgefüllt`} /></Card>
      <Card>
        <Row><H2>HRV</H2></Row>
        <LineChart points={series.hrv} color={t.chart[1]} baseline={hrvBase?.center} unit="ms" caption={hrvBase ? `gestrichelt: dein Ausgangswert ${hrvBase.center.toFixed(0)} ms (${hrvBase.n} Tage)` : 'Ausgangswert noch nicht berechenbar (mind. 14 Tage)'} />
      </Card>
      <Card>
        <H2>Ruhepuls</H2>
        <LineChart points={series.rhr} color={t.chart[4]} baseline={rhrBase?.center} unit="bpm" caption={rhrBase ? `gestrichelt: dein Ausgangswert ${rhrBase.center.toFixed(0)} bpm` : 'Ausgangswert noch nicht berechenbar (mind. 14 Tage)'} />
      </Card>

      {tips.length ? (
        <Card>
          <H2>Anregungen</H2>
          {tips.map((x) => <P key={x.id}><P dim small>{EVIDENCE_LABEL[x.evidence]} · </P>{x.title}: {x.body} <P dim small>Warum: {x.because}</P></P>)}
        </Card>
      ) : null}
      <Disclaimer />
    </Screen>
  );
}
