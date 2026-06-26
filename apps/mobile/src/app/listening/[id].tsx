import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { listeningAPI } from '../../lib/api';

type ListeningQuestion = {
  id: number | string;
  question: string;
  type: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
};

type ListeningContent = {
  id: string;
  title: string;
  cefr_level: string;
  speech_rate_wpm: number;
  duration_seconds: number;
  sub_skill: string;
  transcript: string;
  questions: ListeningQuestion[];
  vocab_focus?: Array<{ word: string; definition_zh: string; phonetic?: string }>;
};

export default function ListeningScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [jobId, setJobId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);

  const generateMutation = useMutation({
    mutationFn: () => listeningAPI.generate(),
    onSuccess: (res) => setJobId(res.data.data.jobId),
  });

  useEffect(() => {
    if (isNew && !jobId && !generateMutation.isPending) generateMutation.mutate();
  }, [isNew, jobId, generateMutation]);

  const lookupId = isNew ? jobId : id;
  const { data, isLoading } = useQuery<any>({
    queryKey: ['listening', lookupId],
    queryFn: async () => {
      const res = isNew
        ? await listeningAPI.getContent(lookupId!)
        : await listeningAPI.getAudio(lookupId!);
      return res.data.data;
    },
    enabled: !!lookupId,
    refetchInterval: (query) => query.state.data?.transcript ? false : 2500,
  });

  const content = data?.transcript ? (data as ListeningContent) : null;

  const submitMutation = useMutation({
    mutationFn: () => listeningAPI.submitAnswers(content!.id, answers),
    onSuccess: (res) => {
      setResult(res.data.data);
      setSubmitted(true);
    },
  });

  if (isLoading || !content) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={s.loadingText}>AI 正在为你生成听力材料...</Text>
      </View>
    );
  }

  const allAnswered = content.questions.every(q => answers[String(q.id)]);

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <Text style={s.badge}>CEFR {content.cefr_level} · {content.speech_rate_wpm} wpm</Text>
        <Text style={s.title}>{content.title}</Text>
        <Text style={s.meta}>{Math.round(content.duration_seconds / 60)} 分钟 · {content.sub_skill}</Text>
      </View>

      <View style={s.audioCard}>
        <Text style={s.audioIcon}>🎧</Text>
        <Text style={s.audioTitle}>听力脚本（开发版）</Text>
        <Text style={s.audioNote}>生产版会在这里播放 TTS 音频；当前版本先展示脚本用于训练和调试。</Text>
        <Text style={s.transcript}>{content.transcript.replace(/\[PAUSE:[^\]]+\]/g, ' … ')}</Text>
      </View>

      {content.vocab_focus?.length ? (
        <View style={s.vocabCard}>
          <Text style={s.sectionTitle}>关键词</Text>
          {content.vocab_focus.slice(0, 5).map(v => (
            <Text key={v.word} style={s.vocabItem}>{v.word} {v.phonetic ? `/${v.phonetic}/` : ''} — {v.definition_zh}</Text>
          ))}
        </View>
      ) : null}

      <Text style={s.sectionTitle}>理解题</Text>
      {content.questions.map((q, idx) => {
        const qid = String(q.id);
        const correct = submitted && result?.results?.[qid];
        const wrong = submitted && result?.results && !result.results[qid];
        return (
          <View key={qid} style={[s.questionCard, correct && s.correctCard, wrong && s.wrongCard]}>
            <Text style={s.questionNo}>第 {idx + 1} 题 · {q.type}</Text>
            <Text style={s.questionText}>{q.question}</Text>
            {(q.options ?? []).map(opt => {
              const letter = opt.split(':')[0]?.trim() ?? opt;
              const selected = answers[qid] === letter;
              return (
                <TouchableOpacity
                  key={opt}
                  disabled={submitted}
                  onPress={() => setAnswers(prev => ({ ...prev, [qid]: letter }))}
                  style={[s.option, selected && s.optionSelected]}
                >
                  <Text style={[s.optionText, selected && s.optionTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
            {submitted && q.explanation ? <Text style={s.explanation}>💡 {q.explanation}</Text> : null}
          </View>
        );
      })}

      {!submitted ? (
        <TouchableOpacity
          style={[s.submitBtn, (!allAnswered || submitMutation.isPending) && s.disabledBtn]}
          disabled={!allAnswered || submitMutation.isPending}
          onPress={() => submitMutation.mutate()}
        >
          {submitMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>提交听力答案</Text>}
        </TouchableOpacity>
      ) : (
        <View style={s.resultCard}>
          <Text style={s.resultScore}>{result.correctCount}/{result.totalCount} 正确</Text>
          <Text style={s.resultNote}>{result.needsReinforcement ? '建议降低语速再练一次' : '完成得不错，继续保持'}</Text>
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
  badge: { alignSelf: 'flex-start', backgroundColor: '#ECFDF5', color: '#047857', fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
  title: { fontSize: 21, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  meta: { fontSize: 12, color: '#9CA3AF' },
  audioCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  audioIcon: { fontSize: 32, textAlign: 'center' },
  audioTitle: { textAlign: 'center', fontWeight: '800', color: '#1F2937', marginBottom: 6 },
  audioNote: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginBottom: 12, lineHeight: 18 },
  transcript: { fontSize: 15, color: '#374151', lineHeight: 25 },
  vocabCard: { backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14, marginBottom: 14 },
  vocabItem: { fontSize: 13, color: '#047857', lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937', marginBottom: 10 },
  questionCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  correctCard: { borderColor: '#10B981' },
  wrongCard: { borderColor: '#EF4444' },
  questionNo: { fontSize: 12, color: '#9CA3AF', marginBottom: 6 },
  questionText: { fontSize: 15, color: '#1F2937', lineHeight: 22, marginBottom: 10, fontWeight: '600' },
  option: { padding: 11, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  optionSelected: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  optionText: { color: '#374151', fontSize: 14 },
  optionTextSelected: { color: '#6366F1', fontWeight: '700' },
  explanation: { fontSize: 13, color: '#92400E', backgroundColor: '#FFF7ED', padding: 8, borderRadius: 8 },
  submitBtn: { backgroundColor: '#6366F1', padding: 15, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  disabledBtn: { backgroundColor: '#C7D2FE' },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  resultCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 12 },
  resultScore: { fontSize: 34, fontWeight: '900', color: '#6366F1' },
  resultNote: { color: '#6B7280', marginVertical: 10 },
});

