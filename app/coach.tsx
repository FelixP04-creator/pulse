import React, { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { Button, Card, Chip, Disclaimer, Field, H2, P, Row, Screen, DemoBanner } from '../src/components/ui';
import type { CoachContext } from '../src/core/coach';
import { buildAiContext, coachReply, type CoachReply } from '../src/core/coachRouter';
import { EVIDENCE_LABEL } from '../src/core/tips';
import { invoke, isConfigured, supabase } from '../src/lib/supabase';
import { useApp } from '../src/state/AppState';
import { useTheme } from '../src/theme/ThemeProvider';

interface Msg { q: string; a: string; kind: 'ai' | 'rule_based'; title?: string; urgent?: boolean; gaps?: string[]; tips?: CoachReply['tips']; note?: string }

const QUICK = ['Was wird von meinem Essen gut aufgenommen?', 'Wie verbessere ich die Eisenaufnahme?', 'Wie war mein Schlaf?', 'Warum ist meine Erholung niedrig?', 'Wie haben sich meine Werte diese Woche entwickelt?'];

export default function Coach() {
  const { state, today, dataset, scores, signedIn } = useApp();
  const t = useTheme();
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const aiPossible = isConfigured && signedIn && state.mode === 'live';

  const ctx = useMemo<CoachContext>(() => ({
    asOf: today, days: dataset.days, nights: dataset.nights, profile: state.profile, recovery: scores.recovery, sleep: scores.sleep, strain: scores.strain,
    vitalityValue: scores.vitality.status === 'ok' ? scores.vitality.value : undefined, meals: state.meals, lens: state.lens ?? 'custom', rules: state.customRules,
    hydrationMlToday: state.hydration[today] ?? 0, month: new Date().getMonth() + 1, hourOfDay: new Date().getHours(), strain3dAvg: scores.strain3dAvg,
  }), [today, dataset, state, scores]);

  const enableAi = async () => {
    if (!aiPossible) return;
    const { data } = await supabase!.from('consents').select('granted').eq('purpose', 'ai_coach').order('created_at', { ascending: false }).limit(1);
    if (data?.[0]?.granted) return setUseAi(true);
    Alert.alert('KI-Coach aktivieren?', 'Für Antworten wird eine Zusammenfassung deiner berechneten Werte (keine Rohdaten, keine Fotos) und deine Frage über unseren Server an einen KI-Anbieter gesendet. Du kannst das jederzeit widerrufen.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Einverstanden', onPress: async () => {
        const { data: u } = await supabase!.auth.getUser();
        if (u.user) await supabase!.from('consents').insert({ user_id: u.user.id, purpose: 'ai_coach', granted: true, policy_version: '2026-10' });
        setUseAi(true);
      } },
    ]);
  };

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setQ('');
    const local = coachReply(text, ctx);
    let msg: Msg = { q: text, a: local.text, kind: 'rule_based', title: local.title, urgent: local.urgent, gaps: local.dataGaps, tips: local.tips };
    // Notfälle werden nie an ein Modell delegiert
    if (useAi && aiPossible && !local.urgent) {
      const r = await invoke<{ answer: string }>('coach', { question: text, context: buildAiContext(ctx) });
      if (r.data?.answer) msg = { q: text, a: r.data.answer, kind: 'ai', gaps: local.dataGaps };
      else msg.note = r.error === 'not_configured' ? 'Der KI-Dienst ist auf dem Server nicht eingerichtet – hier die regelbasierte Antwort.' : 'Die KI war nicht erreichbar – hier die regelbasierte Antwort.';
    }
    setMsgs((m) => [...m, msg]);
    setBusy(false);
  };

  return (
    <Screen banner={state.mode === 'demo' ? <DemoBanner /> : undefined}>
      <Card>
        <H2>Dein Gesundheits-Coach</H2>
        <P dim small>Erklärt Werte, fasst Trends zusammen, zeigt Datenlücken und erklärt, welche Nährstoffe aus deinem Essen wie gut aufgenommen werden. Keine Diagnosen, keine Medikamente, keine Dosierungen.</P>
        <Row wrap>
          <Chip label={useAi ? 'KI-Antworten: an' : 'KI-Antworten: aus (regelbasiert)'} active={useAi} onPress={() => (useAi ? setUseAi(false) : enableAi())} />
        </Row>
        {!aiPossible ? <P dim small>KI-Antworten benötigen den Live-Modus mit Konto und eingerichtetem Server. Bis dahin antwortet eine lokale Regel-Engine – deutlich als „regelbasiert“ gekennzeichnet.</P> : null}
      </Card>

      <Row wrap>{QUICK.map((x) => <Chip key={x} label={x} onPress={() => ask(x)} />)}</Row>

      {msgs.map((m, i) => (
        <Card key={i} style={m.urgent ? { borderColor: t.bad, borderWidth: 2 } : undefined}>
          <P dim small>Du: {m.q}</P>
          <P dim small>{m.kind === 'ai' ? 'KI-Antwort' : 'Regelbasierte Antwort – keine KI-Analyse'}</P>
          {m.title ? <H2>{m.title}</H2> : null}
          <P>{m.a}</P>
          {m.note ? <P dim small>{m.note}</P> : null}
          {m.gaps?.length ? <><P small>Datenlücken:</P>{m.gaps.map((g) => <P key={g} dim small>• {g}</P>)}</> : null}
          {m.tips?.length ? <>{m.tips.map((x) => <P key={x.id} small>💡 {x.title} ({EVIDENCE_LABEL[x.evidence]}): {x.body}</P>)}</> : null}
        </Card>
      ))}

      <Field label="Frage an den Coach" value={q} onChangeText={setQ} multiline placeholder="z. B. Wie wird das Eisen aus Linsen aufgenommen?" onSubmitEditing={() => ask(q)} returnKeyType="send" />
      <Button title={busy ? 'Denke nach …' : 'Fragen'} disabled={busy || !q.trim()} onPress={() => ask(q)} />
      <Disclaimer>Keine medizinische Beratung. Bei akuten Beschwerden: Notruf 112. Telefonseelsorge (kostenlos, rund um die Uhr): 0800 111 0 111.</Disclaimer>
    </Screen>
  );
}
