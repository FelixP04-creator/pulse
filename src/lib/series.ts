import { recoveryScore } from '../core/recovery';
import { sleepScore, asleepMinutes } from '../core/sleep';
import { addDays, daysBetween } from '../core/stats';
import type { DailyMetrics, SleepNight, UserProfile } from '../core/types';
import type { Point } from '../components/charts';

export type RangeId = '1' | '7' | '30' | '90' | '365';
export const RANGES: Array<{ id: RangeId; label: string; days: number }> = [
  { id: '1', label: 'Heute', days: 1 }, { id: '7', label: '7 Tage', days: 7 }, { id: '30', label: '30 Tage', days: 30 }, { id: '90', label: '90 Tage', days: 90 }, { id: '365', label: '1 Jahr', days: 365 },
];
/** „Heute“ zeigt zum Vergleich die letzten 7 Tage. */
export const chartDays = (r: RangeId) => (r === '1' ? 7 : Number(r));
/** Ein Jahr wird nur angeboten, wenn mindestens ~6 Monate Verlauf vorliegen. */
export function historyDays(days: DailyMetrics[], asOf: string): number {
  if (days.length === 0) return 0;
  const first = days.reduce((a, d) => (d.date < a ? d.date : a), days[0].date);
  return daysBetween(first, asOf) + 1;
}
export const rangeAvailable = (r: RangeId, hist: number) => (r === '365' ? hist >= 180 : true);

const lbl = (date: string, n: number) => (n <= 14 ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${date}T12:00:00Z`).getUTCDay()] : date.slice(8, 10) + '.' + date.slice(5, 7) + '.');

export function metricSeries(days: DailyMetrics[], key: keyof Omit<DailyMetrics, 'date'>, asOf: string, n: number): Point[] {
  const m = new Map(days.map((d) => [d.date, d]));
  return Array.from({ length: n }, (_, i) => { const date = addDays(asOf, -(n - 1 - i)); return { label: lbl(date, n), value: m.get(date)?.[key] }; });
}
export function sleepSeries(nights: SleepNight[], asOf: string, n: number): Point[] {
  const m = new Map(nights.map((x) => [x.date, x]));
  return Array.from({ length: n }, (_, i) => { const date = addDays(asOf, -(n - 1 - i)); const x = m.get(date); const v = x ? asleepMinutes(x) : undefined; return { label: lbl(date, n), value: v === undefined ? undefined : v / 60 }; });
}
export function recoverySeries(days: DailyMetrics[], nights: SleepNight[], asOf: string, n: number, profile: UserProfile): Point[] {
  return Array.from({ length: n }, (_, i) => { const date = addDays(asOf, -(n - 1 - i)); const r = recoveryScore(days, nights, date, profile); return { label: lbl(date, n), value: r.status === 'ok' ? r.value : undefined }; });
}
export function sleepScoreSeries(nights: SleepNight[], asOf: string, n: number, profile: UserProfile): Point[] {
  return Array.from({ length: n }, (_, i) => { const date = addDays(asOf, -(n - 1 - i)); const r = sleepScore(nights, date, profile); return { label: lbl(date, n), value: r.status === 'ok' ? r.value : undefined }; });
}
