import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Card, DemoBanner, Disclaimer, H2, P, ProvenanceBadge, Row, Screen } from '../src/components/ui';
import { fmtDateTime } from '../src/lib/format';
import { invoke, isConfigured, supabase } from '../src/lib/supabase';
import type { DataTypeStatusView } from '../src/data/live';
import { useApp } from '../src/state/AppState';

const LABEL: Record<string, string> = {
  'daily-resting-heart-rate': 'Ruheherzfrequenz', 'daily-heart-rate-variability': 'HRV (täglich)', 'daily-respiratory-rate': 'Atemfrequenz', 'daily-oxygen-saturation': 'Sauerstoffsättigung (SpO₂)',
  'daily-sleep-temperature-derivations': 'Hauttemperatur-Abweichung', 'daily-vo2-max': 'Cardio-Fitness (VO₂max)', steps: 'Schritte', 'active-minutes': 'Aktive Minuten', 'active-zone-minutes': 'Active Zone Minutes', sleep: 'Schlaf', exercise: 'Training',
};
const STATE: Record<DataTypeStatusView['state'], string> = {
  ok: '✓ Messwerte erhalten', no_data: '○ Keine Daten im Zeitraum', unsupported_device: '✕ Vom Gerät nicht unterstützt', missing_scope: '✕ Berechtigung fehlt', error: '! Fehler', not_requested: '– Noch nicht abgefragt',
};
const STATUS_TEXT = { connected: 'Verbunden', needs_reauth: 'Erneute Anmeldung nötig', revoked: 'Zugriff widerrufen', error: 'Fehler' } as const;

