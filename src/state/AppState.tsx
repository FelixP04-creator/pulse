import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { dailyStrain, strainSeries } from '../core/strain';
import { recoveryScore } from '../core/recovery';
import { sleepScore } from '../core/sleep';
import { vitalityIndex } from '../core/vitality';
import type { CustomRules, LensId } from '../core/foodRating';
import { liftSessionToWorkout, type LiftSession } from '../core/lifting';
import type { Meal } from '../core/nutrition';
import type { ScoreResult, UserProfile, Workout } from '../core/types';
import { generateDemoDataset, type Dataset } from '../data/demo';
import { loadLiveDataset, type ConnectionView } from '../data/live';
import { supabase } from '../lib/supabase';
import type { ThemePref } from '../theme/ThemeProvider';

export type Mode = 'unset' | 'demo' | 'live';

export interface Habit { id: string; title: string; targetPerWeek: number }
export interface Checkin { stress?: number; energy?: number; mood?: number; reflection?: string }

/** Lokal auf dem Gerät gespeicherte, von der Person selbst eingegebene Daten (Version 1). */
export interface Persisted {
  mode: Mode;
  theme: ThemePref;
  profile: UserProfile & { weightKg?: number };
  lens?: LensId;
  customRules: CustomRules;
  meals: Meal[];
  hydration: Record<string, number>;
  checkins: Record<string, Checkin>;
  habits: Habit[];
  habitLogs: Record<string, string[]>;
  manualWorkouts: Workout[];
  liftSessions: LiftSession[];
}

const EMPTY: Persisted = { mode: 'unset', theme: 'dark', profile: {}, customRules: { prefer: [], avoid: [] }, meals: [], hydration: {}, checkins: {}, habits: [], habitLogs: {}, manualWorkouts: [], liftSessions: [] };
const KEY = 'pulse.state.v1';

/** Lokaler Kalendertag des Geräts (YYYY-MM-DD). */
export function localToday(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Ctx {
  ready: boolean;
  state: Persisted;
  update: (patch: Partial<Persisted>) => void;
  today: string;
  dataset: Dataset;
  connection?: ConnectionView;
  loading: boolean;
  loadError?: string;
  reload: () => Promise<void>;
  scores: { recovery: ScoreResult; sleep: ScoreResult; strain: ScoreResult; vitality: ReturnType<typeof vitalityIndex>; strain3dAvg?: number };
  signedIn: boolean;
  setSignedIn: (v: boolean) => void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = (): Ctx => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('AppProvider fehlt');
  return c;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Persisted>(EMPTY);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState<{ dataset: Dataset; connection?: ConnectionView } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [signedIn, setSignedIn] = useState(false);
  const today = localToday();
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setState({ ...EMPTY, ...JSON.parse(raw) });
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          setSignedIn(!!data.session);
          supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
        }
      } catch { /* beschädigter Speicher → leerer Zustand */ }
      setReady(true);
    })();
  }, []);

  const update = useCallback((patch: Partial<Persisted>) => {
    setState((s) => {
      const next = { ...s, ...patch };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => { AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined); }, 300);
      return next;
    });
  }, []);

  const reload = useCallback(async () => {
    if (state.mode !== 'live' || !supabase || !signedIn) return;
    setLoading(true);
    setLoadError(undefined);
    try { setLive(await loadLiveDataset(supabase)); } catch (e) { setLoadError(e instanceof Error ? e.message : 'Laden fehlgeschlagen'); }
    setLoading(false);
  }, [state.mode, signedIn]);

  useEffect(() => { void reload(); }, [reload]);

  const demo = useMemo(() => generateDemoDataset(today), [today]);
  const base: Dataset = state.mode === 'demo' ? demo : live?.dataset ?? { origin: 'google-health', days: [], nights: [], workouts: [] };
  const dataset = useMemo<Dataset>(() => {
    // Krafteinheiten zählen nur mit Dauer und eingetragener Anstrengung (RIR) zur Belastung – sonst keine erfundene Last
    const lifts = state.liftSessions.map(liftSessionToWorkout).filter((w): w is Workout => !!w);
    return { ...base, workouts: [...base.workouts, ...state.manualWorkouts, ...lifts] };
  }, [base, state.manualWorkouts, state.liftSessions]);

  const scores = useMemo(() => {
    const s3 = strainSeries(dataset.workouts, today, 3);
    return {
      recovery: recoveryScore(dataset.days, dataset.nights, today, state.profile),
      sleep: sleepScore(dataset.nights, today, state.profile),
      strain: dailyStrain(dataset.workouts, today),
      vitality: vitalityIndex(dataset.days, dataset.nights, today, state.profile),
      strain3dAvg: s3.reduce((a, d) => a + d.strain, 0) / s3.length,
    };
  }, [dataset, today, state.profile]);

  const value: Ctx = { ready, state, update, today, dataset, connection: live?.connection, loading, loadError, reload, scores, signedIn, setSignedIn };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
