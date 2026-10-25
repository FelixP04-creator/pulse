import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { MealAnalysis } from '../../src/components/MealAnalysis';
import { Button, Card, Chip, Disclaimer, Field, H2, P, Row, Screen } from '../../src/components/ui';
import { parseFoodAnalysis } from '../../src/core/foodAnalysis';
import { itemFromFood, MEAL_LABEL, MEAL_TYPES, searchFoods, zeroNutrients, type Meal, type MealItem, type MealType } from '../../src/core/nutrition';
import { invoke, isConfigured, supabase } from '../../src/lib/supabase';
import { useApp } from '../../src/state/AppState';

const num = (s: string) => { const n = Number(s.replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const defaultType = (): MealType => { const h = new Date().getHours(); return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack'; };

export default function EditMeal() {
  const { id, type, date } = useLocalSearchParams<{ id?: string; type?: string; date?: string }>();
  const { state, update, today, signedIn } = useApp();
  const router = useRouter();
  const existing = id ? state.meals.find((m) => m.id === id) : undefined;
  const [mealType, setMealType] = useState<MealType>(existing?.type ?? (MEAL_TYPES.includes(type as MealType) ? (type as MealType) : defaultType()));
  const [items, setItems] = useState<MealItem[]>(existing?.items ?? []);
  const [time, setTime] = useState(existing?.time ?? '');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [custom, setCustom] = useState({ name: '', grams: '100', kcal: '', protein: '', carbs: '', fat: '' });

  const patch = (i: number, p: Partial<MealItem>) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const canPhoto = isConfigured && signedIn && state.mode === 'live';

  const analyze = async (source: 'camera' | 'library') => {
    if (!canPhoto) return setMsgs(['Die Foto-Erkennung benötigt das eingerichtete Backend und ein angemeldetes Konto (Live-Modus). Im Demo-Modus wird sie bewusst nicht simuliert. Du kannst Lebensmittel jederzeit manuell hinzufügen.']);
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setMsgs(['Zugriff nicht erlaubt. Du kannst ihn in den iOS-Einstellungen aktivieren oder manuell eintragen.']);
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;

    // Einwilligung: Foto wird zur Auswertung an einen KI-Anbieter übermittelt
    const { data: c } = await supabase!.from('consents').select('granted').eq('purpose', 'ai_food_analysis').order('created_at', { ascending: false }).limit(1);
    if (!c?.[0]?.granted) {
      const ok = await new Promise<boolean>((resolve) => Alert.alert('Foto zur Analyse senden?', 'Das Foto wird nur für diese Analyse über unseren Server an einen KI-Anbieter übermittelt und nicht gespeichert. Du kannst die Einwilligung jederzeit in den Einstellungen widerrufen.', [{ text: 'Abbrechen', style: 'cancel', onPress: () => resolve(false) }, { text: 'Einverstanden', onPress: () => resolve(true) }]));
      if (!ok) return;
      const { data: u } = await supabase!.auth.getUser();
      if (u.user) await supabase!.from('consents').insert({ user_id: u.user.id, purpose: 'ai_food_analysis', granted: true, policy_version: '2026-10' });
    }

    setBusy(true);
    setMsgs([]);
    try {
      const img = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: 1024 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (!img.base64) throw new Error('Bild konnte nicht aufbereitet werden.');
      const r = await invoke<{ raw: unknown }>('food-analyze', { image: img.base64, mediaType: 'image/jpeg', mealType });
      if (r.error === 'not_configured') return setMsgs(['Die Foto-Erkennung ist auf dem Server noch nicht eingerichtet (kein KI-Schlüssel). Bitte manuell eintragen.']);
      if (r.error === 'consent_required') return setMsgs(['Die Einwilligung für die Foto-Analyse fehlt.']);
      if (r.error || !r.data) return setMsgs(['Die Erkennung ist fehlgeschlagen. Bitte erneut versuchen oder manuell eintragen.']);
      const a = parseFoodAnalysis(r.data.raw);
      setMsgs([...(a.isFood ? ['Bitte prüfe die erkannten Lebensmittel und Gewichte – Portionen aus Fotos sind Schätzungen.'] : []), ...a.warnings, ...(a.note ? [a.note] : [])]);
      if (a.isFood) setItems((xs) => [...xs, ...a.items]);
    } catch (e) {
      setMsgs([e instanceof Error ? e.message : 'Unbekannter Fehler']);
    } finally { setBusy(false); }
  };

  const addCustom = () => {
    if (!custom.name.trim()) return;
    const n = zeroNutrients();
    n.kcal = num(custom.kcal); n.protein = num(custom.protein); n.carbs = num(custom.carbs); n.fat = num(custom.fat);
    if (n.kcal === 0) n.kcal = Math.round(4 * n.protein + 4 * n.carbs + 9 * n.fat);
    setItems((xs) => [...xs, { id: `c-${Date.now()}`, name: custom.name.trim().slice(0, 80), grams: Math.min(2000, Math.max(1, num(custom.grams))), per100g: n, source: 'manual', state: 'n/a', processing: 'whole', tags: [] }]);
    setCustom({ name: '', grams: '100', kcal: '', protein: '', carbs: '', fat: '' });
    setMsgs(['Eigene Einträge enthalten nur die Werte, die du angibst – Vitamine und Mineralstoffe fehlen dann in der Auswertung.']);
  };

  const save = () => {
    if (items.length === 0) return Alert.alert('Nichts zu speichern', 'Füge mindestens ein Lebensmittel hinzu.');
    const clean = /^[0-2]\d:[0-5]\d$/.test(time) ? time : undefined;
    const meal: Meal = { id: existing?.id ?? `m-${Date.now()}`, date: existing?.date ?? (date as string | undefined) ?? today, type: mealType, time: clean, items };
    update({ meals: existing ? state.meals.map((m) => (m.id === meal.id ? meal : m)) : [...state.meals, meal] });
    router.back();
  };
  const remove = () => Alert.alert('Mahlzeit löschen?', undefined, [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Löschen', style: 'destructive', onPress: () => { update({ meals: state.meals.filter((m) => m.id !== existing?.id) }); router.back(); } }]);
  const results = q.trim() ? searchFoods(q, 6) : [];

  return (
    <Screen>
      <Row wrap>{MEAL_TYPES.map((m) => <Chip key={m} label={MEAL_LABEL[m]} active={mealType === m} onPress={() => setMealType(m)} />)}</Row>

      <Card>
        <H2>Essen erkennen</H2>
        <P dim small>Fotografiere dein Essen. Die Erkennung schlägt Lebensmittel, Gewichte und Zubereitung vor – du kannst alles prüfen und ändern.</P>
        <Row wrap>
          <Button title={busy ? 'Analysiere …' : 'Foto aufnehmen'} disabled={busy} onPress={() => analyze('camera')} />
          <Button kind="ghost" title="Aus Fotos wählen" disabled={busy} onPress={() => analyze('library')} />
        </Row>
        {!canPhoto ? <P dim small>Foto-Erkennung ist aktuell nicht verfügbar (Backend/Konto nötig). Manuelle Eingabe funktioniert immer.</P> : null}
        {msgs.map((m) => <P key={m} small>• {m}</P>)}
      </Card>

      <Card>
        <H2>Manuell hinzufügen</H2>
        <Field label="Lebensmittel suchen (z. B. Ei, Haferflocken, Lachs)" value={q} onChangeText={setQ} />
        {results.map((f) => <Button key={f.id} kind="ghost" title={`${f.name} · ${f.defaultGrams} g`} onPress={() => { setItems((xs) => [...xs, itemFromFood(f)]); setQ(''); }} />)}
        {q.trim() && results.length === 0 ? <P dim small>Nicht in der Datenbank – du kannst es unten mit eigenen Werten anlegen.</P> : null}
        <P dim small>Eigenes Lebensmittel (Werte pro 100 g):</P>
        <Field label="Name" value={custom.name} onChangeText={(v) => setCustom({ ...custom, name: v })} />
        <Row>
          <View style={{ flex: 1 }}><Field label="Gewicht (g)" keyboardType="decimal-pad" value={custom.grams} onChangeText={(v) => setCustom({ ...custom, grams: v })} /></View>
          <View style={{ flex: 1 }}><Field label="kcal" keyboardType="decimal-pad" value={custom.kcal} onChangeText={(v) => setCustom({ ...custom, kcal: v })} /></View>
        </Row>
        <Row>
          <View style={{ flex: 1 }}><Field label="Protein" keyboardType="decimal-pad" value={custom.protein} onChangeText={(v) => setCustom({ ...custom, protein: v })} /></View>
          <View style={{ flex: 1 }}><Field label="KH" keyboardType="decimal-pad" value={custom.carbs} onChangeText={(v) => setCustom({ ...custom, carbs: v })} /></View>
          <View style={{ flex: 1 }}><Field label="Fett" keyboardType="decimal-pad" value={custom.fat} onChangeText={(v) => setCustom({ ...custom, fat: v })} /></View>
        </Row>
        <Button kind="ghost" title="Eigenes Lebensmittel hinzufügen" onPress={addCustom} />
      </Card>

      <Card>
        <H2>Bestandteile ({items.length})</H2>
        {items.length === 0 ? <P dim>Noch nichts hinzugefügt.</P> : null}
        {items.map((it, i) => (
          <Card key={it.id} style={{ gap: 6 }}>
            <Field label="Name" value={it.name} onChangeText={(v) => patch(i, { name: v })} />
            <Row>
              <View style={{ flex: 1 }}><Field label="Gewicht (g)" keyboardType="decimal-pad" value={String(Math.round(it.grams * 10) / 10)} onChangeText={(v) => patch(i, { grams: Math.min(2000, Math.max(0, num(v))) })} /></View>
              <Chip label={it.state === 'raw' ? 'roh' : it.state === 'cooked' ? 'gegart' : 'Zustand?'} active={it.state !== 'n/a'} onPress={() => patch(i, { state: it.state === 'raw' ? 'cooked' : it.state === 'cooked' ? 'n/a' : 'raw' })} />
              <Chip label="Entfernen" onPress={() => setItems((xs) => xs.filter((_, k) => k !== i))} />
            </Row>
            <P dim small>{Math.round((it.per100g.kcal * it.grams) / 100)} kcal · {Math.round((it.per100g.protein * it.grams) / 10) / 10} g Protein · {it.source === 'ai' ? `per Foto erkannt${it.confidence !== undefined ? ` (Sicherheit ${Math.round(it.confidence * 100)} %)` : ''}` : it.source === 'database' ? 'aus Datenbank' : 'manuell'}{it.nutrientsEstimated ? ' · Werte geschätzt' : ''}</P>
          </Card>
        ))}
        <Field label="Uhrzeit (optional, HH:MM)" value={time} onChangeText={setTime} placeholder="12:30" keyboardType="numbers-and-punctuation" />
      </Card>

      <MealAnalysis items={items} lens={state.lens} rules={state.customRules} />

      <Button title={existing ? 'Änderungen speichern' : 'Mahlzeit speichern'} onPress={save} />
      {existing ? <Button kind="danger" title="Mahlzeit löschen" onPress={remove} /> : null}
      <Disclaimer />
    </Screen>
  );
}
