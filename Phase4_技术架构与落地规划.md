# EnglishiApp — 第四阶段：技术架构与落地规划

> 版本：v1.0 | 日期：2026-06-26 | 状态：待确认
> 前置依赖：Phase3_AI算法中台与Prompt架构设计.md（已确认）

---

## 目录

1. [技术选型总览](#1-技术选型总览)
2. [系统整体架构图](#2-系统整体架构图)
3. [前端技术架构](#3-前端技术架构)
4. [后端技术架构](#4-后端技术架构)
5. [数据库设计](#5-数据库设计)
6. [AI 服务接入层设计](#6-ai-服务接入层设计)
7. [核心 API 接口设计](#7-核心-api-接口设计)
8. [部署架构与扩展性规划](#8-部署架构与扩展性规划)
9. [数据安全与隐私规范](#9-数据安全与隐私规范)

---

## 1. 技术选型总览

### 1.1 选型原则

```
① 教育功能优先：所有选型以"能否支撑自适应学习引擎"为第一判断标准
② 实时能力强：口语对话、写作批改均需低延迟响应
③ 可扩展性：用户能力模型数据结构会随产品迭代变化，选型需支持灵活 schema
④ 成熟生态：使用有大量社区和案例支持的技术，降低开发风险
⑤ 全栈一致性：前后端语言尽量统一（TypeScript），降低上下文切换成本
```

### 1.2 技术栈总览

```
┌────────────────┬──────────────────────────────┬─────────────────────────────────────┐
│ 层级           │ 技术选型                      │ 选择原因                             │
├────────────────┼──────────────────────────────┼─────────────────────────────────────┤
│ 移动端（主端） │ React Native + Expo           │ 跨平台(iOS/Android)、JS生态复用      │
│ Web 端（辅端） │ Next.js 14 (App Router)       │ SSR支持、与RN代码最大复用            │
│ 状态管理       │ Zustand + React Query         │ 轻量/异步数据分离、缓存友好          │
│ UI 组件库      │ NativeWind + 自建组件库        │ Tailwind语法统一、教育场景定制化      │
├────────────────┼──────────────────────────────┼─────────────────────────────────────┤
│ 后端框架       │ Node.js + Fastify             │ 高性能I/O、TypeScript原生支持        │
│ API 规范       │ REST + WebSocket (Socket.io)  │ REST常规接口、WS用于口语实时流       │
│ 任务队列       │ BullMQ (Redis-backed)         │ AI异步任务（写作批改/报告生成）      │
│ 定时任务       │ node-cron                     │ 每日任务包生成、周报推送、SM-2调度   │
├────────────────┼──────────────────────────────┼─────────────────────────────────────┤
│ 主数据库       │ PostgreSQL 16                 │ 关系数据强一致性、JSONB灵活存储UCL   │
│ 缓存数据库     │ Redis 7                       │ UCL缓存、BullMQ任务队列、会话状态    │
│ 向量数据库     │ pgvector（PG扩展）            │ 内容去重embedding存储，无需独立服务  │
│ 文件存储       │ AWS S3 / 阿里云 OSS           │ 口语录音、TTS音频文件存储            │
├────────────────┼──────────────────────────────┼─────────────────────────────────────┤
│ AI 主力模型    │ OpenAI GPT-4o                 │ 写作精批/口语报告（高质量推理）      │
│ AI 高速模型    │ OpenAI GPT-4o-mini            │ 内容生成/词汇/语法（高频低成本）     │
│ 语音转文字     │ OpenAI Whisper API            │ 口语录音转写，支持多口音             │
│ 文字转语音     │ Azure Cognitive Speech        │ 听力音频生成，语速/音色可精确控制    │
│ Embedding      │ OpenAI text-embedding-3-large │ 内容去重、语义相似度计算             │
│ 发音评估       │ Azure Pronunciation Assessment│ 音素级发音评分，专为EFL设计          │
├────────────────┼──────────────────────────────┼─────────────────────────────────────┤
│ 容器化         │ Docker + Docker Compose       │ 本地开发一致性                       │
│ 编排           │ Kubernetes (K8s)              │ 生产环境扩展与服务治理               │
│ CDN            │ Cloudflare                    │ 全球音频/静态资源加速                │
│ 监控           │ Grafana + Prometheus          │ AI接口延迟/成本监控                  │
│ 日志           │ ELK Stack (Elasticsearch)     │ 学习行为日志分析、Prompt质量追踪     │
└────────────────┴──────────────────────────────┴─────────────────────────────────────┘
```

---

## 2. 系统整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              客户端层                                        │
│   ┌────────────────────┐              ┌──────────────────────────────────┐  │
│   │  React Native App  │              │  Next.js Web（教师/管理后台）     │  │
│   │  iOS + Android     │              │                                  │  │
│   └────────┬───────────┘              └──────────────┬───────────────────┘  │
└────────────┼──────────────────────────────────────────┼─────────────────────┘
             │ HTTPS / WSS                              │ HTTPS
┌────────────▼──────────────────────────────────────────▼─────────────────────┐
│                           API Gateway（Nginx/Cloudflare）                    │
│              限流 / 鉴权 / 路由 / SSL 终止 / 请求日志                         │
└──────────┬──────────────────────────────────────────┬───────────────────────┘
           │                                          │
┌──────────▼─────────────┐              ┌─────────────▼────────────────────────┐
│   核心业务服务          │              │   AI 中台服务                         │
│   (Fastify REST API)   │              │   (独立 Node.js 服务)                 │
│                        │              │                                      │
│ - 用户服务             │              │ - ReadingEngine                       │
│ - 学习调度服务          │◀────────────▶│ - ListeningEngine                    │
│ - 评测服务             │  内部 RPC    │ - SpeakingExaminer                   │
│ - 进度追踪服务          │              │ - WritingCritic                      │
│ - 词汇服务             │              │ - VocabEngine                        │
│ - 语法服务             │              │ - GrammarEngine                      │
└──────────┬─────────────┘              └─────────────┬────────────────────────┘
           │                                          │
┌──────────▼──────────────────────────────────────────▼───────────────────────┐
│                              基础设施层                                       │
│   ┌──────────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐  │
│   │ PostgreSQL   │  │  Redis   │  │  BullMQ   │  │   AWS S3 / OSS       │  │
│   │ (主数据库)   │  │  (缓存)  │  │  (任务队列)│  │  (音频/录音文件)      │  │
│   │ + pgvector  │  │          │  │           │  │                      │  │
│   └──────────────┘  └──────────┘  └───────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
           │                                          │
┌──────────▼──────────────────────────────────────────▼───────────────────────┐
│                           外部 AI/语音服务                                    │
│   OpenAI API    │   Azure Cognitive Speech   │   Azure Pronunciation         │
│   (GPT-4o系列)  │   (TTS 音频合成)            │   (发音评估)                  │
│   Whisper API   │   text-embedding-3-large   │                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 前端技术架构

### 3.1 目录结构

```
apps/
├── mobile/                        # React Native (Expo)
│   ├── app/                       # Expo Router 页面（文件系统路由）
│   │   ├── (auth)/                # 未登录页面组
│   │   │   ├── onboarding.tsx     # 首次引导
│   │   │   └── assessment.tsx     # 入门测评
│   │   ├── (tabs)/                # 主 Tab 导航
│   │   │   ├── today.tsx          # 今日学习任务包
│   │   │   ├── progress.tsx       # 能力进度雷达图
│   │   │   ├── practice/          # 专项练习入口
│   │   │   └── profile.tsx        # 用户设置
│   │   ├── reading/[id].tsx       # 阅读文章详情页
│   │   ├── listening/[id].tsx     # 听力任务页
│   │   ├── speaking/session.tsx   # 口语对练会话页
│   │   └── writing/[taskId].tsx   # 写作任务页
│   ├── components/                # 共享 UI 组件
│   │   ├── vocabulary/            # 词汇弹窗、卡片
│   │   ├── speaking/              # 录音按钮、波形可视化
│   │   ├── writing/               # 批注渲染、评分雷达
│   │   └── common/                # 进度条、能力标签等
│   └── stores/                    # Zustand 全局状态
│       ├── userAbilityStore.ts    # 用户能力模型（UCL）本地镜像
│       ├── dailyPackStore.ts      # 今日任务包状态
│       └── sessionStore.ts        # 口语会话临时状态
│
└── web/                           # Next.js（管理后台，后期开发）
```

### 3.2 关键前端状态管理设计

```typescript
// stores/userAbilityStore.ts

interface UserAbilityState {
  // 核心能力模型（与服务端 UCL 同步）
  overallCefr: number;          // 如 1.7 代表 B1.7（A1=1.0, C2=6.0）
  dimensionScores: {
    vocabulary: number;
    grammar: number;
    reading: number;
    listening: number;
    speaking: number;
    writing: number;
  };
  
  // 弱点追踪
  weakAreas: Record<Skill, string[]>;
  errorPatterns: ErrorPattern[];
  
  // 学习元信息
  ieltsPrediction: number;
  iletsTarget: number;
  daysOnProgram: number;
  
  // 缓存控制
  lastSyncedAt: Date;
  isDirty: boolean;             // 本地有未同步的变化
}

// 关键操作
interface UserAbilityActions {
  // 从服务端同步最新 UCL
  syncFromServer: () => Promise<void>;
  
  // 本地乐观更新（任务完成后即时更新UI，异步同步到服务端）
  applyPerformanceUpdate: (taskResult: TaskResult) => void;
  
  // 获取某任务适用的难度参数（防超纲的前端守门）
  getTaskDifficultyParams: (taskType: TaskType) => DifficultyParams;
}
```

### 3.3 口语会话实时通信设计

```typescript
// 口语 Part 1/2/3 会话采用 WebSocket 全双工通信

// 客户端状态机
type SpeakingSessionState =
  | 'idle'
  | 'examiner_speaking'    // AI 考官正在播放问题
  | 'candidate_prep'       // 用户准备时间（Part 2 限时1分钟）
  | 'candidate_recording'  // 用户录音中
  | 'processing'           // 服务端处理中（Whisper转写 + 评分）
  | 'showing_feedback'     // 展示反馈报告
  | 'session_complete';    // 会话结束

// WebSocket 消息协议
interface WSMessage {
  type:
    | 'session_start'
    | 'examiner_question'         // 服务端 → 客户端：下一个问题
    | 'prep_timer_start'          // Part 2 准备计时开始
    | 'recording_start_signal'    // 告知客户端开始录音
    | 'candidate_audio_chunk'     // 客户端 → 服务端：音频流（16kHz PCM）
    | 'candidate_recording_end'   // 客户端 → 服务端：录音结束
    | 'transcription_result'      // 服务端 → 客户端：Whisper转写结果（实时流式）
    | 'follow_up_question'        // 动态追问
    | 'session_report'            // 完整报告
    | 'error';
  payload: Record<string, unknown>;
  session_id: string;
  timestamp: number;
}
```

---

## 4. 后端技术架构

### 4.1 服务模块划分

```
backend/
├── apps/
│   ├── api-gateway/               # Nginx 配置 + 鉴权中间件
│   ├── core-service/              # 主业务服务 (Fastify)
│   │   ├── modules/
│   │   │   ├── user/              # 用户注册、登录、设置
│   │   │   ├── assessment/        # 测评（CAT 算法实现）
│   │   │   ├── scheduler/         # 每日学习包调度引擎
│   │   │   ├── vocabulary/        # SM-2 调度、词汇本管理
│   │   │   ├── grammar/           # 语法知识图谱、练习
│   │   │   ├── progress/          # 进度追踪、Gate Review
│   │   │   └── report/            # 学习报告生成触发
│   │   └── shared/
│   │       ├── ucl/               # UCL 读取/写入/缓存
│   │       └── cqv/               # 内容质量校验层
│   │
│   └── ai-service/                # AI 中台服务 (独立 Fastify 进程)
│       ├── engines/
│       │   ├── reading.engine.ts
│       │   ├── listening.engine.ts
│       │   ├── speaking.engine.ts
│       │   ├── writing.engine.ts
│       │   ├── vocab.engine.ts
│       │   └── grammar.engine.ts
│       ├── prompts/               # Prompt 模板（版本化管理）
│       │   ├── reading/
│       │   │   ├── v2.3.ts        # 当前生产版本
│       │   │   └── v2.4.draft.ts  # 开发中版本
│       │   └── ...
│       └── validators/            # CQV 校验器
│
└── packages/
    ├── shared-types/              # 前后端共享的 TypeScript 类型定义
    ├── cefr-utils/                # CEFR 级别转换工具（数字↔字符串）
    └── vocab-db/                  # 词汇级别数据库（离线查询，避免API调用）
```

### 4.2 每日学习包调度服务（核心后端逻辑）

```typescript
// scheduler/daily-pack.service.ts

class DailyPackScheduler {
  
  async generateDailyPack(userId: string): Promise<DailyPack> {
    
    // 1. 加载用户 UCL（优先缓存）
    const ucl = await this.uclService.load(userId);
    
    // 2. 获取 SM-2 待复习词汇
    const dueVocab = await this.vocabService.getDueItems(userId);
    
    // 3. 获取待补习语法点
    const priorityGrammar = this.grammarService.getPriorityPoint(
      ucl.weakAreas.grammar,
      ucl.ability.knownGrammarStructures
    );
    
    // 4. 确定今日有效学习时间（基于用户承诺 + 历史实际完成率）
    const effectiveMinutes = this.calcEffectiveMinutes(ucl);
    
    // 5. 计算技能权重（弱项上浮）
    const weights = this.calcSkillWeights(ucl);
    
    // 6. 确定今日内容难度参数（严格不超纲）
    const diffParams: DifficultyParams = {
      vocabCeiling: ucl.ability.vocabularyCefr + 1.0,   // 词汇最高 i+1
      grammarAllowed: ucl.ability.knownGrammarStructures,
      grammarForbidden: ucl.ability.notYetGrammar,
      targetNewWordRate: 0.06,
      articleWordCount: this.calcArticleLength(ucl.ability.overallCefr)
    };
    
    // 7. 并行触发 AI 内容生成（非阻塞，加入 BullMQ 队列）
    const contentJobs = await Promise.all([
      this.readingEngine.enqueueGeneration({ ucl, diffParams }),
      this.listeningEngine.enqueueGeneration({ ucl, diffParams }),
    ]);
    
    // 8. 组装任务包（同步部分立即返回，AI 生成内容异步填充）
    const pack: DailyPack = {
      userId,
      date: today(),
      tasks: [
        this.buildVocabTask(dueVocab, ucl),
        this.buildGrammarTask(priorityGrammar, ucl),
        { type: 'reading', status: 'pending', jobId: contentJobs[0] },
        { type: 'listening', status: 'pending', jobId: contentJobs[1] },
        this.buildOutputTask(ucl),   // 口语或写作（隔日轮换）
      ],
      totalEstimatedMinutes: effectiveMinutes,
      difficultyParams: diffParams,
      generatedAt: new Date(),
    };
    
    await this.packRepo.save(pack);
    return pack;
  }
  
  // 防超纲守门：任何任务参数在发出前必须通过此验证
  private validateNeverExceedsLevel(
    task: Task, 
    ucl: UserCapabilityLevel
  ): boolean {
    const maxAllowed = ucl.ability.overallCefr + 1.0;
    if (task.difficultyLevel > maxAllowed) {
      this.logger.warn(`Task ${task.id} level ${task.difficultyLevel} exceeds max ${maxAllowed}`);
      return false;
    }
    return true;
  }
}
```

---

## 5. 数据库设计

### 5.1 核心数据表结构

#### 表1：用户基础表（users）

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  display_name    VARCHAR(100) NOT NULL,
  
  -- 目标设定
  ielts_target_band     DECIMAL(2,1),          -- 如 7.0
  target_deadline       DATE,
  daily_minutes_goal    SMALLINT DEFAULT 30,
  
  -- 兴趣标签
  interest_tags         TEXT[] DEFAULT '{}',    -- ['technology','travel']
  primary_interest      VARCHAR(50),
  
  -- 账户状态
  onboarding_completed  BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  last_active_at        TIMESTAMPTZ,
  
  -- 时区
  timezone              VARCHAR(50) DEFAULT 'Asia/Shanghai'
);

CREATE INDEX idx_users_last_active ON users(last_active_at);
```

#### 表2：用户能力模型表（user_ability_models）⭐ 核心表

```sql
CREATE TABLE user_ability_models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- CEFR 数值化存储（A1=1.0, A2=2.0, B1=3.0, B2=4.0, C1=5.0, C2=6.0，精度0.1）
  overall_cefr          DECIMAL(3,1) NOT NULL,
  vocabulary_cefr       DECIMAL(3,1) NOT NULL,
  grammar_cefr          DECIMAL(3,1) NOT NULL,
  reading_cefr          DECIMAL(3,1) NOT NULL,
  listening_cefr        DECIMAL(3,1) NOT NULL,
  speaking_cefr         DECIMAL(3,1) NOT NULL,
  writing_cefr          DECIMAL(3,1) NOT NULL,
  
  -- 估算词汇量
  estimated_vocab_size  INTEGER,
  
  -- 雅思预测分
  ielts_prediction      DECIMAL(2,1),
  
  -- 已掌握语法点（JSON数组）
  mastered_grammar      JSONB DEFAULT '[]',
  -- 示例：["present_perfect","passive_voice","relative_clauses"]
  
  -- 弱点清单（各维度）
  weak_areas            JSONB DEFAULT '{}',
  -- 示例：{"grammar":["subjunctive"],"listening":["fast_speech"]}
  
  -- 持久性错误模式
  error_patterns        JSONB DEFAULT '[]',
  -- 示例：[{"type":"independent_clause_because","frequency":4,"last_seen":"2026-06-25"}]
  
  -- 能力置信度（CAT 算法输出的标准误差，越小越可信）
  confidence_interval   DECIMAL(3,2) DEFAULT 0.5,
  
  -- 版本控制
  version               INTEGER DEFAULT 1,
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  
  -- 每个用户只有一个当前能力模型（最新版本）
  CONSTRAINT uq_user_ability UNIQUE (user_id)
);

-- 为弱点和错误模式建立 GIN 索引（用于分析查询）
CREATE INDEX idx_ability_weak_areas ON user_ability_models USING GIN(weak_areas);
CREATE INDEX idx_ability_error_patterns ON user_ability_models USING GIN(error_patterns);
```

#### 表3：能力模型历史快照表（ability_model_snapshots）

```sql
-- 每日一次快照，用于能力变化曲线展示和趋势分析
CREATE TABLE ability_model_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,
  
  -- 快照数据（与 user_ability_models 结构一致）
  overall_cefr    DECIMAL(3,1),
  vocabulary_cefr DECIMAL(3,1),
  grammar_cefr    DECIMAL(3,1),
  reading_cefr    DECIMAL(3,1),
  listening_cefr  DECIMAL(3,1),
  speaking_cefr   DECIMAL(3,1),
  writing_cefr    DECIMAL(3,1),
  ielts_prediction DECIMAL(2,1),
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT uq_user_daily_snapshot UNIQUE (user_id, snapshot_date)
);

CREATE INDEX idx_snapshots_user_date ON ability_model_snapshots(user_id, snapshot_date DESC);
```

#### 表4：学习进度流水表（learning_events）⭐ 核心表

```sql
-- 记录每一个学习交互事件，是能力模型更新和报告生成的原始数据源
CREATE TABLE learning_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id      UUID NOT NULL,              -- 同一次打开 App 内的事件归为一个 session
  
  -- 事件分类
  skill           VARCHAR(20) NOT NULL,        -- vocabulary/grammar/reading/listening/speaking/writing
  task_type       VARCHAR(50) NOT NULL,        -- vocab_review/grammar_exercise/reading_article/...
  task_id         UUID,                        -- 指向具体任务记录（可选）
  
  -- 内容难度
  content_cefr    DECIMAL(3,1),               -- 本次任务内容的实际难度
  
  -- 表现数据
  performance_score  DECIMAL(4,3),            -- 0.000 - 1.000（综合表现分）
  correct_count   SMALLINT,
  total_count     SMALLINT,
  time_spent_sec  SMALLINT,
  hint_used_count SMALLINT DEFAULT 0,
  skipped         BOOLEAN DEFAULT FALSE,
  
  -- AI 评分（口语/写作专用）
  ai_band_score   DECIMAL(2,1),              -- 雅思 Band 分（口语/写作任务）
  ai_dimension_scores JSONB,                 -- {"TR":6.5,"CC":6.0,"LR":7.0,"GRA":6.5}
  
  -- 错误详情（语法/词汇任务）
  errors_made     JSONB DEFAULT '[]',
  -- 示例：[{"type":"subject_verb_agreement","content":"neither...was"}]
  
  -- 能力模型更新记录
  ucl_before      DECIMAL(3,1),             -- 事件前的能力值
  ucl_after       DECIMAL(3,1),             -- 事件后的能力值（delta 追踪）
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_user_skill ON learning_events(user_id, skill, created_at DESC);
CREATE INDEX idx_events_session ON learning_events(session_id);
CREATE INDEX idx_events_user_date ON learning_events(user_id, created_at DESC);
-- 按时间分区（每月一个分区，事件量大时保持查询性能）
-- PARTITION BY RANGE (created_at);
```

#### 表5：词汇掌握表（vocabulary_items）

```sql
CREATE TABLE vocabulary_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  word            VARCHAR(100) NOT NULL,
  word_cefr       DECIMAL(3,1) NOT NULL,      -- 该词的 CEFR 难度级别
  domain          VARCHAR(50),                 -- 兴趣域（technology/travel/...）
  
  -- SM-2 间隔重复核心字段
  ease_factor     DECIMAL(4,3) DEFAULT 2.500,  -- 默认 2.5（SM-2 初始值）
  interval_days   SMALLINT DEFAULT 1,          -- 下次复习间隔（天）
  repetitions     SMALLINT DEFAULT 0,          -- 已成功复习次数
  due_date        DATE DEFAULT CURRENT_DATE,   -- 下次复习日期
  
  -- 掌握度追踪
  status          VARCHAR(20) DEFAULT 'learning',
  -- learning → reviewing → mastered → passive_maintenance
  
  choice_correct_streak    SMALLINT DEFAULT 0,  -- 连续选择题正确次数（需达3）
  context_correct_streak   SMALLINT DEFAULT 0,  -- 连续语境使用正确次数（需达2）
  production_verified      BOOLEAN DEFAULT FALSE, -- 在口语/写作中成功使用
  
  -- 来源追踪
  source_type     VARCHAR(30),                 -- assessment/reading/listening/manual
  source_id       UUID,
  
  first_seen_at   TIMESTAMPTZ DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  mastered_at     TIMESTAMPTZ,                 -- 达到 mastered 状态的时间
  
  CONSTRAINT uq_user_word UNIQUE (user_id, word)
);

CREATE INDEX idx_vocab_user_due ON vocabulary_items(user_id, due_date) 
  WHERE status != 'passive_maintenance';
CREATE INDEX idx_vocab_user_status ON vocabulary_items(user_id, status);
```

#### 表6：语法掌握表（grammar_items）

```sql
CREATE TABLE grammar_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  grammar_point   VARCHAR(100) NOT NULL,       -- 如 "subjunctive_mood"
  cefr_level      DECIMAL(3,1) NOT NULL,
  
  -- 掌握状态
  status          VARCHAR(20) DEFAULT 'not_started',
  -- not_started → introduced → practicing → mastered
  
  -- 掌握条件追踪（同时满足才晋级为 mastered）
  exercise_accuracy     DECIMAL(4,3),           -- 练习题正确率（需 ≥0.85）
  exercise_correct_streak SMALLINT DEFAULT 0,   -- 连续正确次数（需达4）
  production_use_count  SMALLINT DEFAULT 0,     -- 在口语/写作中正确使用次数（需≥1）
  
  -- 连续出错（触发降级/强化）
  consecutive_errors    SMALLINT DEFAULT 0,
  
  introduced_at   TIMESTAMPTZ,
  mastered_at     TIMESTAMPTZ,
  last_practiced_at TIMESTAMPTZ,
  
  CONSTRAINT uq_user_grammar UNIQUE (user_id, grammar_point)
);
```

#### 表7：每日学习包表（daily_packs）

```sql
CREATE TABLE daily_packs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_date       DATE NOT NULL,
  
  -- 任务列表（JSON 数组）
  tasks           JSONB NOT NULL DEFAULT '[]',
  /*
  示例：[
    {"type":"vocabulary","status":"completed","item_count":15,"minutes":8},
    {"type":"grammar","status":"completed","point":"reported_speech","minutes":5},
    {"type":"reading","status":"completed","article_id":"uuid","minutes":12},
    {"type":"listening","status":"pending","audio_id":"uuid","minutes":10},
    {"type":"speaking","status":"skipped","part":"Part1","minutes":0}
  ]
  */
  
  -- 进度
  total_tasks     SMALLINT NOT NULL,
  completed_tasks SMALLINT DEFAULT 0,
  total_minutes_estimated SMALLINT,
  total_minutes_actual    SMALLINT DEFAULT 0,
  
  -- 难度参数快照（生成时的参数，用于审计）
  difficulty_params JSONB,
  
  -- Gate Review 状态
  gate_review_due       BOOLEAN DEFAULT FALSE,
  gate_review_passed    BOOLEAN,
  gate_review_score     DECIMAL(4,3),
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  
  CONSTRAINT uq_user_pack_date UNIQUE (user_id, pack_date)
);
```

#### 表8：AI 生成内容缓存表（generated_content）

```sql
CREATE TABLE generated_content (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  content_type    VARCHAR(30) NOT NULL,
  -- reading_article / listening_script / vocab_explanation / grammar_lesson
  
  -- 内容参数（用于缓存键匹配）
  cefr_level      DECIMAL(3,1) NOT NULL,
  interest_domain VARCHAR(50),
  grammar_point   VARCHAR(100),              -- 语法课专用
  word            VARCHAR(100),              -- 词汇解析专用
  
  -- 实际内容
  content_json    JSONB NOT NULL,
  
  -- 向量（用于去重检测）
  embedding       vector(3072),              -- text-embedding-3-large 维度
  
  -- 质量标记
  cqv_passed      BOOLEAN DEFAULT FALSE,
  cqv_checked_at  TIMESTAMPTZ,
  human_reviewed  BOOLEAN DEFAULT FALSE,     -- 人工审核标记（高质量内容可复用）
  
  -- 使用统计
  use_count       INTEGER DEFAULT 0,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ               -- 内容过期时间（可为 NULL 表示永久）
);

-- 向量相似度搜索索引（pgvector）
CREATE INDEX idx_content_embedding ON generated_content 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_content_type_cefr ON generated_content(content_type, cefr_level);
```

#### 表9：口语会话记录表（speaking_sessions）

```sql
CREATE TABLE speaking_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  session_type    VARCHAR(20) NOT NULL,       -- Part1/Part2/Part3/Full_Test
  
  -- 音频文件
  audio_file_url  TEXT,                       -- S3/OSS 存储路径
  audio_duration_sec INTEGER,
  
  -- 完整转写
  transcript      JSONB,
  -- [{"speaker":"examiner","text":"...","ts_start":0,"ts_end":3},...]
  
  -- 声学分析结果
  acoustic_analysis JSONB,
  -- {"filler_count":4,"avg_wpm":145,"pause_per_min":2.3,...}
  
  -- AI 评分报告
  band_scores     JSONB,
  -- {"overall":6.5,"FC":6.5,"LR":7.0,"GRA":6.0,"PR":6.5}
  
  -- 反馈报告（完整 JSON）
  feedback_report JSONB,
  
  -- 处理状态
  status          VARCHAR(20) DEFAULT 'recording',
  -- recording → processing → completed → failed
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
```

#### 表10：写作任务记录表（writing_tasks）

```sql
CREATE TABLE writing_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  task_type       VARCHAR(40) NOT NULL,
  -- IELTS_Task1_Graph / IELTS_Task2_Opinion / General_Paragraph / ...
  
  -- 题目
  task_prompt     TEXT NOT NULL,
  
  -- 用户提交
  submission_text TEXT NOT NULL,
  word_count      SMALLINT NOT NULL,
  submitted_at    TIMESTAMPTZ NOT NULL,
  
  -- AI 批改结果
  band_scores     JSONB,
  -- {"overall":6.0,"TR":6.5,"CC":5.5,"LR":6.0,"GRA":6.0}
  
  critique_report JSONB,                     -- 完整批改 JSON（见 Phase3 设计）
  
  -- 处理状态
  status          VARCHAR(20) DEFAULT 'submitted',
  -- submitted → processing → completed → failed
  
  processing_duration_ms INTEGER,           -- 批改耗时（用于性能监控）
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  critique_completed_at TIMESTAMPTZ
);

CREATE INDEX idx_writing_user ON writing_tasks(user_id, created_at DESC);
```

### 5.2 数据库关系概览

```
users
  ├── user_ability_models (1:1)      ← 当前能力快照
  ├── ability_model_snapshots (1:N)  ← 历史能力曲线
  ├── learning_events (1:N)          ← 所有学习行为流水
  ├── vocabulary_items (1:N)         ← 词汇掌握状态（SM-2）
  ├── grammar_items (1:N)            ← 语法掌握状态
  ├── daily_packs (1:N)              ← 每日任务包
  ├── speaking_sessions (1:N)        ← 口语会话记录
  └── writing_tasks (1:N)            ← 写作任务记录
```

---

## 6. AI 服务接入层设计

### 6.1 OpenAI 调用封装（防重试风暴 + 成本追踪）

```typescript
// ai-service/lib/openai-client.ts

class OpenAIClientWrapper {
  
  async callWithRetry<T>(params: {
    model: 'gpt-4o' | 'gpt-4o-mini';
    messages: ChatMessage[];
    temperature?: number;
    response_format?: { type: 'json_object' };
    maxRetries?: number;
    userId?: string;
    taskType?: string;   // 用于成本追踪
  }): Promise<{ data: T; usage: TokenUsage }> {
    
    const maxRetries = params.maxRetries ?? 3;
    let lastError: Error;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        
        const response = await this.openai.chat.completions.create({
          model: params.model,
          messages: params.messages,
          temperature: params.temperature ?? 0.7,
          response_format: params.response_format,
        });
        
        const latencyMs = Date.now() - startTime;
        
        // 追踪成本（每次调用记录 token 消耗）
        await this.trackUsage({
          userId: params.userId,
          taskType: params.taskType,
          model: params.model,
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          latencyMs,
        });
        
        // 解析 JSON 输出（所有生产调用均要求 JSON 格式）
        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content) as T;
        
        return { data: parsed, usage: response.usage };
        
      } catch (error) {
        lastError = error as Error;
        
        if (this.isRateLimitError(error)) {
          // 速率限制：指数退避
          await this.sleep(Math.pow(2, attempt) * 1000);
        } else if (this.isInvalidJSONError(error)) {
          // JSON 解析失败：记录并重试
          this.logger.warn(`JSON parse failed on attempt ${attempt + 1}`);
        } else {
          // 其他错误不重试
          throw error;
        }
      }
    }
    
    throw new AIServiceError(`Failed after ${maxRetries} attempts`, lastError);
  }
}
```

### 6.2 Azure 语音服务集成（TTS + 发音评估）

```typescript
// ai-service/engines/speech.service.ts

