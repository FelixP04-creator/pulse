import { useRouter } from 'expo-router';
import React from 'react';
import { Card, Button, H1, H2, P, Screen, Disclaimer } from '../src/components/ui';
import { isConfigured } from '../src/lib/supabase';
import { useApp } from '../src/state/AppState';

export default function Welcome() {
  const { update } = useApp();
  const router = useRouter();
  return (
    <Screen>
      <H1>PULSE</H1>
      <P>Verstehe deinen Körper. Erkenne deine Trends. Verbessere deine Gewohnheiten.</P>

      <Card>
        <H2>Mit meinem Fitbit Air starten</H2>
        <P dim>Verbinde dein Konto über die Google Health API. Die Verbindung wird nur als „verbunden“ angezeigt, wenn sie wirklich besteht.</P>
        {isConfigured ? (
          <Button title="Anmelden und verbinden" onPress={() => { update({ mode: 'live' }); router.replace('/auth'); }} />
        ) : (
          <P small>Für die echte Anbindung muss zuerst das Backend eingerichtet werden (siehe README: Supabase und Google-Health-API). Bis dahin steht der Demo-Modus zur Verfügung.</P>
        )}
      </Card>

      <Card>
        <H2>Demo ansehen</H2>
        <P dim>Die App mit erfundenen Beispieldaten ausprobieren. Alles ist deutlich als „Demo“ gekennzeichnet, es besteht keine Verbindung zu einem Gerät.</P>
        <Button kind="ghost" title="Demo-Modus starten" onPress={() => { update({ mode: 'demo' }); router.replace('/'); }} />
      </Card>

      <Disclaimer />
    </Screen>
  );
}
