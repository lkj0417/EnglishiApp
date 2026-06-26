import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { Annotation, SentenceAnnotation } from '@englishi/shared-types';

const ANNOTATION_COLORS: Record<string, string> = {
  GRA_error:  '#EF4444',
  LR_upgrade: '#F59E0B',
  CC_issue:   '#3B82F6',
  TR_issue:   '#F97316',
  highlight:  '#10B981',
};

const ANNOTATION_LABELS: Record<string, string> = {
  GRA_error:  '🔴 语法',
  LR_upgrade: '🟡 词汇升级',
  CC_issue:   '🔵 逻辑衔接',
  TR_issue:   '🟠 偏题',
  highlight:  '🟢 亮点',
};

/**
 * AnnotatedSentenceList — 逐句批注展示，支持点击展开详情
 */
export function AnnotatedSentenceList({ annotations }: { annotations: SentenceAnnotation[] }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  return (
    <View>
      {/* 图例 */}
      <View style={s.legendRow}>
        {Object.entries(ANNOTATION_LABELS).map(([type, label]) => (
          <View key={type} style={[s.legendChip, { borderColor: ANNOTATION_COLORS[type] }]}>
            <Text style={[s.legendText, { color: ANNOTATION_COLORS[type] }]}>{label}</Text>
          </View>
        ))}
      </View>

      {annotations.map((sa, si) => (
        <View key={si} style={s.sentCard}>
          <Text style={s.sentOriginal}>{sa.originalSentence}</Text>
          {sa.annotations.map((ann, ai) => {
            const key = `${si}-${ai}`;
            const isExpanded = expandedKey === key;
            return (
              <TouchableOpacity
                key={key}
                style={[s.annChip, { borderColor: ANNOTATION_COLORS[ann.type] ?? '#9CA3AF' }]}
                onPress={() => setExpandedKey(isExpanded ? null : key)}
                activeOpacity={0.7}
              >
                <Text style={[s.annChipText, { color: ANNOTATION_COLORS[ann.type] ?? '#6B7280' }]}>
                  {ANNOTATION_LABELS[ann.type] ?? ann.type}
                  {ann.span ? ` · "${ann.span}"` : ''}
                </Text>
                {isExpanded && (
                  <View style={s.annDetail}>
                    <Text style={s.annIssue}>{ann.issue}</Text>
                    {ann.correction ? (
                      <Text style={s.annCorrection}>→ {ann.correction}</Text>
                    ) : null}
                    <Text style={s.annExplanation}>{ann.explanation}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/**
 * WordCountIndicator — 词数指示条（写作时实时反馈）
 */
export function WordCountIndicator({ count, min, max }: { count: number; min: number; max: number }) {
  const pct = Math.min(100, (count / min) * 100);
  const isUnder = count < min;
  const isOver  = count > max;
  const color = isOver ? '#EF4444' : isUnder ? '#F59E0B' : '#10B981';

  return (
    <View style={s.wcContainer}>
      <View style={[s.wcBar, { backgroundColor: '#E5E7EB' }]}>
        <View style={[s.wcFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[s.wcText, { color }]}>
        {count} 词{isUnder ? ` (还需 ${min - count} 词)` : isOver ? ' (超出建议上限)' : ' ✓'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  legendChip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  legendText: { fontSize: 11, fontWeight: '600' },

  sentCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  sentOriginal: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 8 },

  annChip: { borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 6 },
  annChipText: { fontSize: 13, fontWeight: '600' },
  annDetail: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  annIssue: { fontSize: 13, color: '#4B5563', marginBottom: 4 },
  annCorrection: { fontSize: 13, color: '#059669', fontWeight: '600', marginBottom: 4 },
  annExplanation: { fontSize: 12, color: '#6B7280', lineHeight: 18 },

  wcContainer: { gap: 4 },
  wcBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  wcFill: { height: '100%', borderRadius: 3 },
  wcText: { fontSize: 12, fontWeight: '600' },
});

