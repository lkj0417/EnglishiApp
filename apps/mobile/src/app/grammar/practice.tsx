import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { grammarAPI } from '../../lib/api';

type Exercise = {
  id: number | string;
  type: string;
  instruction: string;
  question: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
};

type GrammarLesson = {
  grammar_point: string;
  one_line_rule: string;
  inductive_examples?: Array<{ context: string; correct: string; incorrect: string; difference_highlight?: string }>;
  when_to_use?: string[];
  when_not_to_use?: string[];
  chinese_learner_pitfall?: string;
  quick_reference?: string;
  exercises?: Exercise[];
};

export default function GrammarPracticeScreen() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  const { data: priority, isLoading: priorityLoading } = useQuery({
    queryKey: ['grammar-priority'],
    queryFn: () => grammarAPI.getPriorityPoint().then(r => r.data.data),
  });

  const point = priority?.grammarPoint as string | undefined;
  const { data: lessonPayload, isLoading: lessonLoading } = useQuery<any>({
    queryKey: ['grammar-lesson', point],
    queryFn: () => grammarAPI.getLesson(point!).then(r => r.data.data),
    enabled: !!point,
    refetchInterval: (query) => query.state.data?.status === 'completed' ? false : 2500,
  });

  const lesson = lessonPayload?.lesson as GrammarLesson | undefined;
  const exercises = useMemo(() => lesson?.exercises ?? [], [lesson]);

  const submitMutation = useMutation({
    mutationFn: () => grammarAPI.submitExercises(point!, exercises.map(e => ({
      questionId: String(e.id),
      correct: answers[String(e.id)] === e.correct_answer,
    }))),
    onSuccess: (res) => {
      setSubmitResult(res.data.data);
      setSubmitted(true);
    },
  });

  if (priorityLoading || lessonLoading || !lesson) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={s.loadingText}>正在准备你的语法专项...</Text>
      </View>
    );
  }

  const allAnswered = exercises.every(e => answers[String(e.id)]);

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <Text style={s.badge}>CEFR {priority?.cefrLevel}</Text>
        <Text style={s.title}>{priority?.title}</Text>
        <Text style={s.rule}>{lesson.one_line_rule}</Text>
      </View>

      {lesson.inductive_examples?.length ? (
        <View style={s.card}>
          <Text style={s.sectionTitle}>先看例子，再总结规则</Text>
          {lesson.inductive_examples.slice(0, 3).map((ex, i) => (
            <View key={i} style={s.exampleBox}>
              <Text style={s.context}>{ex.context}</Text>
              <Text style={s.correct}>✅ {ex.correct}</Text>
              <Text style={s.incorrect}>❌ {ex.incorrect}</Text>
              {ex.difference_highlight ? <Text style={s.note}>{ex.difference_highlight}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {lesson.chinese_learner_pitfall ? (
        <View style={s.warningCard}>
          <Text style={s.warningTitle}>中文母语者常见误区</Text>
          <Text style={s.warningText}>{lesson.chinese_learner_pitfall}</Text>
        </View>
      ) : null}

      <Text style={s.sectionTitle}>快速练习</Text>
      {exercises.map((ex, idx) => {
        const qid = String(ex.id);
        const selected = answers[qid];
        const correct = submitted && selected === ex.correct_answer;
        const wrong = submitted && selected !== ex.correct_answer;
        return (
          <View key={qid} style={[s.questionCard, correct && s.correctCard, wrong && s.wrongCard]}>
            <Text style={s.questionNo}>第 {idx + 1} 题 · {ex.type}</Text>
            <Text style={s.instruction}>{ex.instruction}</Text>
            <Text style={s.questionText}>{ex.question}</Text>
            {(ex.options ?? []).map(opt => {
              const value = opt.split(':')[0]?.trim() ?? opt;
              const isSelected = selected === value;
              return (
                <TouchableOpacity
                  key={opt}
                  disabled={submitted}
                  onPress={() => setAnswers(prev => ({ ...prev, [qid]: value }))}
                  style={[s.option, isSelected && s.optionSelected]}
                >
                  <Text style={[s.optionText, isSelected && s.optionTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
            {submitted && ex.explanation ? <Text style={s.explanation}>💡 {ex.explanation}</Text> : null}
          </View>
        );
      })}

      {!submitted ? (
        <TouchableOpacity
          style={[s.submitBtn, (!allAnswered || submitMutation.isPending) && s.disabledBtn]}
          disabled={!allAnswered || submitMutation.isPending}
          onPress={() => submitMutation.mutate()}
        >
          {submitMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>提交练习</Text>}
        </TouchableOpacity>
      ) : (
        <View style={s.resultCard}>
          <Text style={s.resultScore}>{Math.round(submitResult.accuracy * 100)}%</Text>
          <Text style={s.resultNote}>{submitResult.message}</Text>
          <TouchableOpacity style={s.submitBtn} onPress={() => router.back()}><Text style={s.submitText}>返回任务列表</Text></TouchableOpacity>
        </View>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { color: '#6B7280', fontSize: 14 },
  header: { paddingTop: 20, paddingBottom: 12 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#EEF2FF', color: '#6366F1', fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', color: '#1F2937', marginBottom: 8 },
  rule: { fontSize: 15, color: '#4B5563', lineHeight: 22 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#1F2937', marginBottom: 10, marginTop: 4 },
  exampleBox: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 10 },
  context: { color: '#6B7280', fontSize: 12, marginBottom: 6 },
  correct: { color: '#047857', fontSize: 14, marginBottom: 4 },
  incorrect: { color: '#B91C1C', fontSize: 14, marginBottom: 4 },
  note: { color: '#6366F1', fontSize: 12 },
  warningCard: { backgroundColor: '#FFF7ED', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#FED7AA' },
  warningTitle: { color: '#92400E', fontWeight: '900', marginBottom: 5 },
  warningText: { color: '#78350F', lineHeight: 21 },
  questionCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  correctCard: { borderColor: '#10B981' },
  wrongCard: { borderColor: '#EF4444' },
  questionNo: { fontSize: 12, color: '#9CA3AF', marginBottom: 5 },
  instruction: { fontSize: 12, color: '#6366F1', fontWeight: '700', marginBottom: 5 },
  questionText: { fontSize: 15, color: '#1F2937', lineHeight: 22, marginBottom: 10, fontWeight: '600' },
  option: { padding: 11, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  optionSelected: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  optionText: { color: '#374151', fontSize: 14 },
  optionTextSelected: { color: '#6366F1', fontWeight: '800' },
  explanation: { fontSize: 13, color: '#92400E', backgroundColor: '#FFF7ED', padding: 8, borderRadius: 8 },
  submitBtn: { backgroundColor: '#6366F1', padding: 15, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  disabledBtn: { backgroundColor: '#C7D2FE' },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  resultCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 12 },
  resultScore: { fontSize: 44, fontWeight: '900', color: '#6366F1' },
  resultNote: { color: '#6B7280', marginVertical: 10 },
});

