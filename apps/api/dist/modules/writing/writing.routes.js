"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writingRoutes = writingRoutes;
const zod_1 = require("zod");
const database_1 = require("@englishi/database");
const drizzle_orm_1 = require("drizzle-orm");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const SubmitWritingSchema = zod_1.z.object({
    taskType: zod_1.z.enum([
        'IELTS_Task1_Graph', 'IELTS_Task1_Process', 'IELTS_Task1_Map',
        'IELTS_Task2_Opinion', 'IELTS_Task2_Discussion', 'IELTS_Task2_Problem_Solution',
        'General_Email', 'General_Paragraph',
    ]),
    taskPrompt: zod_1.z.string().min(10),
    submissionText: zod_1.z.string().min(20).max(1500),
});
let writingQueue = null;
function getWritingQueue() {
    if (!writingQueue) {
        const redis = new ioredis_1.default(process.env['REDIS_URL'] ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
        writingQueue = new bullmq_1.Queue('writing-critique', { connection: redis });
    }
    return writingQueue;
}
async function writingRoutes(app) {
    app.addHook('preHandler', app.authenticate);
    // GET /v1/writing/task — 获取今日写作题目
    app.get('/task', async (req, reply) => {
        const userId = req.user.userId;
        const db = (0, database_1.getDb)();
        const [ability] = await db.select().from(database_1.userAbilityModels)
            .where((0, drizzle_orm_1.eq)(database_1.userAbilityModels.userId, userId)).limit(1);
        const writingCefr = parseFloat(ability?.writingCefr ?? '3.0');
        // 根据 CEFR 返回对应难度的写作题
        const task = getWritingTask(writingCefr);
        return reply.send({ success: true, data: task });
    });
    // POST /v1/writing/submissions — 提交作文
    app.post('/submissions', async (req, reply) => {
        const userId = req.user.userId;
        const body = SubmitWritingSchema.safeParse(req.body);
        if (!body.success) {
            return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
        }
        const db = (0, database_1.getDb)();
        const wordCount = body.data.submissionText.trim().split(/\s+/).length;
        const [submission] = await db.insert(database_1.writingTasks).values({
            userId,
            taskType: body.data.taskType,
            taskPrompt: body.data.taskPrompt,
            submissionText: body.data.submissionText,
            wordCount,
            submittedAt: new Date(),
            status: 'submitted',
        }).returning({ id: database_1.writingTasks.id });
        // 加入异步批改队列
        const queue = getWritingQueue();
        await queue.add('critique', {
            submissionId: submission.id,
            userId,
            taskType: body.data.taskType,
            taskPrompt: body.data.taskPrompt,
            submissionText: body.data.submissionText,
        }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
        return reply.code(202).send({
            success: true,
            data: {
                submissionId: submission.id,
                status: 'processing',
                message: 'Your essay is being reviewed by AI. Check back in 30-60 seconds.',
            },
        });
    });
    // GET /v1/writing/submissions/:id/critique — 获取批改报告
    app.get('/submissions/:id/critique', async (req, reply) => {
        const userId = req.user.userId;
        const { id } = req.params;
        const db = (0, database_1.getDb)();
        const [task] = await db.select().from(database_1.writingTasks)
            .where((0, drizzle_orm_1.eq)(database_1.writingTasks.id, id)).limit(1);
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
    app.get('/submissions', async (req, reply) => {
        const userId = req.user.userId;
        const db = (0, database_1.getDb)();
        const tasks = await db.select({
            id: database_1.writingTasks.id,
            taskType: database_1.writingTasks.taskType,
            wordCount: database_1.writingTasks.wordCount,
            bandScores: database_1.writingTasks.bandScores,
            status: database_1.writingTasks.status,
            submittedAt: database_1.writingTasks.submittedAt,
        }).from(database_1.writingTasks).where((0, drizzle_orm_1.eq)(database_1.writingTasks.userId, userId))
            .orderBy(database_1.writingTasks.submittedAt)
            .limit(20);
        return reply.send({ success: true, data: tasks });
    });
}
// ─────────────────────────────────────────────
// 写作题目库（按 CEFR 分级）
// ─────────────────────────────────────────────
function getWritingTask(writingCefr) {
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
//# sourceMappingURL=writing.routes.js.map