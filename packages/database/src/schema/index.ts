import {
  pgTable, uuid, varchar, text, boolean, smallint, integer,
  decimal, date, timestamp, jsonb, uniqueIndex, index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─────────────────────────────────────────────
// ai_providers AI 提供商配置表（管理员管理）
// ─────────────────────────────────────────────
export const aiProviders = pgTable('ai_providers', {
  id:             uuid('id').primaryKey().defaultRandom(),
  name:           varchar('name', { length: 100 }).notNull(),       // 显示名称，如 "DeepSeek Chat"
  provider:       varchar('provider', { length: 50 }).notNull(),    // openai|deepseek|gemini|anthropic|newapi|ollama|custom
  baseUrl:        text('base_url'),                                  // API 基础 URL（空=使用默认）
  apiKey:         text('api_key').notNull(),                         // 加密存储的 API Key
  apiKeyHint:     varchar('api_key_hint', { length: 20 }),          // Key 末4位，用于展示
  modelId:        varchar('model_id', { length: 100 }).notNull(),   // 实际模型 ID
  tier:           varchar('tier', { length: 10 }).notNull(),        // high|fast（决定哪类任务使用）
  isActive:       boolean('is_active').default(true),
  isDefault:      boolean('is_default').default(false),             // 该 tier 的默认提供商
  priority:       smallint('priority').default(1),                  // 优先级（多个同 tier 时的顺序）
  maxTokens:      integer('max_tokens'),
  temperature:    decimal('temperature', { precision: 3, scale: 2 }),
  requestsPerMin: integer('requests_per_min'),                       // 速率限制
  totalRequests:  integer('total_requests').default(0),             // 累计请求数
  totalTokensIn:  integer('total_tokens_in').default(0),
  totalTokensOut: integer('total_tokens_out').default(0),
  lastUsedAt:     timestamp('last_used_at', { withTimezone: true }),
  notes:          text('notes'),                                     // 管理员备注
  createdAt:      timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  tierActiveIdx: index('idx_providers_tier_active').on(t.tier, t.isActive),
}));

// ─────────────────────────────────────────────
// app_settings 全局应用配置表
// ─────────────────────────────────────────────
export const appSettings = pgTable('app_settings', {
  id:         uuid('id').primaryKey().defaultRandom(),
  category:   varchar('category', { length: 50 }).notNull(),   // ai|learning|assessment|content|system
  key:        varchar('key', { length: 100 }).notNull(),
  value:      text('value').notNull(),
  valueType:  varchar('value_type', { length: 20 }).default('string'), // string|number|boolean|json
  label:      varchar('label', { length: 200 }),               // 界面显示标签
  description:text('description'),                              // 参数说明
  isSecret:   boolean('is_secret').default(false),             // 是否为敏感配置（不回显原值）
  updatedBy:  uuid('updated_by'),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  categoryKeyIdx: index('idx_settings_category_key').on(t.category, t.key),
  uniqueCatKey:   uniqueIndex('uq_settings_cat_key').on(t.category, t.key),
}));

// ─────────────────────────────────────────────
// api_usage_logs API 调用日志
// ─────────────────────────────────────────────
export const apiUsageLogs = pgTable('api_usage_logs', {
  id:           uuid('id').primaryKey().defaultRandom(),
  providerId:   uuid('provider_id').references(() => aiProviders.id),
  userId:       uuid('user_id'),
  taskType:     varchar('task_type', { length: 50 }),    // reading|writing|speaking|grammar|vocab
  modelId:      varchar('model_id', { length: 100 }),
  tokensIn:     integer('tokens_in').default(0),
  tokensOut:    integer('tokens_out').default(0),
  latencyMs:    integer('latency_ms'),
  success:      boolean('success').default(true),
  errorCode:    varchar('error_code', { length: 50 }),
  createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  providerDateIdx: index('idx_usage_provider_date').on(t.providerId, t.createdAt),
  userDateIdx:     index('idx_usage_user_date').on(t.userId, t.createdAt),
}));

