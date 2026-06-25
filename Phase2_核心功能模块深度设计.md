# EnglishiApp — 第二阶段：核心功能模块深度设计

> 版本：v1.0 | 日期：2026-06-26 | 状态：待确认
> 前置依赖：Phase1_PRD_核心规划.md（v1.1 已确认）

---

## 目录

1. [自适应动态水平评测系统（ADLAS）](#1-自适应动态水平评测系统)
2. [听力（Listening）AI 学习流](#2-听力学习流)
3. [口语（Speaking）AI 学习流 — AI 口语考官与纠音系统](#3-口语学习流)
4. [阅读（Reading）AI 学习流](#4-阅读学习流)
5. [写作（Writing）AI 学习流 — AI 逐句精批系统](#5-写作学习流)
6. [四技能联动调度逻辑](#6-四技能联动调度逻辑)

---

## 1. 自适应动态水平评测系统

### 1.1 系统概述

系统全称：**Adaptive Dynamic Language Assessment System（ADLAS）**

ADLAS 分为两个运行模式：
- **入门评测（Onboarding Mode）**：用户首次使用，8 分钟内完成能力建模
- **持续评测（Continuous Mode）**：伴随每次学习，静默更新能力模型

### 1.2 入门评测详细设计

#### 1.2.1 CAT 算法流程

```
【初始化】
  起始难度：B1（面向大多数非零基础用户的合理中点）
  若用户自报"完全零基础" → 起始难度降至 A1

【题目调度规则】
  答对当前难度题 → 下一题升 0.5 个 CEFR 档（如 B1 → B1.5）
  答错当前难度题 → 下一题降 0.5 个 CEFR 档（如 B1 → A2.5）
  连续答对 3 题   → 升 1 个完整 CEFR 档（跳档加速）
  连续答错 3 题   → 降 1 个完整 CEFR 档（跳档保护）

【收敛条件（满足任一即停止）】
  ① 达到 20 道题
  ② 同一难度档位被来回震荡 ≥ 3 次（定位收敛）
  ③ 达到 A1 下限或 C2 上限

【评分算法（IRT 三参数模型）】
  P(θ) = c + (1-c) × [e^(a(θ-b)) / (1 + e^(a(θ-b)))]
  其中：
    θ = 被测者能力值
    a = 题目区分度（0.5-2.0）
    b = 题目难度（对应 CEFR 档位）
    c = 猜测参数（选择题约 0.2）
  最终 θ 值映射到 CEFR 量表（A1=1.0 至 C2=6.0，精度 0.1）
```

#### 1.2.2 四轨并行题目体系

**词汇轨（Vocabulary Track）— 6 题**

```
题型 1：词义辨析（单选）
  示例（B1 级）：
  The new policy will significantly _____ the company's profits.
  A) affect  B) effect  C) infect  D) defect
  考察点：affect/effect 辨析（高频易混词）

题型 2：语境填空（单选）
  示例（B2 级）：
  Despite the _____ evidence against him, the defendant maintained his innocence.
  A) overwhelming  B) overcoming  C) overlapping  D) overreaching
  考察点：overwhelming（压倒性的）在正式语境中的使用

词汇题难度分布：
  A1（2000词以内基础词）→ C2（学术词汇表 AWL 高频词）
  每道题的正确选项和干扰项均来自同一难度档位，防止通过排除低级词作弊
```

**语法轨（Grammar Track）— 6 题**

```
题型 1：错误识别（找出句中语法错误）
  示例（B2 级）：
  "Neither the manager nor the employees was informed about the change."
  错误：was → were（Neither...nor 就近原则）

题型 2：句子重构（从四个选项中选择语法最正确且最地道的表达）
  示例（C1 级）：
  将 "It is possible that she missed the train." 改写为强调句
  A) It might be that she missed the train.
  B) She could have possibly missed the train.
  C) Not only is it possible, but she missed the train.
  D) What is possible is that she missed the train.

语法点覆盖范围（按 CEFR 分层，共 68 个核心语法点）：
  A1-A2（14点）：基础时态、冠词、基础句型、可数不可数名词...
  B1-B2（24点）：完成时、虚拟语气、被动语态、关系从句...
  C1-C2（30点）：倒装、强调结构、分词独立主格、名词化结构...
```

**阅读轨（Reading Track）— 5 题**

```
每道阅读题包含一篇短文（随难度调整词数）：
  A1-A2：40-80 词，基础叙述文体
  B1-B2：100-180 词，说明/议论混合文体
  C1-C2：200-280 词，学术/批判性文体

题型：
  - 细节理解（What does the author say about X?）
  - 推断题（What can be inferred from paragraph 2?）
  - 词义猜测（The word "X" in paragraph 1 is closest in meaning to...）
  - 主旨归纳（What is the main purpose of this passage?）

关键设计：阅读文章语法结构不超出语法轨当前估算水平 +1 档
（避免语法干扰阅读理解的准确测量）
```

**听力轨（Listening Track）— 3 题**

```
每道听力题为一段音频（TTS 生成，语速严格控制）：
  A1-A2：20-30 秒，单人独白，清晰发音，语速 ≤100 wpm
  B1-B2：30-45 秒，双人对话，正常口音，语速 ≤140 wpm
  C1-C2：45-60 秒，含轻微口音/语速，学术内容，语速 ≤175 wpm

题型：
  - 关键信息抓取（填空：The meeting is at ___ o'clock.）
  - 语义理解（Why does the woman suggest X?）
  - 态度辨别（How does the speaker feel about X?）
```

#### 1.2.3 评测输出报告结构

```json
{
  "assessment_id": "uuid",
  "timestamp": "2026-06-26T10:30:00Z",
  "overall": {
    "cefr_level": "B1.7",
    "ielts_prediction": "5.5-6.0",
    "confidence_interval": 0.3
  },
  "dimensions": {
    "vocabulary": {
      "cefr": "B2.0",
      "estimated_size": 4200,
      "strong": ["日常词汇", "商务词汇"],
      "weak": ["学术词汇", "低频形容词"]
    },
    "grammar": {
      "cefr": "B1.5",
      "mastered_points": ["现在完成时", "被动语态", "关系从句"],
      "not_yet": ["虚拟语气", "倒装句", "强调结构"],
      "error_patterns": ["主谓一致（复杂结构）", "时态一致性"]
    },
    "reading": {
      "cefr": "B2.0",
      "speed_wpm": 195,
      "comprehension_rate": 0.78,
      "weak_skills": ["推断题", "作者态度识别"]
    },
    "listening": {
      "cefr": "B1.0",
      "note": "语速偏快时理解率明显下降",
      "accent_tolerance": "标准英美口音良好，其他口音弱"
    }
  },
  "learning_plan": {
    "recommended_track": "B1_INTENSIVE",
    "priority_weakness": "listening",
    "daily_time_allocation": {
      "vocabulary": "25%",
      "grammar": "15%",
      "reading": "25%",
      "listening": "25%",
      "writing": "10%"
    },
    "estimated_weeks_to_ielts_7": 52,
    "first_milestone": "达到 B2 综合水平（预计 16 周）"
  }
}
```

### 1.3 持续评测（Continuous Mode）

#### 1.3.1 静默能力模型更新

```
触发条件（自动，不通知用户）：
  每完成 1 个学习单元 → 采集该单元的表现数据

数据采集维度：
  ├── 正确率（correct_rate）
  ├── 平均答题时长（avg_response_time）
  ├── 跳过/放弃率（skip_rate）
  ├── 提示使用次数（hint_count）
  └── 重试次数（retry_count）

能力值更新公式：
  performance_score = correct_rate × 0.6
                    + (1 - avg_response_time/time_limit) × 0.2
                    + (1 - hint_count/total_items) × 0.2

  new_ability = old_ability × 0.85 + performance_score × target_level × 0.15
  （0.85 权重防止单次波动影响过大）

晋级触发：
  连续 5 个学习单元 performance_score ≥ 0.85 → 触发「晋级候选」
  → 安排一次显式「晋级检测」（用户可见，告知目的）
  → 通过（≥80%）→ 能力模型正式上调 0.5 CEFR 级

降级触发：
  连续 3 个学习单元 performance_score ≤ 0.50 → 触发「强化复习模式」
  → 不降低能力标记（防止挫败感），但向下补充前置薄弱点的练习
```

#### 1.3.2 Gate Review（关键节点守门）

```
触发时机：每完成 10 个学习单元

Gate Review 题目构成：
  - 10 道题，5 分钟
  - 覆盖最近 10 个单元涉及的核心词汇（4题）
  - 最近 10 个单元涉及的语法点（3题）
  - 综合运用题（阅读理解1题 + 改错1题 + 口语句子重述1题）

通过标准：≥ 7/10 正确

未通过处理：
  → 暂停新内容推送（最多 2 个单元）
  → 系统定位具体未掌握点（非全部重学，精准补弱）
  → 针对性补充 2-3 个强化练习单元
  → 再次 Gate Review（5题简化版）→ 通过即恢复正常进度
```

---

## 2. 听力学习流

### 2.1 听力内容分级体系

```
┌────────┬──────────┬───────────┬─────────────────────────────────────┐
│ CEFR   │ 语速(wpm)│ 时长      │ 内容类型 & 雅思对应                  │
├────────┼──────────┼───────────┼─────────────────────────────────────┤
│ A1     │ ≤ 100    │ 15-30秒   │ 单句指令、数字/日期/时间、问候对话    │
│ A2     │ ≤ 120    │ 30-60秒   │ 简单日常对话（购物/问路/预约）        │
│ B1     │ ≤ 140    │ 60-120秒  │ 双人对话（雅思 Section 1-2 难度）    │
│ B2     │ ≤ 160    │ 2-4分钟   │ 小组讨论/电话/短演讲（Section 3）    │
│ C1     │ ≤ 180    │ 4-6分钟   │ 学术讲座/辩论（Section 4 难度）      │
│ C2     │ 原速     │ 6-10分钟  │ 原版 BBC/TED/学术研讨，含口音变体    │
└────────┴──────────┴───────────┴─────────────────────────────────────┘
```

### 2.2 听力任务界面交互流程

```
【第一步：预听准备（30秒）】
  显示：话题背景简介（1-2句话，当前 CEFR 水平的文字）
  显示：核心词汇预览（将在听力中出现的 i+1 新词，附发音+简短释义）
  ⚠️ 设计原则：预览词汇但不提前给出答案，降低焦虑而非降低难度

【第二步：首听（正常速度）】
  界面：纯净音频播放界面，无字幕，无暂停（模拟真实考试）
  允许操作：音量调节、2倍速（C1+用户可解锁）
  不允许：暂停、回放（首听）

【第三步：答题】
  题型组合（根据 CEFR 级别选择）：
    A1-A2：图片选择（3选1）+ 数字/信息填空
    B1-B2：单选（传统）+ 短句填空（≤3词）+ 配对题
    C1-C2：判断（True/False/Not Given）+ 段落摘要填空 + 说话人态度

【第四步：二听（可暂停/回放）】
  在用户提交答案后或主动请求时
  界面：显示字幕（可切换：仅生词高亮 / 全文字幕 / 无字幕三档）
  允许操作：暂停、回放、0.75倍速

【第五步：即时反馈】
  每道题答错后：
    - 高亮音频中对应句子的字幕
    - 显示"为什么是这个答案"（1-2句核心解析）
    - 收录错误相关词汇到复习队列

【第六步：单元总结（30秒内完成）】
  ├── 本次听力理解率：X%
  ├── 新增词汇：N 个（一键加入词汇本）
  ├── 发现的弱点：如"数字信息抓取准确率低"
  └── 下次推送预告（系统自动调整难度）
```

### 2.3 听力专项弱点追踪

```
系统持续追踪以下 8 个听力子技能的独立表现：
  ① 数字/日期/时间信息抓取
  ② 人名/地名/专有名词识别
  ③ 说话人意图/态度理解
  ④ 关键细节 vs 无关信息筛选
  ⑤ 语速适应性（在不同语速下的理解稳定性）
  ⑥ 口音适应性（标准美音/英音/澳音/非母语口音）
  ⑦ 推断与预测（根据已有信息推断未明说的内容）
  ⑧ Note-taking 效率（C1+ 用户：1分钟内记录关键信息点数）

每个子技能独立评分，当某子技能正确率 < 60% 时：
  → 在下一个学习包中增加该子技能专项练习（权重上浮 20%）
  → 连续 3 次低于 60% → 插入专项强化单元（仅针对该弱点）
```

---

## 3. 口语学习流

> 核心模块：**AI 口语考官（AI Speaking Examiner）** 系统

### 3.1 口语训练渐进路径

```
阶段 0（前置，A1 用户）：音素基础训练
  ↓
阶段 1（A1-A2）：有声跟读 + 单句模仿
  ↓
阶段 2（A2-B1）：引导式回答（给话题 + 给框架）
  ↓
阶段 3（B1-B2）：雅思 Part 1 & Part 2 独立作答
  ↓
阶段 4（B2-C1）：雅思 Part 3 + 自由主题对话
  ↓
阶段 5（C1-C2）：辩论 / 学术口头报告 / 无引导自由表达
```

### 3.2 音素基础训练模块（阶段 0，A1 专属）

```
【音素学习单元设计】
  每个单元聚焦 1-2 个音素（共 44 个英语音素，分 22 个单元）
  
  单元内流程：
    1. 音素发音示范（真人录音 + 口型动画）
       - 展示发音部位（唇形/舌位/气流方向）
    2. 最小音对练习（Minimal Pairs）
       - 示例：/p/ vs /b/ → "pat/bat", "cup/cub", "pin/bin"
       - 用户跟读，AI 识别是否正确区分
    3. 单词级跟读（含该音素的高频词，A1 词汇范围内）
    4. 句子级跟读（含多个该音素的简单句）

【AI 发音评估精度要求（音素级）】
  使用音素级 ASR（自动语音识别）+ 声学模型比对：
    ✓ 正确识别到音素 → 绿色高亮 + "发音准确"
    ✗ 音素发音偏差（如/θ/发成/s/）→ 标注具体偏差 + 口型对比图
    ✗ 音节省略/添加 → 标注位置 + 正确音节数示范
  
  判定维度：
    - 元音高低前后（如 /æ/ vs /e/）
    - 清浊音区分（/p/ vs /b/，/t/ vs /d/）
    - 长短音区分（/iː/ vs /ɪ/）
    - 连读/弱读/重音位置
```

### 3.3 AI 口语考官系统（核心模块）

#### 3.3.1 系统架构

```
用户录音
    ↓
ASR 转写引擎（实时转录，延迟 < 500ms）
    ↓
    ├── 声学分析管道（发音层面）
    │     ├── 音素准确率分析
    │     ├── 语调/重音模式分析
    │     ├── 流利度分析（停顿频率/填充词/语速变化）
    │     └── 连读/弱化处理正确性
    │
    └── 语言分析管道（语言层面）
          ├── 词汇多样性（TTR 类符/型符比）
          ├── 语法准确率（错误检测）
          ├── 语法复杂度（句式多样性）
          ├── 内容相关度（与题目的 embedding 余弦相似度）
          └── 话语逻辑（连接词使用/论点展开完整性）
    ↓
评分引擎（映射到雅思 Band 1-9 四维标准）
    ↓
AI 反馈生成（结构化 + 自然语言）
```

#### 3.3.2 雅思口语四维评分标准实现

```
维度 1：流利度与连贯性（Fluency & Coherence）
  评分信号：
    - 每分钟有意义停顿次数（≤ 2次/分钟 → 良好）
    - 填充词频率（"um/uh/like"，≤ 3次/分钟 → 良好）
    - 话语速度稳定性（语速方差）
    - 连接词恰当使用率（"however/therefore/moreover"等）
    - 话轮长度（Part 2 独白是否维持 1-2 分钟）

维度 2：词汇丰富度（Lexical Resource）
  评分信号：
    - TTR（类符/型符比）：不同词汇数 / 总词汇数
    - 高级词汇使用率（高出当前水平 0.5 档的词汇）
    - 搭配正确性（常见错误搭配检测，如 "make a mistake" vs "do a mistake"）
    - 习语/俗语使用（加分项，但需正确使用）
    - 词汇重复率（同一词在 30 词内重复出现 → 扣分）

维度 3：语法多样性与准确度（Grammatical Range & Accuracy）
  评分信号：
    - 句型多样性评分（仅用简单句 → Band 5，复合句+复杂句 → Band 7+）
    - 语法错误率（严重错误 vs 轻微错误分类统计）
    - 高级语法结构使用（虚拟语气/分词短语/倒装等）

维度 4：发音（Pronunciation）
  评分信号：
    - 音素准确率（特别是目标语言者常犯错的音素）
    - 语调自然度（声调曲线与母语者对比）
    - 重音正确率（词重音 + 句子重音）
    - 语速适宜性（过快或过慢均扣分）
    - 清晰度（intelligibility score）
```

#### 3.3.3 口语反馈报告设计（事后回顾，不打断录音）

```
【设计原则】：录音进行中绝不显示任何反馈（保护流畅性）
              所有反馈在用户提交后的"回顾界面"中呈现

反馈报告结构：

┌─────────────────────────────────────────────────────────────┐
│  🎙️ 口语回顾报告                                             │
├─────────────────────────────────────────────────────────────┤
│  综合评分：Band 6.5                                           │
│  ████████░░  距目标 Band 7.0 还差 0.5                        │
├──────────┬──────────┬──────────┬──────────────────────────-─┤
│ 流利连贯  │ 词汇资源  │ 语法准确  │ 发音                        │
│  6.5     │  7.0     │  6.0     │  6.5                        │
└──────────┴──────────┴──────────┴─────────────────────────────┘

【你说的原话（带标注）】
"I think that, um, the environment is, like, very important for, um,
 our future generation because..."

标注说明：
  🔴 填充词过多：3处 "um" + 1处 "like"（建议：用短暂停顿替代）
  🟡 词汇重复：第2句再次出现 "important"（建议换用 "crucial/vital"）
  🟢 亮点：正确使用了 "future generation"（加分搭配）

【Top 3 改进建议（按优先级排序）】

① 【最高优先级】减少填充词 → 直接影响 Fluency 分
   ❌ 你说：  "...is, um, very important..."
   ✅ 建议：  "...is critically important..." （短暂停顿0.5秒，不说"um"）
   🎯 练习：下一题录音前，提醒自己：停顿≠出错，沉默0.5秒比说"um"好

② 【语法】过去完成时使用错误
   ❌ 你说：  "Before I came here, I already finished my homework."
   ✅ 正确：  "Before I came here, I had already finished my homework."
   📖 原因：before 引导的时间从句，主句动作在从句之前完成 → 用过去完成时

③ 【词汇】高频词替换建议
   ❌ 你用了 "very important" 3次
   ✅ 替换库：crucial / vital / paramount / of great significance / indispensable
   🎯 目标：同一概念在同一段话中不使用相同表达超过1次

【原句改写示范（AI 示范 Band 7.5 版本）】
原话："I think the environment is very important for our future generation."
改写："The environment is undeniably crucial to the well-being of future generations,
      particularly given the accelerating pace of climate change."
改动说明：
  ✦ 去掉 "I think"（直接陈述更有力）
  ✦ "very important" → "undeniably crucial"（更高级的词汇）
  ✦ "our" → "the"（更正式的表达）
  ✦ 增加了 "particularly given..."（展开论点，提升 CC 分）
```

### 3.4 雅思各 Part 的 AI 考官交互逻辑

#### Part 1（个人问答）

```
AI 考官行为：
  - 从题库（按 CEFR 分级）随机选取 3-5 个 Part 1 话题问题
  - 每个问题给用户 15 秒准备时间
  - 用户回答后：AI 不评论，直接问下一个问题（模拟真实考官）
  - 全部问题结束后，输出完整评分报告

题目分级示例：
  B1 级：What do you do in your free time?（常见话题，简单词汇足够）
  B2 级：How has technology changed the way people socialize?（需要抽象表达）
  C1 级：To what extent do you think individual choices can impact
         global environmental issues?（需要论证和举例）
```

#### Part 2（独白卡片）

```
AI 考官行为：
  1. 呈现话题卡（含4个提示要点）
  2. 给用户 60 秒准备时间（可记笔记）
  3. 计时器开始，用户独白 1-2 分钟
  4. 计时结束时给出提示音（不强制打断，允许用户自然结束）
  5. AI 提 1-2 个 Rounding-off 问题（对独白内容的追问）

话题卡级别控制：
  B1 话题：Describe a place you like to visit.（具体，熟悉话题）
  B2 话题：Describe a skill you would like to learn.（需要推理）
  C1 话题：Describe a time when you had to make a difficult decision.
           （需要深入反思和复杂叙述）
```

#### Part 3（深度讨论）

```
AI 考官行为：
  - 基于 Part 2 话题延伸出 3-5 个抽象讨论问题
  - 针对用户回答进行追问（不是固定问题，而是动态生成的 Follow-up）
  - 若用户回答过于简短（<20 词）→ AI 追问："Could you elaborate on that?"
  - 若用户观点不够深入 → AI 提出反方观点："But some people argue that..."

动态追问生成逻辑：
  ├── 用户表达了观点A → AI 问："What evidence supports this view?"
  ├── 用户只举了个人例子 → AI 问："Do you think this applies globally?"
  ├── 用户表达矛盾观点 → AI 问："You mentioned X and Y—how do you reconcile these?"
  └── 用户使用了新词汇但可能误用 → AI 在追问中正确使用该词作为反馈
```

---

## 4. 阅读学习流

### 4.1 AI 定制阅读文章生成规范

#### 4.1.1 文章生成参数控制

```
输入参数：
  user_cefr_level: "B1.5"
  interest_tag: "科技/人工智能"
  target_new_word_rate: 0.06  # 6% 生词率（i+1 最优区间）
  target_grammar_max: "B2"    # 语法上限（比词汇稍高，鼓励语法感知）
  article_length: 380          # 词数（B1.5 对应范围 300-450）
  question_types: ["detail", "inference", "vocabulary_in_context"]

输出验证（生成后自动扫描）：
  ✓ 词汇范围检查：扫描所有词汇，超出 B2.5 词汇表的词 → 替换
  ✓ 语法结构检查：扫描复杂从句层级，超过 B2 上限 → 简化
  ✓ 生词率校验：实际生词率在 [4%, 8%] 范围内 → 通过；否则重新生成
  ✓ 重复内容检查：与用户历史文章 embedding 相似度 < 0.80 → 通过
```

#### 4.1.2 文章结构与生词处理

```
【阅读界面设计】

段落文本展示：
  - 已知词：正常黑色显示
  - i+1 生词：浅蓝色下划线（5-8% 比例）
  - 超出 i+1 的偶发词（如专有名词）：灰色斜体（可点击查看释义，
    但不进入复习队列，因超出学习范围）

点击生词后展示（Vocabulary Popup）：
  ┌─────────────────────────────────┐
  │ inevitable [ɪˈnevɪtəbl]  adj.  │
  │ 不可避免的                       │
  │ ─────────────────────────────── │
  │ 例句（当前 CEFR 水平）：           │
  │ "Change is inevitable in a      │
  │  growing company."              │
  │ ─────────────────────────────── │
  │ 词根提示：in-(not) + evit(avoid)│
  │ 相关词：inevitably (adv.)        │
  │ [加入词汇本 +]  [跳过]           │
  └─────────────────────────────────┘
```

### 4.2 雅思阅读题型训练体系

```
题型覆盖（按难度递进引入）：

B1 阶段引入：
  ① True / False / Not Given（判断题）
     → 训练精确定位原文细节，区分"文中明确说" vs "文中未提及"
  ② Multiple Choice（单选）
     → 基础理解，找主旨/细节

B2 阶段引入：
  ③ Matching Headings（段落配标题）
     → 训练段落主题句提炼
  ④ Sentence Completion（句子填空，≤3词）
     → 训练同义替换识别
  ⑤ Matching Information（信息配对）
     → 训练跨段落定位

C1 阶段引入：
  ⑥ Summary Completion（摘要填空）
     → 训练大意提炼 + 同义替换
  ⑦ Matching Features（观点/人物配对）
     → 训练多信息源梳理
  ⑧ Yes / No / Not Given（观点判断）
     → 训练区分 "作者立场" vs "客观事实"
```

### 4.3 阅读速度追踪与提升

```
阅读速度记录：
  每篇文章：记录用户从开始到提交答题的时长
  计算：words / minutes = wpm

CEFR 阅读速度基准：
  A2: 100-130 wpm  B1: 150-180 wpm  B2: 190-230 wpm
  C1: 240-280 wpm  C2: 280+ wpm（雅思考试实际需要 ≥250 wpm）

慢于基准 20% 以上时：
  → 在反馈中提示："阅读速度略慢，当前 X wpm，目标 Y wpm"
  → 推送「计时阅读」专项练习（限时阅读短文，无题目，只问大意）
  → 不强迫，而是通过练习自然提升

快于基准 20% 以上且正确率 > 85% 时：
  → 提示可以尝试更长/更复杂的文章
  → 系统记录并上调阅读难度档
```

---

## 5. 写作学习流

> 核心模块：**AI 逐句精批系统（Sentence-Level Annotation Engine）**

### 5.1 写作任务分级设计

```
级别    任务类型                         字数要求    核心训练目标
─────────────────────────────────────────────────────────────────
A1-A2  连词成句 → 短段落仿写（给模板）   30-60词    正确词序/基础标点
B1     描述性段落 / 非正式邮件            80-120词   段落结构/时态一致
B2     雅思 Task 1 图表描述              150+词     数据解读/客观表达
B2+    雅思 Task 2 基础议论文            250词      论点/论据/举例结构
C1     雅思 Task 2 高质量议论文          ≥250词     逻辑深度/高级词汇
C2     学术 Essay / 批判性分析文章       400-600词  学术风格/引用规范
```

### 5.2 AI 逐句精批系统（核心设计）

#### 5.2.1 批改流程

```
用户提交作文
    ↓
Step 1：结构分析（段落级）
  - 识别引言/主体段/结论
  - 检查段落主题句是否存在
  - 检查段落内部逻辑链是否完整

Step 2：逐句分析（句子级）
  对每一句运行以下分析：
    ├── 语法错误检测（GRA 维度）
    ├── 词汇使用检测（LR 维度）
    ├── 句内逻辑连贯性（CC 维度）
    └── 与题目要求相关度（TR 维度）

Step 3：四维评分（映射雅思 Band Score）
  - TR：任务完成度（是否完整回应题目的每个要点）
  - CC：连贯与衔接（段落结构/连接词/指代关系）
  - LR：词汇丰富度（TTR/高级词汇/搭配正确性）
  - GRA：语法多样性与准确度（错误率/句型多样性）

Step 4：生成批改报告（见下方详细设计）
```

#### 5.2.2 批改报告界面设计

```
【界面布局】
  左侧：用户原文（带彩色批注）
  右侧：批改面板（可滑动查看）

【彩色批注系统（原文左侧）】
  🔴 红色下划线：语法错误（GRA）
  🟡 黄色下划线：用词不当/可以提升（LR）
  🔵 蓝色下划线：逻辑/衔接问题（CC）
  🟠 橙色下划线：与题目偏离（TR）
  🟢 绿色高亮：亮点（值得保留和学习的好表达）

【示例批改（Task 2 作文片段）】

用户原文：
  "Many people think that technology is bad for children.
   I agree with this view. Because it make children lazy.
   Also, children spend too much time on phone."

批注后显示：
  "Many people think that technology is bad [🟡 建议: harmful/detrimental] 
   for children. I agree with this view. [🔵 建议: 加强过渡, 参见右侧]
   Because [🔴 因为: "Because" 不能独立成句] it make [🔴 主谓不一致: makes] 
   children lazy. Also [🔵 连接词重复，可替换], children spend too much time 
   on [🟡 介词: on their phones / on phone → on their phones] phone [🔴 复数: phones]."

【右侧批改面板 - 逐条展开】

▼ 句子 1 分析
  原句："I agree with this view. Because it make children lazy."
  
  🔴 语法错误 × 2
    错误①：独立从句以 "Because" 开头（中式英语习惯）
      修改：将两句合并
      ✅ 改为："I agree with this view because it makes children lazy."
    
    错误②：主谓一致 "it make" → "it makes"
      原因：第三人称单数主语 + 一般现在时 → 动词加 -s
  
  🟡 词汇提升建议
    "bad for" → 更学术的表达：
      • "detrimental to children's development"
      • "harmful to young people's cognitive growth"
      • "have an adverse effect on children"
  
  ✅ 改后版本：
    "I agree with this view, as excessive technology use is 
     detrimental to children's development by fostering laziness."

▼ 综合评分
  ┌──────────────────────────────────────────────────────────┐
  │  TR（任务回应）  ████████░░  6.5  回应了题目，但论证浅薄   │
  │  CC（连贯衔接）  ██████░░░░  5.5  连接词单一，段落跳跃      │
  │  LR（词汇资源）  ██████░░░░  5.5  词汇重复，缺乏高级表达    │
  │  GRA（语法）     ███████░░░  6.0  多处基础语法错误           │
  │  ─────────────────────────────────────────────────────── │
  │  预测 Band Score：5.8  (目标：7.0)                         │
  └──────────────────────────────────────────────────────────┘

▼ 本次最高优先级改进（只给 1 个，防止认知过载）
  🎯 本次专注：消灭独立从句问题（"Because/So/And" 不能单独成句）
  这个错误出现了 3 次，修复后预计 CC 分至少提升 0.5 Band
  → [查看专项练习：连词成句综合训练]（5分钟，直接解决这个问题）

▼ AI 改写参考（Band 7.5 版本）
  "Many commentators argue that technological advancements are 
   detrimental to children's well-being. I concur with this 
   perspective, primarily because excessive screen time discourages 
   physical activity and impedes the development of crucial social 
   skills. Furthermore, the pervasive nature of smartphones means 
   that children are increasingly susceptible to digital distractions, 
   which can significantly undermine their academic performance."
  
  改动说明：
  ✦ 开头避免 "I agree"（过于直白）→ "I concur with this perspective"
  ✦ "bad" → "detrimental to"（更精确的学术词汇）
  ✦ "make children lazy" → 拆分为两个具体后果（提升 TR 分）
  ✦ 增加 "Furthermore" 连接段落（提升 CC 分）
  ✦ 使用复合句 "which can significantly undermine"（提升 GRA 分）
```

### 5.3 写作进步追踪系统

```
每篇作文批改后记录：
  ├── 四维各自 Band Score
  ├── 本篇新出现的语法错误类型
  ├── 本篇使用的高级词汇（是否高于用户词汇水平）
  └── 与上一篇同类任务的对比分

进步可视化（写作成长曲线）：
  - 折线图：每次提交的预测 Band Score 变化
  - 雷达图：四维能力随时间变化的对比（显示最近 5 篇 vs 最初 5 篇）
  - 高频错误排行：显示最近 10 篇中重复出现最多的错误类型
    （确保批改反馈不是每次都重新发现同样的错误，而是有记忆的递进）

高频错误"消灭机制"：
  若同一语法错误类型连续出现 ≥ 3 篇 →
    ① 在下一次写作任务前，弹出提醒："你在过去3篇文章中都出现了X错误"
    ② 推送该语法点的专项练习（5分钟，10道题）
    ③ 下一篇写作批改时，优先检查该错误是否消除
```

---

## 6. 四技能联动调度逻辑

### 6.1 每日学习包动态生成算法

```python
# 伪代码表示逻辑，非实际代码
def generate_daily_pack(user_profile, available_minutes):
    
    # 1. 确定今日基础难度（防超纲保障）
    today_level = user_profile.current_cefr  # 不允许内容超过 current_cefr + 1档
    
    # 2. 计算各技能权重（基于弱点分析）
    weights = calculate_skill_weights(user_profile)
    # 默认权重：Reading 30%, Listening 25%, Vocabulary 20%, Speaking 15%, Writing 10%
    # 若某技能为最弱项 → 该技能权重上浮 10%，其他等比下调
    
    # 3. 计算各技能时间分配
    skill_minutes = {
        skill: available_minutes * weight 
        for skill, weight in weights.items()
    }
    # 确保每个技能至少 5 分钟（保底），最多 30 分钟（防疲劳）
    
    # 4. 生成具体任务
    tasks = []
    
    # 词汇复习（SM-2 调度）
    due_words = get_due_vocabulary(user_profile.vocabulary_deck)
    new_words = get_new_words(today_level, user_profile.interest_tags, count=5)
    tasks.append(VocabTask(review=due_words[:15], new=new_words))
    
    # 语法专项（检测到的弱点优先）
    grammar_point = get_priority_grammar_point(user_profile.grammar_weak_areas)
    tasks.append(GrammarTask(point=grammar_point, exercises=8))
    
    # 阅读（i+1 文章）
    article = generate_article(
        level=today_level, 
        interest=user_profile.current_interest_tag,
        new_word_rate=0.06
    )
    tasks.append(ReadingTask(article=article))
    
    # 听力（分级音频）
    audio = get_audio(level=today_level, sub_skill=user_profile.listening_weak_subskill)
    tasks.append(ListeningTask(audio=audio))
    
    # 口语（隔日）或写作（隔日）
    if is_speaking_day(user_profile):
        tasks.append(SpeakingTask(part=get_appropriate_part(today_level)))
    else:
        tasks.append(WritingTask(type=get_writing_type(today_level), 
                                  topic_from_today_reading=article.topic))
        # 注意：写作话题刻意取自今日阅读话题，强化读写联动
    
    return DailyPack(tasks=tasks, total_minutes=sum(t.minutes for t in tasks))
```

### 6.2 技能联动强化设计

```
联动 1：阅读 → 写作 输入转输出
  今日阅读文章话题 = 今日写作任务话题
  目的：降低写作认知负担（话题词汇刚刚在阅读中出现过），专注写作本身

联动 2：听力 → 词汇 即时入库
  听力中出现的生词自动标记 → 在当日词汇任务中出现（听觉+视觉双编码）

联动 3：语法学习 → 口语/写作 即时应用
  某语法点在语法任务中学完 → 当日写作/口语任务中要求使用该语法点
  AI 批改时特别检测该语法点的使用情况 → 形成学以致用的验证闭环

联动 4：口语表达 → 写作素材
  口语 Part 3 讨论的观点 → 下一次写作任务可以选择相关话题
  用户在口语中说出的好表达 → AI 提示："你刚才说的 X 是很好的表达，
  在接下来的写作任务中可以试着用书面形式表达同样的意思。"
```

### 6.3 学习状态监控与干预

```
异常状态识别：

① 连续 3 天回避某一技能（跳过口语/写作任务）
   干预：系统提示"你已经 3 天没有练习口语了，口语是你的薄弱项之一"
   + 提供一个极短版口语任务（仅需 2 分钟），降低行动门槛

② 某技能准确率突然大幅下降（单日 < 50%，且历史均值 > 75%）
   干预：自动在次日任务包中减少该技能任务量（防止挫败感叠加）
   + 降低 0.3 个 CEFR 档的难度（保护信心）

③ 用户连续 7 天学习时长远低于承诺时间（< 40%）
   干预：任务包精简为"极简模式"（仅 10 分钟核心任务）
   + 调整每日学习时间承诺设置（降低预期，防止放弃）

④ 用户写作/口语任务放弃率 > 50%
   干预：检查任务难度是否超标 → 临时下调 0.5 档
   + 在该技能加入更多输入练习（降低输出焦虑）
```

---

## 附录 A：各模块教学质量检查清单

> 开发阶段每个功能模块上线前必须通过以下检查

### A.1 内容生成模块检查清单

```
□ 生词率在 [4%, 8%] 范围内（词汇 i+1 控制）
□ 文章中无超出当前用户水平 +1 档的语法结构
□ 文章与用户过去 7 天内学习材料 embedding 相似度 < 0.80
□ 听力音频语速符合 CEFR 级别对应标准
□ 口语题目话题与用户当前 CEFR 匹配（不过难/不过易）
□ 写作任务字数要求与当前 CEFR 级别对应
```

### A.2 评分反馈模块检查清单

```
□ 口语评分四维分数有独立计算逻辑，不笼统给综合分
□ 写作批改落到具体句子，不出现"总体来说词汇有待提升"等泛泛评语
□ 每次反馈最高优先级改进只有 1 个（防认知过载）
□ 所有改进建议必须包含"错误示例 + 正确示例 + 原因解释"三要素
□ 给出的改写范本难度不超出用户当前水平 +1.5 档
□ 正向反馈（亮点）与改进建议之间比例不低于 1:3
```

### A.3 进度推进模块检查清单

```
□ Gate Review 通过率 < 75% 时，系统不再推送新知识点
□ 词汇晋级需同时满足：选择题正确率 ≥ 90% + 语境使用正确 ≥ 2次
□ 语法点晋级需同时满足：练习正确率 ≥ 85% + 口语/写作中实际使用
□ CEFR 整体晋级需要四技能全部达标，不允许短板带动整体晋级
□ 同类型任务连续数量不超过 3 个（防疲劳）
□ 每日任务总时长建议不超过 90 分钟（超出提示但不限制）
```

---

*第二阶段文档完成。待确认后进入第三阶段：AI 算法中台与 Prompt 架构设计。*

