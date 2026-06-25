import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { dailyPackAPI } from '../../lib/api';
import { useUserAbilityStore } from '../../stores';
import type { DailyTask } from '@englishi/shared-types';
import { router } from 'expo-router';

const SKILL_ICONS: Record<string, string> = {
  vocab_review: '📚',
  vocab_new: '✨',
  grammar_lesson: '⚙️',
  grammar_exercise: '🔧',
  reading_article: '📖',
  listening_audio: '🎧',
  speaking_session: '🎙️',
  writing_task: '✍️',
  gate_review: '🎯',
};

const SKILL_LABELS: Record<string, string> = {
  vocab_review: '词汇复习',
  vocab_new: '新词学习',
  grammar_lesson: '语法讲解',
  grammar_exercise: '语法练习',
  reading_article: 'AI 定制阅读',
  listening_audio: '听力训练',
  speaking_session: 'AI 口语对练',
  writing_task: '写作任务',
  gate_review: '关卡测验',
};

export default function TodayScreen() {
  const { ucl } = useUserAbilityStore();

  const { data: packData, isLoading, refetch } = useQuery({
    queryKey: ['daily-pack', 'today'],
    queryFn: () => dailyPackAPI.getToday().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const pack = packData?.data;
  const completedCount = pack?.tasks?.filter((t: DailyTask) => t.status === 'completed').length ?? 0;
  const totalCount = pack?.tasks?.length ?? 0;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  const handleTaskPress = (task: DailyTask) => {
    if (task.status === 'completed') return;
    switch (task.type) {
      case 'vocab_review':
      case 'vocab_new':
        router.push('/vocabulary/review');
        break;
      case 'reading_article':
        router.push(`/reading/${task.contentId ?? task.id}`);
        break;
      case 'listening_audio':
        router.push(`/listening/${task.contentId ?? task.id}`);
        break;
      case 'speaking_session':
        router.push('/speaking/session');
        break;
      case 'writing_task':
        router.push(`/writing/${task.contentId ?? task.id}`);
        break;
      case 'grammar_lesson':
      case 'grammar_exercise':
        router.push('/grammar/practice');
        break;
      case 'gate_review':
        router.push('/assessment/gate-review');
        break;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>正在为你准备今日学习包...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 顶部问候 + 进度 */}
      <View style={styles.header}>
        <Text style={styles.greeting}>今日学习</Text>
        {ucl && (
          <View style={styles.ieltsTag}>
            <Text style={styles.ieltsTagText}>
              🎯 雅思预测 {ucl.ieltsPrediction.toFixed(1)} 分
            </Text>
          </View>
        )}
      </View>

      {/* 总进度条 */}
      {pack && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>今日进度</Text>
            <Text style={styles.progressCount}>{completedCount}/{totalCount}</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressSubtext}>
            预计 {pack.totalEstimatedMinutes} 分钟 · 已完成 {Math.round(progress * 100)}%
          </Text>
        </View>
      )}

      {/* Gate Review 提醒 */}
      {pack?.gateReviewDue && (
        <TouchableOpacity
          style={styles.gateReviewBanner}
          onPress={() => router.push('/assessment/gate-review')}
        >
          <Text style={styles.gateReviewIcon}>🎯</Text>
          <View>
            <Text style={styles.gateReviewTitle}>关卡测验待完成</Text>
            <Text style={styles.gateReviewSub}>完成后才能解锁下一阶段内容</Text>
          </View>
          <Text style={styles.gateReviewArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* 任务列表 */}
      <Text style={styles.sectionTitle}>今日任务</Text>
      {pack?.tasks?.map((task: DailyTask) => (
        <TouchableOpacity
          key={task.id}
          style={[
            styles.taskCard,
            task.status === 'completed' && styles.taskCardCompleted,
            task.type === 'gate_review' && styles.taskCardGate,
          ]}
          onPress={() => handleTaskPress(task)}
          disabled={task.status === 'completed'}
        >
          <View style={styles.taskLeft}>
            <Text style={styles.taskIcon}>{SKILL_ICONS[task.type] ?? '📝'}</Text>
            <View>
              <Text style={[
                styles.taskLabel,
                task.status === 'completed' && styles.taskLabelCompleted,
              ]}>
                {SKILL_LABELS[task.type] ?? task.type}
              </Text>
              <Text style={styles.taskMeta}>~{task.estimatedMinutes} 分钟</Text>
            </View>
          </View>
          <View style={styles.taskRight}>
            {task.status === 'completed' ? (
              <View style={styles.taskDone}>
                <Text style={styles.taskDoneText}>✓</Text>
              </View>
            ) : task.status === 'pending' ? (
              <View style={styles.taskStart}>
                <Text style={styles.taskStartText}>开始</Text>
              </View>
            ) : (
              <View style={styles.taskContinue}>
                <Text style={styles.taskContinueText}>继续</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}

      {/* 能力分维度小卡片 */}
      {ucl && (
        <View style={styles.abilitySection}>
          <Text style={styles.sectionTitle}>当前能力</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {Object.entries(ucl.dimensions).map(([skill, score]) => (
              <View key={skill} style={styles.abilityChip}>
                <Text style={styles.abilitySkill}>{SKILL_ZH[skill] ?? skill}</Text>
                <Text style={styles.abilityScore}>{formatCefr(score)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const SKILL_ZH: Record<string, string> = {
  vocabulary: '词汇',
  grammar: '语法',
  reading: '阅读',
  listening: '听力',
  speaking: '口语',
  writing: '写作',
};

function formatCefr(n: number): string {
  const labels = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const base = Math.floor(n);
  const frac = Math.round((n - base) * 10);
  const label = labels[base] ?? '?';
  return frac > 0 ? `${label}.${frac}` : label;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#6B7280', fontSize: 14 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, paddingBottom: 12 },
  greeting: { fontSize: 24, fontWeight: '700', color: '#1F2937' },
  ieltsTag: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  ieltsTagText: { fontSize: 12, color: '#6366F1', fontWeight: '600' },

  progressCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  progressCount: { fontSize: 15, fontWeight: '700', color: '#6366F1' },
  progressBarBg: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#6366F1', borderRadius: 4 },
  progressSubtext: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },

  gateReviewBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#FED7AA' },
  gateReviewIcon: { fontSize: 24, marginRight: 12 },
  gateReviewTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  gateReviewSub: { fontSize: 12, color: '#B45309', marginTop: 2 },
  gateReviewArrow: { marginLeft: 'auto', fontSize: 20, color: '#B45309' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 10, marginTop: 4 },

  taskCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  taskCardCompleted: { opacity: 0.55, backgroundColor: '#F9FAFB' },
  taskCardGate: { borderWidth: 1.5, borderColor: '#A78BFA' },
  taskLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  taskIcon: { fontSize: 22 },
  taskLabel: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  taskLabelCompleted: { color: '#9CA3AF' },
  taskMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  taskRight: {},
  taskDone: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  taskDoneText: { color: '#059669', fontWeight: '700' },
  taskStart: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#6366F1', borderRadius: 20 },
  taskStartText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  taskContinue: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#EEF2FF', borderRadius: 20 },
  taskContinueText: { color: '#6366F1', fontSize: 13, fontWeight: '600' },

  abilitySection: { marginTop: 8 },
  abilityChip: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  abilitySkill: { fontSize: 11, color: '#9CA3AF', marginBottom: 4 },
  abilityScore: { fontSize: 16, fontWeight: '700', color: '#6366F1' },

  bottomPad: { height: 40 },
});

