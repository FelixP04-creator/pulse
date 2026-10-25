/**
 * Kern-Datentypen von PULSE.
 *
 * Dieses Verzeichnis (src/core) ist bewusst frei von Abhängigkeiten (kein React,
 * keine npm-Pakete), damit alle Berechnungen isoliert und reproduzierbar getestet
 * werden können.
 *
 * Einheiten (verbindlich):
 *  - Herzfrequenz: Schläge pro Minute (bpm)
 *  - HRV: RMSSD in Millisekunden (ms)
 *  - Atemfrequenz: Atemzüge pro Minute
 *  - SpO₂: Prozent (0–100)
 *  - Hauttemperatur: Abweichung zur persönlichen Basis in °C
 *  - Dauer: Minuten
 *  - Datum: "YYYY-MM-DD" (lokaler Kalendertag des Nutzers)
 *  - Zeitstempel: ISO-8601 mit Zeitzonen-Offset oder UTC ("Z")
 */

/** Herkunft eines Wertes – wird in der UI immer angezeigt. */
export type Provenance = 'measured' | 'calculated' | 'estimated' | 'manual';

/** Woher der gesamte Datensatz stammt. Demo-Daten dürfen nie als echt erscheinen. */
export type DataOrigin = 'demo' | 'google-health' | 'manual';

export interface DailyMetrics {
  /** Kalendertag (YYYY-MM-DD). */
  date: string;
  restingHr?: number;
  hrvMs?: number;
  respRate?: number;
  spo2?: number;
  /** Abweichung der nächtlichen Hauttemperatur zur persönlichen Basis (°C). */
  skinTempDevC?: number;
  steps?: number;
  /** Aktive Minuten (vom Gerät gemeldet). */
  activeMinutes?: number;
  /** Active Zone Minutes (vom Gerät gemeldet). */
  azm?: number;
  /** Cardio-Fitness / VO₂max in ml/kg/min (Geräteschätzung, kein Labormesswert). */
  vo2max?: number;
}

export interface SleepStages {
  awakeMin: number;
  lightMin: number;
  deepMin: number;
  remMin: number;
}

export interface SleepNight {
  /** Aufwach-Tag (YYYY-MM-DD). */
  date: string;
  /** Einschlafzeit / Bettzeit (ISO). */
  start: string;
  /** Aufwachzeit (ISO). */
  end: string;
  /** Zeit im Bett in Minuten (Intervall start→end). */
  inBedMin: number;
  /** Tatsächliche Schlafzeit in Minuten, falls die Datenquelle sie liefert. */
  asleepMin?: number;
  /** Phasen – nur vorhanden, wenn das Gerät sie liefert. Niemals erfunden. */
  stages?: SleepStages;
  /**
   * true, wenn asleepMin nicht geliefert wurde und aus dem Bettzeit-Intervall
   * angenähert werden musste.
   */
  asleepIsEstimate?: boolean;
}

export interface Workout {
  id: string;
  source: 'device' | 'manual';
  /** Freitext oder Gerätetyp, z. B. "Laufen". */
  type: string;
  /** Beginn (ISO). */
  start: string;
  durationMin: number;
  avgHr?: number;
  maxHr?: number;
  /** Minuten in den Herzfrequenzzonen 1–5 (Index 0 = Zone 1). */
  zoneMinutes?: [number, number, number, number, number];
  /** Subjektive Anstrengung 1–10 (RPE). */
  rpe?: number;
  notes?: string;
}

export interface UserProfile {
  /** Kalenderalter in Jahren – optional, nur auf Wunsch der Person. */
  age?: number;
  /** Persönliches Schlafziel in Minuten – überschreibt die Altersschätzung. */
  sleepTargetMin?: number;
  /** Maximale Herzfrequenz, falls bekannt (sonst Schätzung). */
  hrMax?: number;
}

export type Quality = 'low' | 'medium' | 'high';

export interface Component {
  key: string;
  label: string;
  /** Teilwert 0–100. */
  score: number;
  /** Gewicht nach Umverteilung (Summe = 1). */
  weight: number;
  /** Erklärung in einem Satz. */
  detail: string;
  provenance: Provenance;
}

export interface ScoreOk {
  status: 'ok';
  /** Ganzzahl bzw. gerundeter Wert. */
  value: number;
  provenance: Provenance;
  quality: Quality;
  components: Component[];
  /** Hinweise zu Datenlücken oder Einschränkungen. */
  notes: string[];
}

export interface ScoreInsufficient {
  status: 'insufficient';
  reason: string;
  have: number;
  need: number;
}

export type ScoreResult = ScoreOk | ScoreInsufficient;

export const isOk = (r: ScoreResult): r is ScoreOk => r.status === 'ok';
