import type { DataTypeStatus } from './types.ts';

/**
 * Katalog der von PULSE genutzten Google-Health-API-Datentypen.
 * Quellen (offizielle Dokumentation, Stand der Recherche 24.10.2026):
 *  - https://developers.google.com/health/data-types/device-compatibility
 *  - https://developers.google.com/health/data-types
 *  - https://developers.google.com/health/scopes
 *
 * Datentypen, die laut Gerätekompatibilitäts-Seite für „Fitbit Air“ (deviceId `air`) gelistet sind.
 * Alles außerhalb dieser Liste wird als „nicht unterstützt“ angezeigt – nicht als „keine Daten“.
 */
export const FITBIT_AIR_DATA_TYPES: ReadonlySet<string> = new Set([
  'active-minutes',
  'active-zone-minutes',
  'daily-heart-rate-variability',
  'daily-oxygen-saturation',
  'daily-respiratory-rate',
  'daily-resting-heart-rate',
  'daily-sleep-temperature-derivations',
  'daily-vo2-max',
  'distance',
  'exercise',
  'food-measurement-unit',
  'heart-rate',
  'heart-rate-variability',
  'nutrition-log',
  'oxygen-saturation',
  'respiratory-rate-sleep-summary',
  'run-vo2-max',
  'sedentary-period',
  'sleep',
  'steps',
  'swim-lengths-data',
  'total-calories',
  'vo2-max',
]);

export const SCOPE_PREFIX = 'https://www.googleapis.com/auth/googlehealth.';
export const SCOPES = {
  sleep: `${SCOPE_PREFIX}sleep.readonly`,
  activity: `${SCOPE_PREFIX}activity_and_fitness.readonly`,
  metrics: `${SCOPE_PREFIX}health_metrics_and_measurements.readonly`,
} as const;

/**
 * Minimal benötigte Berechtigungen (nur Lesen). Bewusst NICHT angefordert: Standort (GPS), EKG,
 * unregelmäßiger Rhythmus, Profil, Ernährung, Einstellungen sowie sämtliche Schreibrechte.
 */
export const REQUIRED_SCOPES: readonly string[] = [SCOPES.sleep, SCOPES.activity, SCOPES.metrics];

export type Kind = 'daily' | 'interval' | 'session';

export interface DataTypeSpec {
  id: string;
  /** Feldname in der Antwort (camelCase der Union im DataPoint). */
  field: string;
  kind: Kind;
  scope: string;
  label: string;
}

/** Reihenfolge = Priorität bei Rate-Limits. */
export const DATA_TYPES: readonly DataTypeSpec[] = [
  { id: 'daily-resting-heart-rate', field: 'dailyRestingHeartRate', kind: 'daily', scope: SCOPES.metrics, label: 'Ruheherzfrequenz' },
  { id: 'daily-heart-rate-variability', field: 'dailyHeartRateVariability', kind: 'daily', scope: SCOPES.metrics, label: 'HRV (täglich)' },
  { id: 'daily-respiratory-rate', field: 'dailyRespiratoryRate', kind: 'daily', scope: SCOPES.metrics, label: 'Atemfrequenz' },
  { id: 'daily-oxygen-saturation', field: 'dailyOxygenSaturation', kind: 'daily', scope: SCOPES.metrics, label: 'Sauerstoffsättigung' },
  { id: 'daily-sleep-temperature-derivations', field: 'dailySleepTemperatureDerivations', kind: 'daily', scope: SCOPES.metrics, label: 'Hauttemperatur-Abweichung' },
  { id: 'daily-vo2-max', field: 'dailyVo2Max', kind: 'daily', scope: SCOPES.activity, label: 'Cardio-Fitness (VO₂max)' },
  { id: 'steps', field: 'steps', kind: 'interval', scope: SCOPES.activity, label: 'Schritte' },
  { id: 'active-minutes', field: 'activeMinutes', kind: 'interval', scope: SCOPES.activity, label: 'Aktive Minuten' },
  { id: 'active-zone-minutes', field: 'activeZoneMinutes', kind: 'interval', scope: SCOPES.activity, label: 'Active Zone Minutes' },
  { id: 'sleep', field: 'sleep', kind: 'session', scope: SCOPES.sleep, label: 'Schlaf' },
  { id: 'exercise', field: 'exercise', kind: 'session', scope: SCOPES.activity, label: 'Training' },
];

export function initialStatus(grantedScopes: readonly string[], deviceTypes: ReadonlySet<string> = FITBIT_AIR_DATA_TYPES): Record<string, DataTypeStatus> {
  const out: Record<string, DataTypeStatus> = {};
  for (const t of DATA_TYPES) {
    if (!deviceTypes.has(t.id)) out[t.id] = { state: 'unsupported_device', count: 0, message: 'Von diesem Gerät laut Google-Dokumentation nicht unterstützt.' };
    else if (!grantedScopes.includes(t.scope)) out[t.id] = { state: 'missing_scope', count: 0, message: 'Berechtigung wurde nicht erteilt.' };
    else out[t.id] = { state: 'not_requested', count: 0 };
  }
  return out;
}
