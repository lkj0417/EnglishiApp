import { create } from 'zustand';
import type { UserCapabilityLevel, DailyPack } from '@englishi/shared-types';

// ─────────────────────────────────────────────
// Auth Store
// ─────────────────────────────────────────────
interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, userId: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  isAuthenticated: false,
  setAuth: (token, userId) => set({ token, userId, isAuthenticated: true }),
  clearAuth: () => set({ token: null, userId: null, isAuthenticated: false }),
}));

// ─────────────────────────────────────────────
// User Ability Store (UCL 本地镜像)
// ─────────────────────────────────────────────
interface UserAbilityState {
  ucl: UserCapabilityLevel | null;
  lastSyncedAt: Date | null;
  setUCL: (ucl: UserCapabilityLevel) => void;
  clearUCL: () => void;
  isStale: () => boolean;
}

export const useUserAbilityStore = create<UserAbilityState>((set, get) => ({
  ucl: null,
  lastSyncedAt: null,
  setUCL: (ucl) => set({ ucl, lastSyncedAt: new Date() }),
  clearUCL: () => set({ ucl: null, lastSyncedAt: null }),
  isStale: () => {
    const { lastSyncedAt } = get();
    if (!lastSyncedAt) return true;
    return (Date.now() - lastSyncedAt.getTime()) > 3600 * 1000; // 1 小时过期
  },
}));

// ─────────────────────────────────────────────
// Daily Pack Store
// ─────────────────────────────────────────────
interface DailyPackState {
  pack: DailyPack | null;
  packDate: string | null;
  setPack: (pack: DailyPack) => void;
  markTaskComplete: (taskId: string) => void;
  clearPack: () => void;
}

export const useDailyPackStore = create<DailyPackState>((set) => ({
  pack: null,
  packDate: null,
  setPack: (pack) => set({ pack, packDate: pack.date }),
  markTaskComplete: (taskId) => set((state) => {
    if (!state.pack) return state;
    return {
      pack: {
        ...state.pack,
        tasks: state.pack.tasks.map(t =>
          t.id === taskId ? { ...t, status: 'completed' as const } : t,
        ),
        completedTasks: state.pack.completedTasks + 1,
      },
    };
  }),
  clearPack: () => set({ pack: null, packDate: null }),
}));

// ─────────────────────────────────────────────
// Speaking Session Store (口语会话临时状态)
// ─────────────────────────────────────────────
type SpeakingSessionState =
  | 'idle'
  | 'examiner_speaking'
  | 'candidate_prep'
  | 'candidate_recording'
  | 'processing'
  | 'showing_feedback'
  | 'session_complete';

interface SpeakingState {
  sessionId: string | null;
  state: SpeakingSessionState;
  currentQuestion: string | null;
  transcript: Array<{ speaker: 'examiner' | 'candidate'; text: string }>;
  feedbackReport: any | null;
  prepTimeRemaining: number; // Part 2 准备时间倒计时
  setState: (s: SpeakingSessionState) => void;
  setSessionId: (id: string) => void;
  setCurrentQuestion: (q: string) => void;
  addTranscriptLine: (speaker: 'examiner' | 'candidate', text: string) => void;
  setFeedbackReport: (report: any) => void;
  setPrepTime: (t: number) => void;
  reset: () => void;
}

export const useSpeakingStore = create<SpeakingState>((set) => ({
  sessionId: null,
  state: 'idle',
  currentQuestion: null,
  transcript: [],
  feedbackReport: null,
  prepTimeRemaining: 60,
  setState: (state) => set({ state }),
  setSessionId: (sessionId) => set({ sessionId }),
  setCurrentQuestion: (q) => set({ currentQuestion: q }),
  addTranscriptLine: (speaker, text) =>
    set((s) => ({ transcript: [...s.transcript, { speaker, text }] })),
  setFeedbackReport: (feedbackReport) => set({ feedbackReport }),
  setPrepTime: (t) => set({ prepTimeRemaining: t }),
  reset: () => set({ sessionId: null, state: 'idle', currentQuestion: null, transcript: [], feedbackReport: null }),
}));

