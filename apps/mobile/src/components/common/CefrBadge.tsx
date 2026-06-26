import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CefrBadgeProps {
  value: number;        // 1.0 - 6.0
  size?: 'sm' | 'md' | 'lg';
  showNumeric?: boolean;
}

function cefrLabel(n: number): string {
  const labels = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const base = Math.floor(n);
  const frac = Math.round((n - base) * 10);
  const label = labels[base] ?? '?';
  return frac > 0 ? `${label}.${frac}` : label;
}

const CEFR_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: '#DBEAFE', text: '#1D4ED8' }, // A1 - blue
  2: { bg: '#D1FAE5', text: '#065F46' }, // A2 - green
  3: { bg: '#FEF3C7', text: '#92400E' }, // B1 - amber
  4: { bg: '#FED7AA', text: '#9A3412' }, // B2 - orange
  5: { bg: '#EDE9FE', text: '#5B21B6' }, // C1 - violet
  6: { bg: '#FCE7F3', text: '#9D174D' }, // C2 - pink
};

/** CEFR 级别徽章，带颜色区分 */
export function CefrBadge({ value, size = 'md', showNumeric = false }: CefrBadgeProps) {
  const base = Math.min(6, Math.max(1, Math.floor(value)));
  const color = CEFR_COLORS[base] ?? { bg: '#F3F4F6', text: '#374151' };
  const label = cefrLabel(value);
  const display = showNumeric ? `${label} (${value.toFixed(1)})` : label;

  const sizeStyle = size === 'sm' ? styles.sm : size === 'lg' ? styles.lg : styles.md;
  const textSize = size === 'sm' ? styles.textSm : size === 'lg' ? styles.textLg : styles.textMd;

  return (
    <View style={[styles.badge, sizeStyle, { backgroundColor: color.bg }]}>
      <Text style={[styles.text, textSize, { color: color.text }]}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 8, alignSelf: 'flex-start' },
  sm:   { paddingHorizontal: 6,  paddingVertical: 2 },
  md:   { paddingHorizontal: 10, paddingVertical: 3 },
  lg:   { paddingHorizontal: 14, paddingVertical: 6 },
  text: { fontWeight: '700' },
  textSm: { fontSize: 10 },
  textMd: { fontSize: 12 },
  textLg: { fontSize: 16 },
});

