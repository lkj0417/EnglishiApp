import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { readingAPI, vocabularyAPI } from '../../lib/api';
import type { ReadingArticle } from '@englishi/shared-types';

export default function ReadingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [selectedWord, setSelectedWord] = useState<any | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const isNew = id === 'new';

  const generateMutation = useMutation({
    mutationFn: () => readingAPI.generate(),
    onSuccess: (res) => setJobId(res.data.data.jobId),
  });

  useEffect(() => {
    if (isNew && !jobId && !generateMutation.isPending) {
      generateMutation.mutate();
    }
  }, [isNew, jobId, generateMutation]);

  const contentLookupId = isNew ? jobId : id;

  const { data, isLoading } = useQuery<any>({
    queryKey: ['reading', contentLookupId],
    queryFn: () => readingAPI.getContent(contentLookupId!).then(r => r.data.data),
    enabled: !!contentLookupId,
    refetchInterval: (query) => query.state.data?.body ? false : 2500,
  });

  const article = data?.body ? (data as ReadingArticle) : null;

  const submitMutation = useMutation({
    mutationFn: () => readingAPI.submitAnswers(article!.id, answers),
    onSuccess: (res) => {
      const correct: Record<string, boolean> = {};
      article?.questions.forEach(q => {
        correct[String(q.id)] = answers[String(q.id)] === q.correctAnswer;
      });
      setResults(correct);
      setSubmitted(true);
    },
  });

  const addVocabMutation = useMutation({
    mutationFn: (word: { word: string; wordCefr: number }) =>
      vocabularyAPI.addWord({ ...word, domain: article?.topic }),
  });

  if (isLoading || !article) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>AI 正在为你生成定制文章...</Text>
      </View>
    );
  }


  // 渲染文章正文（高亮 i+1 词汇）
  const renderArticleBody = () => {
    let body = article.body;
    const segments: { text: string; isTarget: boolean; vocabData?: any }[] = [];
    const targetWords = article.targetVocabulary.map(v => v.word.toLowerCase());

    const words = body.split(/(\s+)/);
    for (const word of words) {
      const clean = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
      if (targetWords.includes(clean)) {
        const vocabData = article.targetVocabulary.find(v => v.word.toLowerCase() === clean);
        segments.push({ text: word, isTarget: true, vocabData });
      } else {
        segments.push({ text: word, isTarget: false });
      }
    }

    return (
      <Text style={styles.articleBody}>
        {segments.map((seg, i) =>
          seg.isTarget ? (
            <Text
              key={i}
              style={styles.targetWord}
              onPress={() => setSelectedWord(seg.vocabData)}
            >
              {seg.text}
            </Text>
          ) : (
            <Text key={i}>{seg.text}</Text>
          ),
        )}
      </Text>
    );
  };

  const allAnswered = article.questions.every(q => answers[String(q.id)]);
  const correctCount = Object.values(results).filter(Boolean).length;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* 文章头部 */}
        <View style={styles.articleHeader}>
          <View style={styles.cefrBadge}>
            <Text style={styles.cefrBadgeText}>CEFR {formatCefr(article.cefrLevel)}</Text>
          </View>
          <Text style={styles.articleTitle}>{article.title}</Text>
          <Text style={styles.articleMeta}>{article.wordCount} 词 · {article.genre} · {article.topic}</Text>
        </View>

        {/* 文章正文 */}
        <View style={styles.articleCard}>
          {renderArticleBody()}
        </View>

        {/* 词汇弹窗 */}
        {selectedWord && (
          <View style={styles.vocabPopup}>
            <View style={styles.vocabPopupHeader}>
              <Text style={styles.vocabWord}>{selectedWord.word}</Text>
              <Text style={styles.vocabPhonetic}>{selectedWord.phonetic}</Text>
              <TouchableOpacity onPress={() => setSelectedWord(null)} style={styles.vocabClose}>
                <Text>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.vocabPos}>{selectedWord.partOfSpeech}</Text>
            <Text style={styles.vocabDefEn}>{selectedWord.definitionEn}</Text>
            <Text style={styles.vocabDefZh}>{selectedWord.definitionZh}</Text>
            {selectedWord.commonCollocations?.length > 0 && (
              <Text style={styles.vocabCollocations}>
                常见搭配：{selectedWord.commonCollocations.slice(0, 3).join(' · ')}
              </Text>
            )}
            {selectedWord.memoryAid && (
              <Text style={styles.vocabMemoryAid}>💡 {selectedWord.memoryAid}</Text>
            )}
            <View style={styles.vocabActions}>
              <TouchableOpacity
                style={styles.vocabAddBtn}
                onPress={() => {
                  addVocabMutation.mutate({ word: selectedWord.word, wordCefr: selectedWord.cefrLevel });
                  setSelectedWord(null);
                }}
              >
                <Text style={styles.vocabAddBtnText}>+ 加入词汇本</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedWord(null)} style={styles.vocabSkipBtn}>
                <Text style={styles.vocabSkipBtnText}>跳过</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 理解题 */}
        <Text style={styles.sectionTitle}>理解测验</Text>
        {article.questions.map((q, qi) => (
          <View key={q.id} style={[styles.questionCard, submitted && results[String(q.id)] && styles.questionCorrect, submitted && !results[String(q.id)] && styles.questionWrong]}>
            <Text style={styles.questionNumber}>第 {qi + 1} 题 <Text style={styles.questionType}>({q.type})</Text></Text>
            <Text style={styles.questionText}>{q.question}</Text>
            {q.options.map(opt => {
              const letter = opt.split(':')[0]?.trim() ?? '';
              const isSelected = answers[String(q.id)] === letter;
              const isCorrect = q.correctAnswer === letter;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.option,
                    isSelected && !submitted && styles.optionSelected,
                    submitted && isCorrect && styles.optionCorrect,
                    submitted && isSelected && !isCorrect && styles.optionWrongSelected,
                  ]}
                  onPress={() => !submitted && setAnswers(prev => ({ ...prev, [String(q.id)]: letter }))}
                  disabled={submitted}
                >
                  <Text style={[
                    styles.optionText,
                    isSelected && !submitted && styles.optionTextSelected,
                    submitted && isCorrect && styles.optionTextCorrect,
                  ]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
            {submitted && (
              <View style={styles.explanation}>
                <Text style={styles.explanationText}>💡 {q.explanation}</Text>
              </View>
            )}
          </View>
        ))}

        {/* 提交 / 结果 */}
        {!submitted ? (
          <TouchableOpacity
            style={[styles.submitBtn, !allAnswered && styles.submitBtnDisabled]}
            disabled={!allAnswered || submitMutation.isPending}
            onPress={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>提交答案</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.resultCard}>
            <Text style={styles.resultScore}>
              {correctCount}/{article.questions.length} 正确
            </Text>
            <Text style={styles.resultSubtext}>
              {correctCount === article.questions.length ? '🎉 全对！太棒了' :
               correctCount >= article.questions.length * 0.75 ? '👍 掌握良好' :
               '📖 建议二读，关注未理解的部分'}
            </Text>
            <TouchableOpacity style={styles.nextBtn} onPress={() => router.back()}>
              <Text style={styles.nextBtnText}>完成，返回任务列表</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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

  articleHeader: { paddingTop: 20, paddingBottom: 12 },
  cefrBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 8 },
  cefrBadgeText: { color: '#6366F1', fontSize: 12, fontWeight: '700' },
  articleTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', lineHeight: 28, marginBottom: 6 },
  articleMeta: { fontSize: 12, color: '#9CA3AF' },

  articleCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  articleBody: { fontSize: 16, lineHeight: 26, color: '#374151' },
  targetWord: { color: '#6366F1', textDecorationLine: 'underline', fontWeight: '600' },

  vocabPopup: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: '#6366F1', shadowColor: '#6366F1', shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  vocabPopupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  vocabWord: { fontSize: 20, fontWeight: '700', color: '#1F2937', flex: 1 },
  vocabPhonetic: { fontSize: 13, color: '#6B7280' },
  vocabClose: { padding: 4 },
  vocabPos: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  vocabDefEn: { fontSize: 15, color: '#374151', fontStyle: 'italic', marginBottom: 4 },
  vocabDefZh: { fontSize: 15, color: '#1F2937', fontWeight: '600', marginBottom: 8 },
  vocabCollocations: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  vocabMemoryAid: { fontSize: 13, color: '#10B981', backgroundColor: '#ECFDF5', padding: 8, borderRadius: 8, marginBottom: 10 },
  vocabActions: { flexDirection: 'row', gap: 10 },
  vocabAddBtn: { flex: 1, backgroundColor: '#6366F1', padding: 10, borderRadius: 10, alignItems: 'center' },
  vocabAddBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  vocabSkipBtn: { flex: 1, backgroundColor: '#F3F4F6', padding: 10, borderRadius: 10, alignItems: 'center' },
  vocabSkipBtnText: { color: '#6B7280', fontSize: 14 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 },

  questionCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  questionCorrect: { borderWidth: 1.5, borderColor: '#10B981' },
  questionWrong: { borderWidth: 1.5, borderColor: '#EF4444' },
  questionNumber: { fontSize: 12, color: '#9CA3AF', marginBottom: 6 },
  questionType: { fontStyle: 'italic' },
  questionText: { fontSize: 15, color: '#1F2937', lineHeight: 22, marginBottom: 12, fontWeight: '500' },
  option: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  optionSelected: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  optionCorrect: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  optionWrongSelected: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  optionText: { fontSize: 14, color: '#374151' },
  optionTextSelected: { color: '#6366F1', fontWeight: '600' },
  optionTextCorrect: { color: '#059669', fontWeight: '600' },
  explanation: { backgroundColor: '#FFF7ED', borderRadius: 8, padding: 10, marginTop: 4 },
  explanationText: { fontSize: 13, color: '#92400E', lineHeight: 20 },

  submitBtn: { backgroundColor: '#6366F1', padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  submitBtnDisabled: { backgroundColor: '#C7D2FE' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  resultCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12, borderWidth: 1.5, borderColor: '#6366F1' },
  resultScore: { fontSize: 36, fontWeight: '800', color: '#6366F1', marginBottom: 6 },
  resultSubtext: { fontSize: 15, color: '#6B7280', marginBottom: 16 },
  nextBtn: { backgroundColor: '#6366F1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

