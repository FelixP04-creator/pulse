import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { Bar, Button, Card, Chip, DemoBanner, Disclaimer, Field, H2, P, Row, Screen } from '../src/components/ui';
import { addDays, mean } from '../src/core/stats';
import { sleepScore } from '../src/core/sleep';
import { useApp, type Checkin } from '../src/state/AppState';
import { useTheme } from '../src/theme/ThemeProvider';

const SCALE = [1, 2, 3, 4, 5];
const LABELS: Record<'stress' | 'energy' | 'mood', string> = { stress: 'Stress (1 = ruhig, 5 = sehr hoch)', energy: 'Energie (1 = leer, 5 = voll)', mood: 'Stimmung (1 = niedrig, 5 = sehr gut)' };
const STARTERS = ['Regelmäßigere Schlafzeiten', 'Mehr Alltagsbewegung', 'Bewusste Pausen', 'Entspannungsroutine am Abend', 'Trainingskontinuität'];

function Breathing() {
  const t = useTheme();
  const [on, setOn] = useState(false);
  const [phase, setPhase] = useState('Bereit');
  const scale = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (!on) { scale.setValue(0.6); setPhase('Bereit'); return; }
    let alive = true;
    const loop = () => {
      if (!alive) return;
      setPhase('Einatmen (4 s)');
      Animated.timing(scale, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start(() => {
        if (!alive) return;
        setPhase('Ausatmen (6 s)');
        Animated.timing(scale, { toValue: 0.6, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start(loop);
      });
    };
    loop();
    return () => { alive = false; scale.stopAnimation(); };
  }, [on, scale]);
  return (
    <Card>
      <H2>Atemübung</H2>
      <P dim small>Ruhiges Atmen, etwa 6 Atemzüge pro Minute (4 s ein, 6 s aus). Bei Schwindel oder Unwohlsein sofort aufhören.</P>
      <Animated.View accessibilityLabel={phase} style={{ alignSelf: 'center', width: 140, height: 140, borderRadius: 70, backgroundColor: t.accent, opacity: 0.85, transform: [{ scale }] }} />
      <P>{phase}</P>
      <Button kind={on ? 'ghost' : 'primary'} title={on ? 'Stopp' : 'Start'} onPress={() => setOn((o) => !o)} />
    </Card>
  );
}

export default function Wellbeing() {
  const { state, update, today, dataset } = useApp();
  const t = useTheme();
  const cur: Checkin = state.checkins[today] ?? {};
  const [title, setTitle] = useState('');
  const set = (k: 'stress' | 'energy' | 'mood', v: number) => update({ checkins: { ...state.checkins, [today]: { ...cur, [k]: v } } });

  // Zusammenhang Selbsteinschätzung ↔ Schlaf: nur mit genügend Datenpaaren, nur als Beobachtung
  const pairs = Object.entries(state.checkins).map(([d, c]) => ({ d, c, s: sleepScore(dataset.nights, d, state.profile) })).filter((p) => p.c.energy !== undefined && p.s.status === 'ok');
  const good = pairs.filter((p) => p.s.status === 'ok' && p.s.value >= 70).map((p) => p.c.energy as number);
  const poor = pairs.filter((p) => p.s.status === 'ok' && p.s.value < 70).map((p) => p.c.energy as number);
  const last7 = Array.from({ length: 7 }, (_, i) => state.checkins[addDays(today, -i)]).filter(Boolean);

  const weekDone = (id: string) => (state.habitLogs[id] ?? []).filter((d) => d > addDays(today, -7) && d <= today).length;
  const toggle = (id: string) => {
    const logs = state.habitLogs[id] ?? [];
    update({ habitLogs: { ...state.habitLogs, [id]: logs.includes(today) ? logs.filter((d) => d !== today) : [...logs, today] } });
  };
  const addHabit = (name: string) => {
    const n = name.trim();
    if (!n || state.habits.some((h) => h.title === n)) return;
    update({ habits: [...state.habits, { id: `h-${Date.now()}`, title: n.slice(0, 80), targetPerWeek: 5 }] });
    setTitle('');
  };

  return (
    <Screen banner={state.mode === 'demo' ? <DemoBanner /> : undefined}>
      <Card>
        <H2>Tägliches Check-in</H2>
        <P dim small>Deine Selbsteinschätzung zählt – sie ist eine eigene, subjektive Größe und wird nicht mit Geräteschätzungen vermischt.</P>
        {(['stress', 'energy', 'mood'] as const).map((k) => (
          <React.Fragment key={k}>
            <P small>{LABELS[k]}</P>
            <Row>{SCALE.map((v) => <Chip key={v} label={String(v)} active={cur[k] === v} onPress={() => set(k, v)} />)}</Row>
          </React.Fragment>
        ))}
        <Field label="Tagesreflexion (optional)" multiline value={cur.reflection ?? ''} placeholder="Was lief heute gut? Was hat Energie gegeben oder gekostet?" onChangeText={(v) => update({ checkins: { ...state.checkins, [today]: { ...cur, reflection: v.slice(0, 2000) } } })} />
        {last7.length >= 3 ? <P dim small>Letzte 7 Tage: Ø Energie {mean(last7.map((c) => c.energy).filter((x): x is number => x !== undefined))?.toFixed(1) ?? '–'} · Ø Stress {mean(last7.map((c) => c.stress).filter((x): x is number => x !== undefined))?.toFixed(1) ?? '–'}</P> : null}
      </Card>

      <Card>
        <H2>Zusammenhang mit Schlaf</H2>
        {good.length >= 5 && poor.length >= 5
          ? <P>An Tagen nach gutem Schlaf (Wert ≥ 70) gabst du im Schnitt {mean(good)?.toFixed(1)} Energie an, nach schwächerem Schlaf {mean(poor)?.toFixed(1)}. Das ist eine Beobachtung, kein Beweis für Ursache und Wirkung.</P>
          : <P dim>Dafür brauche ich mindestens 5 Check-ins nach gutem und 5 nach schwächerem Schlaf (aktuell {good.length} / {poor.length}).</P>}
        <P dim small>Stressschätzungen aus Wearable-Daten wären nur indirekte Schätzungen – PULSE zeigt deshalb vorerst nur deine Selbsteinschätzung.</P>
      </Card>

      <Breathing />

      <Card>
        <H2>Gewohnheiten & Ziele</H2>
        <P dim small>Fortschritt wird positiv gezeigt – ausgelassene Tage werden nicht bestraft.</P>
        {state.habits.length === 0 ? <P dim>Noch keine Gewohnheit. Wähle einen Vorschlag oder lege eine eigene an.</P> : null}
        {state.habits.map((h) => (
          <Card key={h.id} style={{ backgroundColor: t.surfaceAlt }}>
            <Bar label={h.title} pct={(weekDone(h.id) / h.targetPerWeek) * 100} right={`${weekDone(h.id)} von ${h.targetPerWeek} Tagen in den letzten 7`} />
            <Row wrap>
              <Chip label={(state.habitLogs[h.id] ?? []).includes(today) ? 'Heute erledigt ✓' : 'Heute erledigt'} active={(state.habitLogs[h.id] ?? []).includes(today)} onPress={() => toggle(h.id)} />
              <Chip label="Ziel −" onPress={() => update({ habits: state.habits.map((x) => (x.id === h.id ? { ...x, targetPerWeek: Math.max(1, x.targetPerWeek - 1) } : x)) })} />
              <Chip label="Ziel +" onPress={() => update({ habits: state.habits.map((x) => (x.id === h.id ? { ...x, targetPerWeek: Math.min(7, x.targetPerWeek + 1) } : x)) })} />
              <Chip label="Entfernen" onPress={() => update({ habits: state.habits.filter((x) => x.id !== h.id) })} />
            </Row>
          </Card>
        ))}
        <Row wrap>{STARTERS.filter((s) => !state.habits.some((h) => h.title === s)).map((s) => <Chip key={s} label={`+ ${s}`} onPress={() => addHabit(s)} />)}</Row>
        <Field label="Eigene Gewohnheit" value={title} onChangeText={setTitle} onSubmitEditing={() => addHabit(title)} />
        <Button kind="ghost" title="Hinzufügen" onPress={() => addHabit(title)} />
      </Card>
      <Disclaimer />
    </Screen>
  );
}
