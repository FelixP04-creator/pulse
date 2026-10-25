import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Button, Card, Disclaimer, Field, H2, P, Screen } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';

export default function Auth() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  const run = async (kind: 'in' | 'up') => {
    if (!supabase) return setMsg('Das Backend ist nicht konfiguriert.');
    if (!email.includes('@') || password.length < 8) return setMsg('Bitte eine gültige E-Mail und ein Passwort mit mindestens 8 Zeichen eingeben.');
    setBusy(true);
    setMsg(undefined);
    const { data, error } = kind === 'in' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (kind === 'up' && !data.session) return setMsg('Bitte bestätige deine E-Mail-Adresse über den Link in der Nachricht und melde dich danach an.');
    router.replace('/data-sources');
  };

  return (
    <Screen>
      <H2>Konto</H2>
      <P dim>Dein Konto schützt deine Gesundheitsdaten. Sie werden verschlüsselt übertragen und sind nur für dich sichtbar.</P>
      <Card>
        <Field label="E-Mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
        <Field label="Passwort (mind. 8 Zeichen)" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="password" />
        {msg ? <P small>{msg}</P> : null}
        <Button title={busy ? 'Bitte warten …' : 'Anmelden'} disabled={busy} onPress={() => run('in')} />
        <Button kind="ghost" title="Neues Konto erstellen" disabled={busy} onPress={() => run('up')} />
      </Card>
      <Disclaimer />
    </Screen>
  );
}
