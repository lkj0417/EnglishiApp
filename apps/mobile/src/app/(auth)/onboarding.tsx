import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { userAPI, assessmentAPI } from '../../lib/api';
import { useUserAbilityStore, useAuthStore } from '../../stores';

const INTERESTS = [
  { id: 'technology', label: '科技', emoji: '💻' },
  { id: 'travel', label: '旅行', emoji: '✈️' },
  { id: 'sports', label: '体育', emoji: '⚽' },
  { id: 'food', label: '美食', emoji: '🍜' },
  { id: 'music', label: '音乐', emoji: '🎵' },
  { id: 'movies', label: '影视', emoji: '🎬' },
  { id: 'business', label: '商业', emoji: '📊' },
  { id: 'science', label: '自然科学', emoji: '🔬' },
  { id: 'arts', label: '艺术', emoji: '🎨' },
  { id: 'health', label: '健康', emoji: '🏃' },
];

const IELTS_TARGETS = [
  { band: 5.5, label: '雅思 5.5 分', desc: '基础出行、工作需求' },
  { band: 6.0, label: '雅思 6.0 分', desc: '大多数海外本科申请' },
  { band: 6.5, label: '雅思 6.5 分', desc: '研究生申请基本要求' },
  { band: 7.0, label: '雅思 7.0 分', desc: 'Top 院校研究生申请' },
  { band: 7.5, label: '雅思 7.5 分', desc: '顶尖院校/专业职位' },
  { band: 8.0, label: '雅思 8.0 分', desc: '极高要求 / 学术路径' },
];

const DAILY_MINUTES = [15, 30, 45, 60, 90];

