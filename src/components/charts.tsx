import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { font } from '../theme/tokens';

export interface Point {
  label: string;
  value?: number;
}

function range(points: Point[], fixed?: [number, number]): [number, number] {
  if (fixed) return fixed;
  const v = points.map((p) => p.value).filter((x): x is number => x !== undefined);
  if (v.length === 0) return [0, 1];
  let lo = Math.min(...v), hi = Math.max(...v);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15;
  return [lo - pad, hi + pad];
}

/** Liniendiagramm. Fehlende Werte unterbrechen die Linie (keine Interpolation → keine erfundenen Daten). */
export function LineChart({ points, color, height = 140, baseline, unit, yRange, caption }:
  { points: Point[]; color?: string; height?: number; baseline?: number; unit?: string; yRange?: [number, number]; caption?: string }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const c = color ?? t.chart[0];
  const [lo, hi] = range(points, yRange);
  const padX = 8, padY = 10;
  const x = (i: number) => padX + (points.length <= 1 ? 0 : (i * (w - 2 * padX)) / (points.length - 1));
  const y = (v: number) => padY + (1 - (v - lo) / (hi - lo)) * (height - 2 * padY);
  let d = '';
  let pen = false;
  points.forEach((p, i) => {
    if (p.value === undefined) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)} `;
    pen = true;
  });
  const valid = points.filter((p) => p.value !== undefined);
  const last = valid[valid.length - 1];
  const summary = valid.length ? `Verlauf mit ${valid.length} Werten, zuletzt ${last.value?.toFixed(1)}${unit ? ' ' + unit : ''}` : 'Keine Werte im Zeitraum';
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} accessible accessibilityLabel={summary}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          {baseline !== undefined && baseline >= lo && baseline <= hi ? <Line x1={padX} x2={w - padX} y1={y(baseline)} y2={y(baseline)} stroke={t.textDim} strokeDasharray="4 4" strokeWidth={1} /> : null}
          {d ? <Path d={d} stroke={c} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
          {points.length <= 45 ? points.map((p, i) => (p.value === undefined ? null : <Circle key={i} cx={x(i)} cy={y(p.value)} r={2.5} fill={c} />)) : null}
          <SvgText x={w - padX} y={12} fontSize={11} fill={t.textDim} textAnchor="end">{`${hi.toFixed(0)}`}</SvgText>
          <SvgText x={w - padX} y={height - 2} fontSize={11} fill={t.textDim} textAnchor="end">{`${lo.toFixed(0)}`}</SvgText>
        </Svg>
      ) : <View style={{ height }} />}
      {caption ? <Text style={{ color: t.textDim, fontSize: font.xs }}>{caption}</Text> : null}
    </View>
  );
}

/** Säulendiagramm (z. B. Belastung je Tag). Fehlende Werte werden als leere Spalte dargestellt. */
export function BarChart({ points, color, height = 120, max, unit }: { points: Point[]; color?: string; height?: number; max?: number; unit?: string }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const m = max ?? Math.max(1, ...points.map((p) => p.value ?? 0));
  const gap = 4;
  const bw = points.length ? Math.max(2, (w - gap * (points.length - 1)) / points.length) : 0;
  const total = points.filter((p) => p.value !== undefined).length;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} accessible accessibilityLabel={`Säulendiagramm mit ${total} Werten${unit ? ' in ' + unit : ''}`}>
      {w > 0 ? (
        <Svg width={w} height={height + 16}>
          {points.map((p, i) => {
            const h = p.value === undefined ? 0 : Math.max(2, (p.value / m) * height);
            return <Rect key={i} x={i * (bw + gap)} y={height - h} width={bw} height={h} rx={3} fill={color ?? t.chart[1]} opacity={p.value === undefined ? 0.15 : 1} />;
          })}
          {points.length <= 14 ? points.map((p, i) => <SvgText key={`l${i}`} x={i * (bw + gap) + bw / 2} y={height + 13} fontSize={10} fill={t.textDim} textAnchor="middle">{p.label}</SvgText>) : null}
        </Svg>
      ) : <View style={{ height: height + 16 }} />}
    </View>
  );
}
