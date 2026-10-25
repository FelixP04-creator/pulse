import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type Palette } from './tokens';

export type ThemePref = 'dark' | 'light' | 'system';

const Ctx = createContext<Palette>(dark);

export function ThemeProvider({ pref, children }: { pref: ThemePref; children: React.ReactNode }) {
  const system = useColorScheme();
  const p = useMemo(() => (pref === 'system' ? (system === 'light' ? light : dark) : pref === 'light' ? light : dark), [pref, system]);
  return <Ctx.Provider value={p}>{children}</Ctx.Provider>;
}

export const useTheme = (): Palette => useContext(Ctx);
