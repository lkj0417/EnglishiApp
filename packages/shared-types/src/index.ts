// ─────────────────────────────────────────────
// CEFR 能力级别类型
// A1=1.0, A2=2.0, B1=3.0, B2=4.0, C1=5.0, C2=6.0
// 精度到 0.1 级
// ─────────────────────────────────────────────
export type CefrNumeric = number; // 1.0 - 6.0

export type Skill = 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'speaking' | 'writing';

export type TaskType =
  | 'vocab_review'
  | 'vocab_new'
  | 'grammar_lesson'
  | 'grammar_exercise'
  | 'reading_article'
  | 'listening_audio'
  | 'speaking_session'
  | 'writing_task'
  | 'gate_review';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

export type VocabStatus = 'learning' | 'reviewing' | 'mastered' | 'passive_maintenance';

export type GrammarStatus = 'not_started' | 'introduced' | 'practicing' | 'mastered';

// ─────────────────────────────────────────────
// 用户能力模型（UCL）
// ─────────────────────────────────────────────
export interface DimensionScores {
  vocabulary: CefrNumeric;
  grammar: CefrNumeric;
  reading: CefrNumeric;
  listening: CefrNumeric;
  speaking: CefrNumeric;
  writing: CefrNumeric;
}

export interface WeakAreas {
  grammar: string[];
  listening: string[];
  writing: string[];
  speaking: string[];
  vocabulary: string[];
}

export interface ErrorPattern {
  type: string;           // e.g. "independent_clause_because"
  frequency: number;
  lastSeen: string;       // ISO date string
}

export interface UserCapabilityLevel {
  userId: string;
  overallCefr: CefrNumeric;
  dimensions: DimensionScores;
  estimatedVocabSize: number;
  ieltsPrediction: number;
  masteredGrammar: string[];
  notYetGrammar: string[];
  weakAreas: WeakAreas;
  errorPatterns: ErrorPattern[];
  confidenceInterval: number;
  updatedAt: string;
}

// ─────────────────────────────────────────────
// 内容难度参数
// ─────────────────────────────────────────────
export interface DifficultyParams {
  vocabCeiling: CefrNumeric;          // 词汇最高允许难度
  grammarAllowed: string[];           // 允许的语法结构列表
  grammarForbidden: string[];         // 禁用的语法结构列表
  targetNewWordRate: number;          // 目标生词率 (0.04-0.08)
  articleWordCount: number;           // 文章词数
  speechRateWpm?: number;             // 语速 (听力)
}

// ─────────────────────────────────────────────
// 每日学习包
// ─────────────────────────────────────────────
export interface DailyTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  estimatedMinutes: number;
  contentId?: string;         // 指向生成的具体内容
  jobId?: string;             // AI 生成任务 ID（异步）
  metadata?: Record<string, unknown>;
}

export interface DailyPack {
  id: string;
  userId: string;
  date: string;               // YYYY-MM-DD
  tasks: DailyTask[];
  totalEstimatedMinutes: number;
  completedTasks: number;
  totalTasks: number;
  difficultyParams: DifficultyParams;
  gateReviewDue: boolean;
  gateReviewPassed?: boolean;
}

// ─────────────────────────────────────────────
// SM-2 词汇条目
// ─────────────────────────────────────────────
export interface VocabularyItem {
  id: string;
  userId: string;
  word: string;
  wordCefr: CefrNumeric;
  domain?: string;
  // SM-2 核心字段
  easeFactor: number;         // 默认 2.5
  intervalDays: number;       // 复习间隔天数
  repetitions: number;        // 成功复习次数
  dueDate: string;            // 下次复习日期 YYYY-MM-DD
  status: VocabStatus;
  // 掌握条件追踪
  choiceCorrectStreak: number;    // 需达 3
  contextCorrectStreak: number;   // 需达 2
  productionVerified: boolean;    // 在输出中使用过
}

// ─────────────────────────────────────────────
// 学习事件（流水）
// ─────────────────────────────────────────────
export interface LearningEvent {
  id: string;
  userId: string;
  sessionId: string;
  skill: Skill;
  taskType: TaskType;
  taskId?: string;
  contentCefr?: CefrNumeric;
  performanceScore: number;   // 0-1
  correctCount?: number;
  totalCount?: number;
  timeSpentSec: number;
  hintUsedCount: number;
  skipped: boolean;
  // AI 评分（口语/写作）
  aiBandScore?: number;
  aiDimensionScores?: IeltsDimensionScores;
  errorsMade: ErrorRecord[];
  // 能力变化
  uclBefore?: CefrNumeric;
  uclAfter?: CefrNumeric;
  createdAt: string;
}

export interface ErrorRecord {
  type: string;
  content: string;
}

// ─────────────────────────────────────────────
// 雅思评分维度
// ─────────────────────────────────────────────
export interface IeltsWritingScores {
  overall: number;
  TR: number;   // Task Response
  CC: number;   // Coherence & Cohesion
  LR: number;   // Lexical Resource
  GRA: number;  // Grammatical Range & Accuracy
}

export interface IeltsSpeakingScores {
  overall: number;
  FC: number;   // Fluency & Coherence
  LR: number;   // Lexical Resource
  GRA: number;  // Grammatical Range & Accuracy
  PR: number;   // Pronunciation
}

export type IeltsDimensionScores = IeltsWritingScores | IeltsSpeakingScores;

// ─────────────────────────────────────────────
// AI 生成内容
// ─────────────────────────────────────────────
export interface ReadingArticle {
  id: string;
  title: string;
  body: string;
  wordCount: number;
  topic: string;
  genre: string;
  cefrLevel: CefrNumeric;
  targetVocabulary: VocabExplanation[];
  grammarStructuresUsed: string[];
  questions: ReadingQuestion[];
  embedding?: number[];
}

