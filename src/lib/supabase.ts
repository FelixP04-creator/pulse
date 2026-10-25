import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

/**
 * Supabase-Client (nur anon-Key; Schutz durch Row-Level Security). Ist nichts konfiguriert, ist `supabase` null und
 * die App bietet ausschließlich den klar gekennzeichneten Demo-Modus sowie lokale Eingaben an.
 * Session-Token liegen im iOS-Schlüsselbund (SecureStore), nicht in AsyncStorage.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const secureStorage = {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
};
void AsyncStorage;

export const isConfigured = !!url && !!anon && !url.includes('YOUR-PROJECT');

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url as string, anon as string, { auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })
  : null;

export async function invoke<T = unknown>(name: string, body?: unknown): Promise<{ data?: T; error?: string; status?: number }> {
  if (!supabase) return { error: 'not_configured' };
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> | undefined });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    let code = error.message;
    try {
      const j = await (error as { context?: Response }).context?.json?.();
      if (j?.error) code = j.error;
    } catch { /* ignore */ }
    return { error: code, status };
  }
  return { data: data as T };
}
