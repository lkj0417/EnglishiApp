import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import { getDb, generatedContent, writingTasks, speakingSessions, userAbilityModels } from '@englishi/database';
import { eq } from 'drizzle-orm';
import { generateReadingArticle } from './engines/reading.engine.js';
import { critiqueWriting } from './engines/writing.engine.js';
import { generateSpeakingReport, generatePart3FollowUp } from './engines/speaking.engine.js';
import { callLLM } from './lib/openai-client.js';
import type { UserCapabilityLevel } from '@englishi/shared-types';

const PORT = parseInt(process.env['PORT'] ?? '3002', 10);

const redisConnection = new Redis(
  process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  { maxRetriesPerRequest: null },
) as any;

// ─────────────────────────────────────────────
// BullMQ Workers
// ─────────────────────────────────────────────

const readingWorker = new Worker('reading-generate', async (job) => {
  const { userId, topic, abilitySnapshot } = job.data;
  const db = getDb();

  const ucl = snapshotToUCL(userId, abilitySnapshot);
  const article = await generateReadingArticle({ ucl, interestDomain: 'technology', topic });

  const [saved] = await db.insert(generatedContent).values({
    contentType: 'reading_article',
    cefrLevel: ucl.overallCefr.toString(),
    interestDomain: 'technology',
    contentJson: article as unknown as Record<string, unknown>,
    cqvPassed: true,
    cqvCheckedAt: new Date(),
    useCount: 0,
  }).returning();

  return { ...article, id: saved!.id };
}, { connection: redisConnection, concurrency: 3 });

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

  return { submissionId, overall: report.overall };
}, { connection: redisConnection, concurrency: 2 });

const speakingWorker = new Worker('speaking-report', async (job) => {
  const { sessionId, userId, transcript, acousticData } = job.data;
  const db = getDb();

  const [ability] = await db.select().from(userAbilityModels).where(eq(userAbilityModels.userId, userId)).limit(1);
  if (!ability) throw new Error('No ability model found');

  const ucl = snapshotToUCL(userId, ability);
  const report = await generateSpeakingReport({
    ucl,
    transcript: transcript ?? [],
    acousticData: acousticData ?? { fillerWordCount: 0, fillerWordsFound: [], avgSpeechRateWpm: 130, pauseFrequencyPerMinute: 2 },
    sessionType: 'Part1',
  });

  await db.update(speakingSessions).set({
    status: 'completed',
    bandScores: report.dimensionScores as unknown as Record<string, unknown>,
    feedbackReport: report as unknown as Record<string, unknown>,
    completedAt: new Date(),
  }).where(eq(speakingSessions.id, sessionId));

  return { sessionId, overallBand: report.overallBand };
}, { connection: redisConnection, concurrency: 2 });

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

  // 缓存生成的语法讲解
  await db.insert(generatedContent).values({
    contentType: 'grammar_lesson',
    cefrLevel: grammarCefr.toString(),
    grammarPoint,
    contentJson: lesson as unknown as Record<string, unknown>,
    cqvPassed: true,
    cqvCheckedAt: new Date(),
  }).onConflictDoNothing();

  return lesson;
}, { connection: redisConnection, concurrency: 5 });

// 错误处理
[readingWorker, writingWorker, speakingWorker, grammarWorker].forEach(w => {
  w.on('failed', (job, err) => console.error(`Worker job ${job?.id} failed:`, err.message));
  w.on('completed', job => console.log(`Worker job ${job.id} completed`));
});

// ─────────────────────────────────────────────
// HTTP API（内部服务，供 core-service 调用）
// ─────────────────────────────────────────────
async function buildAIServer() {
  const app = Fastify({ logger: { level: 'info' } });
  await app.register(fastifyCors, { origin: true });

  app.get('/health', async () => ({
    status: 'ok',
    workers: { reading: 'active', writing: 'active', speaking: 'active', grammar: 'active' },
  }));

  // 词汇解析（同步，快速）
  app.post('/vocab/explain', async (req, reply) => {
    const { word, wordCefr, learnerCefr, interestDomain } = req.body as any;

    const result = await callLLM<any>({
      tier: 'fast',
      messages: [{
        role: 'user',
        content: `Explain the English word "${word}" (CEFR ${wordCefr}) for an EFL learner at CEFR ${learnerCefr}.
        Interest domain: ${interestDomain ?? 'general'}.
        Context vocab ceiling: CEFR ${(learnerCefr - 0.5).toFixed(1)} (all example sentence words must be below this).
        
        Output JSON only:
        {
          "word": "string",
          "phonetic": "string (IPA)",
          "cefr_level": "string",
          "part_of_speech": "string",
          "definition_en": "string (max 12 words, simple English)",
          "definition_zh": "string",
          "example_sentences": [
            {"sentence": "string", "domain": "string", "context_clues": "string"},
            {"sentence": "string", "domain": "string", "context_clues": "string"}
          ],
          "word_family": {"noun": "string|null", "verb": "string|null", "adjective": "string|null", "adverb": "string|null"},
          "common_collocations": ["string"],
          "common_errors": [{"error": "string", "correction": "string"}],
          "memory_aid": "string|null"
        }`,
      }],
      temperature: 0.6,
      taskLabel: 'VocabExplain',
    });

    return reply.send({ success: true, data: result });
  });

  // Part 3 动态追问（同步，实时性要求高）
  app.post('/speaking/follow-up', async (req, reply) => {
    const { originalQuestion, candidateResponse, speakingCefr } = req.body as any;
    const result = await generatePart3FollowUp({ originalQuestion, candidateResponse, speakingCefr });
    return reply.send({ success: true, data: result });
  });

  return app;
}

async function start() {
  const app = await buildAIServer();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`✅ EnglishiApp AI Service running on port ${PORT}`);
  console.log('Workers: reading, writing, speaking, grammar — all active');
}

start().catch(err => {
  console.error('AI Service failed to start:', err);
  process.exit(1);
});

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────
function snapshotToUCL(userId: string, snapshot: any): UserCapabilityLevel {
  return {
    userId,
    overallCefr: parseFloat(snapshot.overallCefr ?? snapshot.overall_cefr ?? '3.0'),
    dimensions: {
      vocabulary: parseFloat(snapshot.vocabularyCefr ?? snapshot.vocabulary_cefr ?? '3.0'),
      grammar: parseFloat(snapshot.grammarCefr ?? snapshot.grammar_cefr ?? '3.0'),
      reading: parseFloat(snapshot.readingCefr ?? snapshot.reading_cefr ?? '3.0'),
      listening: parseFloat(snapshot.listeningCefr ?? snapshot.listening_cefr ?? '3.0'),
      speaking: parseFloat(snapshot.speakingCefr ?? snapshot.speaking_cefr ?? '3.0'),
      writing: parseFloat(snapshot.writingCefr ?? snapshot.writing_cefr ?? '3.0'),
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