class AzureSpeechService {
  
  // TTS：生成听力音频
  async synthesizeListeningAudio(params: {
    script: string;
    voice: 'en-US-JennyNeural' | 'en-GB-SoniaNeural' | 'en-AU-NatashaNeural';
    rate: number;           // 0.5-2.0，1.0 为正常语速
    outputFormat: 'mp3' | 'wav';
    pauseMarkers: Array<{ position: number; durationMs: number }>;
  }): Promise<Buffer> {
    
    // 将 [PAUSE:Xs] 标记转换为 SSML <break> 标签
    const ssml = this.buildSSML({
      text: params.script,
      voice: params.voice,
      rate: params.rate,
      pauseMarkers: params.pauseMarkers
    });
    
    const audioBuffer = await this.speechSynthesizer.speakSsmlAsync(ssml);
    return audioBuffer;
  }
  
  // 发音评估：音素级精度
  async assessPronunciation(params: {
    audioBuffer: Buffer;
    referenceText: string;
    granularity: 'phoneme' | 'word' | 'sentence';
  }): Promise<PronunciationAssessmentResult> {
    
    const config = PronunciationAssessmentConfig.fromJSON(JSON.stringify({
      referenceText: params.referenceText,
      gradingSystem: 'HundredMark',
      granularity: params.granularity,
      enableMiscue: true,
      enableProsodyAssessment: true   // 语调/节奏评估
    }));
    
    const result = await this.performAssessment(params.audioBuffer, config);
    
    return {
      accuracyScore: result.pronunciationResult.accuracyScore,
      fluencyScore: result.pronunciationResult.fluencyScore,
      completenessScore: result.pronunciationResult.completenessScore,
      phonemes: result.pronunciationResult.detailResult.Phonemes.map(p => ({
        phoneme: p.Phoneme,
        accuracyScore: p.PronunciationAssessment.AccuracyScore,
        nbest: p.PronunciationAssessment.NBest   // 候选发音
      }))
    };
  }
}
```

---

## 7. 核心 API 接口设计

### 7.1 接口规范

```
Base URL:        https://api.englishi.app/v1
Authentication:  Bearer JWT Token
Content-Type:    application/json
Error Format:    {"error": {"code": "string", "message": "string", "details": {}}}
```

### 7.2 核心接口列表

```
【用户与测评模块】
POST   /auth/register                  注册
POST   /auth/login                     登录
POST   /assessment/start               启动入门 CAT 测评
POST   /assessment/answer              提交单题答案（返回下一题）
POST   /assessment/complete            完成测评（返回能力报告）
GET    /users/me/ability               获取当前能力模型（UCL）
GET    /users/me/ability/history       获取历史能力曲线（按日期）