// ─────────────────────────────────────────────
// prompt_templates Prompt 模板版本管理
// ─────────────────────────────────────────────
export const promptTemplates = pgTable('prompt_templates', {
  id:          uuid('id').primaryKey().defaultRandom(),
  engineName:  varchar('engine_name', { length: 50 }).notNull(),  // ReadingEngine|WritingCritic|...
  version:     varchar('version', { length: 20 }).notNull(),      // v2.3
  tier:        varchar('tier', { length: 10 }).notNull(),         // high|fast
  systemPrompt:text('system_prompt').notNull(),
  userPromptTemplate: text('user_prompt_template').notNull(),
  isActive:    boolean('is_active').default(false),
  isCurrent:   boolean('is_current').default(false),              // 当前生产版本
  abTestGroup: varchar('ab_test_group', { length: 10 }),          // A|B|null
  abTestWeight:smallint('ab_test_weight').default(100),           // 流量权重 0-100
  cqvPassRate: decimal('cqv_pass_rate', { precision: 5, scale: 2 }), // 历史 CQV 通过率
  notes:       text('notes'),
  createdBy:   uuid('created_by'),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  engineCurrentIdx: index('idx_prompt_engine_current').on(t.engineName, t.isCurrent),
}));

// ─────────────────────────────────────────────
// users 用户基础表
// ─────────────────────────────────────────────
export const users = pgTable('users', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  email:                varchar('email', { length: 255 }).unique().notNull(),
  passwordHash:         varchar('password_hash', { length: 255 }).notNull(),
  displayName:          varchar('display_name', { length: 100 }).notNull(),
  role:                 varchar('role', { length: 20 }).default('student'), // student|admin|super_admin

  // 目标设定
  iletsTargetBand:      decimal('ilets_target_band', { precision: 2, scale: 1 }),
  targetDeadline:       date('target_deadline'),
  dailyMinutesGoal:     smallint('daily_minutes_goal').default(30),

  // 兴趣标签
  interestTags:         text('interest_tags').array().default([]),
  primaryInterest:      varchar('primary_interest', { length: 50 }),

  // 账户状态
  onboardingCompleted:  boolean('onboarding_completed').default(false),
  timezone:             varchar('timezone', { length: 50 }).default('Asia/Shanghai'),

  createdAt:            timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastActiveAt:         timestamp('last_active_at', { withTimezone: true }),
}, (t) => ({
  emailIdx: uniqueIndex('idx_users_email').on(t.email),
  lastActiveIdx: index('idx_users_last_active').on(t.lastActiveAt),
}));

// ─────────────────────────────────────────────
// user_ability_models 用户能力模型（核心表）
// ─────────────────────────────────────────────
export const userAbilityModels = pgTable('user_ability_models', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  userId:               uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // CEFR 数值化 (A1=1.0 ... C2=6.0, 精度0.1)
  overallCefr:          decimal('overall_cefr', { precision: 3, scale: 1 }).notNull(),
  vocabularyCefr:       decimal('vocabulary_cefr', { precision: 3, scale: 1 }).notNull(),
  grammarCefr:          decimal('grammar_cefr', { precision: 3, scale: 1 }).notNull(),
  readingCefr:          decimal('reading_cefr', { precision: 3, scale: 1 }).notNull(),
  listeningCefr:        decimal('listening_cefr', { precision: 3, scale: 1 }).notNull(),
  speakingCefr:         decimal('speaking_cefr', { precision: 3, scale: 1 }).notNull(),
  writingCefr:          decimal('writing_cefr', { precision: 3, scale: 1 }).notNull(),

  estimatedVocabSize:   integer('estimated_vocab_size'),
  ieltsPrediction:      decimal('ielts_prediction', { precision: 2, scale: 1 }),

  // JSONB 灵活存储
  masteredGrammar:      jsonb('mastered_grammar').default([]),
  // ["present_perfect","passive_voice","relative_clauses"]

  weakAreas:            jsonb('weak_areas').default({}),
  // {"grammar":["subjunctive"],"listening":["fast_speech"]}

  errorPatterns:        jsonb('error_patterns').default([]),
  // [{"type":"independent_clause_because","frequency":4,"lastSeen":"2026-06-25"}]

  confidenceInterval:   decimal('confidence_interval', { precision: 3, scale: 2 }).default('0.50'),
  version:              integer('version').default(1),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  userUniqueIdx:  uniqueIndex('uq_user_ability').on(t.userId),
  weakAreasIdx:   index('idx_ability_weak_areas').on(t.weakAreas),
}));

