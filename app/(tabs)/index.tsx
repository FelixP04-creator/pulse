import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Card, DemoBanner, H1, H2, Metric, P, Row, Screen, Button, ProvenanceBadge, Disclaimer } from '../../src/components/ui';
import { recoveryBand } from '../../src/core/recovery';
import { activitySummary } from '../../src/core/strain';
import { fmtDate, fmtDateTime, fmtNum } from '../../src/lib/format';
import { useApp } from '../../src/state/AppState';
import { useTheme } from '../../src/theme/ThemeProvider';
import { scoreColor } from '../../src/theme/tokens';

const BAND = { low: 'Dein Körper signalisiert heute eher Bedarf an Ruhe.', moderate: 'Du bist heute im mittleren Bereich deiner persönlichen Erholung.', high: 'Du bist heute im oberen Bereich deiner persönlichen Erholung.' } as const;

export default function Home() {
  const { state, today, dataset, scores, loading, loadError, connection } = useApp();
  const t = useTheme();
  const router = useRouter();
  const demo = state.mode === 'demo';
  const todayRow = dataset.days.find((d) => d.date === today);
  const act = activitySummary(dataset.days, today);
  const rec = scores.recovery.status === 'ok' ? scores.recovery : undefined;
  const slp = scores.sleep.status === 'ok' ? scores.sleep : undefined;
  const noData = !demo && dataset.days.length === 0 && dataset.nights.length === 0;

  return (
    <Screen banner={demo ? <DemoBanner /> : undefined}>
      <H1>{fmtDate(today)}</H1>
      {loading ? <ActivityIndicator color={t.accent} /> : null}
      {loadError ? <Card><P>{loadError}</P></Card> : null}

      {noData ? (
        <Card>
          <H2>Noch keine Daten</H2>
          <P dim>Es wurden noch keine Messwerte importiert. Verbinde dein Fitbit Air unter „Datenquellen“ und starte die Synchronisierung.</P>
          <Button title="Datenquellen öffnen" onPress={() => router.push('/data-sources')} />
        </Card>
      ) : null}

      <Card>
        <Row><H2>Gesamtstatus</H2>{demo ? <ProvenanceBadge kind="demo" /> : null}</Row>
        <P>{rec ? BAND[recoveryBand(rec.value)] : 'Für einen Gesamtstatus fehlen noch Daten (mindestens 14 Tage Verlauf, Schlaf und Tageswerte).'}</P>
        <P dim small>Letzte Synchronisierung: {demo ? 'Demo-Daten – keine echte Verbindung' : fmtDateTime(connection?.lastSyncAt ?? dataset.lastSyncAt)}</P>
      </Card>

      <Metric title="Erholung" value={rec?.value} unit="/ 100" color={rec ? scoreColor(t, rec.value) : undefined} provenance={rec?.provenance} onPress={() => router.push('/recovery')}
        insufficient={scores.recovery.status === 'insufficient' ? scores.recovery.reason : undefined}
        explain="Vergleicht HRV, Ruhepuls und Schlaf der letzten Nacht mit deinen eigenen Durchschnittswerten der letzten Wochen. Ein niedriger Wert ist keine Krankheitsaussage." />
      <Metric title="Schlaf" value={slp?.value} unit="/ 100" color={slp ? scoreColor(t, slp.value) : undefined} provenance={slp?.provenance} onPress={() => router.push('/sleep')}
        insufficient={scores.sleep.status === 'insufficient' ? scores.sleep.reason : undefined}
        explain="Setzt sich aus Schlafdauer (60 %), Regelmäßigkeit (25 %) und Effizienz (15 %) zusammen. Fehlt ein Teil, werden die Gewichte neu verteilt." />
      <Metric title="Belastung" value={scores.strain.status === 'ok' && scores.strain.components.length ? scores.strain.value : undefined} unit="/ 21" provenance={scores.strain.status === 'ok' ? scores.strain.provenance : undefined} onPress={() => router.push('/strain')}
        insufficient="Heute ist kein Training mit Herzfrequenzzonen oder Anstrengungsangabe erfasst."
        explain="App-eigene Skala 0–21 aus der Trainingsdauer in Herzfrequenzzonen. Nicht mit den Skalen anderer Anbieter vergleichbar. Alltagsbewegung zählt hier nicht mit." />

      <Row wrap>
        <Card style={{ flex: 1, minWidth: 150 }}><P dim small>Ruhepuls</P><H1>{fmtNum(todayRow?.restingHr)}</H1><P dim small>bpm · {todayRow?.restingHr === undefined ? 'kein Wert' : 'gemessen'}</P></Card>
        <Card style={{ flex: 1, minWidth: 150 }}><P dim small>HRV (RMSSD)</P><H1>{fmtNum(todayRow?.hrvMs)}</H1><P dim small>ms · {todayRow?.hrvMs === undefined ? 'kein Wert' : 'gemessen'}</P></Card>
      </Row>

      <Card>
        <H2>Aktivität</H2>
        <P>{act.steps !== undefined ? `${fmtNum(act.steps)} Schritte` : 'Keine Schritte erfasst'} · {act.activeMinutes !== undefined ? `${act.activeMinutes} aktive Min.` : 'keine aktiven Minuten'}{act.azm !== undefined ? ` · ${act.azm} Active Zone Min.` : ''}</P>
        {act.guidelineProgress !== undefined ? <P dim small>Diese Woche: {Math.round(act.guidelineProgress * 100)} % der allgemeinen Mindestempfehlung (150 aktive Minuten).</P> : null}
      </Card>

      <Row wrap>
        <Button kind="ghost" title="Ernährung" onPress={() => router.push('/nutrition')} />
        <Button kind="ghost" title="Coach" onPress={() => router.push('/coach')} />
        <Button kind="ghost" title="Training" onPress={() => router.push('/activity')} />
        <Button kind="ghost" title="Krafttraining" onPress={() => router.push('/lifting')} />
        <Button kind="ghost" title="Wohlbefinden" onPress={() => router.push('/wellbeing')} />
        <Button kind="ghost" title="Datenquellen" onPress={() => router.push('/data-sources')} />
        <Button kind="ghost" title="Einstellungen" onPress={() => router.push('/settings')} />
      </Row>
      <Disclaimer />
    </Screen>
  );
}