【每日学习模块】
GET    /daily-pack/today               获取今日学习包
POST   /daily-pack/tasks/:taskId/complete  标记任务完成
GET    /daily-pack/gate-review         获取 Gate Review 题目
POST   /daily-pack/gate-review/submit  提交 Gate Review 答案

【词汇模块】
GET    /vocabulary/due                 获取今日待复习词汇
POST   /vocabulary/review             提交词汇复习结果（SM-2 更新）
POST   /vocabulary/items              手动添加词汇
GET    /vocabulary/items              查看词汇本（支持过滤/排序）

【语法模块】
GET    /grammar/priority-point         获取当前优先学习的语法点
GET    /grammar/:point/lesson          获取语法讲解（JSON含例句+练习）
POST   /grammar/:point/exercises/submit 提交语法练习答案

【阅读模块】
POST   /reading/generate               生成定制阅读文章（返回 jobId）
GET    /reading/content/:jobId         获取生成结果（轮询或 webhook）
POST   /reading/sessions/:articleId/answers  提交阅读答案

【听力模块】
POST   /listening/generate             生成听力材料（返回 jobId）
GET    /listening/content/:jobId       获取生成结果
GET    /listening/audio/:audioId       获取 TTS 音频文件 URL
POST   /listening/sessions/:audioId/answers  提交听力答案

