import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb, userAbilityModels, generatedContent, learningEvents, updateAbilityAfterEvent } from '@englishi/database';
import { eq } from 'drizzle-orm';
import { computePerformanceScore } from '@englishi/cefr-utils';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

let listeningQueue: Queue | null = null;
function getListeningQueue() {
  if (!listeningQueue) {
    const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    listeningQueue = new Queue('listening-generate', { connection: redis as any });
  }
  return listeningQueue;
}

export async function listeningRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (app as any).authenticate);

  // POST /v1/listening/generate
  app.post('/generate', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const { topic, subSkill } = req.body as { topic?: string; subSkill?: string };
    const db = getDb();

    const [ability] = await db.select().from(userAbilityModels)
      .where(eq(userAbilityModels.userId, userId)).limit(1);
    if (!ability) {
      return reply.code(400).send({ success: false, error: { code: 'NO_ABILITY', message: 'Complete assessment first' } });
    }

    const queue = getListeningQueue();
    const job = await queue.add('generate', {
      userId, topic: topic ?? 'general',
      subSkill: subSkill ?? 'detail_comprehension',
      abilitySnapshot: ability,
    }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });

    return reply.code(202).send({ success: true, data: { jobId: job.id, status: 'generating', message: 'Listening material being generated. Poll /listening/content/:jobId' } });
  });

  // GET /v1/listening/content/:jobId
  app.get('/content/:jobId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { jobId } = req.params as { jobId: string };
    const queue = getListeningQueue();
    const job = await queue.getJob(jobId);
    if (!job) return reply.code(404).send({ success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } });

    const state = await job.getState();
    if (state === 'completed') return reply.send({ success: true, data: { ...job.returnvalue, status: 'completed' } });
    if (state === 'failed') return reply.code(500).send({ success: false, error: { code: 'GENERATION_FAILED', message: 'Generation failed' } });
    return reply.code(202).send({ success: true, data: { status: state, jobId } });
  });

  // GET /v1/listening/audio/:audioId
  app.get('/audio/:audioId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { audioId } = req.params as { audioId: string };
    const db = getDb();
    const [content] = await db.select().from(generatedContent).where(eq(generatedContent.id, audioId)).limit(1);
    if (!content) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Audio not found' } });
    return reply.send({ success: true, data: content.contentJson });
  });

  // POST /v1/listening/sessions/:audioId/answers
  app.post('/sessions/:audioId/answers', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const { audioId } = req.params as { audioId: string };
    const { answers, timeSpentSec = 0 } = req.body as { answers: Record<string, string>; timeSpentSec?: number };
    const db = getDb();

    const [content] = await db.select().from(generatedContent).where(eq(generatedContent.id, audioId)).limit(1);
    if (!content) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Audio not found' } });

    const audioContent = content.contentJson as any;
    const questions = audioContent?.questions ?? [];
    const results: Record<string, boolean> = {};
    const errorsMade: { type: string; content: string }[] = [];
    let correctCount = 0;

    for (const q of questions) {
      const userAnswer = answers[q.id];
      const correct = userAnswer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase();
      results[q.id] = correct;
      if (correct) { correctCount++; }
      else { errorsMade.push({ type: `listening_${q.sub_skill ?? 'comprehension'}_error`, content: `Q${q.id}: expected "${q.correct_answer}", got "${userAnswer ?? 'blank'}"` }); }
    }

    const performanceScore = questions.length > 0 ? correctCount / questions.length : 0;

    // 静默更新听力维度能力模型（PRD §1.3.1）
    const perf = computePerformanceScore({ correctRate: performanceScore });
    const abilityUpdate = await updateAbilityAfterEvent(db, {
      userId,
      skill: 'listening',
      performanceScore: perf,
      contentCefr: parseFloat(content.cefrLevel ?? '0'),
    }).catch(() => null);

    await Promise.all([
      db.update(generatedContent).set({ useCount: (content.useCount ?? 0) + 1 }).where(eq(generatedContent.id, audioId)),
      db.insert(learningEvents).values({
        userId, sessionId: crypto.randomUUID(),
        skill: 'listening', taskType: 'listening_audio', taskId: audioId,
        contentCefr: content.cefrLevel, performanceScore: performanceScore.toString(),
        correctCount, totalCount: questions.length, timeSpentSec,
        hintUsedCount: 0, skipped: false, errorsMade,
        uclBefore: abilityUpdate?.before?.toString(),
        uclAfter: abilityUpdate?.after?.toString(),
      }),
    ]);

    return reply.send({
      success: true,
      data: {
        results, correctCount, totalCount: questions.length, comprehensionRate: performanceScore,
        needsReinforcement: performanceScore < 0.6,
      },
    });
  });
}
