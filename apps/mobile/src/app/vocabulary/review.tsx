import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vocabularyAPI } from '../../lib/api';
import type { VocabularyItem } from '@englishi/shared-types';

type CardState = 'front' | 'checking';

export default function VocabReviewScreen() {
  const qc = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardState, setCardState] = useState<CardState>('front');
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ['vocab-due'],
    queryFn: () => vocabularyAPI.getDue().then(r => r.data.data as VocabularyItem[]),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ wordId, quality }: { wordId: string; quality: number }) =>
      vocabularyAPI.review({ wordId, quality }),
    onSuccess: (_, vars) => {
      setSessionStats(prev => ({
        correct: vars.quality >= 4 ? prev.correct + 1 : prev.correct,
        total: prev.total + 1,
      }));
      if (currentIndex < (data?.length ?? 0) - 1) {
        setCurrentIndex(i => i + 1);
        setCardState('front');
      } else {
        setCurrentIndex(-1); // 完成
        qc.invalidateQueries({ queryKey: ['vocab-due'] });
      }
    },
  });

  if (isLoading) {
    return <View style={s.centered}><ActivityIndicator size="large" color="#6366F1" /></View>;
  }

  if (!data || data.length === 0) {
    return (
      <View style={s.centered}>
        <Text style={s.emptyEmoji}>🎉</Text>
        <Text style={s.emptyTitle}>今日词汇已全部复习完毕</Text>
        <Text style={s.emptySubtext}>系统会在下次复习时再次推送</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>返回任务列表</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 完成所有词汇
  if (currentIndex === -1) {
    return (
      <View style={s.centered}>
        <Text style={s.emptyEmoji}>✅</Text>
        <Text style={s.emptyTitle}>本轮复习完成！</Text>
        <Text style={s.emptySubtext}>{sessionStats.correct} / {sessionStats.total} 正确</Text>
        <Text style={s.emptySubtext2}>正确率 {Math.round(sessionStats.correct / sessionStats.total * 100)}%</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>返回任务列表</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const word = data[currentIndex]!;
  const remaining = data.length - currentIndex;

  return (
    <View style={s.container}>
      {/* 顶部进度 */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.closeBtn}>✕</Text>
        </TouchableOpacity>
        <View style={s.progressBarBg}>
          <View style={[s.progressBarFill, { width: `${(currentIndex / data.length) * 100}%` }]} />
        </View>
        <Text style={s.remaining}>{remaining} 剩余</Text>
      </View>

      <ScrollView style={s.cardArea} showsVerticalScrollIndicator={false}>
        {/* 词汇卡片正面 */}
        <View style={s.wordCard}>
          <View style={s.wordHeader}>
            <Text style={s.wordCefr}>CEFR {formatCefr(Number(word.wordCefr))}</Text>
            <Text style={s.wordStatus}>{STATUS_LABELS[word.status] ?? word.status}</Text>
          </View>
          <Text style={s.wordMain}>{word.word}</Text>
          {word.domain && <Text style={s.wordDomain}>{word.domain}</Text>}

          {cardState === 'front' ? (
            <TouchableOpacity style={s.revealBtn} onPress={() => setCardState('checking')}>
              <Text style={s.revealBtnText}>查看答案</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.answerArea}>
              <Text style={s.answerNote}>你记住这个词了吗？</Text>
              <View style={s.qualityBtns}>
                {QUALITY_BUTTONS.map(q => (
                  <TouchableOpacity
                    key={q.quality}
                    style={[s.qualityBtn, { backgroundColor: q.color }]}
                    disabled={reviewMutation.isPending}
                    onPress={() => reviewMutation.mutate({ wordId: word.id, quality: q.quality })}
                  >
                    <Text style={s.qualityBtnText}>{q.label}</Text>
                    <Text style={s.qualityBtnSub}>{q.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* 间隔复习状态 */}
        <View style={s.sm2Card}>
          <Text style={s.sm2Title}>记忆状态</Text>
          <View style={s.sm2Row}>
            <Text style={s.sm2Item}>复习次数：{word.repetitions}</Text>
            <Text style={s.sm2Item}>间隔天数：{word.intervalDays} 天</Text>
            <Text style={s.sm2Item}>选择连续正确：{word.choiceCorrectStreak}/3</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function formatCefr(n: number): string {
  const labels = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const base = Math.floor(n);
  const frac = Math.round((n - base) * 10);
  return frac > 0 ? `${labels[base]}.${frac}` : (labels[base] ?? '?');
}

const STATUS_LABELS: Record<string, string> = {
  learning: '学习中',
  reviewing: '复习中',
  mastered: '已掌握',
  passive_maintenance: '维护中',
};

const QUALITY_BUTTONS = [
  { quality: 1, label: '完全忘了', sub: '重新开始', color: '#FEE2E2' },
  { quality: 3, label: '模糊记得', sub: '再加强', color: '#FEF3C7' },
  { quality: 4, label: '记住了', sub: '正确', color: '#D1FAE5' },
  { quality: 5, label: '非常熟悉', sub: '完美', color: '#DBEAFE' },
];

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  emptySubtext: { fontSize: 15, color: '#6B7280' },
  emptySubtext2: { fontSize: 14, color: '#6366F1', fontWeight: '600' },
  backBtn: { backgroundColor: '#6366F1', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  closeBtn: { fontSize: 18, color: '#9CA3AF', width: 30 },
  progressBarBg: { flex: 1, height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#6366F1', borderRadius: 3 },
  remaining: { fontSize: 13, color: '#9CA3AF', width: 40, textAlign: 'right' },

  cardArea: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  wordCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3, marginBottom: 14, minHeight: 220 },
  wordHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  wordCefr: { fontSize: 12, color: '#6366F1', fontWeight: '700', backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  wordStatus: { fontSize: 12, color: '#9CA3AF' },
  wordMain: { fontSize: 36, fontWeight: '800', color: '#1F2937', marginBottom: 8 },
  wordDomain: { fontSize: 13, color: '#9CA3AF', marginBottom: 20 },
  revealBtn: { backgroundColor: '#6366F1', padding: 14, borderRadius: 12, alignItems: 'center' },
  revealBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  answerArea: {},
  answerNote: { fontSize: 14, color: '#6B7280', marginBottom: 12, textAlign: 'center' },
  qualityBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qualityBtn: { flex: 1, minWidth: '45%', padding: 14, borderRadius: 12, alignItems: 'center' },
  qualityBtnText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  qualityBtnSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  sm2Card: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginBottom: 20 },
  sm2Title: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', marginBottom: 8 },
  sm2Row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sm2Item: { fontSize: 12, color: '#6B7280', backgroundColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});