【口语模块】
POST   /speaking/sessions              创建口语会话（返回 sessionId + WS Token）
WS     /speaking/sessions/:id/stream   WebSocket 口语实时流
GET    /speaking/sessions/:id/report   获取会话后报告

【写作模块】
GET    /writing/task                   获取今日写作题目（基于当前水平）
POST   /writing/submissions            提交作文
GET    /writing/submissions/:id/critique  获取批改报告（异步，轮询）

【进度与报告】
GET    /progress/overview              进度总览（能力雷达图数据）
GET    /progress/weekly-report         本周学习报告
GET    /progress/ielts-timeline        达标时间线预测
```

### 7.3 关键接口详细设计（口语 WebSocket）

```
WS /speaking/sessions/:sessionId/stream

客户端 → 服务端消息：
  { type: "audio_chunk", data: "<base64 PCM>", sequence: number }
  { type: "recording_end", duration_ms: number }

服务端 → 客户端消息：
  { type: "examiner_question", text: "...", audio_url: "...", q_id: "T1Q1" }
  { type: "transcription_stream", text: "...", is_final: false }  // 实时转写流
  { type: "transcription_final", text: "...", q_id: "T1Q1" }
  { type: "follow_up_question", text: "...", audio_url: "..." }
  { type: "session_complete", report_available_at: "ISO8601" }
  { type: "error", code: "...", message: "..." }

