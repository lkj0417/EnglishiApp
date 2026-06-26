/**
 * AI Service Workers —— 全部 BullMQ Worker 的唯一定义处。
 *
 * 由 server.ts 通过 registerWorkers() 引入并启动，确保「本地 dev」与
 * 「Docker 容器」运行的是同一套完整 Worker（阅读 / 写作 / 口语 / 语法 / 听力），
 * 不再出现 server.ts 与 workers.ts 重复注册、Docker 缺失 Worker 的问题。
 */
import { Worker } from 'bullmq';
import {
  getDb, generatedContent, writingTasks, speakingSessions,
  userAbilityModels, users, learningEvents, updateAbilityAfterEvent,
} from '@englishi/database';
import { eq } from 'drizzle-orm';
import { ieltsBandToCefr } from '@englishi/cefr-utils';
import { generateReadingArticle } from './engines/reading.engine.js';
import { critiqueWriting } from './engines/writing.engine.js';
import { generateSpeakingReport } from './engines/speaking.engine.js';
import { callLLM } from './lib/openai-client.js';
import type { UserCapabilityLevel } from '@englishi/shared-types';

// ─────────────────────────────────────────────
// 将数据库能力模型行 / 快照对象转换为标准 UCL
// ─────────────────────────────────────────────
export function snapshotToUCL(userId: string, snapshot: any): UserCapabilityLevel {
  return {
    userId,
    overallCefr: parseFloat(snapshot.overallCefr ?? snapshot.overall_cefr ?? '3.0'),
    dimensions: {
      vocabulary: parseFloat(snapshot.vocabularyCefr ?? snapshot.vocabulary_cefr ?? '3.0'),
      grammar:    parseFloat(snapshot.grammarCefr ?? snapshot.grammar_cefr ?? '3.0'),
      reading:    parseFloat(snapshot.readingCefr ?? snapshot.reading_cefr ?? '3.0'),
      listening:  parseFloat(snapshot.listeningCefr ?? snapshot.listening_cefr ?? '3.0'),
      speaking:   parseFloat(snapshot.speakingCefr ?? snapshot.speaking_cefr ?? '3.0'),
      writing:    parseFloat(snapshot.writingCefr ?? snapshot.writing_cefr ?? '3.0'),
    },
    estimatedVocabSize: snapshot.estimatedVocabSize ?? snapshot.estimated_vocab_size ?? 2000,
    ieltsPrediction: parseFloat(snapshot.ieltsPrediction ?? snapshot.ielts_prediction ?? '5.0'),
    masteredGrammar: snapshot.masteredGrammar ?? snapshot.mastered_grammar ?? [],
    notYetGrammar: [],
    weakAreas: snapshot.weakAreas ?? snapshot.weak_areas ?? {},
    errorPatterns: snapshot.errorPatterns ?? snapshot.error_patterns ?? [],
    confidenceInterval: 0.3,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 创建并启动全部 Worker，返回 Worker 数组（便于优雅关闭）。
 * connection 用 any 以兼容工作区内多版本 ioredis 的类型差异（与 server.ts 一致）。
 */
export function registerWorkers(connection: any): Worker[] {
  // ── Worker 1：阅读文章生成 ──────────────────
  const readingWorker = new Worker('reading-generate', async (job) => {
    const { userId, topic, abilitySnapshot } = job.data;
    const db = getDb();

    const [userProfile] = await db.select({ primaryInterest: users.primaryInterest, interestTags: users.interestTags })
      .from(users).where(eq(users.id, userId)).limit(1);
    const interestDomain = userProfile?.primaryInterest
      ?? (userProfile?.interestTags as string[] | null)?.[0]
      ?? 'general knowledge';

    const ucl = snapshotToUCL(userId, abilitySnapshot);
    const article = await generateReadingArticle({ ucl, interestDomain, topic });

    const [saved] = await db.insert(generatedContent).values({
      contentType: 'reading_article',
      cefrLevel: ucl.overallCefr.toString(),
      interestDomain,
      contentJson: article as unknown as Record<string, unknown>,
      cqvPassed: true,
      cqvCheckedAt: new Date(),
      useCount: 0,
    }).returning();

    return { ...article, id: saved!.id };
  }, { connection, concurrency: 3 });

  // ── Worker 2：写作批改 ──────────────────────
  const writingWorker = new Worker('writing-critique', async (job) => {
    const { submissionId, userId, taskType, taskPrompt, submissionText } = job.data;
    const db = getDb();

    const [ability] = await db.select().from(userAbilityModels).where(eq(userAbilityModels.userId, userId)).limit(1);
    if (!ability) throw new Error('No ability model found');

    const ucl = snapshotToUCL(userId, ability);
    const startTime = Date.now();
    const report = await critiqueWriting({ ucl, taskType, taskPrompt, submissionText });

    await db.update(writingTasks).set({
      status: 'completed',
      bandScores: report.overall as unknown as Record<string, unknown>,
      critiqueReport: report as unknown as Record<string, unknown>,
      processingDurationMs: Date.now() - startTime,
      critiqueCompletedAt: new Date(),
    }).where(eq(writingTasks.id, submissionId));

    // 用预测 Band 静默更新写作维度能力 + 记录学习事件
    const band = Number(report.overall?.overall) || ucl.ieltsPrediction;
    await updateAbilityAfterEvent(db, {
      userId, skill: 'writing', performanceScore: 1.0, contentCefr: ieltsBandToCefr(band),
    }).catch(() => null);
    await db.insert(learningEvents).values({
      userId, sessionId: crypto.randomUUID(),
      skill: 'writing', taskType: 'writing_task', taskId: submissionId,
      performanceScore: Math.min(1, band / 9).toFixed(3),
      aiBandScore: band.toFixed(1),
      timeSpentSec: 0, hintUsedCount: 0, skipped: false, errorsMade: [],
    }).catch(() => {});

    return { submissionId, overall: report.overall };
  }, { connection, concurrency: 2 });

  // ── Worker 3：口语报告生成 ──────────────────
  const speakingWorker = new Worker('speaking-report', async (job) => {
    const { sessionId, userId, transcript, acousticData, sessionType } = job.data;
    const db = getDb();

    const [ability] = await db.select().from(userAbilityModels).where(eq(userAbilityModels.userId, userId)).limit(1);
    if (!ability) throw new Error('No ability model found');

    const ucl = snapshotToUCL(userId, ability);
    const report = await generateSpeakingReport({
      ucl,
      transcript: transcript ?? [],
      acousticData: acousticData ?? { fillerWordCount: 0, fillerWordsFound: [], avgSpeechRateWpm: 130, pauseFrequencyPerMinute: 2 },
      sessionType: sessionType ?? 'Part1',
    });

    await db.update(speakingSessions).set({
      status: 'completed',
      bandScores: report.dimensionScores as unknown as Record<string, unknown>,
      feedbackReport: report as unknown as Record<string, unknown>,
      completedAt: new Date(),
    }).where(eq(speakingSessions.id, sessionId));

    const band = Number(report.overallBand) || ucl.ieltsPrediction;
    await updateAbilityAfterEvent(db, {
      userId, skill: 'speaking', performanceScore: 1.0, contentCefr: ieltsBandToCefr(band),
    }).catch(() => null);
    await db.insert(learningEvents).values({
      userId, sessionId: crypto.randomUUID(),
      skill: 'speaking', taskType: 'speaking_session', taskId: sessionId,
      performanceScore: Math.min(1, band / 9).toFixed(3),
      aiBandScore: band.toFixed(1),
      timeSpentSec: 0, hintUsedCount: 0, skipped: false, errorsMade: [],
    }).catch(() => {});

    return { sessionId, overallBand: report.overallBand };
  }, { connection, concurrency: 2 });

  // ── Worker 4：语法讲解生成 ──────────────────
  const grammarWorker = new Worker('grammar-lesson', async (job) => {
    const { grammarPoint, userId } = job.data;
    const db = getDb();

    const [ability] = await db.select().from(userAbilityModels).where(eq(userAbilityModels.userId, userId)).limit(1);
    const grammarCefr = parseFloat(ability?.grammarCefr ?? '3.0');

    const lesson = await callLLM<any>({
      tier: 'fast',
      messages: [{
        role: 'user',
        content: `Generate an EFL grammar lesson for the grammar point "${grammarPoint}" at CEFR level ${grammarCefr.toFixed(1)}.

      Output JSON only:
      {
        "grammar_point": "string",
        "one_line_rule": "string (max 20 words, plain English)",
        "inductive_examples": [
          {"context": "string", "correct": "string", "incorrect": "string", "difference_highlight": "string"}
        ],
        "when_to_use": ["string"],
        "when_not_to_use": ["string"],
        "chinese_learner_pitfall": "string",
        "quick_reference": "string",
        "exercises": [
          {"id": 1, "type": "string", "instruction": "string", "question": "string", "options": ["string"], "correct_answer": "string", "explanation": "string"}
        ]
      }`,
      }],
      temperature: 0.5,
      taskLabel: 'GrammarLesson',
    });

    await db.insert(generatedContent).values({
      contentType: 'grammar_lesson',
      cefrLevel: grammarCefr.toString(),
      grammarPoint,
      contentJson: lesson as unknown as Record<string, unknown>,
      cqvPassed: true,
      cqvCheckedAt: new Date(),
    }).onConflictDoNothing();

    return lesson;
  }, { connection, concurrency: 5 });

  // ── Worker 5：听力材料生成 ──────────────────
  const listeningWorker = new Worker('listening-generate', async (job) => {
    const { userId, topic, subSkill, abilitySnapshot } = job.data;
    const db = getDb();

    const ucl = snapshotToUCL(userId, abilitySnapshot);
    const listeningCefr = ucl.dimensions.listening.toFixed(1);
    const speechRateWpm = ucl.dimensions.listening < 3 ? 90
      : ucl.dimensions.listening < 4 ? 120
      : ucl.dimensions.listening < 5 ? 150
      : 170;

    const lesson = await callLLM<any>({
      tier: 'fast',
      messages: [{
        role: 'user',
        content: `Generate an IELTS-style listening exercise for an EFL learner at CEFR ${listeningCefr}.

Topic: ${topic ?? 'everyday life'}
Sub-skill focus: ${subSkill ?? 'detail_comprehension'}
Speech rate target: ~${speechRateWpm} wpm (embed [PAUSE:1s] markers in script)
Accent: neutral British or American

Sub-skill types: detail_comprehension | number_extraction | attitude_opinion | topic_change | inference

Output JSON only:
{
  "title": "string",
  "cefr_level": "string",
  "speech_rate_wpm": "integer",
  "duration_seconds": "integer",
  "sub_skill": "string",
  "transcript": "string (full spoken text with [PAUSE:Xs] markers)",
  "tts_params": {"voice": "string", "rate": "string (0.8-1.2)"},
  "questions": [
    {
      "id": "integer",
      "sub_skill": "string",
      "question": "string",
      "type": "string (multiple_choice|short_answer|fill_blank)",
      "options": ["string"] ,
      "correct_answer": "string",
      "explanation": "string (max 30 words)"
    }
  ],
  "vocab_focus": [{"word": "string", "definition_zh": "string", "phonetic": "string"}]
}`,
      }],
      temperature: 0.7,
      taskLabel: 'ListeningEngine',
      userId,
    });

    const [saved] = await db.insert(generatedContent).values({
      contentType: 'listening_audio',
      cefrLevel: ucl.dimensions.listening.toString(),
      interestDomain: topic ?? 'general',
      contentJson: lesson as unknown as Record<string, unknown>,
      cqvPassed: true,
      cqvCheckedAt: new Date(),
      useCount: 0,
    }).returning();

    return { ...lesson, id: saved!.id };
  }, { connection, concurrency: 3 });

  const workers = [readingWorker, writingWorker, speakingWorker, grammarWorker, listeningWorker];

  workers.forEach(w => {
    w.on('failed', (job, err) => console.error(`[Worker] job ${job?.id} failed:`, err.message));
    w.on('completed', job => console.log(`[Worker] job ${job.id} completed`));
  });

  console.log('✅ AI Service Workers started: reading, writing, speaking, grammar, listening');
  return workers;
}

