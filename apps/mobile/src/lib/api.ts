import axios from 'axios';
import { useAuthStore } from '../stores/index.js';

const API_BASE = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器：自动注入 JWT
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一错误处理
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  },
);

// ─────────────────────────────────────────────
// API 方法封装
// ─────────────────────────────────────────────

export const authAPI = {
  register: (data: { email: string; password: string; displayName: string }) =>
    apiClient.post('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    apiClient.post('/auth/login', data),
};

export const userAPI = {
  getMe: () => apiClient.get('/users/me'),
  updateMe: (data: Partial<{
    displayName: string;
    interestTags: string[];
    primaryInterest: string;
    iletsTargetBand: number;
    dailyMinutesGoal: number;
  }>) => apiClient.patch('/users/me', data),
  getAbility: () => apiClient.get('/users/me/ability'),
  getAbilityHistory: () => apiClient.get('/users/me/ability/history'),
};

export const assessmentAPI = {
  start: () => apiClient.post('/assessment/start'),
  answer: (data: { sessionId: string; questionId: string; answer: string; responseTimeSec: number }) =>
    apiClient.post('/assessment/answer', data),
  complete: (sessionId: string) => apiClient.post('/assessment/complete', { sessionId }),
};

export const dailyPackAPI = {
  getToday: () => apiClient.get('/daily-pack/today'),
  completeTask: (taskId: string, data?: { timeSpentSec: number }) =>
    apiClient.post(`/daily-pack/tasks/${taskId}/complete`, data),
  getGateReview: () => apiClient.get('/daily-pack/gate-review'),
  submitGateReview: (answers: Record<string, string>) =>
    apiClient.post('/daily-pack/gate-review/submit', { answers }),
};

export const vocabularyAPI = {
  getDue: () => apiClient.get('/vocabulary/due'),
  review: (data: { wordId: string; quality: number }) =>
    apiClient.post('/vocabulary/review', data),
  addWord: (data: { word: string; wordCefr: number; domain?: string }) =>
    apiClient.post('/vocabulary/items', data),
  getItems: (params?: { status?: string; limit?: number; offset?: number }) =>
    apiClient.get('/vocabulary/items', { params }),
};

export const readingAPI = {
  generate: (params?: { topic?: string }) =>
    apiClient.post('/reading/generate', params),
  getContent: (jobId: string) => apiClient.get(`/reading/content/${jobId}`),
  submitAnswers: (articleId: string, answers: Record<string, string>) =>
    apiClient.post(`/reading/sessions/${articleId}/answers`, { answers }),
};

export const speakingAPI = {
  createSession: (sessionType: 'Part1' | 'Part2' | 'Part3') =>
    apiClient.post('/speaking/sessions', { sessionType }),
  getReport: (sessionId: string) => apiClient.get(`/speaking/sessions/${sessionId}/report`),
};

export const writingAPI = {
  getTask: () => apiClient.get('/writing/task'),
  submitEssay: (data: { taskType: string; taskPrompt: string; submissionText: string }) =>
    apiClient.post('/writing/submissions', data),
  getCritique: (submissionId: string) =>
    apiClient.get(`/writing/submissions/${submissionId}/critique`),
};

export const progressAPI = {
  getOverview: () => apiClient.get('/progress/overview'),
  getWeeklyReport: () => apiClient.get('/progress/weekly-report'),
  getIeltsTimeline: () => apiClient.get('/progress/ielts-timeline'),
};