连接关闭条件：
  - 会话自然结束（所有 Part 完成）
  - 用户主动结束（客户端发送 close frame）
  - 超时（120 秒无音频输入）
  - 错误（音频格式不支持等）
```

---

## 8. 部署架构与扩展性规划

### 8.1 生产环境 Kubernetes 部署结构

```yaml
# 服务规模（初期）
services:
  api-gateway:
    replicas: 2
    resources: { cpu: "500m", memory: "512Mi" }
    
  core-service:
    replicas: 3
    resources: { cpu: "1", memory: "1Gi" }
    autoscaling:
      minReplicas: 3
      maxReplicas: 10
      targetCPUUtilizationPercentage: 70
      
  ai-service:
    replicas: 2
    resources: { cpu: "2", memory: "2Gi" }
    autoscaling:
      minReplicas: 2
      maxReplicas: 8
      # AI 服务按 BullMQ 队列积压量扩容，而非 CPU
      custom_metric: bullmq_queue_depth > 50
      
  speaking-ws-service:          # 口语 WebSocket 独立部署（长连接特性）
    replicas: 3
    resources: { cpu: "1", memory: "2Gi" }
    service_type: LoadBalancer
    session_affinity: ClientIP  # WebSocket 需要粘性会话

databases:
  postgresql:
    type: RDS PostgreSQL 16 (Multi-AZ)
    instance: db.r6g.xlarge
    storage: 500GB SSD，自动扩展
    read_replicas: 1（用于报告查询分离）
    
  redis:
    type: ElastiCache Redis 7 (Cluster Mode)
    nodes: 3 primary + 3 replica
