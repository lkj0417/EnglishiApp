import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDb, vocabularyItems } from '@englishi/database';
import { eq, and, lte, ne } from 'drizzle-orm';
import { sm2Update } from '@englishi/cefr-utils';
import { sql } from 'drizzle-orm';

const ReviewResultSchema = z.object({
  wordId: z.string().uuid(),
  quality: z.number().int().min(0).max(5),
  // 0-2: 完全不记得, 3: 勉强记住, 4: 正确, 5: 完美
});

const AddWordSchema = z.object({
  word: z.string().min(1).max(100),
  wordCefr: z.number().min(1).max(6),
  domain: z.string().optional(),
  sourceType: z.enum(['assessment', 'reading', 'listening', 'manual']).optional(),
  sourceId: z.string().uuid().optional(),
});

export async function vocabularyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (app as any).authenticate);

  // GET /v1/vocabulary/due — 获取今日待复习词汇
  app.get('/due', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const db = getDb();
    const today = new Date().toISOString().split('T')[0]!;

    const dueItems = await db.select().from(vocabularyItems)
      .where(
        and(
          eq(vocabularyItems.userId, userId),
          lte(vocabularyItems.dueDate, today),
          ne(vocabularyItems.status, 'passive_maintenance'),
        ),
      )
      .limit(20)
      .orderBy(vocabularyItems.dueDate);

    return reply.send({ success: true, data: dueItems, meta: { total: dueItems.length } });
  });

  // POST /v1/vocabulary/review — 提交复习结果（SM-2 更新）
  app.post('/review', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const body = ReviewResultSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
    }

    const db = getDb();
    const { wordId, quality } = body.data;

    const [item] = await db.select().from(vocabularyItems)
      .where(and(eq(vocabularyItems.id, wordId), eq(vocabularyItems.userId, userId)))
      .limit(1);

    if (!item) {
      return reply.code(404).send({ success: false, error: { code: 'WORD_NOT_FOUND', message: 'Vocabulary item not found' } });
    }

    const { easeFactor, intervalDays, repetitions } = sm2Update(
      parseFloat(item.easeFactor!),
      item.intervalDays!,
      item.repetitions!,
      quality,
    );

    // 计算下次复习日期
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + intervalDays);
    const dueDateStr = nextDue.toISOString().split('T')[0]!;

    // 更新掌握条件追踪
    const newChoiceStreak = quality >= 4
      ? (item.choiceCorrectStreak! + 1)
      : 0;
    const newContextStreak = quality === 5
      ? (item.contextCorrectStreak! + 1)
      : item.contextCorrectStreak!;

    // 判断是否达到掌握条件
    let newStatus = item.status!;
    if (newChoiceStreak >= 3 && newContextStreak >= 2) {
      newStatus = item.productionVerified ? 'mastered' : 'reviewing';
    } else if (repetitions > 0) {
      newStatus = 'reviewing';
    }

    await db.update(vocabularyItems).set({
      easeFactor: easeFactor.toString(),
      intervalDays,
      repetitions,
      dueDate: dueDateStr,
      status: newStatus,
      choiceCorrectStreak: newChoiceStreak,
      contextCorrectStreak: newContextStreak,
      lastReviewedAt: new Date(),
      masteredAt: newStatus === 'mastered' ? new Date() : item.masteredAt,
    }).where(eq(vocabularyItems.id, wordId));

    return reply.send({
      success: true,
      data: {
        nextReviewDate: dueDateStr,
        intervalDays,
        status: newStatus,
        easeFactor: parseFloat(easeFactor.toFixed(3)),
      },
    });
  });

  // POST /v1/vocabulary/items — 手动添加词汇
  app.post('/items', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const body = AddWordSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
    }

    const db = getDb();

    // 检查是否已存在
    const existing = await db.select({ id: vocabularyItems.id })
      .from(vocabularyItems)
      .where(and(eq(vocabularyItems.userId, userId), eq(vocabularyItems.word, body.data.word)))
      .limit(1);

    if (existing.length > 0) {
      return reply.code(409).send({ success: false, error: { code: 'WORD_EXISTS', message: 'Word already in vocabulary list' } });
    }

    const [newItem] = await db.insert(vocabularyItems).values({
      userId,
      word: body.data.word.toLowerCase(),
      wordCefr: body.data.wordCefr.toString(),
      domain: body.data.domain,
      sourceType: body.data.sourceType,
      sourceId: body.data.sourceId,
    }).returning();

    return reply.code(201).send({ success: true, data: newItem });
  });

  // GET /v1/vocabulary/items — 获取词汇本列表
  app.get('/items', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const { status, limit = 50, offset = 0 } = req.query as { status?: string; limit?: number; offset?: number };

    const db = getDb();
    const conditions = [eq(vocabularyItems.userId, userId)];
    if (status) conditions.push(eq(vocabularyItems.status, status));

    const items = await db.select().from(vocabularyItems)
      .where(and(...conditions))
      .limit(Number(limit))
      .offset(Number(offset))
      .orderBy(vocabularyItems.firstSeenAt);

    const total = await db.select({ count: sql<number>`count(*)` })
      .from(vocabularyItems)
      .where(and(...conditions));

    return reply.send({
      success: true,
      data: items,
      meta: { total: Number(total[0]?.count ?? 0), limit: Number(limit), offset: Number(offset) },
    });
  });
}