type Step = 'interests' | 'target' | 'daily_time' | 'ready';

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>('interests');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<number>(7.0);
  const [dailyMinutes, setDailyMinutes] = useState<number>(30);
  const setUCL = useUserAbilityStore(s => s.setUCL);

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => userAPI.updateMe(data),
  });

  const handleFinish = async () => {
    await updateProfileMutation.mutateAsync({
      interestTags: selectedInterests,
      primaryInterest: selectedInterests[0],
      iletsTargetBand: selectedTarget,
      dailyMinutesGoal: dailyMinutes,
    });
    // 导航到测评
    router.replace('/(auth)/assessment');
  };

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 5 ? [...prev, id] : prev,
    );
  };

  const steps = { interests: 1, target: 2, daily_time: 3, ready: 4 };
  const currentStepNum = steps[step];

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      {/* 进度条 */}
      <View style={s.progressRow}>
        {[1, 2, 3, 4].map(n => (
          <View key={n} style={[s.progressDot, n <= currentStepNum && s.progressDotActive]} />
        ))}
      </View>

      {step === 'interests' && (
        <View>
          <Text style={s.stepTitle}>选择你的兴趣领域</Text>
          <Text style={s.stepSubtitle}>AI 会用你感兴趣的话题生成学习内容（最多选 5 个）</Text>
          <View style={s.interestsGrid}>
            {INTERESTS.map(i => (
              <TouchableOpacity
                key={i.id}
                style={[s.interestChip, selectedInterests.includes(i.id) && s.interestChipSelected]}
                onPress={() => toggleInterest(i.id)}
              >
                <Text style={s.interestEmoji}>{i.emoji}</Text>
                <Text style={[s.interestLabel, selectedInterests.includes(i.id) && s.interestLabelSelected]}>
                  {i.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[s.nextBtn, selectedInterests.length === 0 && s.nextBtnDisabled]}
            disabled={selectedInterests.length === 0}
            onPress={() => setStep('target')}
          >
            <Text style={s.nextBtnText}>下一步</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'target' && (
        <View>
          <Text style={s.stepTitle}>设置你的目标</Text>
          <Text style={s.stepSubtitle}>系统会根据目标分数规划你的学习路径</Text>
          {IELTS_TARGETS.map(t => (
            <TouchableOpacity
              key={t.band}
              style={[s.targetCard, selectedTarget === t.band && s.targetCardSelected]}
              onPress={() => setSelectedTarget(t.band)}
            >
              <Text style={[s.targetBand, selectedTarget === t.band && s.targetBandSelected]}>{t.label}</Text>
              <Text style={s.targetDesc}>{t.desc}</Text>
            </TouchableOpacity>
          ))}
          <View style={s.btnRow}>
            <TouchableOpacity style={s.backBtn} onPress={() => setStep('interests')}>
              <Text style={s.backBtnText}>上一步</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.nextBtn} onPress={() => setStep('daily_time')}>
              <Text style={s.nextBtnText}>下一步</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'daily_time' && (
        <View>
          <Text style={s.stepTitle}>每天能学多久？</Text>
          <Text style={s.stepSubtitle}>系统每天任务量将按此时间生成，不会超量</Text>
          <View style={s.timeGrid}>
            {DAILY_MINUTES.map(m => (
              <TouchableOpacity
                key={m}
                style={[s.timeChip, dailyMinutes === m && s.timeChipSelected]}
                onPress={() => setDailyMinutes(m)}
              >
                <Text style={[s.timeLabel, dailyMinutes === m && s.timeLabelSelected]}>
                  {m} 分钟
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.btnRow}>
            <TouchableOpacity style={s.backBtn} onPress={() => setStep('target')}>
              <Text style={s.backBtnText}>上一步</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.nextBtn} onPress={() => setStep('ready')}>
              <Text style={s.nextBtnText}>下一步</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'ready' && (
        <View style={s.readyArea}>
          <Text style={s.readyEmoji}>🎯</Text>
          <Text style={s.readyTitle}>准备好了！</Text>
          <Text style={s.readySub}>接下来进行一次 8 分钟的入门测评</Text>
          <Text style={s.readySub}>AI 会精确定位你的英语水平，生成专属学习路径</Text>

          <View style={s.summaryCard}>
            <Text style={s.summaryRow}>🎨 兴趣：{selectedInterests.map(id => INTERESTS.find(i => i.id === id)?.label).join('、')}</Text>
            <Text style={s.summaryRow}>🎯 目标：雅思 {selectedTarget} 分</Text>
            <Text style={s.summaryRow}>⏱️ 每日：{dailyMinutes} 分钟</Text>
          </View>

          {updateProfileMutation.isPending
            ? <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 24 }} />
            : (
              <TouchableOpacity style={[s.nextBtn, { marginTop: 24 }]} onPress={handleFinish}>
                <Text style={s.nextBtnText}>开始入门测评 →</Text>
              </TouchableOpacity>
            )
          }
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 24, paddingTop: 32 },
  progressRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 32 },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E7EB' },
  progressDotActive: { backgroundColor: '#6366F1', width: 24 },

  stepTitle: { fontSize: 24, fontWeight: '800', color: '#1F2937', marginBottom: 8 },
  stepSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24, lineHeight: 22 },

  interestsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  interestChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  interestChipSelected: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  interestEmoji: { fontSize: 18 },
  interestLabel: { fontSize: 14, color: '#374151', fontWeight: '600' },
  interestLabelSelected: { color: '#6366F1' },

  targetCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: '#E5E7EB' },
  targetCardSelected: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  targetBand: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 4 },
  targetBandSelected: { color: '#6366F1' },
  targetDesc: { fontSize: 13, color: '#9CA3AF' },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  timeChip: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  timeChipSelected: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  timeLabel: { fontSize: 15, fontWeight: '700', color: '#374151' },
  timeLabelSelected: { color: '#6366F1' },

  nextBtn: { flex: 1, backgroundColor: '#6366F1', padding: 16, borderRadius: 14, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: '#C7D2FE' },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  backBtn: { flex: 1, backgroundColor: '#F3F4F6', padding: 16, borderRadius: 14, alignItems: 'center', marginRight: 10 },
  backBtnText: { color: '#6B7280', fontWeight: '700', fontSize: 16 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },

  readyArea: { alignItems: 'center', paddingTop: 20 },
  readyEmoji: { fontSize: 64, marginBottom: 16 },
  readyTitle: { fontSize: 28, fontWeight: '800', color: '#1F2937', marginBottom: 10 },
  readySub: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 4 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginTop: 24, width: '100%', gap: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  summaryRow: { fontSize: 15, color: '#374151', lineHeight: 24 },
});

