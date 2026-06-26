"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readingRoutes = readingRoutes;
const database_1 = require("@englishi/database");
const drizzle_orm_1 = require("drizzle-orm");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
let readingQueue = null;
function getReadingQueue() {
    if (!readingQueue) {
        const redis = new ioredis_1.default(process.env['REDIS_URL'] ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
        readingQueue = new bullmq_1.Queue('reading-generate', { connection: redis });
    }
    return readingQueue;
}
async function readingRoutes(app) {
    app.addHook('preHandler', app.authenticate);
    // POST /v1/reading/generate
    app.post('/generate', async (req, reply) => {
        const userId = req.user.userId;
        const { topic } = req.body;
        const db = (0, database_1.getDb)();
        const [ability] = await db.select().from(database_1.userAbilityModels)
            .where((0, drizzle_orm_1.eq)(database_1.userAbilityModels.userId, userId)).limit(1);
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
    app.get('/content/:jobId', async (req, reply) => {
        const { jobId } = req.params;
        const queue = getReadingQueue();
        const job = await queue.getJob(jobId);
        if (!job) {
            const db = (0, database_1.getDb)();
            const [content] = await db.select().from(database_1.generatedContent)
                .where((0, drizzle_orm_1.eq)(database_1.generatedContent.id, jobId)).limit(1);
            if (content) {
                return reply.send({ success: true, data: { ...content.contentJson, id: content.id } });
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
    app.post('/sessions/:articleId/answers', async (req, reply) => {
        const userId = req.user.userId;
        const { articleId } = req.params;
        const { answers } = req.body;
        const db = (0, database_1.getDb)();
        const [content] = await db.select().from(database_1.generatedContent)
            .where((0, drizzle_orm_1.eq)(database_1.generatedContent.id, articleId)).limit(1);
        if (!content) {
            return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found' } });
        }
        const article = content.contentJson;
        const questions = article?.questions ?? [];
        const results = {};
        let correctCount = 0;
        for (const q of questions) {
            const userAnswer = answers[q.id];
            const correct = userAnswer === q.correct_answer;
            results[q.id] = correct;
            if (correct)
                correctCount++;
        }
        const performanceScore = questions.length > 0 ? correctCount / questions.length : 0;
        // 并行：更新使用次数 + 记录学习事件
        await Promise.all([
            db.update(database_1.generatedContent).set({
                useCount: (content.useCount ?? 0) + 1,
            }).where((0, drizzle_orm_1.eq)(database_1.generatedContent.id, articleId)),
            db.insert(database_1.learningEvents).values({
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
//# sourceMappingURL=reading.routes.js.map