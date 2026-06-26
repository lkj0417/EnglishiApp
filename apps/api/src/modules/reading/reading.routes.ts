// reading.routes.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb, userAbilityModels, generatedContent, learningEvents, updateAbilityAfterEvent } from '@englishi/database';
import { eq } from 'drizzle-orm';
import { computePerformanceScore } from '@englishi/cefr-utils';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

let readingQueue: Queue | null = null;
function getReadingQueue() {
  if (!readingQueue) {
    const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    readingQueue = new Queue('reading-generate', { connection: redis as any });
  }
  return readingQueue;
}

export async function readingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (app as any).authenticate);

  // POST /v1/reading/generate
  app.post('/generate', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const { topic } = req.body as { topic?: string };

    const db = getDb();
    const [ability] = await db.select().from(userAbilityModels)
      .where(eq(userAbilityModels.userId, userId)).limit(1);

    if (!ability) {
      return reply.code(400).send({ success: false, error: { code: 'NO_ABILITY', message: 'Complete assessment first' } });
    }

    const queue = getReadingQueue();
    const job = await queue.add('generate', { userId, topic, abilitySnapshot: ability });

    return reply.code(202).send({
      success: true,
      data: { jobId: job.id, status: 'generating', message: 'Article being generated. Poll /reading/content/:jobId' },
    });
  });

  // GET /v1/reading/content/:jobId
  app.get('/content/:jobId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { jobId } = req.params as { jobId: string };
    const queue = getReadingQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      const db = getDb();
      const [content] = await db.select().from(generatedContent)
        .where(eq(generatedContent.id, jobId)).limit(1);
      if (content) {
        return reply.send({ success: true, data: { ...(content.contentJson as any), id: content.id } });
      }
      return reply.code(404).send({ success: false, error: { code: 'CONTENT_NOT_FOUND', message: 'Reading content not found' } });
    }

    const state = await job.getState();
    if (state === 'completed') {
      return reply.send({ success: true, data: job.returnvalue });
    }
    if (state === 'failed') {
      return reply.code(500).send({ success: false, error: { code: 'GENERATION_FAILED', message: 'Article generation failed' } });
    }

    return reply.code(202).send({ success: true, data: { status: state, jobId } });
  });

  // POST /v1/reading/sessions/:articleId/answers
  app.post('/sessions/:articleId/answers', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const { articleId } = req.params as { articleId: string };
    const { answers } = req.body as { answers: Record<string, string> };

    const db = getDb();
    const [content] = await db.select().from(generatedContent)
      .where(eq(generatedContent.id, articleId)).limit(1);

    if (!content) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found' } });
    }

    const article = content.contentJson as any;
    const questions = article?.questions ?? [];
    const results: Record<string, boolean> = {};
    let correctCount = 0;

    for (const q of questions) {
      const userAnswer = answers[q.id];
      const correct = userAnswer === q.correct_answer;
      results[q.id] = correct;
      if (correct) correctCount++;
    }

    const performanceScore = questions.length > 0 ? correctCount / questions.length : 0;

    // 静默更新阅读维度能力模型（PRD §1.3.1），并回填 uclBefore/uclAfter
    const perf = computePerformanceScore({ correctRate: performanceScore });
    const abilityUpdate = await updateAbilityAfterEvent(db, {
      userId,
      skill: 'reading',
      performanceScore: perf,
      contentCefr: parseFloat(content.cefrLevel ?? '0'),
    }).catch(() => null);

    // 并行：更新使用次数 + 记录学习事件
    await Promise.all([
      db.update(generatedContent).set({
        useCount: (content.useCount ?? 0) + 1,
      }).where(eq(generatedContent.id, articleId)),

      db.insert(learningEvents).values({
        userId,
        sessionId: crypto.randomUUID(),
        skill: 'reading',
        taskType: 'reading_article',
        taskId: articleId,
        contentCefr: content.cefrLevel,
        performanceScore: performanceScore.toString(),
        correctCount,
        totalCount: questions.length,
        timeSpentSec: 0, // 客户端提交时应传入
        hintUsedCount: 0,
        skipped: false,
        errorsMade: [],
        uclBefore: abilityUpdate?.before?.toString(),
        uclAfter: abilityUpdate?.after?.toString(),
      }),
    ]);

    return reply.send({
      success: true,
      data: {
        results,
        correctCount,
        totalCount: questions.length,
        comprehensionRate: performanceScore,
      },
    });
  });
}