export interface VocabExplanation {
  word: string;
  phonetic: string;
  cefrLevel: CefrNumeric;
  partOfSpeech: string;
  definitionEn: string;
  definitionZh: string;
  exampleSentences: ExampleSentence[];
  wordFamily: WordFamily;
  commonCollocations: string[];
  commonErrors: { error: string; correction: string }[];
  memoryAid?: string;
}

export interface ExampleSentence {
  sentence: string;
  domain: string;
  targetWordPosition: number;
  contextClues: string;
}

export interface WordFamily {
  noun?: string;
  verb?: string;
  adjective?: string;
  adverb?: string;
}

export interface ReadingQuestion {
  id: number;
  type: 'detail' | 'inference' | 'vocabulary_in_context' | 'main_idea';
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  paragraphReference: number;
}

// ─────────────────────────────────────────────
// 口语会话
// ─────────────────────────────────────────────
export interface SpeakingQuestion {
  qId: string;
  question: string;
  expectedLengthSeconds: number;
}

export interface SpeakingFeedbackReport {
  overallBand: number;
  dimensionScores: IeltsSpeakingScores;
  highlights: { text: string; reason: string }[];
  topImprovements: SpeakingImprovement[];
  modelResponseExample: ModelResponseExample;
  acousticAnalysis: AcousticAnalysis;
}

export interface SpeakingImprovement {
  priority: number;
  dimension: 'FC' | 'LR' | 'GRA' | 'PR';
  issue: string;
  exampleWrong: string;
  exampleCorrected: string;
  explanation: string;
  linkedPracticeType: string;
}

export interface ModelResponseExample {
  question: string;
  candidateAnswer: string;
  modelAnswerBand75: string;
  changesExplained: string[];
}

export interface AcousticAnalysis {
  fillerWordCount: number;
  fillerWordsFound: string[];
  avgSpeechRateWpm: number;
  pauseFrequencyPerMinute: number;
  pronunciationErrorFlags: PronunciationError[];
}

export interface PronunciationError {
  word: string;
  errorType: string;
  timestamp: number;
}

// ─────────────────────────────────────────────
// 写作批改
// ─────────────────────────────────────────────
export interface WritingCritiqueReport {
  overall: IeltsWritingScores & { wordCount: number; wordCountNote?: string };
  paragraphAnalysis: ParagraphAnalysis[];
  sentenceAnnotations: SentenceAnnotation[];
  topPriorityImprovement: TopImprovement;
  persistentErrorsCheck: PersistentErrorCheck[];
  highlights: { originalText: string; reason: string }[];
  modelRewrite: ModelRewrite;
}

export interface ParagraphAnalysis {
  paragraphIndex: number;
  paragraphText: string;
  roleDetected: string;
  mainIdeaClear: boolean;
  paragraphLevelComment: string;
}

export interface SentenceAnnotation {
  sentenceIndex: number;
  originalSentence: string;
  annotations: Annotation[];
}

export interface Annotation {
  type: 'GRA_error' | 'LR_upgrade' | 'CC_issue' | 'TR_issue' | 'highlight';
  span: string;
  issue: string;
  correction: string;
  explanation: string;
  severity: 'critical' | 'moderate' | 'minor' | 'positive';
}

export interface TopImprovement {
  dimension: 'TR' | 'CC' | 'LR' | 'GRA';
  issueSummary: string;
  occurrenceCount: number;
  exampleOriginal: string;
  exampleFixed: string;
  fixExplanation: string;
  linkedGrammarPoint?: string;
  quickPracticeAvailable: boolean;
}

export interface PersistentErrorCheck {
  errorType: string;
  appearedInThisEssay: boolean;
  instances: string[];
  improvementNote?: string;
}

export interface ModelRewrite {
  scope: 'full_essay' | 'key_paragraph';
  targetBand: number;
  rewrittenText: string;
  changesMade: { original: string; rewritten: string; dimension: string; explanation: string }[];
}

// ─────────────────────────────────────────────
// Gate Review
// ─────────────────────────────────────────────
export interface GateReviewQuestion {
  id: string;
  type: 'vocabulary' | 'grammar' | 'reading_comprehension' | 'error_correction' | 'oral_rephrase';
  question: string;
  options?: string[];
  correctAnswer: string;
  skill: Skill;
  contentCefr: CefrNumeric;
}

export interface GateReviewResult {
  score: number;            // 0-1
  passed: boolean;          // >= 0.70 通过
  correctCount: number;
  totalCount: number;
  weakPointsIdentified: string[];
}

// ─────────────────────────────────────────────
// API 响应通用结构
// ─────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

// ─────────────────────────────────────────────
// 进度报告
// ─────────────────────────────────────────────
export interface WeeklyReport {
  summaryHeadline: string;
  stats: {
    totalStudyMinutes: number;
    daysStudied: number;
    longestStreak: number;
  };
  abilityChanges: AbilityChange[];
  biggestAchievement: Achievement;
  focusNextWeek: NextWeekFocus;
  ieltsProgress: IeltsProgress;
}

export interface AbilityChange {
  skill: Skill;
  cefrStart: CefrNumeric;
  cefrEnd: CefrNumeric;
  change: number;
  note: string;
}

export interface Achievement {
  skill: Skill;
  description: string;
  celebrationMessage: string;
}

export interface NextWeekFocus {
  skill: Skill;
  specificTarget: string;
  recommendedDailyTask: string;
}

export interface IeltsProgress {
  currentPredictedBand: number;
  targetBand: number;
  gap: number;
  estimatedWeeksRemaining: number;
  onTrack: boolean;
  paceNote: string;
}

