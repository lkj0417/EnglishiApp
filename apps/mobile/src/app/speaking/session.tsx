import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { speakingAPI } from '../../lib/api';
import { useSpeakingStore } from '../../stores';
import type { SpeakingFeedbackReport } from '@englishi/shared-types';

type SessionState =
  | 'idle'
  | 'starting'
  | 'examiner_speaking'
  | 'candidate_recording'
  | 'processing'
  | 'feedback';

const PART_LABELS = { Part1: 'Part 1 — 个人问答', Part2: 'Part 2 — 独白', Part3: 'Part 3 — 深度讨论' };
const DIM_LABELS = { FC: '流利连贯', LR: '词汇资源', GRA: '语法准确', PR: '发音' };

export default function SpeakingSessionScreen() {
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [selectedPart, setSelectedPart] = useState<'Part1' | 'Part2' | 'Part3'>('Part1');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [transcript, setTranscript] = useState<{ speaker: 'examiner' | 'candidate'; text: string }[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [prepTime, setPrepTime] = useState(60);
  const ws = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 创建口语会话
  const createMutation = useMutation({
    mutationFn: () => speakingAPI.createSession(selectedPart),
    onSuccess: (res) => {
      const { sessionId: sid, wsToken, wsUrl } = res.data.data;
      setSessionId(sid);
      connectWebSocket(wsUrl, wsToken, sid);
    },
  });

  // 获取报告（完成后）
  const { data: reportData } = useQuery({
    queryKey: ['speaking-report', sessionId],
    queryFn: () => speakingAPI.getReport(sessionId!).then(r => r.data.data),
    enabled: sessionState === 'processing' && !!sessionId,
    refetchInterval: (query) => {
      if (query.state.data?.feedbackReport) return false;
      return 3000;
    },
    refetchOnMount: false,
  });

  useEffect(() => {
    if (reportData?.feedbackReport) {
      setSessionState('feedback');
    }
  }, [reportData]);

  // 录音时动态波形动画
  useEffect(() => {
    if (sessionState === 'candidate_recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionState]);

  const connectWebSocket = (wsUrl: string, token: string, sid: string) => {
    setSessionState('starting');
    // 使用内置 WebSocket（React Native 原生支持）
    const socket = new WebSocket(`${wsUrl}?token=${token}`);
    ws.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'session_start', session_id: sid, timestamp: Date.now() }));
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'examiner_question':
          setCurrentQuestion(msg.payload.text);
          setTranscript(prev => [...prev, { speaker: 'examiner', text: msg.payload.text }]);
          setSessionState(selectedPart === 'Part2' ? 'candidate_recording' : 'examiner_speaking');
          // Part 2 需要准备时间
          if (selectedPart === 'Part2') {
            let countdown = 60;
            const prep = setInterval(() => {
              countdown--;
              setPrepTime(countdown);
              if (countdown <= 0) { clearInterval(prep); setSessionState('candidate_recording'); }
            }, 1000);
          } else {
            setTimeout(() => setSessionState('candidate_recording'), 500);
          }
          break;
        case 'transcription_final':
          setTranscript(prev => [...prev, { speaker: 'candidate', text: msg.payload.text }]);
          setSessionState('examiner_speaking');
          break;
        case 'follow_up_question':
          setCurrentQuestion(msg.payload.text);
          setTranscript(prev => [...prev, { speaker: 'examiner', text: msg.payload.text }]);
          setSessionState('candidate_recording');
          break;
        case 'session_complete':
          setSessionState('processing');
          break;
      }
    };

    socket.onerror = () => setSessionState('idle');
    socket.onclose = () => { if (sessionState !== 'processing' && sessionState !== 'feedback') setSessionState('idle'); };
  };

  const handleStartRecording = () => {
    // 实际生产版：调用 expo-av 录音
    // 此处发送模拟数据用于演示流程
    ws.current?.send(JSON.stringify({
      type: 'candidate_recording_end',
      session_id: sessionId,
      mock_text: '[Recording would be transcribed here]',
      duration_ms: recordingTime * 1000,
      is_last_question: transcript.filter(t => t.speaker === 'examiner').length >= 3,
      timestamp: Date.now(),
    }));
  };

  const report = reportData?.feedbackReport as SpeakingFeedbackReport | undefined;

  // ── 状态渲染 ──────────────────────────────

  if (sessionState === 'idle') {
    return (
      <ScrollView style={s.container}>
        <Text style={s.pageTitle}>口语训练</Text>
        <Text style={s.pageSubtitle}>选择练习模式，AI 考官将模拟真实雅思口语考试</Text>

        {(['Part1', 'Part2', 'Part3'] as const).map(part => (
          <TouchableOpacity
            key={part}
            style={[s.partCard, selectedPart === part && s.partCardSelected]}
            onPress={() => setSelectedPart(part)}
          >
            <Text style={[s.partTitle, selectedPart === part && s.partTitleSelected]}>{PART_LABELS[part]}</Text>
            <Text style={s.partDesc}>
              {part === 'Part1' ? '3-4 个个人话题问答，每题15-40秒' :
               part === 'Part2' ? '1分钟准备 + 1-2分钟独白描述' :
               '3-5 个抽象话题讨论，AI 动态追问'}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={s.tipsBox}>
          <Text style={s.tipsTitle}>💡 考前提示</Text>
          <Text style={s.tip}>• 录音时不会有任何实时纠错（防止打断流畅性）</Text>
          <Text style={s.tip}>• 全部结束后 AI 会给出完整评分报告</Text>
          <Text style={s.tip}>• 填充词（um/uh/like）会被检测统计</Text>
        </View>

        <TouchableOpacity
          style={s.startBtn}
          onPress={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.startBtnText}>开始 {PART_LABELS[selectedPart]}</Text>
          }
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  if (sessionState === 'processing') {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={s.processingTitle}>AI 考官正在评分...</Text>
        <Text style={s.processingSubtext}>分析流利度 · 词汇 · 语法 · 发音</Text>
        <Text style={s.processingSubtext}>通常需要 20-30 秒</Text>
      </View>
    );
  }

  if (sessionState === 'feedback' && report) {
    return <FeedbackScreen report={report} onBack={() => router.back()} />;
  }

  // ── 会话中界面 ──
  return (
    <View style={s.sessionContainer}>
      {/* 对话记录 */}
      <ScrollView style={s.transcriptArea} showsVerticalScrollIndicator={false}>
        {transcript.map((line, i) => (
          <View key={i} style={[s.bubble, line.speaker === 'examiner' ? s.examinerBubble : s.candidateBubble]}>
            <Text style={s.bubbleLabel}>{line.speaker === 'examiner' ? '🎓 考官' : '🙋 你'}</Text>
            <Text style={[s.bubbleText, line.speaker === 'candidate' && s.candidateText]}>{line.text}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 当前状态区 */}
      <View style={s.controlArea}>
        {sessionState === 'examiner_speaking' && (
          <View style={s.waitingRow}>
            <ActivityIndicator size="small" color="#6366F1" />
            <Text style={s.waitingText}>考官提问中...</Text>
          </View>
        )}

        {sessionState === 'candidate_recording' && (
          <View style={s.recordingArea}>
            <Text style={s.questionPreview} numberOfLines={3}>{currentQuestion}</Text>
            <Animated.View style={[s.micBtn, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={s.micIcon}>🎙️</Text>
            </Animated.View>
            <Text style={s.recordingTime}>{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</Text>
            <Text style={s.recordingHint}>正在录音，说完后点击"完成"</Text>
            <TouchableOpacity style={s.doneBtn} onPress={handleStartRecording}>
              <Text style={s.doneBtnText}>完成回答</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function FeedbackScreen({ report, onBack }: { report: SpeakingFeedbackReport; onBack: () => void }) {
  const bandColor = report.overallBand >= 7 ? '#10B981' : report.overallBand >= 6 ? '#F59E0B' : '#EF4444';
  return (
    <ScrollView style={s.container}>
      <View style={s.scoreHeader}>
        <Text style={s.scoreLabel}>综合 Band Score</Text>
        <Text style={[s.scoreBig, { color: bandColor }]}>{report.overallBand.toFixed(1)}</Text>
      </View>

      <View style={s.dimGrid}>
        {(['FC', 'LR', 'GRA', 'PR'] as const).map(dim => (
          <View key={dim} style={s.dimCard}>
            <Text style={s.dimLabel}>{DIM_LABELS[dim]}</Text>
            <Text style={s.dimScore}>{(report.dimensionScores as any)[dim]?.toFixed(1) ?? '-'}</Text>
          </View>
        ))}
      </View>

      {report.highlights?.length > 0 && (
        <View style={s.highlightsCard}>
          <Text style={s.highlightsTitle}>🟢 你说得好的地方</Text>
          {report.highlights.map((h, i) => (
            <Text key={i} style={s.highlightText}>"{h.text}" — {h.reason}</Text>
          ))}
        </View>
      )}

      <Text style={s.sectionTitle}>改进建议</Text>
      {report.topImprovements?.slice(0, 3).map((imp, i) => (
        <View key={i} style={s.improvementCard}>
          <Text style={s.impPriority}>#{imp.priority} {DIM_LABELS[imp.dimension] ?? imp.dimension}</Text>
          <Text style={s.impIssue}>{imp.issue}</Text>
          <View style={s.beforeAfterRow}>
            <Text style={s.impWrong}>❌ "{imp.exampleWrong}"</Text>
            <Text style={s.impCorrect}>✅ "{imp.exampleCorrected}"</Text>
          </View>
          <Text style={s.impExplanation}>{imp.explanation}</Text>
        </View>
      ))}

      {report.modelResponseExample && (
        <View style={s.modelCard}>
          <Text style={s.modelTitle}>Band 7.5 示范回答</Text>
          <Text style={s.modelQ}>{report.modelResponseExample.question}</Text>
          <Text style={s.modelYou}>你的回答：{report.modelResponseExample.candidateAnswer}</Text>
          <Text style={s.modelBand75}>{report.modelResponseExample.modelAnswerBand75}</Text>
        </View>
      )}

      <TouchableOpacity style={s.startBtn} onPress={onBack}>
        <Text style={s.startBtnText}>完成，返回任务列表</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#1F2937', marginTop: 20, marginBottom: 6 },
  pageSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20, lineHeight: 20 },

  partCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: '#E5E7EB' },
  partCardSelected: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  partTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 4 },
  partTitleSelected: { color: '#6366F1' },
  partDesc: { fontSize: 13, color: '#9CA3AF', lineHeight: 20 },

  tipsBox: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#A7F3D0' },
  tipsTitle: { fontSize: 13, fontWeight: '700', color: '#065F46', marginBottom: 8 },
  tip: { fontSize: 13, color: '#047857', lineHeight: 22 },

  startBtn: { backgroundColor: '#6366F1', padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  processingTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  processingSubtext: { fontSize: 14, color: '#6B7280' },

  sessionContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  transcriptArea: { flex: 1, padding: 16 },
  bubble: { marginBottom: 12, maxWidth: '85%' },
  examinerBubble: { alignSelf: 'flex-start' },
  candidateBubble: { alignSelf: 'flex-end' },
  bubbleLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 3 },
  bubbleText: { backgroundColor: '#fff', borderRadius: 14, padding: 12, fontSize: 15, color: '#1F2937', lineHeight: 22, borderWidth: 1, borderColor: '#E5E7EB' },
  candidateText: { backgroundColor: '#6366F1', color: '#fff', borderColor: '#6366F1' },

  controlArea: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', padding: 16, minHeight: 150 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  waitingText: { fontSize: 15, color: '#6B7280' },
  recordingArea: { alignItems: 'center', gap: 10 },
  questionPreview: { fontSize: 14, color: '#1F2937', textAlign: 'center', lineHeight: 20 },
  micBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#6366F1' },
  micIcon: { fontSize: 32 },
  recordingTime: { fontSize: 20, fontWeight: '700', color: '#EF4444' },
  recordingHint: { fontSize: 13, color: '#9CA3AF' },
  doneBtn: { backgroundColor: '#6366F1', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24 },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  scoreHeader: { alignItems: 'center', paddingTop: 24, paddingBottom: 16 },
  scoreLabel: { fontSize: 14, color: '#9CA3AF', marginBottom: 4 },
  scoreBig: { fontSize: 56, fontWeight: '800' },
  dimGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  dimCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  dimLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  dimScore: { fontSize: 22, fontWeight: '700', color: '#6366F1' },

  highlightsCard: { backgroundColor: '#ECFDF5', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#A7F3D0' },
  highlightsTitle: { fontSize: 14, fontWeight: '700', color: '#065F46', marginBottom: 8 },
  highlightText: { fontSize: 13, color: '#047857', lineHeight: 20, marginBottom: 6 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  improvementCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  impPriority: { fontSize: 12, color: '#6366F1', fontWeight: '700', marginBottom: 4 },
  impIssue: { fontSize: 14, color: '#1F2937', fontWeight: '600', marginBottom: 8 },
  beforeAfterRow: { gap: 6, marginBottom: 8 },
  impWrong: { fontSize: 13, color: '#EF4444' },
  impCorrect: { fontSize: 13, color: '#10B981' },
  impExplanation: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  modelCard: { backgroundColor: '#EEF2FF', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#C7D2FE' },
  modelTitle: { fontSize: 14, fontWeight: '700', color: '#6366F1', marginBottom: 8 },
  modelQ: { fontSize: 13, color: '#1F2937', fontWeight: '600', marginBottom: 6 },
  modelYou: { fontSize: 12, color: '#9CA3AF', marginBottom: 8, fontStyle: 'italic' },
  modelBand75: { fontSize: 14, color: '#1F2937', lineHeight: 22 },
});