// ─────────────────────────────────────────────
// ability_model_snapshots 能力历史快照
// ─────────────────────────────────────────────
export const abilityModelSnapshots = pgTable('ability_model_snapshots', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  snapshotDate:     date('snapshot_date').notNull(),

  overallCefr:      decimal('overall_cefr', { precision: 3, scale: 1 }),
  vocabularyCefr:   decimal('vocabulary_cefr', { precision: 3, scale: 1 }),
  grammarCefr:      decimal('grammar_cefr', { precision: 3, scale: 1 }),
  readingCefr:      decimal('reading_cefr', { precision: 3, scale: 1 }),
  listeningCefr:    decimal('listening_cefr', { precision: 3, scale: 1 }),
  speakingCefr:     decimal('speaking_cefr', { precision: 3, scale: 1 }),
  writingCefr:      decimal('writing_cefr', { precision: 3, scale: 1 }),
  ieltsPrediction:  decimal('ielts_prediction', { precision: 2, scale: 1 }),

  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniqueSnapshotIdx: uniqueIndex('uq_user_daily_snapshot').on(t.userId, t.snapshotDate),
  userDateIdx:       index('idx_snapshots_user_date').on(t.userId, t.snapshotDate),
}));

// ─────────────────────────────────────────────
// learning_events 学习进度流水（核心表）
// ─────────────────────────────────────────────
export const learningEvents = pgTable('learning_events', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  userId:               uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId:            uuid('session_id').notNull(),

  skill:                varchar('skill', { length: 20 }).notNull(),
  taskType:             varchar('task_type', { length: 50 }).notNull(),
  taskId:               uuid('task_id'),

  contentCefr:          decimal('content_cefr', { precision: 3, scale: 1 }),
  performanceScore:     decimal('performance_score', { precision: 4, scale: 3 }),
  correctCount:         smallint('correct_count'),
  totalCount:           smallint('total_count'),
  timeSpentSec:         smallint('time_spent_sec'),
  hintUsedCount:        smallint('hint_used_count').default(0),
  skipped:              boolean('skipped').default(false),

  aiBandScore:          decimal('ai_band_score', { precision: 2, scale: 1 }),
  aiDimensionScores:    jsonb('ai_dimension_scores'),
  errorsMade:           jsonb('errors_made').default([]),

  uclBefore:            decimal('ucl_before', { precision: 3, scale: 1 }),
  uclAfter:             decimal('ucl_after', { precision: 3, scale: 1 }),

  createdAt:            timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  userSkillIdx:   index('idx_events_user_skill').on(t.userId, t.skill, t.createdAt),
  sessionIdx:     index('idx_events_session').on(t.sessionId),
  userDateIdx:    index('idx_events_user_date').on(t.userId, t.createdAt),
}));

