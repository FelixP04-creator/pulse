import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { BarChart, LineChart } from '../../src/components/charts';
import { RangeChips } from '../../src/components/RangeChips';
import { Bar, Button, Card, DemoBanner, Disclaimer, H1, H2, Metric, P, ProvenanceBadge, Row, Screen } from '../../src/components/ui';
import { activitySummary, loadBalance, strainSeries, workoutLoad, zoneTotals } from '../../src/core/strain';
import { addDays } from '../../src/core/stats';
import { fmtNum } from '../../src/lib/format';
import { chartDays, recoverySeries, type RangeId } from '../../src/lib/series';
import { useApp } from '../../src/state/AppState';
import { useTheme } from '../../src/theme/ThemeProvider';

const BAL = {
  insufficient: 'Für den Vergleich fehlen Belastungs- oder Erholungsdaten.',
  room: 'Deine Erholung ist gut und die letzten Tage waren eher moderat – es ist Spielraum für Belastung da.',
  balanced: 'Belastung und Erholung wirken ausgewogen. Hör zusätzlich auf dein Körpergefühl.',
  strained: 'Mehrere fordernde Tage bei niedriger Erholung: Ein lockerer Tag könnte guttun – das ist eine Anregung, keine Vorgabe.',
} as const;
const ZONE = ['Zone 1 (50–60 % HRR)', 'Zone 2 (60–70 %)', 'Zone 3 (70–80 %)', 'Zone 4 (80–90 %)', 'Zone 5 (≥ 90 %)'];

export default function Strain() {
  const { state, today, dataset, scores } = useApp();
  const t = useTheme();
  const router = useRouter();
  const [range, setRange] = useState<RangeId>('7');
  const n = chartDays(range);
  const s = scores.strain;
  const series = useMemo(() => strainSeries(dataset.workouts, today, n), [dataset.workouts, today, n]);
  const rec = useMemo(() => recoverySeries(dataset.days, dataset.nights, today, n, state.profile), [dataset, today, n, state.profile]);
  const zones = zoneTotals(dataset.workouts, today, 7);
  const zmax = Math.max(1, ...zones);
  const todays = dataset.workouts.filter((w) => w.start.slice(0, 10) === today);
  const week = dataset.workouts.filter((w) => w.start.slice(0, 10) > addDays(today, -7));
  const act = activitySummary(dataset.days, today);
  const bal = loadBalance(scores.strain3dAvg, scores.recovery.status === 'ok' ? scores.recovery.value : undefined);
  const hasTraining = s.status === 'ok' && s.components.length > 0;

  return (
    <Screen banner={state.mode === 'demo' ? <DemoBanner /> : undefined}>
      <H1>Belastung</H1>
      <Metric title="Tagesbelastung" value={hasTraining && s.status === 'ok' ? s.value : undefined} unit="/ 21" provenance={s.status === 'ok' && hasTraining ? s.provenance : undefined}
        insufficient="Heute ist keine Einheit mit Herzfrequenzzonen oder Anstrengungsangabe erfasst."
        caption={s.status === 'ok' ? s.notes[0] : undefined}
        explain="App-eigenes Modell: Minuten in Herzfrequenzzonen (Zone 1–5, relativ zur Herzfrequenzreserve) werden gewichtet summiert und auf 0–21 abgebildet. Ohne Zonen kann eine Anstrengungsangabe (1–10) genutzt werden – dann ist es eine Schätzung. Nicht mit WHOOP oder anderen Anbietern vergleichbar. Alltagsaktivität und Erholung sind getrennte Größen." />

      <Card>
        <H2>Heutige Einheiten</H2>
        {todays.length === 0 ? <P dim>Heute keine Einheit erfasst.</P> : todays.map((w) => {
          const l = workoutLoad(w);
          return (
            <Row key={w.id}>
              <P>{w.type} · {w.durationMin} min{w.avgHr ? ` · Ø ${w.avgHr} bpm` : ''}{l ? ` · Last ${Math.round(l.load)}` : ' · ohne Belastungsdaten'}</P>
              <ProvenanceBadge kind={w.source === 'manual' ? 'manual' : 'measured'} />
            </Row>
          );
        })}
        <Button kind="ghost" title="Training eintragen / Historie" onPress={() => router.push('/activity')} />
      </Card>

      <Card>
        <H2>Belastung und Erholung</H2>
        <P>{BAL[bal]}</P>
        {scores.strain3dAvg !== undefined ? <P dim small>Ø Belastung der letzten 3 Tage: {fmtNum(scores.strain3dAvg, 1)} von 21.</P> : null}
      </Card>

      <RangeChips value={range} onChange={setRange} days={dataset.days} today={today} />
      <Card><H2>Belastungsverlauf</H2><BarChart points={series.map((x) => ({ label: x.date.slice(8), value: x.strain }))} max={21} color={t.chart[1]} unit="von 21" /></Card>
      <Card><H2>Erholung im Vergleich</H2><LineChart points={rec} color={t.chart[0]} yRange={[0, 100]} unit="/100" caption="Gleicher Zeitraum wie oben" /></Card>

      <Card>
        <H2>Herzfrequenzzonen (7 Tage)</H2>
        {zones.some((z) => z > 0) ? zones.map((z, i) => <Bar key={i} label={ZONE[i]} pct={(z / zmax) * 100} color={t.chart[i % 5]} right={`${z} min`} />) : <P dim>Keine Zonendaten – dafür sind Herzfrequenzwerte während des Trainings und ein Ruhepuls nötig.</P>}
        <P dim small>Zonen basieren auf HRmax (Eingabe oder Schätzung 208 − 0,7 × Alter) und dem Ruhepuls – individuell können sie abweichen.</P>
      </Card>

      <Card>
        <H2>Woche</H2>
        <P>{week.length} Einheit(en) · {week.reduce((a, w) => a + w.durationMin, 0)} min Training</P>
        <P dim small>Alltagsaktivität (getrennt vom Training): {act.weekActiveMinutes !== undefined ? `${act.weekActiveMinutes} aktive Minuten in 7 Tagen` : 'zu wenige Daten'}</P>
      </Card>
      <Disclaimer />
    </Screen>
  );
}
