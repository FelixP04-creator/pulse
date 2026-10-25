import React, { useMemo, useState } from 'react';
import { LineChart } from '../../src/components/charts';
import { RangeChips } from '../../src/components/RangeChips';
import { Bar, Card, DemoBanner, Disclaimer, H1, H2, InsufficientCard, Metric, P, Screen } from '../../src/components/ui';
import { asleepMinutes, formatShiftedClock, sleepConsistency, sleepDebt, sleepNeedMin, sleepSummary } from '../../src/core/sleep';
import { fmtDuration, hhmm } from '../../src/lib/format';
import { chartDays, sleepScoreSeries, sleepSeries, type RangeId } from '../../src/lib/series';
import { useApp } from '../../src/state/AppState';
import { useTheme } from '../../src/theme/ThemeProvider';
import { scoreColor } from '../../src/theme/tokens';

export default function Sleep() {
  const { state, today, dataset, scores } = useApp();
  const t = useTheme();
  const [range, setRange] = useState<RangeId>('30');
  const n = chartDays(range);
  const night = dataset.nights.find((x) => x.date === today);
  const s = scores.sleep;
  const need = sleepNeedMin(state.profile);
  const cons = sleepConsistency(dataset.nights, today);
  const debt = sleepDebt(dataset.nights, today, state.profile);
  const week = sleepSummary(dataset.nights, today, 7);
  const month = sleepSummary(dataset.nights, today, 30);
  const dur = useMemo(() => sleepSeries(dataset.nights, today, n), [dataset.nights, today, n]);
  const sc = useMemo(() => sleepScoreSeries(dataset.nights, today, n, state.profile), [dataset.nights, today, n, state.profile]);
  const asleep = night ? asleepMinutes(night) : undefined;
  const st = night?.stages;

  return (
    <Screen banner={state.mode === 'demo' ? <DemoBanner /> : undefined}>
      <H1>Schlaf</H1>
      {s.status === 'ok' ? (
        <>
          <Metric title="Schlafwert" value={s.value} unit="/ 100" color={scoreColor(t, s.value)} provenance={s.provenance} caption={`Datenqualität: ${s.quality === 'high' ? 'hoch' : s.quality === 'medium' ? 'mittel' : 'gering'}`}
            explain="Dauer 60 % (gegenüber deinem geschätzten Bedarf), Regelmäßigkeit 25 % (Streuung von Bett- und Aufwachzeit), Effizienz 15 % (nur wenn das Gerät die tatsächliche Schlafzeit liefert)." />
          <Card>
            <H2>Zusammensetzung</H2>
            {s.components.map((c) => <Bar key={c.key} label={c.label} pct={c.score} color={scoreColor(t, c.score)} right={`${Math.round(c.score)} · ${Math.round(c.weight * 100)} %`} />)}
            {s.components.map((c) => <P key={c.key + 'd'} dim small>{c.label}: {c.detail}</P>)}
            {s.notes.map((x) => <P key={x} dim small>{x}</P>)}
          </Card>
        </>
      ) : <InsufficientCard title="Schlafwert" reason={s.reason} />}

      {night ? (
        <Card>
          <H2>Letzte Nacht</H2>
          <P>{hhmm(night.start)} – {hhmm(night.end)} · im Bett {fmtDuration(night.inBedMin)}</P>
          <P>Schlafzeit: {asleep !== undefined ? fmtDuration(asleep) : 'nicht ermittelbar'}{night.asleepIsEstimate ? ' (angenähert)' : ''}</P>
          {st ? (
            <>
              <Bar label="Tiefschlaf" pct={(st.deepMin / Math.max(1, night.inBedMin)) * 100} color={t.chart[1]} right={fmtDuration(st.deepMin)} />
              <Bar label="REM" pct={(st.remMin / Math.max(1, night.inBedMin)) * 100} color={t.chart[3]} right={fmtDuration(st.remMin)} />
              <Bar label="Leichtschlaf" pct={(st.lightMin / Math.max(1, night.inBedMin)) * 100} color={t.chart[0]} right={fmtDuration(st.lightMin)} />
              <Bar label="Wach" pct={(st.awakeMin / Math.max(1, night.inBedMin)) * 100} color={t.warn} right={fmtDuration(st.awakeMin)} />
              <P dim small>Phasen wurden vom Gerät geliefert (Schätzung der Gerätealgorithmen, keine Schlaflabor-Messung).</P>
            </>
          ) : <P dim small>Für diese Nacht liefert die Datenquelle keine Schlafphasen – deshalb werden keine angezeigt.</P>}
        </Card>
      ) : null}

      <Card>
        <H2>Bedarf & Defizit</H2>
        <P>Geschätzter Bedarf: {fmtDuration(need.minutes)} <P dim small>({need.basis})</P></P>
        {debt ? <P>Letzte 7 Tage: etwa {fmtDuration(debt.debtMin)} unter dem Bedarf (Ø über {debt.nightsCounted} Nächte). Das ist eine Orientierung – kein Rückstand, den du „abarbeiten“ musst.</P> : <P dim>Für das Defizit werden mindestens 4 Nächte in 7 Tagen benötigt.</P>}
      </Card>

      <Card>
        <H2>Deine Schlafroutine</H2>
        {week.avgBedShifted !== undefined && week.avgWakeShifted !== undefined ? <P>Ø Bettzeit {formatShiftedClock(week.avgBedShifted)} · Ø Aufwachzeit {formatShiftedClock(week.avgWakeShifted)} (7 Tage)</P> : <P dim>Noch zu wenige Nächte.</P>}
        {cons ? <P>Regelmäßigkeit {Math.round(cons.score)}/100 (Bettzeit ±{Math.round(cons.sigmaBedMin)} min, Aufwachzeit ±{Math.round(cons.sigmaWakeMin)} min)</P> : <P dim>Regelmäßigkeit: mindestens 5 Nächte in 14 Tagen nötig.</P>}
        {week.avgAsleepMin !== undefined && month.avgAsleepMin !== undefined ? <P dim small>Ø Schlafzeit: 7 Tage {fmtDuration(week.avgAsleepMin)} · 30 Tage {fmtDuration(month.avgAsleepMin)}</P> : null}
        <P dim small>Realistische Orientierung: Eine gleichbleibende Aufstehzeit ist meist hilfreicher als eine perfekte Einschlafzeit. Einzelne kurze Nächte sind normal.</P>
      </Card>

      <RangeChips value={range} onChange={setRange} days={dataset.days} today={today} />
      <Card><H2>Schlafdauer (Stunden)</H2><LineChart points={dur} color={t.chart[1]} baseline={need.minutes / 60} unit="h" caption={`gestrichelt: geschätzter Bedarf (${(need.minutes / 60).toFixed(1)} h)`} /></Card>
      <Card><H2>Schlafwert</H2><LineChart points={sc} color={t.chart[0]} yRange={[0, 100]} unit="/100" /></Card>
      <Disclaimer />
    </Screen>
  );
}
