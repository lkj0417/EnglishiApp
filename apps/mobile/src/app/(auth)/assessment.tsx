import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { assessmentAPI } from '../../lib/api';
import { useUserAbilityStore } from '../../stores';

type AssessmentState = 'starting' | 'in_progress' | 'completed';

export default function AssessmentScreen() {
  const [state, setState] = useState<AssessmentState>('starting');
  const [sessionId, setSessionId] = useState('');
  const [question, setQuestion] = useState<any>(null);
  const [progress, setProgress] = useState({ current: 0, total: 20 });
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [result, setResult] = useState<any>(null);
  const [startTime, setStartTime] = useState(0);
  const setUCL = useUserAbilityStore(s => s.setUCL);

  const startMutation = useMutation({
    mutationFn: () => assessmentAPI.start(),
    onSuccess: (res) => {
      const { sessionId: sid, question: q, progress: p } = res.data.data;
      setSessionId(sid);
      setQuestion(q);
      setProgress(p);
      setStartTime(Date.now());
      setState('in_progress');
    },
  });

  const answerMutation = useMutation({
    mutationFn: (answer: string) => assessmentAPI.answer({
      sessionId,
      questionId: question.id,
      answer,
      responseTimeSec: Math.round((Date.now() - startTime) / 1000),
    }),
    onSuccess: (res) => {
      const data = res.data.data;
      if (data.completed) {
        // 保存结果到服务器
        assessmentAPI.complete(sessionId).then((completeRes) => {
          setResult(data.result);
          setState('completed');
          // 更新本地 UCL
          if (data.result) {
            setUCL({
              userId: '',
              overallCefr: data.result.overallCefr,
              dimensions: data.result.dimensions,
              estimatedVocabSize: data.result.estimatedVocabSize,
              ieltsPrediction: data.result.ieltsPrediction,
              masteredGrammar: data.result.masteredGrammar,
              notYetGrammar: [],
              weakAreas: data.result.weakAreas,
              errorPatterns: [],
              confidenceInterval: data.result.confidenceInterval,
              updatedAt: new Date().toISOString(),
            });
          }
        });
      } else {
        setQuestion(data.question);
        setProgress(data.progress);
        setSelectedAnswer('');
        setStartTime(Date.now());
      }
    },
  });

  if (state === 'starting') {
    return (
      <View style={s.centered}>
        <Text style={s.titleEmoji}>🎯</Text>
        <Text style={s.title}>入门测评</Text>
        <Text style={s.subtitle}>20 道题 · 约 8 分钟{'\n'}AI 将精确定位你的英语水平</Text>
        <View style={s.infoCard}>
          <Text style={s.infoItem}>✓ 词汇 · 语法 · 阅读 · 听力四维评测</Text>
          <Text style={s.infoItem}>✓ 难度自动调整，越答越准</Text>
          <Text style={s.infoItem}>✓ 完成后立即生成个性化学习计划</Text>
          <Text style={s.infoItem}>✓ 不会出现超出能力范围的题目</Text>
        </View>
        <TouchableOpacity
          style={s.startBtn}
          onPress={() => startMutation.mutate()}
          disabled={startMutation.isPending}
        >
          {startMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.startBtnText}>开始测评</Text>
          }
        </TouchableOpacity>
      </View>
    );
  }

  if (state === 'completed' && result) {
    const labels: Record<number, string> = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' };
    const cefrLabel = labels[Math.floor(result.overallCefr)] ?? 'B1';
    return (
      <ScrollView style={s.container}>
        <View style={s.resultHeader}>
          <Text style={s.resultEmoji}>🎉</Text>
          <Text style={s.resultTitle}>测评完成！</Text>
          <Text style={s.resultCefr}>{cefrLabel} {(result.overallCefr % 1 * 10).toFixed(0) !== '0' ? `.${(result.overallCefr % 1 * 10).toFixed(0)}` : ''}</Text>
          <Text style={s.resultIelts}>雅思预测：{result.ieltsPrediction} 分</Text>
        </View>

        <View style={s.dimGrid}>
          {Object.entries(result.dimensions as Record<string, number>).map(([skill, score]) => (
            <View key={skill} style={s.dimCard}>
              <Text style={s.dimLabel}>{SKILL_LABELS[skill] ?? skill}</Text>
              <Text style={s.dimScore}>{labels[Math.floor(score)] ?? 'B1'}</Text>
            </View>
          ))}
        </View>

        <View style={s.vocabCard}>
          <Text style={s.vocabTitle}>📚 估算词汇量</Text>
          <Text style={s.vocabCount}>{result.estimatedVocabSize.toLocaleString()} 词</Text>
        </View>

        <TouchableOpacity
          style={s.startBtn}
          onPress={() => router.replace('/(tabs)/today')}
        >
          <Text style={s.startBtnText}>开始我的专属学习计划 →</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // in_progress
  const skillLabels: Record<string, string> = { vocabulary: '词汇', grammar: '语法', reading: '阅读', listening: '听力' };

  return (
    <View style={s.container}>
      {/* 进度 */}
      <View style={s.progressArea}>
        <View style={s.progressBarBg}>
          <View style={[s.progressBarFill, { width: `${(progress.current / progress.total) * 100}%` }]} />
        </View>
        <Text style={s.progressText}>{progress.current} / {progress.total}</Text>
      </View>

      <ScrollView style={s.questionArea} showsVerticalScrollIndicator={false}>
        {/* 技能标签 */}
        {question?.skill && (
          <View style={s.skillBadge}>
            <Text style={s.skillBadgeText}>{skillLabels[question.skill] ?? question.skill}</Text>
          </View>
        )}

        {/* 题目 */}
        <Text style={s.questionText}>{question?.question}</Text>

        {/* 选项 */}
        {question?.options?.map((opt: string) => {
          const letter = opt.split(':')[0]?.trim() ?? '';
          const isSelected = selectedAnswer === letter;
          return (
            <TouchableOpacity
              key={opt}
              style={[s.option, isSelected && s.optionSelected]}
              onPress={() => setSelectedAnswer(letter)}
            >
              <Text style={[s.optionText, isSelected && s.optionTextSelected]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 提交 */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          style={[s.submitBtn, (!selectedAnswer || answerMutation.isPending) && s.submitBtnDisabled]}
          disabled={!selectedAnswer || answerMutation.isPending}
          onPress={() => answerMutation.mutate(selectedAnswer)}
        >
          {answerMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.submitBtnText}>确认答案</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const SKILL_LABELS: Record<string, string> = { vocabulary: '词汇', grammar: '语法', reading: '阅读', listening: '听力', speaking: '口语', writing: '写作' };

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  titleEmoji: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#1F2937', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', gap: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginBottom: 24 },
  infoItem: { fontSize: 14, color: '#374151', lineHeight: 22 },
  startBtn: { backgroundColor: '#6366F1', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 14, width: '100%', alignItems: 'center' },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  progressArea: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBarBg: { flex: 1, height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#6366F1', borderRadius: 4 },
  progressText: { fontSize: 13, color: '#9CA3AF', fontWeight: '600', width: 40 },

  questionArea: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  skillBadge: { alignSelf: 'flex-start', backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginBottom: 12 },
  skillBadgeText: { fontSize: 12, color: '#6366F1', fontWeight: '700' },
  questionText: { fontSize: 16, color: '#1F2937', lineHeight: 26, marginBottom: 20, fontWeight: '500' },
  option: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, marginBottom: 10, backgroundColor: '#fff' },
  optionSelected: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  optionText: { fontSize: 15, color: '#374151', lineHeight: 22 },
  optionTextSelected: { color: '#6366F1', fontWeight: '600' },

  bottomBar: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#fff' },
  submitBtn: { backgroundColor: '#6366F1', padding: 16, borderRadius: 14, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#C7D2FE' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  resultHeader: { alignItems: 'center', paddingTop: 32, paddingBottom: 20, paddingHorizontal: 24 },
  resultEmoji: { fontSize: 56, marginBottom: 12 },
  resultTitle: { fontSize: 24, fontWeight: '800', color: '#1F2937', marginBottom: 8 },
  resultCefr: { fontSize: 48, fontWeight: '800', color: '#6366F1', marginBottom: 4 },
  resultIelts: { fontSize: 16, color: '#9CA3AF' },
  dimGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  dimCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  dimLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  dimScore: { fontSize: 22, fontWeight: '700', color: '#6366F1' },
  vocabCard: { marginHorizontal: 16, backgroundColor: '#EEF2FF', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  vocabTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  vocabCount: { fontSize: 22, fontWeight: '800', color: '#6366F1' },
});

