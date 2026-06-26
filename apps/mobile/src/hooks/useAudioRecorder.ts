import { useState, useRef, useCallback } from 'react';

type RecordingState = 'idle' | 'recording' | 'stopped';

interface UseAudioRecorderResult {
  recordingState: RecordingState;
  recordingDurationSec: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  resetRecording: () => void;
  error: string | null;
}

/**
 * useAudioRecorder — 浏览器/React Native Web 音频录制钩子
 * 生产版本应使用 expo-av (React Native) 或 MediaRecorder API (Web)
 *
 * 此版本使用 MediaRecorder API，在 Web/Expo Web 环境下可用。
 * 对于原生 iOS/Android，请替换为 expo-av 的 Audio.Recording。
 */
export function useAudioRecorder(): UseAudioRecorderResult {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingDurationSec, setRecordingDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];
    setRecordingDurationSec(0);

    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(200); // 每 200ms 收集一个 chunk
      setRecordingState('recording');

      // 计时器
      timerRef.current = setInterval(() => {
        setRecordingDurationSec(s => s + 1);
      }, 1000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Microphone access denied';
      setError(message);
      setRecordingState('idle');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setRecordingState('stopped');
        // 停止所有 track
        recorder.stream?.getTracks().forEach(t => t.stop());
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  const resetRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setRecordingState('idle');
    setRecordingDurationSec(0);
    setError(null);
  }, []);

  return {
    recordingState,
    recordingDurationSec,
    startRecording,
    stopRecording,
    resetRecording,
    error,
  };
}