// ─────────────────────────────────────────────
// vocabulary_items 词汇掌握表
// ─────────────────────────────────────────────
export const vocabularyItems = pgTable('vocabulary_items', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  userId:                 uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  word:                   varchar('word', { length: 100 }).notNull(),
  wordCefr:               decimal('word_cefr', { precision: 3, scale: 1 }).notNull(),
  domain:                 varchar('domain', { length: 50 }),

  // SM-2 字段
  easeFactor:             decimal('ease_factor', { precision: 4, scale: 3 }).default('2.500'),
  intervalDays:           smallint('interval_days').default(1),
  repetitions:            smallint('repetitions').default(0),
  dueDate:                date('due_date').defaultNow(),

  status:                 varchar('status', { length: 20 }).default('learning'),

  choiceCorrectStreak:    smallint('choice_correct_streak').default(0),
  contextCorrectStreak:   smallint('context_correct_streak').default(0),
  productionVerified:     boolean('production_verified').default(false),

  sourceType:             varchar('source_type', { length: 30 }),
  sourceId:               uuid('source_id'),

  firstSeenAt:            timestamp('first_seen_at', { withTimezone: true }).defaultNow(),
  lastReviewedAt:         timestamp('last_reviewed_at', { withTimezone: true }),
  masteredAt:             timestamp('mastered_at', { withTimezone: true }),
}, (t) => ({
  uniqueWordIdx:    uniqueIndex('uq_user_word').on(t.userId, t.word),
  dueIdx:           index('idx_vocab_user_due').on(t.userId, t.dueDate),
  statusIdx:        index('idx_vocab_user_status').on(t.userId, t.status),
}));

// ─────────────────────────────────────────────
// grammar_items 语法掌握表
// ─────────────────────────────────────────────
export const grammarItems = pgTable('grammar_items', {
  id:                       uuid('id').primaryKey().defaultRandom(),
  userId:                   uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  grammarPoint:             varchar('grammar_point', { length: 100 }).notNull(),
  cefrLevel:                decimal('cefr_level', { precision: 3, scale: 1 }).notNull(),

  status:                   varchar('status', { length: 20 }).default('not_started'),

  exerciseAccuracy:         decimal('exercise_accuracy', { precision: 4, scale: 3 }),
  exerciseCorrectStreak:    smallint('exercise_correct_streak').default(0),
  productionUseCount:       smallint('production_use_count').default(0),
  consecutiveErrors:        smallint('consecutive_errors').default(0),

  introducedAt:             timestamp('introduced_at', { withTimezone: true }),
  masteredAt:               timestamp('mastered_at', { withTimezone: true }),
  lastPracticedAt:          timestamp('last_practiced_at', { withTimezone: true }),
}, (t) => ({
  uniqueGrammarIdx: uniqueIndex('uq_user_grammar').on(t.userId, t.grammarPoint),
}));

// ─────────────────────────────────────────────
// daily_packs 每日学习包
// ─────────────────────────────────────────────
export const dailyPacks = pgTable('daily_packs', {
  id:                       uuid('id').primaryKey().defaultRandom(),
  userId:                   uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  packDate:                 date('pack_date').notNull(),

  tasks:                    jsonb('tasks').notNull().default([]),
  totalTasks:               smallint('total_tasks').notNull(),
  completedTasks:           smallint('completed_tasks').default(0),
  totalMinutesEstimated:    smallint('total_minutes_estimated'),
  totalMinutesActual:       smallint('total_minutes_actual').default(0),

  difficultyParams:         jsonb('difficulty_params'),

  gateReviewDue:            boolean('gate_review_due').default(false),
  gateReviewPassed:         boolean('gate_review_passed'),
  gateReviewScore:          decimal('gate_review_score', { precision: 4, scale: 3 }),

  createdAt:                timestamp('created_at', { withTimezone: true }).defaultNow(),
  completedAt:              timestamp('completed_at', { withTimezone: true }),
}, (t) => ({
  uniquePackIdx: uniqueIndex('uq_user_pack_date').on(t.userId, t.packDate),
}));