```

### 8.2 关键性能指标与 SLA

```
接口响应时间 P95 目标：
  普通 REST 接口：        < 200ms
  每日任务包获取：        < 500ms（部分内容异步生成）
  写作批改（提交后）：    < 30 秒（异步，用户无需等待）
  阅读文章生成：          < 8 秒
  听力音频生成：          < 10 秒
  口语 WebSocket 转写延迟：< 500ms（逐句实时反馈）

可用性 SLA：
  核心学习功能：99.5%
  AI 内容生成：99%（允许偶发降级回退到缓存内容）
  
AI 服务降级策略（当 OpenAI API 超时或不可用）：
  Level 1（API 延迟 >10s）：从缓存库中匹配最相似的预生成内容
  Level 2（API 完全不可用）：切换到预置模板库（人工审核内容）
  Level 3（超过 30 分钟不可用）：禁用 AI 生成类任务，仅保留词汇/语法练习
```

### 8.3 数据分析与教学质量监控

```
核心监控看板（Grafana）：

【教学质量看板】
  - 各 CEFR 级别用户的日均任务完成率
  - Gate Review 通过率（分 CEFR 级别）→ 低于 60% 触发告警
  - 用户反馈"内容太难"/"内容太简单"比率（均应 < 5%）
  - AI 生成内容 CQV 通过率（按内容类型）→ 低于 85% 触发告警
  - 写作批改 P95 耗时

