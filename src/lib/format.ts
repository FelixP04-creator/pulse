export const fmtDuration = (min?: number) => (min === undefined ? '–' : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`);
export const fmtNum = (x: number | undefined, d = 0) => (x === undefined || !Number.isFinite(x) ? '–' : x.toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: d }));
export function fmtDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}
export function fmtDateTime(iso?: string): string {
  if (!iso) return 'noch nie';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'unbekannt' : d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
export const hhmm = (iso: string) => iso.slice(11, 16);
