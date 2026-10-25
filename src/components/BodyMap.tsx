import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BODY_H, BODY_W, bodyShapes, heat, type View as BodyView } from '../core/bodyMap';
import { REGION_LABEL, type Region } from '../core/exercises';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Stilisierte Körperfigur (Vorder- und Rückseite). Je stärker eine Region belastet ist, desto kräftiger die Akzentfarbe.
 * Die Zuordnung ist eine Modellannahme (siehe src/core/exercises.ts), keine Messung.
 */
export function BodyMap({ load, full = 8, width = 150 }: { load: Partial<Record<Region, number>>; full?: number; width?: number }) {
  const t = useTheme();
  const top = (Object.entries(load) as Array<[Region, number]>).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const label = top.length ? `Körperfigur. Am stärksten belastet: ${top.map(([r]) => REGION_LABEL[r]).join(', ')}.` : 'Körperfigur. Keine Belastung eingetragen.';
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
      {(['front', 'back'] as BodyView[]).map((v) => {
        const s = bodyShapes(v);
        return (
          <View key={v} style={{ alignItems: 'center' }}>
            <Svg width={width} height={(width * BODY_H) / BODY_W} viewBox={`0 0 ${BODY_W} ${BODY_H}`}>
              {s.base.map((d, i) => <Path key={`b${i}`} d={d} fill={t.surfaceAlt} />)}
              {s.regions.map((r, i) => <Path key={`r${i}`} d={r.d} fill={t.border} fillOpacity={0.55} />)}
              {s.regions.map((r, i) => (heat(load[r.region], full) > 0 ? <Path key={`h${i}`} d={r.d} fill={t.accent} fillOpacity={heat(load[r.region], full)} /> : null))}
            </Svg>
            <Text style={{ color: t.textDim, fontSize: 12 }}>{v === 'front' ? 'Vorne' : 'Hinten'}</Text>
          </View>
        );
      })}
    </View>
  );
}
