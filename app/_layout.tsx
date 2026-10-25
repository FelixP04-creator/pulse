import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppProvider, useApp } from '../src/state/AppState';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

function Gate() {
  const { ready, state } = useApp();
  const t = useTheme();
  const router = useRouter();
  const seg = useSegments();
  useEffect(() => {
    if (!ready) return;
    if (state.mode === 'unset' && seg[0] !== 'welcome' && seg[0] !== 'auth') router.replace('/welcome');
  }, [ready, state.mode, seg, router]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center' }}><ActivityIndicator color={t.accent} /></View>;
  return (
    <>
      <StatusBar style={t.bg === '#0E1012' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerStyle: { backgroundColor: t.bg }, headerTintColor: t.text, headerShadowVisible: false, contentStyle: { backgroundColor: t.bg }, headerBackTitle: 'Zurück' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ title: 'Anmelden' }} />
        <Stack.Screen name="nutrition" options={{ title: 'Ernährung' }} />
        <Stack.Screen name="meal/edit" options={{ title: 'Mahlzeit', presentation: 'modal' }} />
        <Stack.Screen name="coach" options={{ title: 'Coach' }} />
        <Stack.Screen name="activity" options={{ title: 'Training & Journal' }} />
        <Stack.Screen name="lifting" options={{ title: 'Krafttraining' }} />
        <Stack.Screen name="wellbeing" options={{ title: 'Wohlbefinden & Gewohnheiten' }} />
        <Stack.Screen name="data-sources" options={{ title: 'Datenquellen' }} />
        <Stack.Screen name="settings" options={{ title: 'Einstellungen' }} />
      </Stack>
    </>
  );
}

function Themed({ children }: { children: React.ReactNode }) {
  const { state } = useApp();
  return <ThemeProvider pref={state.theme}>{children}</ThemeProvider>;
}

export default function Root() {
  return (
    <AppProvider>
      <Themed>
        <Gate />
      </Themed>
    </AppProvider>
  );
}
