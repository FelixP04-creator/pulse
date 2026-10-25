import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';

const icon = (glyph: string) => ({ color }: { color: string }) => <Text style={{ color, fontSize: 20 }} accessibilityElementsHidden>{glyph}</Text>;

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: t.accent, tabBarInactiveTintColor: t.textDim, tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border } }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('◉') }} />
      <Tabs.Screen name="recovery" options={{ title: 'Recovery', tabBarIcon: icon('♡') }} />
      <Tabs.Screen name="sleep" options={{ title: 'Schlaf', tabBarIcon: icon('☾') }} />
      <Tabs.Screen name="strain" options={{ title: 'Belastung', tabBarIcon: icon('↯') }} />
      <Tabs.Screen name="vitality" options={{ title: 'Vitalität', tabBarIcon: icon('✦') }} />
    </Tabs>
  );
}