【AI 成本看板】
  - 每日各模型 Token 消耗（输入/输出）
  - 每用户每日 AI 调用成本
  - CQV 重试率（高重试率 = Prompt 质量问题）
  - 缓存命中率（语法讲解缓存应 > 70%）

【用户学习效果看板】
  - 用户 7/30/90 天 CEFR 提升分布
  - 口语 Band Score 趋势（按用户分组）
  - 写作四维分数提升趋势
  - 最常见持久性错误类型排名（驱动 Prompt 和内容优化）
```

---

## 9. 数据安全与隐私规范

### 9.1 数据分级保护

```
S1 级（最高敏感，加密存储）：
  - 用户邮箱、手机号
  - 认证 Token、密码 Hash
  处理：AES-256 字段加密 + 访问日志强制记录

S2 级（敏感，访问控制）：
  - 口语录音文件（S3 私有桶，仅用户本人可访问）
  - 写作内容（可能含个人信息）
  - 学习行为日志
  处理：签名 URL（1小时过期）访问音频；日志数据匿名化后才允许分析使用

S3 级（一般，标准保护）：
  - 能力模型数据（CEFR 分数）
  - 学习进度统计
  处理：标准 RBAC 访问控制

S4 级（公开，无特殊保护）：
  - 生成的阅读文章
  - 语法知识讲解内容