export default function DataSources() {
  const { state, connection, reload, signedIn, loading } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState<string>();
  const [msg, setMsg] = useState<string>();
  const demo = state.mode === 'demo';

  const ensureConsent = async (): Promise<boolean> => {
    const { data } = await supabase!.from('consents').select('granted').eq('purpose', 'google_health_import').order('created_at', { ascending: false }).limit(1);
    if (data?.[0]?.granted) return true;
    const ok = await new Promise<boolean>((resolve) => Alert.alert('Gesundheitsdaten importieren?', 'PULSE liest bei Google nur Schlaf, Aktivität sowie Herzfrequenz-, HRV-, SpO₂-, Atemfrequenz- und Temperaturdaten – ausschließlich lesend. Standort, EKG, Profil und Ernährung werden nicht angefragt. Die Daten werden verschlüsselt übertragen und nur für dich gespeichert. Du kannst den Zugriff jederzeit hier oder in deinem Google-Konto widerrufen.', [{ text: 'Abbrechen', style: 'cancel', onPress: () => resolve(false) }, { text: 'Weiter zu Google', onPress: () => resolve(true) }]));
    if (!ok) return false;
    const { data: u } = await supabase!.auth.getUser();
    if (!u.user) return false;
    await supabase!.from('consents').insert([{ user_id: u.user.id, purpose: 'health_data_processing', granted: true, policy_version: '2026-10' }, { user_id: u.user.id, purpose: 'google_health_import', granted: true, policy_version: '2026-10' }]);
    return true;
  };

  const connect = async () => {
    if (!supabase) return;
    setBusy('connect'); setMsg(undefined);
    try {
      if (!(await ensureConsent())) return;
      const r = await invoke<{ url: string }>('google-health-oauth-start');
      if (r.error || !r.data?.url) return setMsg('Die Anmeldung konnte nicht gestartet werden. Ist das Backend mit den Google-Zugangsdaten eingerichtet? (siehe README)');
      const res = await WebBrowser.openAuthSessionAsync(r.data.url, 'pulse://data-sources');
      if (res.type === 'success') {
        const status = new URL(res.url).searchParams.get('status');
        setMsg(status === 'connected' ? 'Verbunden. Du kannst jetzt synchronisieren.' : status === 'no_scopes' ? 'Es wurden keine benötigten Berechtigungen erteilt.' : status === 'denied' ? 'Du hast die Anmeldung abgebrochen.' : 'Die Verbindung konnte nicht abgeschlossen werden.');
      }
      await reload();
    } finally { setBusy(undefined); }
  };

  const sync = async () => {
    setBusy('sync'); setMsg(undefined);
    const r = await invoke<{ ok: boolean; warnings?: string[] }>('google-health-sync', { days: 30 });
    setBusy(undefined);
    if (r.error === 'needs_reauth' || r.status === 409) setMsg('Der Zugriff ist abgelaufen oder wurde widerrufen. Bitte erneut verbinden.');
    else if (r.error) setMsg('Synchronisierung fehlgeschlagen. Bitte später erneut versuchen.');
    else setMsg(`Synchronisierung abgeschlossen${r.data?.warnings?.length ? ` (${r.data.warnings.length} Hinweis(e) zum Datenformat – siehe README)` : ''}.`);
    await reload();
  };

  const disconnect = () => Alert.alert('Verbindung trennen?', 'Der Zugriff wird bei Google widerrufen und gespeicherte Zugangsdaten werden gelöscht.', [
    { text: 'Abbrechen', style: 'cancel' },
    { text: 'Nur trennen', onPress: async () => { await invoke('google-health-disconnect', { deleteData: false }); await reload(); } },
    { text: 'Trennen & Daten löschen', style: 'destructive', onPress: async () => { await invoke('google-health-disconnect', { deleteData: true }); await reload(); } },
  ]);

  return (
    <Screen banner={demo ? <DemoBanner /> : undefined}>
      <Card>
        <Row><H2>Google Health API · Fitbit Air</H2>{demo ? <ProvenanceBadge kind="demo" /> : null}</Row>
        {demo ? (
          <>
            <P>Demo-Modus: Es besteht <P>keine</P> Verbindung zu einem Gerät. Alle angezeigten Werte sind erfundene Beispieldaten.</P>
            <Button title="Zum Live-Modus wechseln" onPress={() => router.push('/settings')} />
          </>
        ) : !isConfigured ? (
          <P>Das Backend ist nicht konfiguriert (EXPO_PUBLIC_SUPABASE_URL / ANON_KEY fehlen). Deshalb ist keine Verbindung möglich. Siehe README, Abschnitt „Einrichtung“.</P>
        ) : !signedIn ? (
          <><P>Bitte zuerst anmelden.</P><Button title="Anmelden" onPress={() => router.push('/auth')} /></>
        ) : !connection ? (
          <><P>Noch nicht verbunden.</P><Button title={busy === 'connect' ? 'Öffne Google …' : 'Mit Google verbinden'} disabled={!!busy} onPress={connect} /></>
        ) : (
          <>
            <P>Status: {STATUS_TEXT[connection.status]}</P>
            <P dim small>Letzte erfolgreiche Synchronisierung: {fmtDateTime(connection.lastSyncAt)}{connection.lastSyncStatus === 'partial' ? ' (teilweise)' : connection.lastSyncStatus === 'rate_limited' ? ' (Limit erreicht – später erneut)' : ''}</P>
            {connection.lastError ? <P small>{connection.lastError}</P> : null}
            <Row wrap>
              {connection.status === 'connected' ? <Button title={busy === 'sync' ? 'Synchronisiere …' : 'Jetzt synchronisieren'} disabled={!!busy || loading} onPress={sync} /> : <Button title="Erneut verbinden" disabled={!!busy} onPress={connect} />}
              <Button kind="ghost" title="Trennen" onPress={disconnect} />
            </Row>
          </>
        )}
        {msg ? <P small>{msg}</P> : null}
      </Card>

      {connection?.detail ? (
        <Card>
          <H2>Datentypen</H2>
          <P dim small>Unterschieden wird zwischen echten Messwerten, fehlenden Daten, nicht unterstützten Daten und fehlenden Berechtigungen.</P>
          {Object.entries(connection.detail).map(([k, v]) => <P key={k}>{LABEL[k] ?? k}: {STATE[v.state]}{v.count ? ` (${v.count})` : ''}{v.message && v.state !== 'ok' ? ` – ${v.message}` : ''}</P>)}
        </Card>
      ) : null}

      <Card>
        <H2>Gerätehinweise</H2>
        <P dim small>Laut Google-Dokumentation (Stand 24.10.2026) liefert das Fitbit Air u. a. Herzfrequenz, HRV, Ruhepuls, Schlaf, SpO₂, Atemfrequenz, Active Zone Minutes, VO₂max und Hauttemperatur-Abweichung. Ob einzelne Werte tatsächlich ankommen, hängt von Konto, Berechtigungen und Tragezeit ab. Die Anbindung wurde bisher nicht mit einem echten Konto getestet.</P>
      </Card>
      <Disclaimer />
    </Screen>
  );
}
