/** Designsystem PULSE: dunkel als Standard, Limettengrün als dezente Akzentfarbe. Kontraste ≥ 4,5:1 für Text. */
export interface Palette {
  bg: string; surface: string; surfaceAlt: string; border: string;
  text: string; textDim: string; accent: string; accentText: string;
  good: string; warn: string; bad: string;
  /** Diagrammfarben (farbenblind-freundliche Reihenfolge) */
  chart: [string, string, string, string, string];
}

export const dark: Palette = {
  bg: '#0E1012', surface: '#1A1D20', surfaceAlt: '#23272B', border: '#2E3338',
  text: '#F2F4F5', textDim: '#A3ABB2', accent: '#B6F04C', accentText: '#0E1012',
  good: '#7BDC8C', warn: '#F2C14E', bad: '#F2796B',
  chart: ['#B6F04C', '#4CC9F0', '#F2C14E', '#C792EA', '#F2796B'],
};

export const light: Palette = {
  bg: '#F5F6F7', surface: '#FFFFFF', surfaceAlt: '#ECEEF0', border: '#D8DCE0',
  text: '#14171A', textDim: '#566069', accent: '#4E8A00', accentText: '#FFFFFF',
  good: '#2E7D32', warn: '#9A6700', bad: '#B3261E',
  chart: ['#4E8A00', '#0B7AA3', '#9A6700', '#7B3FA0', '#B3261E'],
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;
export const font = { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, hero: 56 } as const;

/** Farbe eines 0–100-Scores (relativ zur eigenen Basis; keine medizinische Bewertung). */
export function scoreColor(p: Palette, v: number): string {
  return v < 34 ? p.bad : v < 67 ? p.warn : p.good;
}
