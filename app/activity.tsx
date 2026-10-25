import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Card, Chip, DemoBanner, Disclaimer, Field, H2, P, ProvenanceBadge, Row, Screen } from '../src/components/ui';
import { ACTIVITY_KINDS, CATEGORY_LABEL, estimateKcal, intensityFromRpe, kindFromLabel, type ActivityCategory } from '../src/core/activities';
import { addDays } from '../src/core/stats';
import { activitySummary, workoutLoad, WEEKLY_ACTIVE_MINUTES_GUIDELINE } from '../src/core/strain';
import type { Workout } from '../src/core/types';
import { fmtDateTime } from '../src/lib/format';
import { useApp } from '../src/state/AppState';

const CATS = Object.keys(CATEGORY_LABEL) as ActivityCategory[];
const hhmmNow = () => new Date().toTimeString().slice(0, 5);

export default function Activity() {
  const { state, update, today, dataset } = useApp();
  const router = useRouter();
  const [view, setView] = useState<'week' | 'month'>('week');
  const [type, setType] = useState('Laufen');
  const [cat, setCat] = useState<ActivityCategory | 'alle'>('alle');
  const [dur, setDur] = useState('45');
  const [rpe, setRpe] = useState('6');
  const [notes, setNotes] = useState('');
  const days = view === 'week' ? 7 : 30;
  const from = addDays(today, -(days - 1));
  const list = [...dataset.workouts].filter((w) => w.start.slice(0, 10) >= from).sort((a, b) => b.start.localeCompare(a.start));
  const act = activitySummary(dataset.days, today);
  const total = list.reduce((a, w) => a + w.durationMin, 0);
  const manual = list.filter((w) => w.source === 'manual').length;

  const shown = ACTIVITY_KINDS.filter((k) => cat === 'alle' || k.category === cat);
  const kcalPreview = (() => { const k = kindFromLabel(type); const r = Number(rpe); return k && r >= 1 && r <= 10 ? estimateKcal(k.id, intensityFromRpe(r), Number(dur), state.profile.weightKg) : undefined; })();

  const add = () => {
    const d = Math.round(Number(dur));
    const r = Math.round(Number(rpe));
    if (!(d >= 1 && d <= 600)) return Alert.alert('Dauer prüfen', 'Bitte eine Dauer zwischen 1 und 600 Minuten eingeben.');
    if (!(r >= 1 && r <= 10)) return Alert.alert('Anstrengung prüfen', 'Bitte einen Wert von 1 (sehr leicht) bis 10 (maximal) eingeben.');
    const w: Workout = { id: `man-${Date.now()}`, source: 'manual', type, start: `${today}T${hhmmNow()}:00`, durationMin: d, rpe: r, notes: notes.trim() || undefined };
    update({ manualWorkouts: [...state.manualWorkouts, w] });
    setNotes('');
  };

  return (
    <Screen banner={state.mode === 'demo' ? <DemoBanner /> : undefined}>
      <Card>
        <H2>Training eintragen</H2>
        <P dim small>Manuelle Einträge werden getrennt von Gerätedaten gekennzeichnet. Ohne Herzfrequenzzonen wird die Belastung aus Dauer × Anstrengung geschätzt.</P>
        <Row wrap><Chip label="Alle" active={cat === 'alle'} onPress={() => setCat('alle')} />{CATS.map((c) => <Chip key={c} label={CATEGORY_LABEL[c]} active={cat === c} onPress={() => setCat(c)} />)}</Row>
        <Row wrap>{shown.map((k) => <Chip key={k.id} label={k.label} active={type === k.label} onPress={() => setType(k.label)} />)}</Row>
        <Row>
          <View style={{ flex: 1 }}><Field label="Dauer (min)" keyboardType="number-pad" value={dur} onChangeText={setDur} /></View>
          <View style={{ flex: 1 }}><Field label="Anstrengung 1–10" keyboardType="number-pad" value={rpe} onChangeText={setRpe} /></View>
        </Row>
        <Field label="Notizen (optional)" value={notes} onChangeText={setNotes} multiline />
        <P dim small>{kcalPreview !== undefined ? `Geschätzter Energieverbrauch ca. ${kcalPreview} kcal (grobe Schätzung nach MET-Richtwerten, Abweichungen von 30 % und mehr sind normal).` : 'Für eine Kalorienschätzung bitte das Körpergewicht in den Einstellungen eintragen. Es wird nichts angenommen.'}</P>
        {type === 'Krafttraining' ? <Button kind="ghost" title="Satzgenau protokollieren (Science-based Lifting)" onPress={() => router.push('/lifting')} /> : null}
        <Button title="Speichern" onPress={add} />
      </Card>

      <Row><Chip label="Woche" active={view === 'week'} onPress={() => setView('week')} /><Chip label="Monat" active={view === 'month'} onPress={() => setView('month')} /></Row>
      <Card>
        <H2>{view === 'week' ? 'Wochenübersicht' : 'Monatsübersicht'}</H2>
        <P>{list.length} Einheit(en) · {total} min · davon {manual} manuell</P>
        {view === 'week' && act.weekActiveMinutes !== undefined ? <P dim small>Alltagsbewegung (getrennt vom Training): {act.weekActiveMinutes} aktive Minuten, allgemeine Mindestempfehlung {WEEKLY_ACTIVE_MINUTES_GUIDELINE}.</P> : null}
      </Card>

      {list.length === 0 ? <P dim>Keine Einheiten im Zeitraum.</P> : list.map((w) => {
        const l = workoutLoad(w);
        const kc = (() => { const k = kindFromLabel(w.type); return k && w.rpe ? estimateKcal(k.id, intensityFromRpe(w.rpe), w.durationMin, state.profile.weightKg) : undefined; })();
        return (
          <Card key={w.id}>
            <Row><H2>{w.type}</H2><ProvenanceBadge kind={w.source === 'manual' ? 'manual' : 'measured'} /></Row>
            <P dim small>{fmtDateTime(w.start)} · {w.durationMin} min{w.avgHr ? ` · Ø ${w.avgHr} bpm` : ''}{w.rpe ? ` · Anstrengung ${w.rpe}/10` : ''}</P>
            {kc !== undefined ? <P dim small>≈ {kc} kcal (Schätzung)</P> : null}
        <P dim small>{l ? `Belastungslast ${Math.round(l.load)}${l.provenance === 'estimated' ? ' (geschätzt aus Anstrengung)' : ''}` : 'Keine Daten für eine Belastungsberechnung'}</P>
            {w.notes ? <P small>{w.notes}</P> : null}
            {w.source === 'manual' && !w.id.startsWith('lift-') ? <Button kind="ghost" title="Löschen" onPress={() => update({ manualWorkouts: state.manualWorkouts.filter((x) => x.id !== w.id) })} /> : null}
          </Card>
        );
      })}
      <Disclaimer />
    </Screen>
  );
}
