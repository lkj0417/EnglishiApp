"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listeningRoutes = listeningRoutes;
const database_1 = require("@englishi/database");
const drizzle_orm_1 = require("drizzle-orm");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
let listeningQueue = null;
function getListeningQueue() {
    if (!listeningQueue) {
        const redis = new ioredis_1.default(process.env['REDIS_URL'] ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
        listeningQueue = new bullmq_1.Queue('listening-generate', { connection: redis });
    }
    return listeningQueue;
}
async function listeningRoutes(app) {
    app.addHook('preHandler', app.authenticate);
    // POST /v1/listening/generate
    app.post('/generate', async (req, reply) => {
        const userId = req.user.userId;
        const { topic, subSkill } = req.body;
        const db = (0, database_1.getDb)();
        const [ability] = await db.select().from(database_1.userAbilityModels)
            .where((0, drizzle_orm_1.eq)(database_1.userAbilityModels.userId, userId)).limit(1);
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
    app.get('/content/:jobId', async (req, reply) => {
        const { jobId } = req.params;
        const queue = getListeningQueue();
        const job = await queue.getJob(jobId);
        if (!job)
            return reply.code(404).send({ success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } });
        const state = await job.getState();
        if (state === 'completed')
            return reply.send({ success: true, data: { ...job.returnvalue, status: 'completed' } });
        if (state === 'failed')
            return reply.code(500).send({ success: false, error: { code: 'GENERATION_FAILED', message: 'Generation failed' } });
        return reply.code(202).send({ success: true, data: { status: state, jobId } });
    });
    // GET /v1/listening/audio/:audioId
    app.get('/audio/:audioId', async (req, reply) => {
        const { audioId } = req.params;
        const db = (0, database_1.getDb)();
        const [content] = await db.select().from(database_1.generatedContent).where((0, drizzle_orm_1.eq)(database_1.generatedContent.id, audioId)).limit(1);
        if (!content)
            return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Audio not found' } });
        return reply.send({ success: true, data: content.contentJson });
    });
    // POST /v1/listening/sessions/:audioId/answers
    app.post('/sessions/:audioId/answers', async (req, reply) => {
        const userId = req.user.userId;
        const { audioId } = req.params;
        const { answers, timeSpentSec = 0 } = req.body;
        const db = (0, database_1.getDb)();
        const [content] = await db.select().from(database_1.generatedContent).where((0, drizzle_orm_1.eq)(database_1.generatedContent.id, audioId)).limit(1);
        if (!content)
            return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Audio not found' } });
        const audioContent = content.contentJson;
        const questions = audioContent?.questions ?? [];
        const results = {};
        const errorsMade = [];
        let correctCount = 0;
        for (const q of questions) {
            const userAnswer = answers[q.id];
            const correct = userAnswer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase();
            results[q.id] = correct;
            if (correct) {
                correctCount++;
            }
            else {
                errorsMade.push({ type: `listening_${q.sub_skill ?? 'comprehension'}_error`, content: `Q${q.id}: expected "${q.correct_answer}", got "${userAnswer ?? 'blank'}"` });
            }
        }
        const performanceScore = questions.length > 0 ? correctCount / questions.length : 0;
        await Promise.all([
            db.update(database_1.generatedContent).set({ useCount: (content.useCount ?? 0) + 1 }).where((0, drizzle_orm_1.eq)(database_1.generatedContent.id, audioId)),
            db.insert(database_1.learningEvents).values({
                userId, sessionId: crypto.randomUUID(),
                skill: 'listening', taskType: 'listening_audio', taskId: audioId,
                contentCefr: content.cefrLevel, performanceScore: performanceScore.toString(),
                correctCount, totalCount: questions.length, timeSpentSec,
                hintUsedCount: 0, skipped: false, errorsMade,
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
//# sourceMappingURL=listening.routes.js.map