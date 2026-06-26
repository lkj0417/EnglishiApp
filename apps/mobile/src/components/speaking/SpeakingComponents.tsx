import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';

interface RecordButtonProps {
  isRecording: boolean;
  durationSec: number;
  onStop: () => void;
  disabled?: boolean;
}

/**
 * RecordButton — 录音按钮，带脉冲动画和计时器
 */
export function RecordButton({ isRecording, durationSec, onStop, disabled }: RecordButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.outerRing, isRecording && styles.outerRingActive, { transform: [{ scale: pulseAnim }] }]}>
        <View style={[styles.micBtn, isRecording && styles.micBtnActive]}>
          <Text style={styles.micIcon}>🎙️</Text>
        </View>
      </Animated.View>

      {isRecording && (
        <View style={styles.timerRow}>
          <View style={styles.recordingDot} />
          <Text style={styles.timerText}>{timeStr}</Text>
        </View>
      )}

      {isRecording && (
        <TouchableOpacity
          style={[styles.stopBtn, disabled && styles.stopBtnDisabled]}
          onPress={onStop}
          disabled={disabled}
        >
          <Text style={styles.stopBtnText}>完成回答</Text>
        </TouchableOpacity>
      )}

      {!isRecording && (
        <Text style={styles.hint}>等待考官问题...</Text>
      )}
    </View>
  );
}

/**
 * TranscriptBubble — 对话气泡（考官/考生）
 */
export function TranscriptBubble({
  speaker,
  text,
}: {
  speaker: 'examiner' | 'candidate';
  text: string;
}) {
  const isExaminer = speaker === 'examiner';
  return (
    <View style={[styles.bubble, isExaminer ? styles.examinerBubble : styles.candidateBubble]}>
      <Text style={styles.bubbleLabel}>{isExaminer ? '🎓 考官' : '🙋 你'}</Text>
      <Text style={[styles.bubbleText, !isExaminer && styles.candidateText]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12, paddingVertical: 16 },

  outerRing: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#C7D2FE',
  },
  outerRingActive: { borderColor: '#6366F1', backgroundColor: '#E0E7FF' },

  micBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6366F1', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  micBtnActive: { backgroundColor: '#6366F1' },
  micIcon: { fontSize: 32 },

  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  timerText: { fontSize: 20, fontWeight: '700', color: '#EF4444', fontVariant: ['tabular-nums'] },

  stopBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 32, paddingVertical: 12,
    borderRadius: 24,
  },
  stopBtnDisabled: { backgroundColor: '#C7D2FE' },
  stopBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  hint: { fontSize: 13, color: '#9CA3AF' },

  bubble: { marginBottom: 12, maxWidth: '85%' },
  examinerBubble: { alignSelf: 'flex-start' },
  candidateBubble: { alignSelf: 'flex-end' },
  bubbleLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 3 },
  bubbleText: {
    backgroundColor: '#fff', borderRadius: 14, padding: 12,
    fontSize: 15, color: '#1F2937', lineHeight: 22,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  candidateText: { backgroundColor: '#6366F1', color: '#fff', borderColor: '#6366F1' },
});

