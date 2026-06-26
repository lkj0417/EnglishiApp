import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { writingAPI } from '../../lib/api';
import type { WritingCritiqueReport, Annotation } from '@englishi/shared-types';

const ANNOTATION_COLORS: Record<string, string> = {
  GRA_error:  '#EF4444',
  LR_upgrade: '#F59E0B',
  CC_issue:   '#3B82F6',
  TR_issue:   '#F97316',
  highlight:  '#10B981',
};

const ANNOTATION_LABELS: Record<string, string> = {
  GRA_error:  '🔴 语法',
  LR_upgrade: '🟡 词汇',
  CC_issue:   '🔵 逻辑',
  TR_issue:   '🟠 偏题',
  highlight:  '🟢 亮点',
};

const DIMENSION_LABELS = { TR: '任务回应', CC: '连贯衔接', LR: '词汇资源', GRA: '语法准确' };

export default function WritingTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [essayText, setEssayText] = useState('');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);

  // 获取写作题目
  const { data: taskData, isLoading: taskLoading } = useQuery({
    queryKey: ['writing-task'],
    queryFn: () => writingAPI.getTask().then(r => r.data.data),
  });

  // 提交作文
  const submitMutation = useMutation({
    mutationFn: () => writingAPI.submitEssay({
      taskType: taskData?.type ?? 'IELTS_Task2_Opinion',
      taskPrompt: taskData?.prompt ?? '',
      submissionText: essayText,
    }),
    onSuccess: (res) => {
      setSubmissionId(res.data.data.submissionId);
      setPollingEnabled(true);
    },
    onError: () => Alert.alert('提交失败', '请检查网络连接后重试'),
  });

  // 轮询批改结果
  const { data: critiqueData, isLoading: critiqueLoading } = useQuery({
    queryKey: ['writing-critique', submissionId],
    queryFn: () => writingAPI.getCritique(submissionId!).then(r => r.data.data),
    enabled: pollingEnabled && !!submissionId,
    refetchInterval: (query) => {
      // 直接检查 status 字段（非 state.status）
      if (query.state.data?.status === 'completed') return false;
      return 3000; // 每 3 秒轮询一次
    },
  });

  const report = critiqueData?.critiqueReport as WritingCritiqueReport | undefined;
  const wordCount = essayText.trim().split(/\s+/).filter(Boolean).length;
  const minWords = taskData?.minWords ?? 250;

  if (taskLoading) {
    return <View style={s.centered}><ActivityIndicator size="large" color="#6366F1" /></View>;
  }

  // ── 已有批改报告 → 显示结果页 ──
  if (report) {
    return <CritiqueReport report={report} onBack={() => router.back()} />;
  }

  // ── 提交后等待批改 ──
  if (submissionId && pollingEnabled) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={s.loadingTitle}>AI 正在批改你的作文...</Text>
        <Text style={s.loadingSubtext}>通常需要 20-40 秒，请稍候</Text>
        <Text style={s.loadingSubtext2}>AI 考官正在逐句分析你的写作</Text>
      </View>
    );
  }

  // ── 写作输入页 ──
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
        {/* 题目卡片 */}
        <View style={s.taskCard}>
          <View style={s.taskTypeRow}>
            <Text style={s.taskTypeBadge}>{taskData?.type?.replace(/_/g, ' ')}</Text>
            <Text style={s.wordTarget}>{minWords}+ 词</Text>
          </View>
          <Text style={s.taskPrompt}>{taskData?.prompt}</Text>
          {taskData?.tips?.length > 0 && (
            <View style={s.tipsBox}>
              <Text style={s.tipsTitle}>💡 写作提示</Text>
              {taskData.tips.map((tip: string, i: number) => (
                <Text key={i} style={s.tipItem}>• {tip}</Text>
              ))}
            </View>
          )}
        </View>

        {/* 写作区域 */}
        <View style={s.editorCard}>
          <View style={s.editorHeader}>
            <Text style={s.editorTitle}>你的作文</Text>
            <Text style={[s.wordCount, wordCount >= minWords && s.wordCountOk]}>
              {wordCount} / {minWords} 词
            </Text>
          </View>
          <TextInput
            style={s.editor}
            multiline
            placeholder={`在此输入你的作文...\n\n建议结构：\n• 引言（2-3句，阐明立场）\n• 正文段1（论点+论据+举例）\n• 正文段2（论点+论据+举例）\n• 结论（总结立场，不引入新观点）`}
            placeholderTextColor="#9CA3AF"
            value={essayText}
            onChangeText={setEssayText}
            textAlignVertical="top"
          />
        </View>

        {/* 提交按钮 */}
        <TouchableOpacity
          style={[s.submitBtn, (wordCount < 20 || submitMutation.isPending) && s.submitBtnDisabled]}
          disabled={wordCount < 20 || submitMutation.isPending}
          onPress={() => submitMutation.mutate()}
        >
          {submitMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.submitBtnText}>提交 · AI 精批</Text>
          }
        </TouchableOpacity>
        {wordCount > 0 && wordCount < minWords && (
          <Text style={s.warningText}>⚠️ 还需要 {minWords - wordCount} 个词才达到最低要求</Text>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── 批改报告组件 ──────────────────────────────
function CritiqueReport({ report, onBack }: { report: WritingCritiqueReport; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'scores' | 'annotations' | 'rewrite'>('scores');
  const [expandedAnnotation, setExpandedAnnotation] = useState<string | null>(null);

  const overall = report.overall;
  const bandColor = overall.overall >= 7 ? '#10B981' : overall.overall >= 6 ? '#F59E0B' : '#EF4444';

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      {/* 总分头部 */}
      <View style={s.scoreHeader}>
        <Text style={s.scoreLabel}>预测 Band Score</Text>
        <Text style={[s.scoreBig, { color: bandColor }]}>{overall.overall.toFixed(1)}</Text>
        <Text style={s.wordCountNote}>{overall.wordCount} 词{overall.wordCountNote ? ` · ${overall.wordCountNote}` : ''}</Text>
      </View>

      {/* 四维分数 */}
      <View style={s.dimGrid}>
        {(['TR', 'CC', 'LR', 'GRA'] as const).map(dim => (
          <View key={dim} style={s.dimCard}>
            <Text style={s.dimLabel}>{DIMENSION_LABELS[dim]}</Text>
            <Text style={s.dimScore}>{(overall[dim] ?? 0).toFixed(1)}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['scores', 'annotations', 'rewrite'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab === 'scores' ? '详细分析' : tab === 'annotations' ? '逐句批注' : 'AI 改写'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab 内容 */}
      {activeTab === 'scores' && (
        <View>
          {/* 最高优先改进 */}
          <View style={s.priorityCard}>
            <Text style={s.priorityTitle}>🎯 本次最高优先改进</Text>
            <Text style={s.priorityDim}>{DIMENSION_LABELS[report.topPriorityImprovement.dimension]} · 出现 {report.topPriorityImprovement.occurrenceCount} 次</Text>
            <Text style={s.priorityIssue}>{report.topPriorityImprovement.issueSummary}</Text>
            <View style={s.beforeAfter}>
              <View style={s.beforeBox}>
                <Text style={s.beforeLabel}>❌ 原文</Text>
                <Text style={s.beforeText}>{report.topPriorityImprovement.exampleOriginal}</Text>
              </View>
              <View style={s.afterBox}>
                <Text style={s.afterLabel}>✅ 修改</Text>
                <Text style={s.afterText}>{report.topPriorityImprovement.exampleFixed}</Text>
              </View>
            </View>
            <Text style={s.fixExplanation}>{report.topPriorityImprovement.fixExplanation}</Text>
          </View>

          {/* 亮点 */}
          {report.highlights.length > 0 && (
            <View style={s.highlightsCard}>
              <Text style={s.highlightsTitle}>🟢 写得好的地方</Text>
              {report.highlights.map((h, i) => (
                <View key={i} style={s.highlightItem}>
                  <Text style={s.highlightText}>"{h.originalText}"</Text>
                  <Text style={s.highlightReason}>{h.reason}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 段落分析 */}
          <Text style={s.sectionTitle}>段落结构分析</Text>
          {report.paragraphAnalysis.map((p, i) => (
            <View key={i} style={s.paraCard}>
              <View style={s.paraHeader}>
                <Text style={s.paraRole}>{p.roleDetected}</Text>
                <View style={[s.paraClarity, { backgroundColor: p.mainIdeaClear ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Text style={{ fontSize: 11, color: p.mainIdeaClear ? '#065F46' : '#991B1B' }}>
                    {p.mainIdeaClear ? '主题清晰' : '主题不清'}
                  </Text>
                </View>
              </View>
              <Text style={s.paraComment}>{p.paragraphLevelComment}</Text>
            </View>
          ))}
        </View>
      )}

      {activeTab === 'annotations' && (
        <View>
          <Text style={s.legendTitle}>批注颜色说明</Text>
          <View style={s.legendRow}>
            {Object.entries(ANNOTATION_LABELS).map(([type, label]) => (
              <Text key={type} style={[s.legendItem, { borderColor: ANNOTATION_COLORS[type] }]}>{label}</Text>
            ))}
          </View>
          {report.sentenceAnnotations.map((sa, si) => (
            <View key={si} style={s.sentCard}>
              <Text style={s.sentOriginal}>{sa.originalSentence}</Text>
              {sa.annotations.map((ann, ai) => {
                const key = `${si}-${ai}`;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[s.annChip, { borderColor: ANNOTATION_COLORS[ann.type] ?? '#9CA3AF' }]}
                    onPress={() => setExpandedAnnotation(expandedAnnotation === key ? null : key)}
                  >
                    <Text style={[s.annChipText, { color: ANNOTATION_COLORS[ann.type] ?? '#6B7280' }]}>
                      {ANNOTATION_LABELS[ann.type] ?? ann.type} · "{ann.span}"
                    </Text>
                    {expandedAnnotation === key && (
                      <View style={s.annDetail}>
                        <Text style={s.annIssue}>{ann.issue}</Text>
                        {ann.correction && <Text style={s.annCorrection}>→ {ann.correction}</Text>}
                        <Text style={s.annExplanation}>{ann.explanation}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {activeTab === 'rewrite' && report.modelRewrite && (
        <View>
          <View style={s.rewriteHeader}>
            <Text style={s.rewriteTitle}>AI 改写参考</Text>
            <Text style={s.rewriteTargetBand}>目标 Band {report.modelRewrite.targetBand.toFixed(1)}</Text>
          </View>
          <Text style={s.rewriteNote}>以下为 AI 示范改写，对比你的原文学习提升方向</Text>
          <View style={s.rewriteText}>
            <Text style={s.rewriteContent}>{report.modelRewrite.rewrittenText}</Text>
          </View>
          <Text style={s.changesSectionTitle}>改动说明</Text>
          {report.modelRewrite.changesMade.map((c, i) => (
            <View key={i} style={s.changeItem}>
              <Text style={s.changeOriginal}>原：{c.original}</Text>
              <Text style={s.changeRewritten}>改：{c.rewritten}</Text>
              <Text style={s.changeDim}>[{c.dimension}] {c.explanation}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={s.backBtn} onPress={onBack}>
        <Text style={s.backBtnText}>返回任务列表</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', textAlign: 'center' },
  loadingSubtext: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  loadingSubtext2: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  taskCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  taskTypeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  taskTypeBadge: { backgroundColor: '#EEF2FF', color: '#6366F1', fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  wordTarget: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  taskPrompt: { fontSize: 15, color: '#1F2937', lineHeight: 24, fontWeight: '500' },
  tipsBox: { backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12, marginTop: 12 },
  tipsTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 6 },
  tipItem: { fontSize: 13, color: '#78350F', lineHeight: 20 },

  editorCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  editorHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  editorTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  wordCount: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
  wordCountOk: { color: '#10B981' },
  editor: { minHeight: 220, fontSize: 15, color: '#1F2937', lineHeight: 24 },

  submitBtn: { backgroundColor: '#6366F1', padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 8 },
  submitBtnDisabled: { backgroundColor: '#C7D2FE' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  warningText: { textAlign: 'center', color: '#F59E0B', fontSize: 13, marginBottom: 8 },

  // Report styles
  scoreHeader: { alignItems: 'center', paddingTop: 24, paddingBottom: 16 },
  scoreLabel: { fontSize: 14, color: '#9CA3AF', marginBottom: 4 },
  scoreBig: { fontSize: 56, fontWeight: '800' },
  wordCountNote: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },

  dimGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  dimCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  dimLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  dimScore: { fontSize: 22, fontWeight: '700', color: '#6366F1' },

  tabRow: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },
  tabTextActive: { color: '#6366F1' },

  priorityCard: { backgroundColor: '#FFF7ED', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#FED7AA' },
  priorityTitle: { fontSize: 15, fontWeight: '800', color: '#92400E', marginBottom: 4 },
  priorityDim: { fontSize: 12, color: '#B45309', marginBottom: 8 },
  priorityIssue: { fontSize: 14, color: '#78350F', marginBottom: 12 },
  beforeAfter: { gap: 8, marginBottom: 10 },
  beforeBox: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 10 },
  beforeLabel: { fontSize: 11, color: '#B91C1C', fontWeight: '700', marginBottom: 4 },
  beforeText: { fontSize: 13, color: '#991B1B', lineHeight: 20 },
  afterBox: { backgroundColor: '#D1FAE5', borderRadius: 10, padding: 10 },
  afterLabel: { fontSize: 11, color: '#065F46', fontWeight: '700', marginBottom: 4 },
  afterText: { fontSize: 13, color: '#047857', lineHeight: 20 },
  fixExplanation: { fontSize: 13, color: '#78350F', lineHeight: 20 },

  highlightsCard: { backgroundColor: '#ECFDF5', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#A7F3D0' },
  highlightsTitle: { fontSize: 15, fontWeight: '700', color: '#065F46', marginBottom: 10 },
  highlightItem: { marginBottom: 8 },
  highlightText: { fontSize: 14, color: '#047857', fontStyle: 'italic' },
  highlightReason: { fontSize: 12, color: '#10B981', marginTop: 2 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  paraCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  paraHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  paraRole: { fontSize: 13, fontWeight: '700', color: '#6366F1' },
  paraClarity: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  paraComment: { fontSize: 13, color: '#4B5563', lineHeight: 20 },

  legendTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  legendItem: { fontSize: 11, borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, color: '#374151' },

  sentCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  sentOriginal: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 8 },
  annChip: { borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 6 },
  annChipText: { fontSize: 13, fontWeight: '600' },
  annDetail: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  annIssue: { fontSize: 13, color: '#4B5563', marginBottom: 4 },
  annCorrection: { fontSize: 13, color: '#059669', fontWeight: '600', marginBottom: 4 },
  annExplanation: { fontSize: 12, color: '#6B7280', lineHeight: 18 },

  rewriteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rewriteTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  rewriteTargetBand: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, color: '#6366F1', fontSize: 12, fontWeight: '700' },
  rewriteNote: { fontSize: 13, color: '#9CA3AF', marginBottom: 12 },
  rewriteText: { backgroundColor: '#F0FDF4', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#A7F3D0' },
  rewriteContent: { fontSize: 15, color: '#1F2937', lineHeight: 26 },
  changesSectionTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  changeItem: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  changeOriginal: { fontSize: 13, color: '#EF4444', marginBottom: 4 },
  changeRewritten: { fontSize: 13, color: '#10B981', marginBottom: 4 },
  changeDim: { fontSize: 12, color: '#6B7280' },

  backBtn: { backgroundColor: '#6366F1', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

