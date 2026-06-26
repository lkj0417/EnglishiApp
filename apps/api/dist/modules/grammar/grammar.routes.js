"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.grammarRoutes = grammarRoutes;
const database_1 = require("@englishi/database");
const drizzle_orm_1 = require("drizzle-orm");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
// 68 个核心语法点，按 CEFR 级别排序
const GRAMMAR_POINTS = [
    // A1
    { point: 'present_simple', cefr: 1.0, title: '一般现在时', prereqs: [] },
    { point: 'past_simple', cefr: 1.2, title: '一般过去时', prereqs: ['present_simple'] },
    { point: 'basic_articles', cefr: 1.3, title: '冠词 (a/an/the)', prereqs: [] },
    { point: 'plural_nouns', cefr: 1.0, title: '名词复数', prereqs: [] },
    // A2
    { point: 'present_continuous', cefr: 2.0, title: '现在进行时', prereqs: ['present_simple'] },
    { point: 'future_will', cefr: 2.2, title: '将来时 (will)', prereqs: ['present_simple'] },
    { point: 'comparative_adjectives', cefr: 2.0, title: '形容词比较级', prereqs: ['basic_articles'] },
    { point: 'can_modal', cefr: 2.0, title: '情态动词 can', prereqs: [] },
    // B1
    { point: 'present_perfect', cefr: 3.0, title: '现在完成时', prereqs: ['past_simple'] },
    { point: 'passive_voice_simple', cefr: 3.2, title: '简单被动语态', prereqs: ['past_simple'] },
    { point: 'relative_clauses_basic', cefr: 3.0, title: '定语从句（who/which/that）', prereqs: ['past_simple'] },
    { point: 'conditional_type_1', cefr: 3.3, title: '一型条件句（真实条件）', prereqs: ['future_will'] },
    { point: 'reported_speech', cefr: 3.5, title: '间接引语', prereqs: ['past_simple', 'present_simple'] },
    // B2
    { point: 'past_perfect', cefr: 4.0, title: '过去完成时', prereqs: ['present_perfect'] },
    { point: 'passive_voice_complex', cefr: 4.0, title: '复杂被动语态', prereqs: ['passive_voice_simple'] },
    { point: 'modal_verbs_all', cefr: 4.0, title: '全部情态动词', prereqs: ['can_modal'] },
    { point: 'conditional_type_2', cefr: 4.2, title: '二型条件句（虚拟条件）', prereqs: ['conditional_type_1'] },
    // C1
    { point: 'subjunctive_mood', cefr: 5.0, title: '虚拟语气', prereqs: ['conditional_type_2'] },
    { point: 'inversion_basic', cefr: 5.0, title: '基础倒装句', prereqs: ['reported_speech'] },
    { point: 'participle_clauses', cefr: 5.2, title: '分词从句', prereqs: ['present_continuous'] },
    { point: 'cleft_sentences', cefr: 5.0, title: '强调句型（It is...that）', prereqs: ['relative_clauses_basic'] },
];
let grammarQueue = null;
function getGrammarQueue() {
    if (!grammarQueue) {
        const redis = new ioredis_1.default(process.env['REDIS_URL'] ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
        grammarQueue = new bullmq_1.Queue('grammar-lesson', { connection: redis });
    }
    return grammarQueue;
}
async function grammarRoutes(app) {
    app.addHook('preHandler', app.authenticate);
    // GET /v1/grammar/priority-point — 获取当前优先学习的语法点
    app.get('/priority-point', async (req, reply) => {
        const userId = req.user.userId;
        const db = (0, database_1.getDb)();
        const [ability] = await db.select().from(database_1.userAbilityModels)
            .where((0, drizzle_orm_1.eq)(database_1.userAbilityModels.userId, userId)).limit(1);
        const grammarCefr = parseFloat(ability?.grammarCefr ?? '3.0');
        const masteredGrammar = ability?.masteredGrammar ?? [];
        // 找到当前水平范围内未掌握的语法点
        const notMastered = GRAMMAR_POINTS.filter(gp => {
            const levelMatch = gp.cefr >= grammarCefr - 0.5 && gp.cefr <= grammarCefr + 0.5;
            const notYetMastered = !masteredGrammar.includes(gp.point);
            const prereqsMet = gp.prereqs.every(r => masteredGrammar.includes(r));
            return levelMatch && notYetMastered && prereqsMet;
        });
        const priority = notMastered[0] ?? GRAMMAR_POINTS.find(gp => !masteredGrammar.includes(gp.point));
        return reply.send({
            success: true,
            data: priority ? {
                grammarPoint: priority.point,
                title: priority.title,
                cefrLevel: priority.cefr,
                prereqsMet: priority.prereqs.every(r => masteredGrammar.includes(r)),
            } : { message: 'All grammar points at current level mastered!' },
        });
    });
    // GET /v1/grammar/:point/lesson — 获取语法讲解（AI 生成，带缓存）
    app.get('/:point/lesson', async (req, reply) => {
        const { point } = req.params;
        const userId = req.user.userId;
        const grammarInfo = GRAMMAR_POINTS.find(g => g.point === point);
        if (!grammarInfo) {
            return reply.code(404).send({ success: false, error: { code: 'UNKNOWN_GRAMMAR', message: 'Grammar point not found' } });
        }
        const db = (0, database_1.getDb)();
        const [cached] = await db.select().from(database_1.generatedContent)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.generatedContent.contentType, 'grammar_lesson'), (0, drizzle_orm_1.eq)(database_1.generatedContent.grammarPoint, point)))
            .limit(1);
        if (cached) {
            return reply.send({
                success: true,
                data: {
                    grammarPoint: point,
                    title: grammarInfo.title,
                    cefrLevel: grammarInfo.cefr,
                    status: 'completed',
                    lesson: cached.contentJson,
                },
            });
        }
        // 将语法讲解生成请求加入队列（使用 jobId 去重，相同语法点不重复生成）
        const queue = getGrammarQueue();
        const jobId = `grammar-${point}-lesson`;
        const existingJob = await queue.getJob(jobId);
        if (existingJob && await existingJob.getState() === 'completed') {
            return reply.send({
                success: true,
                data: {
                    grammarPoint: point,
                    title: grammarInfo.title,
                    cefrLevel: grammarInfo.cefr,
                    status: 'completed',
                    lesson: existingJob.returnvalue,
                },
            });
        }
        if (!existingJob) {
            await queue.add('generate-lesson', { grammarPoint: point, userId }, { jobId });
        }
        return reply.send({
            success: true,
            data: {
                grammarPoint: point,
                title: grammarInfo.title,
                cefrLevel: grammarInfo.cefr,
                status: 'generating',
                message: 'Lesson content being generated. Retry in a few seconds.',
            },
        });
    });
    // POST /v1/grammar/:point/exercises/submit — 提交语法练习结果
    app.post('/:point/exercises/submit', async (req, reply) => {
        const userId = req.user.userId;
        const { point } = req.params;
        const { results } = req.body;
        const db = (0, database_1.getDb)();
        const totalQuestions = results.length;
        if (totalQuestions === 0) {
            return reply.code(400).send({ success: false, error: { code: 'NO_RESULTS', message: 'No exercise results submitted' } });
        }
        const correctCount = results.filter(r => r.correct).length;
        const accuracy = correctCount / totalQuestions;
        // 更新语法掌握状态
        const existing = await db.select().from(database_1.grammarItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.grammarItems.userId, userId), (0, drizzle_orm_1.eq)(database_1.grammarItems.grammarPoint, point)))
            .limit(1);
        const grammarInfo = GRAMMAR_POINTS.find(g => g.point === point);
        if (existing.length === 0) {
            await db.insert(database_1.grammarItems).values({
                userId,
                grammarPoint: point,
                cefrLevel: (grammarInfo?.cefr ?? 3.0).toString(),
                status: 'practicing',
                exerciseAccuracy: accuracy.toString(),
                exerciseCorrectStreak: accuracy >= 0.85 ? 1 : 0,
                consecutiveErrors: accuracy < 0.5 ? 1 : 0,
                introducedAt: new Date(),
                lastPracticedAt: new Date(),
            });
        }
        else {
            const curr = existing[0];
            const newStreak = accuracy >= 0.85 ? (curr.exerciseCorrectStreak + 1) : 0;
            const newStatus = newStreak >= 4 ? 'mastered' : 'practicing';
            await db.update(database_1.grammarItems).set({
                exerciseAccuracy: accuracy.toString(),
                exerciseCorrectStreak: newStreak,
                consecutiveErrors: accuracy < 0.5 ? (curr.consecutiveErrors + 1) : 0,
                status: newStatus,
                masteredAt: newStatus === 'mastered' ? new Date() : curr.masteredAt,
                lastPracticedAt: new Date(),
            }).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.grammarItems.userId, userId), (0, drizzle_orm_1.eq)(database_1.grammarItems.grammarPoint, point)));
        }
        return reply.send({
            success: true,
            data: {
                accuracy,
                correctCount,
                totalQuestions,
                mastered: accuracy >= 0.85,
                message: accuracy >= 0.85 ? '语法点掌握良好！' : '继续练习，巩固这个语法点。',
            },
        });
    });
}
//# sourceMappingURL=grammar.routes.js.map