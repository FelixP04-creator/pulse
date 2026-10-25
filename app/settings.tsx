import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { Button, Card, Chip, Disclaimer, Field, H2, P, Row, Screen } from '../src/components/ui';
import { invoke, isConfigured, supabase } from '../src/lib/supabase';
import { useApp } from '../src/state/AppState';

export default function Settings() {
  const { state, update, signedIn } = useApp();
  const router = useRouter();
  const p = state.profile;
  const [age, setAge] = useState(p.age ? String(p.age) : '');
  const [sleepH, setSleepH] = useState(p.sleepTargetMin ? String(p.sleepTargetMin / 60) : '');
  const [kg, setKg] = useState(p.weightKg ? String(p.weightKg) : '');
  const [hrMax, setHrMax] = useState(p.hrMax ? String(p.hrMax) : '');
  const [busy, setBusy] = useState(false);

  const save = () => {
    const a = Number(age), s = Number(sleepH.replace(',', '.')), w = Number(kg.replace(',', '.')), h = Number(hrMax);
    update({ profile: { ...p, age: a >= 10 && a <= 110 ? a : undefined, sleepTargetMin: s >= 4 && s <= 12 ? Math.round(s * 60) : undefined, weightKg: w >= 25 && w <= 300 ? w : undefined, hrMax: h >= 120 && h <= 230 ? h : undefined } });
    Alert.alert('Gespeichert', 'Angaben bleiben auf diesem Gerät. Ungültige Werte wurden ignoriert.');
  };

  const exportData = async () => {
    setBusy(true);
    const r = await invoke<Record<string, unknown>>('account-export');
    setBusy(false);
    const local = { exportedAt: new Date().toISOString(), device: { meals: state.meals, hydration: state.hydration, checkins: state.checkins, habits: state.habits, habitLogs: state.habitLogs, manualWorkouts: state.manualWorkouts, liftSessions: state.liftSessions, profile: state.profile } };
    await Share.share({ message: JSON.stringify({ server: r.data ?? null, ...local }, null, 2), title: 'PULSE – Datenexport' });
  };

  const wipeLocal = () => Alert.alert('Lokale Daten löschen?', 'Mahlzeiten, Check-ins, Gewohnheiten, manuelle Trainings, Krafteinheiten und Profilangaben auf diesem Gerät werden gelöscht.', [
    { text: 'Abbrechen', style: 'cancel' },
    { text: 'Löschen', style: 'destructive', onPress: () => update({ meals: [], hydration: {}, checkins: {}, habits: [], habitLogs: {}, manualWorkouts: [], liftSessions: [], profile: {}, lens: undefined, customRules: { prefer: [], avoid: [] } }) },
  ]);

  const deleteAccount = () => Alert.alert('Konto endgültig löschen?', 'Alle Server-Daten, Verbindungen und dein Login werden unwiderruflich gelöscht. Der Google-Zugriff wird widerrufen.', [
    { text: 'Abbrechen', style: 'cancel' },
    { text: 'Endgültig löschen', style: 'destructive', onPress: async () => {
      setBusy(true);
      const r = await invoke('account-delete', { confirm: 'DELETE' });
      setBusy(false);
      if (r.error) return Alert.alert('Löschen fehlgeschlagen', 'Bitte später erneut versuchen.');
      await supabase?.auth.signOut();
      update({ mode: 'unset' });
      router.replace('/welcome');
    } },
  ]);

  return (
    <Screen>
      <Card>
        <H2>Darstellung</H2>
        <Row>{(['dark', 'light', 'system'] as const).map((t) => <Chip key={t} label={t === 'dark' ? 'Dunkel' : t === 'light' ? 'Hell' : 'System'} active={state.theme === t} onPress={() => update({ theme: t })} />)}</Row>
      </Card>

      <Card>
        <H2>Modus</H2>
        <P dim small>{state.mode === 'demo' ? 'Demo: erfundene Beispieldaten.' : 'Live: echte Daten aus deinem Konto.'}</P>
        <Row>
          <Chip label="Demo" active={state.mode === 'demo'} onPress={() => update({ mode: 'demo' })} />
          <Chip label="Live" active={state.mode === 'live'} onPress={() => (isConfigured ? (update({ mode: 'live' }), signedIn ? undefined : router.push('/auth')) : Alert.alert('Nicht verfügbar', 'Das Backend ist nicht konfiguriert (siehe README).'))} />
        </Row>
      </Card>

      <Card>
        <H2>Profil (optional)</H2>
        <P dim small>Alle Angaben sind freiwillig, bleiben auf diesem Gerät und verbessern nur die Auswertung.</P>
        <Row>
          <View style={{ flex: 1 }}><Field label="Alter" keyboardType="number-pad" value={age} onChangeText={setAge} /></View>
          <View style={{ flex: 1 }}><Field label="Schlafziel (h)" keyboardType="decimal-pad" value={sleepH} onChangeText={setSleepH} /></View>
        </Row>
        <Row>
          <View style={{ flex: 1 }}><Field label="Gewicht (kg)" keyboardType="decimal-pad" value={kg} onChangeText={setKg} /></View>
          <View style={{ flex: 1 }}><Field label="Max. Puls (bpm)" keyboardType="number-pad" value={hrMax} onChangeText={setHrMax} /></View>
        </Row>
        <Button title="Speichern" onPress={save} />
      </Card>

      <Card>
        <H2>Datenschutz</H2>
        <P dim small>• Gesundheitsdaten werden nur verschlüsselt übertragen und nur für dich gespeichert (Row-Level Security).{'\n'}• Zugangsdaten zu Google liegen ausschließlich verschlüsselt auf dem Server, nie in der App.{'\n'}• Keine Weitergabe an Werbenetzwerke, kein Tracking.{'\n'}• Fotos werden nicht gespeichert; sie gehen nur mit deiner Einwilligung einmalig zur Analyse an einen KI-Anbieter.{'\n'}• Mahlzeiten, Check-ins und Gewohnheiten liegen lokal auf diesem Gerät.{'\n'}• Diese App ist nicht rechtlich geprüft; eine Datenschutz-Folgenabschätzung und rechtliche Prüfung (DSGVO, besondere Kategorien) sind vor einem Produktivbetrieb nötig.</P>
        <Button kind="ghost" title={busy ? 'Bitte warten …' : 'Daten exportieren'} disabled={busy} onPress={exportData} />
        <Button kind="ghost" title="Lokale Daten löschen" onPress={wipeLocal} />
        {signedIn ? <>
          <Button kind="ghost" title="Abmelden" onPress={async () => { await supabase?.auth.signOut(); }} />
          <Button kind="danger" title="Konto & alle Server-Daten löschen" disabled={busy} onPress={deleteAccount} />
        </> : null}
      </Card>
      <Disclaimer />
    </Screen>
  );
}
