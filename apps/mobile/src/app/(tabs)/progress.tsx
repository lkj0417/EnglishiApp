import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { progressAPI } from '../../lib/api';
import { router } from 'expo-router';

const SKILL_LABELS: Record<string, string> = { vocabulary: '词汇', grammar: '语法', reading: '阅读', listening: '听力', speaking: '口语', writing: '写作' };
const SKILL_COLORS: Record<string, string> = { vocabulary: '#6366F1', grammar: '#8B5CF6', reading: '#3B82F6', listening: '#10B981', speaking: '#F59E0B', writing: '#EF4444' };

function formatCefr(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  const labels = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const base = Math.floor(num);
  const frac = Math.round((num - base) * 10);
  return frac > 0 ? `${labels[base] ?? '?'}.${frac}` : (labels[base] ?? '?');
}

export default function ProgressScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['progress-overview'],
    queryFn: () => progressAPI.getOverview().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: timeline } = useQuery({
    queryKey: ['ielts-timeline'],
    queryFn: () => progressAPI.getIeltsTimeline().then(r => r.data.data),
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return <View style={s.centered}><ActivityIndicator size="large" color="#6366F1" /></View>;
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      {/* 总体雅思预测 */}
      <View style={s.ieltsBanner}>
        <Text style={s.ieltsBannerLabel}>雅思当前预测分</Text>
        <Text style={s.ieltsBannerScore}>{data?.ieltsPrediction?.toFixed(1) ?? '-'}</Text>
        <Text style={s.ieltsBannerSub}>CEFR {formatCefr(data?.overallCefr ?? 3)}</Text>
      </View>

      {/* 六维雷达（简化为条形图） */}
      <Text style={s.sectionTitle}>各维度能力</Text>
      {data?.radarData?.map((dim: any) => (
        <View key={dim.skill} style={s.dimRow}>
          <Text style={s.dimName}>{dim.label ?? SKILL_LABELS[dim.skill] ?? dim.skill}</Text>
          <View style={s.dimBarBg}>
            <View style={[
              s.dimBarFill,
              { width: `${(dim.value / 6) * 100}%`, backgroundColor: SKILL_COLORS[dim.skill] ?? '#6366F1' },
            ]} />
          </View>
          <Text style={s.dimValue}>{formatCefr(dim.value)}</Text>
        </View>
      ))}

      {/* 词汇统计 */}
      {data?.vocabularyStats && (
        <View style={s.vocabCard}>
          <Text style={s.vocabCardTitle}>词汇本统计</Text>
          <View style={s.vocabRow}>
            {data.vocabularyStats.map((vs: any) => (
              <View key={vs.status} style={s.vocabStat}>
                <Text style={s.vocabStatNum}>{vs.count}</Text>
                <Text style={s.vocabStatLabel}>{STATUS_ZH[vs.status] ?? vs.status}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 雅思目标时间线 */}
      {timeline && (
        <View style={s.timelineCard}>
          <Text style={s.timelineTitle}>📅 雅思达标时间线</Text>
          <Text style={s.timelineTarget}>目标：{timeline.targetBand} 分 · 预计 {timeline.estimatedWeeksToTarget} 周</Text>
          <Text style={s.timelineDate}>预计达标：{timeline.estimatedTargetDate}</Text>

          <View style={s.milestones}>
            {(timeline.milestones ?? []).slice(0, 4).map((m: any, i: number) => (
              <View key={i} style={s.milestone}>
                <View style={[s.milestoneCircle, { backgroundColor: m.ieltsPrediction >= timeline.targetBand ? '#6366F1' : '#E5E7EB' }]}>
                  <Text style={[s.milestoneText, { color: m.ieltsPrediction >= timeline.targetBand ? '#fff' : '#9CA3AF' }]}>
                    {m.ieltsPrediction}
                  </Text>
                </View>
                <Text style={s.milestoneWeek}>第 {m.estimatedWeek} 周</Text>
                <Text style={s.milestoneCefr}>{m.cefrLabel}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 快捷操作 */}
      <Text style={s.sectionTitle}>快捷练习</Text>
      <View style={s.quickGrid}>
        {[
          { label: '词汇本', emoji: '📚', route: '/vocabulary/review' },
          { label: 'AI 阅读', emoji: '📖', route: '/reading/new' },
          { label: 'AI 口语', emoji: '🎙️', route: '/speaking/session' },
          { label: 'AI 写作', emoji: '✍️', route: '/writing/new' },
        ].map(item => (
          <TouchableOpacity key={item.label} style={s.quickCard} onPress={() => router.push(item.route as any)}>
            <Text style={s.quickEmoji}>{item.emoji}</Text>
            <Text style={s.quickLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const STATUS_ZH: Record<string, string> = {
  learning: '学习中',
  reviewing: '复习中',
  mastered: '已掌握',
  passive_maintenance: '维护',
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  ieltsBanner: { backgroundColor: '#6366F1', borderRadius: 20, padding: 24, alignItems: 'center', marginTop: 16, marginBottom: 20 },
  ieltsBannerLabel: { fontSize: 13, color: '#C7D2FE', marginBottom: 4 },
  ieltsBannerScore: { fontSize: 56, fontWeight: '800', color: '#fff' },
  ieltsBannerSub: { fontSize: 14, color: '#C7D2FE', marginTop: 4 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12, marginTop: 4 },

  dimRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  dimName: { fontSize: 14, color: '#374151', width: 40 },
  dimBarBg: { flex: 1, height: 10, backgroundColor: '#E5E7EB', borderRadius: 5, overflow: 'hidden' },
  dimBarFill: { height: '100%', borderRadius: 5 },
  dimValue: { fontSize: 13, fontWeight: '700', color: '#6366F1', width: 40, textAlign: 'right' },

  vocabCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  vocabCardTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  vocabRow: { flexDirection: 'row', justifyContent: 'space-around' },
  vocabStat: { alignItems: 'center' },
  vocabStatNum: { fontSize: 24, fontWeight: '800', color: '#6366F1' },
  vocabStatLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  timelineCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  timelineTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  timelineTarget: { fontSize: 14, color: '#6366F1', fontWeight: '600', marginBottom: 4 },
  timelineDate: { fontSize: 13, color: '#9CA3AF', marginBottom: 16 },
  milestones: { flexDirection: 'row', justifyContent: 'space-between' },
  milestone: { alignItems: 'center', flex: 1 },
  milestoneCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  milestoneText: { fontSize: 13, fontWeight: '700' },
  milestoneWeek: { fontSize: 11, color: '#9CA3AF' },
  milestoneCefr: { fontSize: 12, color: '#6366F1', fontWeight: '600' },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  quickCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  quickEmoji: { fontSize: 28, marginBottom: 8 },
  quickLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
});

