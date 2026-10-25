import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Provenance } from '../core/types';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space } from '../theme/tokens';

export function Screen({ children, banner }: { children: React.ReactNode; banner?: React.ReactNode }) {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'left', 'right']}>
      {banner}
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 96, gap: space.md }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={{ color: t.text, fontSize: font.xl, fontWeight: '700' }}>{children}</Text>;
}
export function H2({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={{ color: t.text, fontSize: font.lg, fontWeight: '600' }}>{children}</Text>;
}
export function P({ children, dim, small }: { children: React.ReactNode; dim?: boolean; small?: boolean }) {
  const t = useTheme();
  return <Text style={{ color: dim ? t.textDim : t.text, fontSize: small ? font.xs + 1 : font.sm + 1, lineHeight: small ? 18 : 22 }}>{children}</Text>;
}

export function Card({ children, style, onPress, label }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void; label?: string }) {
  const t = useTheme();
  const body = <View style={[{ backgroundColor: t.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border }, style]}>{children}</View>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>{body}</Pressable> : body;
}

export function Button({ title, onPress, kind = 'primary', disabled }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean }) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'danger' ? t.bad : 'transparent';
  const fg = kind === 'primary' ? t.accentText : kind === 'danger' ? '#fff' : t.text;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1, borderRadius: radius.pill, paddingVertical: 13, paddingHorizontal: space.xl, alignItems: 'center', borderWidth: kind === 'ghost' ? 1 : 0, borderColor: t.border, minHeight: 44 })}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: font.md }}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: active ? t.accent : t.surfaceAlt, minHeight: 36, justifyContent: 'center' }}>
      <Text style={{ color: active ? t.accentText : t.text, fontSize: font.sm, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, wrap }: { children: React.ReactNode; wrap?: boolean }) {
  return <View style={{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', gap: space.sm, alignItems: 'center' }}>{children}</View>;
}

export function Field(props: TextInputProps & { label: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: t.textDim, fontSize: font.xs + 1 }}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={t.textDim} {...rest}
        style={[{ backgroundColor: t.surfaceAlt, color: t.text, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10, fontSize: font.md, minHeight: 44 }, style]} />
    </View>
  );
}

// ---- Herkunft (gemessen / berechnet / geschätzt / manuell / Demo) -------------

const PROV_LABEL: Record<Provenance | 'demo', string> = { measured: 'Gemessen', calculated: 'Berechnet', estimated: 'Geschätzt', manual: 'Manuell', demo: 'Demo' };

export function ProvenanceBadge({ kind }: { kind: Provenance | 'demo' }) {
  const t = useTheme();
  const c = kind === 'estimated' ? t.warn : kind === 'demo' ? t.chart[3] : t.textDim;
  return (
    <View accessibilityLabel={`Herkunft: ${PROV_LABEL[kind]}`} style={{ borderColor: c, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text style={{ color: c, fontSize: font.xs }}>{PROV_LABEL[kind]}</Text>
    </View>
  );
}

export function DemoBanner() {
  const t = useTheme();
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: t.chart[3], paddingVertical: 6, paddingHorizontal: space.lg }}>
      <Text style={{ color: '#0E1012', fontWeight: '700', fontSize: font.xs + 1, textAlign: 'center' }}>DEMO-MODUS – alle Daten sind erfundene Beispieldaten, keine echte Verbindung</Text>
    </View>
  );
}

/** Große Kennzahl mit Erklärung und Herkunft. `value === undefined` → „Nicht genügend Daten“ statt erfundener Zahl. */
export function Metric({ title, value, unit, caption, provenance, explain, color, insufficient, onPress }:
  { title: string; value?: number | string; unit?: string; caption?: string; provenance?: Provenance; explain: string; color?: string; insufficient?: string; onPress?: () => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start(); }, [fade]);
  return (
    <Card onPress={onPress} label={title}>
      <Row><Text style={{ color: t.textDim, fontSize: font.sm, flex: 1 }}>{title}</Text>{provenance ? <ProvenanceBadge kind={provenance} /> : null}</Row>
      {value === undefined ? (
        <>
          <Text style={{ color: t.textDim, fontSize: font.lg, fontWeight: '600' }}>Nicht genügend Daten</Text>
          {insufficient ? <P dim small>{insufficient}</P> : null}
        </>
      ) : (
        <Animated.View style={{ opacity: fade, flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={{ color: color ?? t.text, fontSize: font.hero, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</Text>
          {unit ? <Text style={{ color: t.textDim, fontSize: font.lg }}>{unit}</Text> : null}
        </Animated.View>
      )}
      {caption ? <P dim small>{caption}</P> : null}
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={`Erklärung zu ${title}`}>
        <Text style={{ color: t.accent, fontSize: font.sm }}>{open ? 'Erklärung ausblenden' : 'Was bedeutet das?'}</Text>
      </Pressable>
      {open ? <P dim small>{explain}</P> : null}
    </Card>
  );
}

export function InsufficientCard({ title, reason }: { title: string; reason: string }) {
  return (
    <Card>
      <H2>{title}</H2>
      <P dim>{reason}</P>
      <P dim small>Statt eines erfundenen Wertes zeigt PULSE hier nichts an. Sobald genug Messdaten vorliegen, erscheint die Auswertung automatisch.</P>
    </Card>
  );
}

export function Disclaimer({ children }: { children?: React.ReactNode }) {
  return <P dim small>{children ?? 'PULSE ist eine Wellness-App und stellt keine medizinischen Diagnosen. Bei gesundheitlichen Sorgen wende dich an eine Ärztin oder einen Arzt.'}</P>;
}

export function Stars({ value }: { value: number }) {
  const t = useTheme();
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <Text accessibilityLabel={`${value} von 5 Sternen`} style={{ color: t.accent, fontSize: font.lg, letterSpacing: 2 }}>
      {'★'.repeat(full)}{half ? '⯨' : ''}<Text style={{ color: t.border }}>{'★'.repeat(5 - full - (half ? 1 : 0))}</Text>
    </Text>
  );
}

export function Bar({ pct, color, label, right }: { pct: number; color?: string; label: string; right: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 3 }} accessible accessibilityLabel={`${label}: ${right}`}>
      <Row><Text style={{ color: t.text, fontSize: font.sm, flex: 1 }}>{label}</Text><Text style={{ color: t.textDim, fontSize: font.sm }}>{right}</Text></Row>
      <View style={{ height: 8, backgroundColor: t.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: 8, backgroundColor: color ?? t.accent, borderRadius: 4 }} />
      </View>
    </View>
  );
}
