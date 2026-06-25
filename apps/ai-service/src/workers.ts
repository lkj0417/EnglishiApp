import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { getDb, generatedContent, writingTasks, speakingSessions } from '@englishi/database';
import { eq } from 'drizzle-orm';
import { generateReadingArticle } from './engines/reading.engine.js';
import { critiqueWriting } from './engines/writing.engine.js';
import { generateSpeakingReport } from './engines/speaking.engine.js';
import type { UserCapabilityLevel } from '@englishi/shared-types';

const redisConnection = new Redis(
  process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  { maxRetriesPerRequest: null },
) as any;

// ─────────────────────────────────────────────
// Worker 1：阅读文章生成
// ─────────────────────────────────────────────
const readingWorker = new Worker('reading-generate', async (job) => {
  console.log(`[ReadingWorker] Processing job ${job.id}`);
  const { userId, topic, abilitySnapshot } = job.data;

  const ucl: UserCapabilityLevel = {
    userId,
    overallCefr: parseFloat(abilitySnapshot.overallCefr),
    dimensions: {
      vocabulary: parseFloat(abilitySnapshot.vocabularyCefr),
      grammar: parseFloat(abilitySnapshot.grammarCefr),
      reading: parseFloat(abilitySnapshot.readingCefr),
      listening: parseFloat(abilitySnapshot.listeningCefr),
      speaking: parseFloat(abilitySnapshot.speakingCefr),
      writing: parseFloat(abilitySnapshot.writingCefr),
    },
    estimatedVocabSize: abilitySnapshot.estimatedVocabSize ?? 2000,
    ieltsPrediction: parseFloat(abilitySnapshot.ieltsPrediction ?? '5.0'),
    masteredGrammar: abilitySnapshot.masteredGrammar ?? [],
    notYetGrammar: [],
    weakAreas: abilitySnapshot.weakAreas ?? {},
    errorPatterns: abilitySnapshot.errorPatterns ?? [],
    confidenceInterval: 0.3,
    updatedAt: new Date().toISOString(),
  };

  const article = await generateReadingArticle({
    ucl,
    interestDomain: 'technology',  // 实际应从用户设置读取
    topic,
  });

  // 存入缓存表
  const db = getDb();
  const [saved] = await db.insert(generatedContent).values({
    contentType: 'reading_article',
    cefrLevel: ucl.overallCefr.toString(),
    interestDomain: 'technology',
    contentJson: article as unknown as Record<string, unknown>,
    cqvPassed: true,
    cqvCheckedAt: new Date(),
    useCount: 0,
  }).returning();

  console.log(`[ReadingWorker] Generated article ${saved!.id}`);
  return { ...article, id: saved!.id };
}, { connection: redisConnection, concurrency: 3 });

// ─────────────────────────────────────────────
// Worker 2：写作批改
// ─────────────────────────────────────────────
const writingWorker = new Worker('writing-critique', async (job) => {
  console.log(`[WritingWorker] Processing job ${job.id}`);
  const { submissionId, userId, taskType, taskPrompt, submissionText } = job.data;

  const db = getDb();
  const { userAbilityModels } = await import('@englishi/database');

  const [ability] = await db.select().from(userAbilityModels)
    .where(eq(userAbilityModels.userId, userId)).limit(1);

  if (!ability) throw new Error('No ability model found for user');

  const ucl: UserCapabilityLevel = {
    userId,
    overallCefr: parseFloat(ability.overallCefr),
    dimensions: {
      vocabulary: parseFloat(ability.vocabularyCefr),
      grammar: parseFloat(ability.grammarCefr),
      reading: parseFloat(ability.readingCefr),
      listening: parseFloat(ability.listeningCefr),
      speaking: parseFloat(ability.speakingCefr),
      writing: parseFloat(ability.writingCefr),
    },
    estimatedVocabSize: ability.estimatedVocabSize ?? 2000,
    ieltsPrediction: parseFloat(ability.ieltsPrediction ?? '5.0'),
    masteredGrammar: (ability.masteredGrammar as string[]) ?? [],
    notYetGrammar: [],
    weakAreas: (ability.weakAreas as any) ?? {},
    errorPatterns: (ability.errorPatterns as any[]) ?? [],
    confidenceInterval: 0.3,
    updatedAt: new Date().toISOString(),
  };

  const startTime = Date.now();
  const report = await critiqueWriting({ ucl, taskType, taskPrompt, submissionText });
  const duration = Date.now() - startTime;

  await db.update(writingTasks).set({
    status: 'completed',
    bandScores: report.overall as unknown as Record<string, unknown>,
    critiqueReport: report as unknown as Record<string, unknown>,
    processingDurationMs: duration,
    critiqueCompletedAt: new Date(),
  }).where(eq(writingTasks.id, submissionId));

  console.log(`[WritingWorker] Critique completed for ${submissionId} in ${duration}ms`);
  return { submissionId, overall: report.overall };
}, { connection: redisConnection, concurrency: 2 });

// ─────────────────────────────────────────────
// Worker 3：口语报告生成
// ─────────────────────────────────────────────
const speakingWorker = new Worker('speaking-report', async (job) => {
  console.log(`[SpeakingWorker] Processing job ${job.id}`);
  const { sessionId, userId, transcript, acousticData } = job.data;

  const db = getDb();
  const { userAbilityModels } = await import('@englishi/database');

  const [ability] = await db.select().from(userAbilityModels)
    .where(eq(userAbilityModels.userId, userId)).limit(1);

  if (!ability) throw new Error('No ability model found');

  const ucl: UserCapabilityLevel = {
    userId,
    overallCefr: parseFloat(ability.overallCefr),
    dimensions: {
      vocabulary: parseFloat(ability.vocabularyCefr),
      grammar: parseFloat(ability.grammarCefr),
      reading: parseFloat(ability.readingCefr),
      listening: parseFloat(ability.listeningCefr),
      speaking: parseFloat(ability.speakingCefr),
      writing: parseFloat(ability.writingCefr),
    },
    estimatedVocabSize: ability.estimatedVocabSize ?? 2000,
    ieltsPrediction: parseFloat(ability.ieltsPrediction ?? '5.0'),
    masteredGrammar: (ability.masteredGrammar as string[]) ?? [],
    notYetGrammar: [],
    weakAreas: (ability.weakAreas as any) ?? {},
    errorPatterns: (ability.errorPatterns as any[]) ?? [],
    confidenceInterval: 0.3,
    updatedAt: new Date().toISOString(),
  };

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

  console.log(`[SpeakingWorker] Report generated for session ${sessionId}`);
  return { sessionId, overallBand: report.overallBand };
}, { connection: redisConnection, concurrency: 2 });

// 错误处理
[readingWorker, writingWorker, speakingWorker].forEach(worker => {
  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });
});

console.log('✅ EnglishiApp AI Service Workers started');
console.log('  → ReadingWorker: listening on queue "reading-generate"');
console.log('  → WritingWorker: listening on queue "writing-critique"');
console.log('  → SpeakingWorker: listening on queue "speaking-report"');

