/**
 * Normalisierte Datentypen der Serverseite.
 * Sie entsprechen strukturell den Typen in src/core/types.ts (die App liest diese Daten aus Postgres).
 * Hinweis: Dieses Verzeichnis ist absichtlich eigenständig (nur Web-Standard-APIs, keine npm-Pakete),
 * damit es sowohl in Deno (Supabase Edge Functions) als auch in Node-Tests läuft.
 */

export interface DailyMetricsRow {
  date: string;
  restingHr?: number;
  hrvMs?: number;
  respRate?: number;
  spo2?: number;
  skinTempDevC?: number;
  steps?: number;
  activeMinutes?: number;
  azm?: number;
  vo2max?: number;
}

export interface SleepRow {
  /** Aufwach-Tag */
  date: string;
  providerId: string;
  /** Lokale Uhrzeit, ISO ohne Offset ("2026-10-23T23:10:00") */
  startLocal: string;
  endLocal: string;
  inBedMin: number;
  asleepMin?: number;
  asleepIsEstimate: boolean;
  stages?: { awakeMin: number; lightMin: number; deepMin: number; remMin: number };
}

export interface WorkoutRow {
  providerId: string;
  type: string;
  startLocal: string;
  /** UTC-Zeitpunkte (ISO) – nur für Folgeabfragen (Herzfrequenz im Trainingsfenster). */
  startUtc?: string;
  endUtc?: string;
  durationMin: number;
  avgHr?: number;
  maxHr?: number;
  zoneMinutes?: [number, number, number, number, number];
}

/** Status je Datentyp – trennt „nicht unterstützt“, „keine Berechtigung“, „keine Daten“ und „echte Messwerte“. */
export type DataTypeState = 'ok' | 'no_data' | 'unsupported_device' | 'missing_scope' | 'error' | 'not_requested';

export interface DataTypeStatus {
  state: DataTypeState;
  count: number;
  message?: string;
}