// ─────────────────────────────────────────────
// generated_content AI 生成内容缓存
// ─────────────────────────────────────────────
export const generatedContent = pgTable('generated_content', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  contentType:        varchar('content_type', { length: 30 }).notNull(),

  cefrLevel:          decimal('cefr_level', { precision: 3, scale: 1 }).notNull(),
  interestDomain:     varchar('interest_domain', { length: 50 }),
  grammarPoint:       varchar('grammar_point', { length: 100 }),
  word:               varchar('word', { length: 100 }),

  contentJson:        jsonb('content_json').notNull(),

  // pgvector 存储 embedding（需在 migrate 时手动建立 vector 列）
  // embeddingVector: 在 SQL 迁移中单独处理

  cqvPassed:          boolean('cqv_passed').default(false),
  cqvCheckedAt:       timestamp('cqv_checked_at', { withTimezone: true }),
  humanReviewed:      boolean('human_reviewed').default(false),
  useCount:           integer('use_count').default(0),

  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow(),
  expiresAt:          timestamp('expires_at', { withTimezone: true }),
}, (t) => ({
  typeCefrIdx: index('idx_content_type_cefr').on(t.contentType, t.cefrLevel),
}));

// ─────────────────────────────────────────────
// speaking_sessions 口语会话
// ─────────────────────────────────────────────
export const speakingSessions = pgTable('speaking_sessions', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  userId:             uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  sessionType:        varchar('session_type', { length: 20 }).notNull(),
  audioFileUrl:       text('audio_file_url'),
  audioDurationSec:   integer('audio_duration_sec'),

  transcript:         jsonb('transcript'),
  acousticAnalysis:   jsonb('acoustic_analysis'),
  bandScores:         jsonb('band_scores'),
  feedbackReport:     jsonb('feedback_report'),

  status:             varchar('status', { length: 20 }).default('recording'),

  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow(),
  completedAt:        timestamp('completed_at', { withTimezone: true }),
}, (t) => ({
  userIdx: index('idx_speaking_user').on(t.userId, t.createdAt),
}));

// ─────────────────────────────────────────────
// writing_tasks 写作任务
// ─────────────────────────────────────────────
export const writingTasks = pgTable('writing_tasks', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  userId:               uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  taskType:             varchar('task_type', { length: 40 }).notNull(),
  taskPrompt:           text('task_prompt').notNull(),
  submissionText:       text('submission_text').notNull(),
  wordCount:            smallint('word_count').notNull(),
  submittedAt:          timestamp('submitted_at', { withTimezone: true }).notNull(),

  bandScores:           jsonb('band_scores'),
  critiqueReport:       jsonb('critique_report'),

  status:               varchar('status', { length: 20 }).default('submitted'),
  processingDurationMs: integer('processing_duration_ms'),

  createdAt:            timestamp('created_at', { withTimezone: true }).defaultNow(),
  critiqueCompletedAt:  timestamp('critique_completed_at', { withTimezone: true }),
}, (t) => ({
  userIdx: index('idx_writing_user').on(t.userId, t.createdAt),
}));

// ─────────────────────────────────────────────
// assessment_sessions 测评会话（CAT）
// ─────────────────────────────────────────────
export const assessmentSessions = pgTable('assessment_sessions', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  sessionType:      varchar('session_type', { length: 20 }).default('onboarding'),
  // onboarding / periodic / gate_review

  answers:          jsonb('answers').default([]),
  // [{qId, skill, difficulty, correct, responseTimeSec}]

  result:           jsonb('result'),
  // 输出的 UCL 数据

  status:           varchar('status', { length: 20 }).default('in_progress'),
  startedAt:        timestamp('started_at', { withTimezone: true }).defaultNow(),
  completedAt:      timestamp('completed_at', { withTimezone: true }),
}, (t) => ({
  userIdx: index('idx_assessment_user').on(t.userId, t.startedAt),
}));

// ─────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────
export const usersRelations = relations(users, ({ one, many }) => ({
  abilityModel:      one(userAbilityModels, { fields: [users.id], references: [userAbilityModels.userId] }),
  snapshots:         many(abilityModelSnapshots),
  learningEvents:    many(learningEvents),
  vocabularyItems:   many(vocabularyItems),
  grammarItems:      many(grammarItems),
  dailyPacks:        many(dailyPacks),
  speakingSessions:  many(speakingSessions),
  writingTasks:      many(writingTasks),
  assessments:       many(assessmentSessions),
}));

