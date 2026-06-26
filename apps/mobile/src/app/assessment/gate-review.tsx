import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { dailyPackAPI } from '../../lib/api';

export default function GateReviewScreen() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['gate-review'],
    queryFn: () => dailyPackAPI.getGateReview().then(r => r.data.data),
  });

  const submitMutation = useMutation({
    mutationFn: () => dailyPackAPI.submitGateReview(answers),
    onSuccess: (res) => setResult(res.data.data),
  });

  if (isLoading || !data) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={s.loadingText}>正在加载关卡测验...</Text>
      </View>
    );
  }

  const questions = data.questions ?? [];
  const allAnswered = questions.every((q: any) => answers[q.id]);

  if (result) {
    return (
      <View style={s.centered}>
        <Text style={s.emoji}>{result.passed ? '🎉' : '📚'}</Text>
        <Text style={s.resultTitle}>{result.passed ? '关卡通过' : '需要巩固'}</Text>
        <Text style={[s.resultScore, { color: result.passed ? '#10B981' : '#F59E0B' }]}>{Math.round(result.score * 100)}%</Text>
        <Text style={s.resultMessage}>{result.message}</Text>
        <TouchableOpacity style={s.submitBtn} onPress={() => router.replace('/(tabs)/today')}>
          <Text style={s.submitText}>返回今日学习</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <Text style={s.badge}>Gate Review · {Math.round(data.timeLimit / 60)} 分钟</Text>
        <Text style={s.title}>关卡测验</Text>
        <Text style={s.subtitle}>通过后系统才会继续提升内容难度，防止超纲和虚假进度。</Text>
      </View>

      {questions.map((q: any, idx: number) => (
        <View key={q.id} style={s.questionCard}>
          <Text style={s.questionNo}>第 {idx + 1} 题 · {q.type}</Text>
          <Text style={s.questionText}>{q.question}</Text>
          {(q.options ?? []).map((opt: string) => {
            const value = opt.split(':')[0]?.trim() ?? opt;
            const selected = answers[q.id] === value;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => setAnswers(prev => ({ ...prev, [q.id]: value }))}
                style={[s.option, selected && s.optionSelected]}
              >
                <Text style={[s.optionText, selected && s.optionTextSelected]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <TouchableOpacity
        style={[s.submitBtn, (!allAnswered || submitMutation.isPending) && s.disabledBtn]}
        disabled={!allAnswered || submitMutation.isPending}
        onPress={() => submitMutation.mutate()}
      >
        {submitMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>提交关卡测验</Text>}
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16 },
  centered: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { color: '#6B7280', fontSize: 14 },
  header: { paddingTop: 20, paddingBottom: 12 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#F5F3FF', color: '#6D28D9', fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '900', color: '#1F2937', marginBottom: 6 },
  subtitle: { color: '#6B7280', lineHeight: 21 },
  questionCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  questionNo: { fontSize: 12, color: '#9CA3AF', marginBottom: 6 },
  questionText: { fontSize: 15, color: '#1F2937', lineHeight: 22, marginBottom: 10, fontWeight: '700' },
  option: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  optionSelected: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  optionText: { color: '#374151', fontSize: 14 },
  optionTextSelected: { color: '#6366F1', fontWeight: '800' },
  submitBtn: { backgroundColor: '#6366F1', padding: 15, borderRadius: 14, alignItems: 'center', marginTop: 6 },
  disabledBtn: { backgroundColor: '#C7D2FE' },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  emoji: { fontSize: 58 },
  resultTitle: { fontSize: 22, fontWeight: '900', color: '#1F2937' },
  resultScore: { fontSize: 50, fontWeight: '900' },
  resultMessage: { textAlign: 'center', color: '#6B7280', lineHeight: 22, marginBottom: 8 },
});

