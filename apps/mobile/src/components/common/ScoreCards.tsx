import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ProgressRingProps {
  progress: number;  // 0-1
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
}

/**
 * ProgressBar — 横向带百分比的进度条
 */
export function ProgressBar({
  progress,
  height = 8,
  color = '#6366F1',
  backgroundColor = '#E5E7EB',
}: {
  progress: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
  return (
    <View style={[styles.barBg, { height, backgroundColor, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.barFill,
          { width: `${pct}%` as any, height, backgroundColor: color, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

/**
 * BandScoreCard — 四个维度分数展示卡（写作/口语用）
 */
export function BandScoreCard({
  scores,
  labels,
  overall,
}: {
  scores: Record<string, number>;
  labels: Record<string, string>;
  overall: number;
}) {
  const color = overall >= 7 ? '#10B981' : overall >= 6 ? '#F59E0B' : '#EF4444';
  return (
    <View style={styles.bandCard}>
      <View style={styles.bandOverall}>
        <Text style={styles.bandOverallLabel}>综合 Band</Text>
        <Text style={[styles.bandOverallScore, { color }]}>{overall.toFixed(1)}</Text>
      </View>
      <View style={styles.bandDims}>
        {Object.entries(scores).map(([key, val]) => (
          <View key={key} style={styles.bandDimItem}>
            <Text style={styles.bandDimLabel}>{labels[key] ?? key}</Text>
            <Text style={styles.bandDimScore}>{val.toFixed(1)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barBg:   { overflow: 'hidden' },
  barFill: {},

  bandCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 14,
  },
  bandOverall: { alignItems: 'center', marginBottom: 12 },
  bandOverallLabel: { fontSize: 13, color: '#9CA3AF' },
  bandOverallScore: { fontSize: 48, fontWeight: '800' },
  bandDims: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bandDimItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  bandDimLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 4 },
  bandDimScore: { fontSize: 20, fontWeight: '700', color: '#6366F1' },
});

