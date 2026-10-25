import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { BodyMap } from '../src/components/BodyMap';
import { Bar, Button, Card, Chip, DemoBanner, Disclaimer, Field, H2, P, ProvenanceBadge, Row, Screen } from '../src/components/ui';
import {
  EQUIPMENT_LABEL, EVIDENCE, EXERCISES, LIFTING_TIPS, MUSCLES, MUSCLE_LABEL, REGION_LABEL, REGIONS, weeklyRegionLoad, type Muscle, type Region, VOLUME_TEXT, bestE1rm, deloadHint, e1rm, e1rmDeclines, exerciseById, personalRecords,
  progressionAdvice, sessionRpe, sessionTonnage, validateSet, weeklyVolume, type LiftEntry, type LiftSession,
} from '../src/core/lifting';
import { recoveryScore } from '../src/core/recovery';
import { addDays, mean } from '../src/core/stats';
import { useApp } from '../src/state/AppState';

const num = (s: string) => Number(s.replace(',', '.'));
const fmtKg = (n: number) => `${Math.round(n * 100) / 100} kg`;

export default function Lifting() {
  const { state, update, today, dataset } = useApp();
  const [exId, setExId] = useState('bench_press');
  const [group, setGroup] = useState<Muscle>('chest');
  const [joint, setJoint] = useState<'alle' | 'single' | 'multi'>('alle');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rir, setRir] = useState('2');
  const [warm, setWarm] = useState(false);
  const [draft, setDraft] = useState<LiftEntry[]>([]);
  const [dur, setDur] = useState('60');
  const [notes, setNotes] = useState('');

  const sessions = state.liftSessions;
  const ex = exerciseById(exId)!;
  const list = useMemo(() => EXERCISES.filter((e) => e.primary.includes(group) && (joint === 'alle' || e.joint === joint)), [group, joint]);
  const exLoad = useMemo(() => Object.fromEntries(REGIONS.filter((r) => ex.regions[r]).map((r) => [r, (ex.regions[r] as number) * 8])) as Partial<Record<Region, number>>, [ex]);
  const weekLoad = useMemo(() => weeklyRegionLoad(sessions, today), [sessions, today]);
  const volume = useMemo(() => weeklyVolume(sessions, today), [sessions, today]);
  const prs = useMemo(() => personalRecords(sessions), [sessions]);
  const lastSets = useMemo(() => [...sessions].sort((a, b) => b.date.localeCompare(a.date)).flatMap((s) => s.entries.filter((e) => e.exerciseId === exId).map((e) => e.sets)).find((x) => x.length > 0) ?? [], [sessions, exId]);
  const advice = useMemo(() => progressionAdvice(lastSets, ex), [lastSets, ex]);
  const rec7 = useMemo(() => {
    const v: number[] = [];
    for (let i = 0; i < 7; i++) { const r = recoveryScore(dataset.days, dataset.nights, addDays(today, -i), state.profile); if (r.status === 'ok') v.push(r.value); }
    return v.length >= 3 ? mean(v) : undefined;
  }, [dataset, today, state.profile]);
  const deload = deloadHint({ recoveryAvg7d: rec7, e1rmDeclineLifts: e1rmDeclines(sessions) });

  const addSet = () => {
    const s = { reps: Math.round(num(reps)), weightKg: num(weight), rir: warm || rir === '' ? undefined : num(rir), warmup: warm || undefined };
    const err = validateSet(s);
    if (err) return Alert.alert('Eingabe prüfen', err);
    setDraft((d) => {
      const i = d.findIndex((e) => e.exerciseId === exId);
      return i >= 0 ? d.map((e, k) => (k === i ? { ...e, sets: [...e.sets, s] } : e)) : [...d, { exerciseId: exId, sets: [s] }];
    });
    setReps('');
  };

  const save = () => {
    if (!draft.length) return Alert.alert('Keine Sätze', 'Bitte zuerst mindestens einen Satz eintragen.');
    const d = Math.round(num(dur));
    const session: LiftSession = { id: `ls-${Date.now()}`, date: today, durationMin: d >= 1 && d <= 360 ? d : undefined, entries: draft, notes: notes.trim() || undefined };
    update({ liftSessions: [...sessions, session] });
    setDraft([]); setNotes('');
  };

  const removeSession = (id: string) => Alert.alert('Einheit löschen?', 'Diese Krafteinheit wird von diesem Gerät entfernt.', [
    { text: 'Abbrechen', style: 'cancel' },
    { text: 'Löschen', style: 'destructive', onPress: () => update({ liftSessions: sessions.filter((s) => s.id !== id) }) },
  ]);

  const recent = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return (
    <Screen banner={state.mode === 'demo' ? <DemoBanner /> : undefined}>
      <Card>
        <H2>Science-based Lifting</H2>
        <P dim small>Protokolliere Sätze mit Gewicht, Wiederholungen und „Wiederholungen in Reserve“ (RIR). Die App zählt harte Sätze je Muskelgruppe, schätzt dein 1RM und schlägt die nächste Progression vor. Alles sind Richtwerte aus der Forschung, keine individuelle Trainingsberatung.</P>
      </Card>

      <Card>
        <H2>Diese Woche (7 Tage)</H2>
        <P dim small>Harte Sätze = Arbeitssätze mit höchstens 4 Wiederholungen vor dem Versagen. Hilfsmuskeln zählen mit 0,5 (Konvention). Zielbereich grob 6–20 effektive Sätze je Muskel (moderat belegt).</P>
        <BodyMap load={weekLoad} full={10} />
        <P dim small>Figur: Je kräftiger die Farbe, desto mehr gewichtete harte Sätze in dieser Region (7 Tage). Gewichte sind Modellannahmen.</P>
        {volume.filter((v) => v.status !== 'none').map((v) => (
          <View key={v.muscle} style={{ gap: 2 }}>
            <Bar label={MUSCLE_LABEL[v.muscle]} pct={(v.effective / 20) * 100} right={`${v.effective} Sätze · ${v.sessions}× trainiert`} />
            {v.status !== 'none' ? <P dim small>{VOLUME_TEXT[v.status]}</P> : null}
          </View>
        ))}
        {volume.every((v) => v.status === 'none') ? <P dim>Noch keine Krafteinheit in den letzten 7 Tagen.</P> : null}
      </Card>

      <Card>
        <H2>Satz eintragen</H2>
        <Row wrap>{MUSCLES.map((m) => <Chip key={m} label={MUSCLE_LABEL[m]} active={group === m} onPress={() => { setGroup(m); const f = EXERCISES.find((e) => e.primary.includes(m)); if (f) setExId(f.id); }} />)}</Row>
        <Row wrap>
          <Chip label="Alle" active={joint === 'alle'} onPress={() => setJoint('alle')} />
          <Chip label="Einzelgelenk" active={joint === 'single'} onPress={() => setJoint('single')} />
          <Chip label="Mehrgelenk" active={joint === 'multi'} onPress={() => setJoint('multi')} />
        </Row>
        {list.length ? <Row wrap>{list.map((e) => <Chip key={e.id} label={e.name} active={exId === e.id} onPress={() => setExId(e.id)} />)}</Row> : <P dim small>Keine Übung mit diesem Filter.</P>}
        <H2>{ex.name}</H2>
        <P dim small>{ex.joint === 'single' ? 'Einzelgelenk' : 'Mehrgelenk'} · {EQUIPMENT_LABEL[ex.equipment]}</P>
        <BodyMap load={exLoad} full={8} />
        {REGIONS.filter((r) => ex.regions[r]).sort((a, b) => (ex.regions[b] as number) - (ex.regions[a] as number)).map((r) => <P key={r} small>{(ex.regions[r] as number) >= 1 ? '●' : (ex.regions[r] as number) >= 0.5 ? '◐' : '○'} {REGION_LABEL[r]}</P>)}
        <P dim small>● Hauptziel · ◐ deutlich beteiligt · ○ gering. Das ist ein Modell aus Biomechanik und Praxiswissen (Evidenz: {EVIDENCE.preliminary}), keine Messung an dir. Unterschiede zwischen Winkeln und Griffen sind oft klein.</P>
        <P dim small>Wiederholungsbereich: {ex.repRange[0]}–{ex.repRange[1]} · Hinweis: {ex.cue}</P>
        {lastSets.length ? <P small>Letztes Mal: {lastSets.filter((s) => !s.warmup).map((s) => `${s.reps}×${fmtKg(s.weightKg)}${s.rir !== undefined ? ` @RIR${s.rir}` : ''}`).join(', ')}</P> : null}
        <P small>Vorschlag: {advice.reason}{advice.nextWeightKg !== undefined && advice.action !== 'no_data' ? ` (Nächstes Ziel: ${advice.targetReps} × ${fmtKg(advice.nextWeightKg)})` : ''}</P>
        <P dim small>Heuristik ({EVIDENCE[advice.evidence]}). Auf Körpergefühl und Technik hören.</P>
        <Row>
          <View style={{ flex: 1 }}><Field label="Gewicht (kg)" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} /></View>
          <View style={{ flex: 1 }}><Field label="Wdh." keyboardType="number-pad" value={reps} onChangeText={setReps} /></View>
          <View style={{ flex: 1 }}><Field label="RIR" keyboardType="number-pad" value={rir} onChangeText={setRir} /></View>
        </Row>
        <Row wrap>
          <Chip label={warm ? 'Aufwärmsatz ✓' : 'Aufwärmsatz'} active={warm} onPress={() => setWarm((w) => !w)} />
          <Button title="Satz hinzufügen" onPress={addSet} />
        </Row>
        {draft.length ? (
          <>
            <H2>Aktuelle Einheit</H2>
            {draft.map((e) => (
              <View key={e.exerciseId}>
                <P>{exerciseById(e.exerciseId)?.name}</P>
                {e.sets.map((s, i) => <P key={i} dim small>{s.warmup ? 'Aufwärmen · ' : ''}{s.reps} × {fmtKg(s.weightKg)}{s.rir !== undefined ? ` · RIR ${s.rir}` : ''}{e1rm(s) ? ` · e1RM ≈ ${fmtKg(e1rm(s) as number)}` : ''}</P>)}
                <Button kind="ghost" title="Letzten Satz entfernen" onPress={() => setDraft((d) => d.map((x) => (x.exerciseId === e.exerciseId ? { ...x, sets: x.sets.slice(0, -1) } : x)).filter((x) => x.sets.length))} />
              </View>
            ))}
            <Field label="Dauer der Einheit (min)" keyboardType="number-pad" value={dur} onChangeText={setDur} />
            <Field label="Notizen (optional)" value={notes} onChangeText={setNotes} multiline />
            <P dim small>Dauer und RIR gehen als Schätzung in deine Belastung ein. Ohne RIR wird keine Belastung erfunden.</P>
            <Button title="Einheit speichern" onPress={save} />
          </>
        ) : null}
      </Card>

      {deload.reasons.length ? (
        <Card>
          <H2>{deload.suggest ? 'Leichtere Woche erwägen' : 'Beobachtung'}</H2>
          {deload.reasons.map((r) => <P key={r} small>• {r}</P>)}
          <P dim small>Heuristik ohne feste Studiengrundlage ({EVIDENCE[deload.evidence]}). Einzelne schwächere Tage sind normal.</P>
        </Card>
      ) : null}

      {prs.length ? (
        <Card>
          <H2>Geschätzte Bestwerte (1RM)</H2>
          {prs.map((p) => <P key={p.exerciseId}>{exerciseById(p.exerciseId)?.name}: ≈ {fmtKg(p.e1rm)} <P dim small>({p.date})</P></P>)}
          <P dim small>Berechnet nach Epley aus Sätzen bis 12 Wiederholungen. Eine Schätzung, kein Maximaltest.</P>
        </Card>
      ) : null}

      {recent.length ? (
        <Card>
          <H2>Letzte Einheiten</H2>
          {recent.map((s) => {
            const t = sessionTonnage(s);
            return (
              <Card key={s.id}>
                <Row><P>{s.date}{s.durationMin ? ` · ${s.durationMin} min` : ''}</P><ProvenanceBadge kind="manual" /></Row>
                <P dim small>{t.workSets} Arbeitssätze, davon {t.hardSets} hart · Tonnage {t.totalKg} kg{sessionRpe(s) !== undefined ? ` · Ø Anstrengung ${sessionRpe(s)}/10` : ''}</P>
                {s.entries.map((e) => <P key={e.exerciseId} dim small>{exerciseById(e.exerciseId)?.name}: {e.sets.filter((x) => !x.warmup).map((x) => `${x.reps}×${x.weightKg}`).join(', ')}{bestE1rm(e.sets) ? ` (≈ ${fmtKg(bestE1rm(e.sets) as number)} 1RM)` : ''}</P>)}
                {s.notes ? <P small>{s.notes}</P> : null}
                <Button kind="ghost" title="Löschen" onPress={() => removeSession(s.id)} />
              </Card>
            );
          })}
        </Card>
      ) : null}

      <Card>
        <H2>Evidenzbasierte Tipps</H2>
        {LIFTING_TIPS.map((t) => <P key={t.id} small>💡 {t.title} ({EVIDENCE[t.evidence]}): {t.body}</P>)}
      </Card>
      <Disclaimer>Keine medizinische Beratung oder individuelle Trainingsplanung. Bei Schmerzen, Vorerkrankungen oder Unsicherheit bei der Technik bitte ärztlichen oder trainerischen Rat einholen.</Disclaimer>
    </Screen>
  );
}
