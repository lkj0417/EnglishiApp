import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDb, writingTasks, userAbilityModels } from '@englishi/database';
import { eq, desc } from 'drizzle-orm';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const SubmitWritingSchema = z.object({
  taskType: z.enum([
    'IELTS_Task1_Graph', 'IELTS_Task1_Process', 'IELTS_Task1_Map',
    'IELTS_Task2_Opinion', 'IELTS_Task2_Discussion', 'IELTS_Task2_Problem_Solution',
    'General_Email', 'General_Paragraph',
  ]),
  taskPrompt: z.string().min(10),
  submissionText: z.string().min(20).max(1500),
});

let writingQueue: Queue | null = null;

function getWritingQueue() {
  if (!writingQueue) {
    const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    writingQueue = new Queue('writing-critique', { connection: redis as any });
  }
  return writingQueue;
}

export async function writingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (app as any).authenticate);

  // GET /v1/writing/task — 获取今日写作题目
  app.get('/task', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const db = getDb();

    const [ability] = await db.select().from(userAbilityModels)
      .where(eq(userAbilityModels.userId, userId)).limit(1);

    const writingCefr = parseFloat(ability?.writingCefr ?? '3.0');

    // 根据 CEFR 返回对应难度的写作题
    const task = getWritingTask(writingCefr);

    return reply.send({ success: true, data: task });
  });

  // POST /v1/writing/submissions — 提交作文
  app.post('/submissions', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const body = SubmitWritingSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
    }

    const db = getDb();
    const wordCount = body.data.submissionText.trim().split(/\s+/).length;

    const [submission] = await db.insert(writingTasks).values({
      userId,
      taskType: body.data.taskType,
      taskPrompt: body.data.taskPrompt,
      submissionText: body.data.submissionText,
      wordCount,
      submittedAt: new Date(),
      status: 'submitted',
    }).returning({ id: writingTasks.id });

    // 加入异步批改队列
    const queue = getWritingQueue();
    await queue.add('critique', {
      submissionId: submission!.id,
      userId,
      taskType: body.data.taskType,
      taskPrompt: body.data.taskPrompt,
      submissionText: body.data.submissionText,
    }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });

    return reply.code(202).send({
      success: true,
      data: {
        submissionId: submission!.id,
        status: 'processing',
        message: 'Your essay is being reviewed by AI. Check back in 30-60 seconds.',
      },
    });
  });

  // GET /v1/writing/submissions/:id/critique — 获取批改报告
  app.get('/submissions/:id/critique', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const { id } = req.params as { id: string };

    const db = getDb();
    const [task] = await db.select().from(writingTasks)
      .where(eq(writingTasks.id, id)).limit(1);

    if (!task || task.userId !== userId) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Submission not found' } });
    }

    if (task.status === 'submitted' || task.status === 'processing') {
      return reply.code(202).send({
        success: true,
        data: { status: task.status, message: 'Still processing, please retry in a few seconds.' },
      });
    }

    return reply.send({
      success: true,
      data: {
        status: task.status,
        bandScores: task.bandScores,
        critiqueReport: task.critiqueReport,
        submittedAt: task.submittedAt,
        completedAt: task.critiqueCompletedAt,
      },
    });
  });

  // GET /v1/writing/submissions — 写作历史
  app.get('/submissions', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const db = getDb();

    const tasks = await db.select({
      id: writingTasks.id,
      taskType: writingTasks.taskType,
      wordCount: writingTasks.wordCount,
      bandScores: writingTasks.bandScores,
      status: writingTasks.status,
      submittedAt: writingTasks.submittedAt,
    }).from(writingTasks).where(eq(writingTasks.userId, userId))
      .orderBy(desc(writingTasks.submittedAt))
      .limit(20);

    return reply.send({ success: true, data: tasks });
  });
}

// ─────────────────────────────────────────────
// 写作题目库（按 CEFR 分级）
// ─────────────────────────────────────────────
function getWritingTask(writingCefr: number) {
  if (writingCefr < 2.5) {
    return {
      type: 'General_Paragraph',
      prompt: 'Write 3-4 sentences about your daily routine. Use simple present tense.',
      minWords: 40, maxWords: 80,
      tips: ['Start each sentence with "I"', 'Use verbs like: wake up, eat, go, study, sleep'],
    };
  }
  if (writingCefr < 3.5) {
    return {
      type: 'General_Email',
      prompt: 'Write an email to a friend telling them about a place you visited recently. Include: where you went, what you did, and whether you would recommend it.',
      minWords: 80, maxWords: 120,
      tips: ['Start with "Dear [Name],"', 'Use past tense to describe what happened', 'End with "Best wishes," or "Yours,"'],
    };
  }
  if (writingCefr < 4.5) {
    return {
      type: 'IELTS_Task2_Opinion',
      prompt: 'Some people believe that the internet has made people more isolated, while others think it has helped people connect. Discuss both views and give your own opinion.',
      minWords: 250, maxWords: 320,
      tips: ['Write an introduction, 2 body paragraphs, and a conclusion', 'State your opinion clearly', 'Use linking words: however, furthermore, in contrast'],
    };
  }
  return {
    type: 'IELTS_Task2_Discussion',
    prompt: 'In many countries, the gap between the rich and the poor is widening. What problems does this cause, and what measures could be taken to address this issue?',
    minWords: 260, maxWords: 340,
    tips: ['Identify at least 2 problems and 2 solutions', 'Use academic vocabulary', 'Demonstrate complex sentence structures'],
  };
}