```

### 9.2 用户数据使用规范

```
明确告知用户：
  ① 口语录音的用途：仅用于发音评分，不用于模型训练（除非用户主动同意）
  ② 写作内容的用途：仅用于 AI 批改和用户自己的进度追踪
  ③ 学习行为数据：用于个性化推荐算法，匿名化后用于产品优化

数据保留策略：
  - 口语录音：保留 90 天（供用户回顾），之后自动删除原始音频（保留转写文本）
  - 写作原文：永久保留（用户可随时删除）
  - 学习事件流水：保留 2 年
  - 账户注销后：30 天内完全删除所有个人数据
```

---

## 附录 C：开发里程碑建议

```
Week 1-4：地基建设
  ✦ 数据库 Schema 创建 + 基础 CRUD API
  ✦ 用户注册/登录/UCL 初始化
  ✦ AI 服务封装层（OpenAI + Azure Speech）
  ✦ CQV 校验器基础版本

Week 5-8：核心评测与词汇
  ✦ CAT 测评系统（前端 + 后端 + IRT 算法）
  ✦ SM-2 词汇调度引擎
  ✦ VocabEngine（情景化例句生成）
  ✦ 每日任务包调度器 v1

Week 9-12：阅读 + 语法
  ✦ ReadingEngine（文章生成 + CQV 校验）
  ✦ 阅读界面（词汇弹窗 + 答题 + 反馈）
  ✦ GrammarEngine（讲解 + 练习题）
  ✦ Gate Review 机制

Week 13-18：口语系统
  ✦ WebSocket 口语会话框架
  ✦ Whisper ASR 接入 + 实时转写
  ✦ Azure 发音评估接入
  ✦ SpeakingExaminer Prompt 调优
  ✦ 事后报告生成

Week 19-24：写作系统
  ✦ WritingCritic（逐句精批 Prompt 调优）
  ✦ 批改报告前端渲染（五色批注）
  ✦ 写作进度追踪 + 持久性错误机制
  ✦ BullMQ 异步任务队列（写作批改）

Week 25-28：整合与优化
  ✦ 听力系统（TTS + 题目生成）
  ✦ 四技能联动逻辑
  ✦ 周报生成
  ✦ 能力进度可视化（雷达图 + 趋势曲线）

Week 29-32：质量保证
  ✦ Prompt A/B 测试框架
  ✦ 教学质量监控看板
  ✦ 超纲率 / 拖沓率监控告警
  ✦ 性能压测 + K8s 弹性扩容验证
  ✦ 用户 Beta 测试 + 反馈收集
```

---

## 附录 D：四阶段文档索引

| 文档 | 内容 |
|------|------|
| Phase1_PRD_核心规划.md | 用户画像、痛点分析、功能路线图、教育闭环、防超纲机制 |
| Phase2_核心功能模块深度设计.md | ADLAS测评系统、听说读写四技能详细交互逻辑 |
| Phase3_AI算法中台与Prompt架构设计.md | AI中台架构、UCL注入、7大核心Prompt框架、CQV校验 |
| Phase4_技术架构与落地规划.md | 技术选型、数据库设计、API设计、部署规划 |

---

*第四阶段文档完成。至此，EnglishiApp 全套方案四阶段输出完毕。*

