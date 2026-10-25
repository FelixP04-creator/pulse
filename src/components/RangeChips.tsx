import React from 'react';
import { View } from 'react-native';
import type { DailyMetrics } from '../core/types';
import { historyDays, RANGES, rangeAvailable, type RangeId } from '../lib/series';
import { Chip, P, Row } from './ui';

/** Zeitraum-Umschalter. „1 Jahr“ erscheint nur aktiv, wenn genug Verlauf vorhanden ist. */
export function RangeChips({ value, onChange, days, today }: { value: RangeId; onChange: (r: RangeId) => void; days: DailyMetrics[]; today: string; history?: number }) {
  const hist = historyDays(days, today);
  return (
    <View style={{ gap: 6 }}>
      <Row wrap>
        {RANGES.filter((r) => rangeAvailable(r.id, hist) || r.id === '365').map((r) => (
          <Chip key={r.id} label={r.label} active={value === r.id} onPress={() => (rangeAvailable(r.id, hist) ? onChange(r.id) : undefined)} />
        ))}
      </Row>
      {!rangeAvailable('365', hist) ? <P dim small>„1 Jahr“ wird freigeschaltet, sobald mindestens ~6 Monate Verlauf vorliegen (aktuell {hist} Tage).</P> : null}
      {value === '1' ? <P dim small>Heute – zum Vergleich werden die letzten 7 Tage gezeigt.</P> : null}
    </View>
  );
}
