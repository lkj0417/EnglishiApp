"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vocabularyRoutes = vocabularyRoutes;
const zod_1 = require("zod");
const database_1 = require("@englishi/database");
const drizzle_orm_1 = require("drizzle-orm");
const cefr_utils_1 = require("@englishi/cefr-utils");
const drizzle_orm_2 = require("drizzle-orm");
const ReviewResultSchema = zod_1.z.object({
    wordId: zod_1.z.string().uuid(),
    quality: zod_1.z.number().int().min(0).max(5),
    // 0-2: 完全不记得, 3: 勉强记住, 4: 正确, 5: 完美
});
const AddWordSchema = zod_1.z.object({
    word: zod_1.z.string().min(1).max(100),
    wordCefr: zod_1.z.number().min(1).max(6),
    domain: zod_1.z.string().optional(),
    sourceType: zod_1.z.enum(['assessment', 'reading', 'listening', 'manual']).optional(),
    sourceId: zod_1.z.string().uuid().optional(),
});
async function vocabularyRoutes(app) {
    app.addHook('preHandler', app.authenticate);
    // GET /v1/vocabulary/due — 获取今日待复习词汇
    app.get('/due', async (req, reply) => {
        const userId = req.user.userId;
        const db = (0, database_1.getDb)();
        const today = new Date().toISOString().split('T')[0];
        const dueItems = await db.select().from(database_1.vocabularyItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.vocabularyItems.userId, userId), (0, drizzle_orm_1.lte)(database_1.vocabularyItems.dueDate, today), (0, drizzle_orm_1.ne)(database_1.vocabularyItems.status, 'passive_maintenance')))
            .limit(20)
            .orderBy(database_1.vocabularyItems.dueDate);
        return reply.send({ success: true, data: dueItems, meta: { total: dueItems.length } });
    });
    // POST /v1/vocabulary/review — 提交复习结果（SM-2 更新）
    app.post('/review', async (req, reply) => {
        const userId = req.user.userId;
        const body = ReviewResultSchema.safeParse(req.body);
        if (!body.success) {
            return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
        }
        const db = (0, database_1.getDb)();
        const { wordId, quality } = body.data;
        const [item] = await db.select().from(database_1.vocabularyItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.vocabularyItems.id, wordId), (0, drizzle_orm_1.eq)(database_1.vocabularyItems.userId, userId)))
            .limit(1);
        if (!item) {
            return reply.code(404).send({ success: false, error: { code: 'WORD_NOT_FOUND', message: 'Vocabulary item not found' } });
        }
        const { easeFactor, intervalDays, repetitions } = (0, cefr_utils_1.sm2Update)(parseFloat(item.easeFactor), item.intervalDays, item.repetitions, quality);
        // 计算下次复习日期
        const nextDue = new Date();
        nextDue.setDate(nextDue.getDate() + intervalDays);
        const dueDateStr = nextDue.toISOString().split('T')[0];
        // 更新掌握条件追踪
        const newChoiceStreak = quality >= 4
            ? (item.choiceCorrectStreak + 1)
            : 0;
        const newContextStreak = quality === 5
            ? (item.contextCorrectStreak + 1)
            : item.contextCorrectStreak;
        // 判断是否达到掌握条件
        let newStatus = item.status;
        if (newChoiceStreak >= 3 && newContextStreak >= 2) {
            newStatus = item.productionVerified ? 'mastered' : 'reviewing';
        }
        else if (repetitions > 0) {
            newStatus = 'reviewing';
        }
        await db.update(database_1.vocabularyItems).set({
            easeFactor: easeFactor.toString(),
            intervalDays,
            repetitions,
            dueDate: dueDateStr,
            status: newStatus,
            choiceCorrectStreak: newChoiceStreak,
            contextCorrectStreak: newContextStreak,
            lastReviewedAt: new Date(),
            masteredAt: newStatus === 'mastered' ? new Date() : item.masteredAt,
        }).where((0, drizzle_orm_1.eq)(database_1.vocabularyItems.id, wordId));
        // 记录学习事件
        await db.insert(database_1.learningEvents).values({
            userId,
            sessionId: crypto.randomUUID(),
            skill: 'vocabulary',
            taskType: 'vocab_review',
            taskId: wordId,
            contentCefr: item.wordCefr,
            performanceScore: (quality / 5).toString(),
            correctCount: quality >= 3 ? 1 : 0,
            totalCount: 1,
            timeSpentSec: 0,
            hintUsedCount: 0,
            skipped: false,
            errorsMade: quality < 3 ? [{ type: 'recall_failure', content: item.word }] : [],
        });
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
    app.post('/items', async (req, reply) => {
        const userId = req.user.userId;
        const body = AddWordSchema.safeParse(req.body);
        if (!body.success) {
            return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
        }
        const db = (0, database_1.getDb)();
        // 检查是否已存在
        const existing = await db.select({ id: database_1.vocabularyItems.id })
            .from(database_1.vocabularyItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.vocabularyItems.userId, userId), (0, drizzle_orm_1.eq)(database_1.vocabularyItems.word, body.data.word)))
            .limit(1);
        if (existing.length > 0) {
            return reply.code(409).send({ success: false, error: { code: 'WORD_EXISTS', message: 'Word already in vocabulary list' } });
        }
        const [newItem] = await db.insert(database_1.vocabularyItems).values({
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
    app.get('/items', async (req, reply) => {
        const userId = req.user.userId;
        const { status, limit = 50, offset = 0 } = req.query;
        const db = (0, database_1.getDb)();
        const conditions = [(0, drizzle_orm_1.eq)(database_1.vocabularyItems.userId, userId)];
        if (status)
            conditions.push((0, drizzle_orm_1.eq)(database_1.vocabularyItems.status, status));
        const items = await db.select().from(database_1.vocabularyItems)
            .where((0, drizzle_orm_1.and)(...conditions))
            .limit(Number(limit))
            .offset(Number(offset))
            .orderBy(database_1.vocabularyItems.firstSeenAt);
        const total = await db.select({ count: (0, drizzle_orm_2.sql) `count(*)` })
            .from(database_1.vocabularyItems)
            .where((0, drizzle_orm_1.and)(...conditions));
        return reply.send({
            success: true,
            data: items,
            meta: { total: Number(total[0]?.count ?? 0), limit: Number(limit), offset: Number(offset) },
        });
    });
}
//# sourceMappingURL=vocabulary.routes.js.map