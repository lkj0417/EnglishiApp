"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assessmentRoutes = assessmentRoutes;
const zod_1 = require("zod");
const database_1 = require("@englishi/database");
const drizzle_orm_1 = require("drizzle-orm");
const cefr_utils_1 = require("@englishi/cefr-utils");
// CAT 题库（正式版应从数据库加载，此处内嵌基础题库）
const question_bank_js_1 = require("./question-bank.js");
const AnswerSchema = zod_1.z.object({
    sessionId: zod_1.z.string().uuid(),
    questionId: zod_1.z.string(),
    answer: zod_1.z.string(),
    responseTimeSec: zod_1.z.number().positive(),
});
async function assessmentRoutes(app) {
    app.addHook('preHandler', app.authenticate);
    // POST /v1/assessment/start — 开始测评会话
    app.post('/start', async (req, reply) => {
        const userId = req.user.userId;
        const db = (0, database_1.getDb)();
        // 创建测评会话
        const [session] = await db.insert(database_1.assessmentSessions).values({
            userId,
            sessionType: 'onboarding',
            answers: [],
            status: 'in_progress',
        }).returning();
        // 返回第一道题（从 B1 中点开始）
        const firstQuestion = getNextQuestion(session.id, [], 3.0);
        return reply.code(201).send({
            success: true,
            data: {
                sessionId: session.id,
                question: firstQuestion,
                progress: { current: 1, total: 20 },
            },
        });
    });
    // POST /v1/assessment/answer — 提交答案并获取下一题
    app.post('/answer', async (req, reply) => {
        const userId = req.user.userId;
        const body = AnswerSchema.safeParse(req.body);
        if (!body.success) {
            return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
        }
        const db = (0, database_1.getDb)();
        const { sessionId, questionId, answer, responseTimeSec } = body.data;
        // 加载会话
        const [session] = await db.select().from(database_1.assessmentSessions)
            .where((0, drizzle_orm_1.eq)(database_1.assessmentSessions.id, sessionId)).limit(1);
        if (!session || session.userId !== userId) {
            return reply.code(404).send({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Assessment session not found' } });
        }
        // 获取题目
        const question = question_bank_js_1.QUESTION_BANK.find(q => q.id === questionId);
        if (!question) {
            return reply.code(404).send({ success: false, error: { code: 'QUESTION_NOT_FOUND', message: 'Question not found' } });
        }
        const correct = answer === question.correctAnswer;
        const currentAnswers = session.answers || [];
        const newAnswer = {
            qId: questionId,
            skill: question.skill,
            difficulty: question.difficulty,
            correct,
            responseTimeSec,
            a: question.discrimination ?? 1.0,
        };
        const updatedAnswers = [...currentAnswers, newAnswer];
        // 估算当前能力值
        const currentAbility = (0, cefr_utils_1.estimateAbility)(updatedAnswers);
        // 检查是否收敛或达到最大题目数
        const shouldComplete = updatedAnswers.length >= 20 || isConverged(updatedAnswers);
        if (shouldComplete) {
            // 更新会话状态
            await db.update(database_1.assessmentSessions)
                .set({ answers: updatedAnswers, status: 'completed', completedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(database_1.assessmentSessions.id, sessionId));
            // 计算最终能力分析
            const result = buildAbilityResult(updatedAnswers, currentAbility, userId);
            // 更新会话结果
            await db.update(database_1.assessmentSessions)
                .set({ result })
                .where((0, drizzle_orm_1.eq)(database_1.assessmentSessions.id, sessionId));
            return reply.send({
                success: true,
                data: {
                    completed: true,
                    result,
                    sessionId,
                },
            });
        }
        // CAT：根据当前能力决定下一题难度
        const nextDifficulty = calcNextDifficulty(updatedAnswers, currentAbility);
        const nextQuestion = getNextQuestion(sessionId, updatedAnswers.map(a => a.qId), nextDifficulty);
        // 更新会话
        await db.update(database_1.assessmentSessions)
            .set({ answers: updatedAnswers })
            .where((0, drizzle_orm_1.eq)(database_1.assessmentSessions.id, sessionId));
        return reply.send({
            success: true,
            data: {
                completed: false,
                correct,
                currentAbility,
                question: nextQuestion,
                progress: { current: updatedAnswers.length + 1, total: 20 },
            },
        });
    });
    // POST /v1/assessment/complete — 保存测评结果到用户档案
    app.post('/complete', async (req, reply) => {
        const userId = req.user.userId;
        const { sessionId } = req.body;
        const db = (0, database_1.getDb)();
        const [session] = await db.select().from(database_1.assessmentSessions)
            .where((0, drizzle_orm_1.eq)(database_1.assessmentSessions.id, sessionId)).limit(1);
        if (!session || session.status !== 'completed' || session.userId !== userId) {
            return reply.code(400).send({ success: false, error: { code: 'INVALID_SESSION', message: 'Session not completed' } });
        }
        const result = session.result;
        if (!result) {
            return reply.code(400).send({ success: false, error: { code: 'NO_RESULT', message: 'No result available' } });
        }
        // 插入或更新用户能力模型
        await db.insert(database_1.userAbilityModels).values({
            userId,
            overallCefr: result.overallCefr.toString(),
            vocabularyCefr: result.dimensions.vocabulary.toString(),
            grammarCefr: result.dimensions.grammar.toString(),
            readingCefr: result.dimensions.reading.toString(),
            listeningCefr: result.dimensions.listening.toString(),
            speakingCefr: result.dimensions.speaking.toString(),
            writingCefr: result.dimensions.writing.toString(),
            estimatedVocabSize: result.estimatedVocabSize,
            ieltsPrediction: result.ieltsPrediction.toString(),
            masteredGrammar: result.masteredGrammar,
            weakAreas: result.weakAreas,
            errorPatterns: [],
            confidenceInterval: result.confidenceInterval.toString(),
        }).onConflictDoUpdate({
            target: database_1.userAbilityModels.userId,
            set: {
                overallCefr: result.overallCefr.toString(),
                vocabularyCefr: result.dimensions.vocabulary.toString(),
                grammarCefr: result.dimensions.grammar.toString(),
                readingCefr: result.dimensions.reading.toString(),
                listeningCefr: result.dimensions.listening.toString(),
                speakingCefr: result.dimensions.speaking.toString(),
                writingCefr: result.dimensions.writing.toString(),
                estimatedVocabSize: result.estimatedVocabSize,
                ieltsPrediction: result.ieltsPrediction.toString(),
                masteredGrammar: result.masteredGrammar,
                weakAreas: result.weakAreas,
                confidenceInterval: result.confidenceInterval.toString(),
                updatedAt: new Date(),
            },
        });
        // 标记引导流程完成
        await db.update(database_1.users).set({ onboardingCompleted: true }).where((0, drizzle_orm_1.eq)(database_1.users.id, userId));
        // 创建初始能力快照（为进度曲线提供起点）
        const today = new Date().toISOString().split('T')[0];
        await db.insert(database_1.abilityModelSnapshots).values({
            userId,
            snapshotDate: today,
            overallCefr: result.overallCefr.toString(),
            vocabularyCefr: result.dimensions.vocabulary.toString(),
            grammarCefr: result.dimensions.grammar.toString(),
            readingCefr: result.dimensions.reading.toString(),
            listeningCefr: result.dimensions.listening.toString(),
            speakingCefr: result.dimensions.speaking.toString(),
            writingCefr: result.dimensions.writing.toString(),
            ieltsPrediction: result.ieltsPrediction.toString(),
        }).onConflictDoNothing(); // 若当天已有快照则跳过
        return reply.send({ success: true, data: { message: 'Assessment saved', abilityModel: result } });
    });
}
// ─────────────────────────────────────────────
// CAT 辅助函数
// ─────────────────────────────────────────────
function getNextQuestion(sessionId, usedIds, targetDifficulty) {
    // 在目标难度附近（±0.3）找一道未用过的题
    const candidates = question_bank_js_1.QUESTION_BANK.filter(q => !usedIds.includes(q.id) && Math.abs(q.difficulty - targetDifficulty) <= 0.3);
    if (candidates.length === 0) {
        // 放宽范围
        const wider = question_bank_js_1.QUESTION_BANK.filter(q => !usedIds.includes(q.id) && Math.abs(q.difficulty - targetDifficulty) <= 0.7);
        if (wider.length === 0)
            return question_bank_js_1.QUESTION_BANK.find(q => !usedIds.includes(q.id)) ?? question_bank_js_1.QUESTION_BANK[0];
        return wider[Math.floor(Math.random() * wider.length)];
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}
function calcNextDifficulty(answers, currentAbility) {
    if (answers.length === 0)
        return 3.0;
    const lastAnswer = answers[answers.length - 1];
    const lastTwo = answers.slice(-3);
    // 连续3题全对 → 跳档 +1.0
    if (lastTwo.length === 3 && lastTwo.every(a => a.correct)) {
        return Math.min(6.0, currentAbility + 1.0);
    }
    // 连续3题全错 → 跳档 -1.0
    if (lastTwo.length === 3 && lastTwo.every(a => !a.correct)) {
        return Math.max(1.0, currentAbility - 1.0);
    }
    // 单题上/下调 0.5
    const delta = lastAnswer.correct ? 0.5 : -0.5;
    return Math.max(1.0, Math.min(6.0, currentAbility + delta));
}
function isConverged(answers) {
    if (answers.length < 8)
        return false;
    // 检查最近 4 题是否在同一难度档位来回震荡
    const last4 = answers.slice(-4);
    const diffs = last4.map(a => a.difficulty);
    const range = Math.max(...diffs) - Math.min(...diffs);
    return range <= 0.5; // 难度范围在 0.5 内认为收敛
}
function buildAbilityResult(answers, overallCefr, _userId) {
    // 按技能分组计算各维度能力值
    const bySkill = {};
    for (const a of answers) {
        if (!bySkill[a.skill])
            bySkill[a.skill] = [];
        bySkill[a.skill].push(a);
    }
    const calcSkillCefr = (skillAnswers) => {
        if (!skillAnswers || skillAnswers.length === 0)
            return overallCefr;
        return Math.max(1.0, Math.min(6.0, (0, cefr_utils_1.estimateAbility)(skillAnswers)));
    };
    const dimensions = {
        vocabulary: calcSkillCefr(bySkill['vocabulary']),
        grammar: calcSkillCefr(bySkill['grammar']),
        reading: calcSkillCefr(bySkill['reading']),
        listening: calcSkillCefr(bySkill['listening']),
        speaking: overallCefr, // 测评不含口语，默认等于综合分
        writing: overallCefr, // 测评不含写作，默认等于综合分
    };
    const ieltsPrediction = (0, cefr_utils_1.cefrToIeltsPrediction)(overallCefr);
    // 估算词汇量（基于词汇维度分）
    const vocabMapping = {
        1: 500, 2: 1200, 3: 2500, 4: 4500, 5: 7000, 6: 10000,
    };
    const vocabBase = Math.floor(dimensions.vocabulary);
    const vocabInterp = (vocabMapping[vocabBase + 1] ?? 10000) - (vocabMapping[vocabBase] ?? 500);
    const estimatedVocabSize = Math.round((vocabMapping[vocabBase] ?? 500) + vocabInterp * (dimensions.vocabulary - vocabBase));
    // 识别弱点技能
    const allDims = Object.entries(dimensions);
    const minCefr = Math.min(...allDims.map(([, v]) => v));
    const weakSkills = allDims
        .filter(([, v]) => v <= minCefr + 0.3)
        .map(([k]) => k);
    const weakAreas = {};
    for (const skill of weakSkills) {
        weakAreas[skill] = ['needs_improvement'];
    }
    return {
        overallCefr: parseFloat(overallCefr.toFixed(1)),
        dimensions: Object.fromEntries(Object.entries(dimensions).map(([k, v]) => [k, parseFloat(v.toFixed(1))])),
        ieltsPrediction,
        estimatedVocabSize,
        masteredGrammar: inferMasteredGrammar(dimensions.grammar),
        weakAreas,
        confidenceInterval: answers.length >= 20 ? 0.2 : 0.4,
    };
}
function inferMasteredGrammar(grammarCefr) {
    const grammarByLevel = {
        1: ['present_simple', 'past_simple', 'basic_articles', 'plural_nouns'],
        2: ['present_continuous', 'future_will', 'comparative_adjectives', 'can_modal'],
        3: ['present_perfect', 'passive_voice_simple', 'relative_clauses_basic', 'conditional_type_1'],
        4: ['past_perfect', 'passive_voice_complex', 'modal_verbs_all', 'conditional_type_2', 'reported_speech'],
        5: ['subjunctive_mood', 'inversion_basic', 'participle_clauses', 'cleft_sentences'],
        6: ['advanced_inversion', 'nominalization', 'complex_conditionals'],
    };
    const mastered = [];
    for (let level = 1; level <= Math.floor(grammarCefr); level++) {
        mastered.push(...(grammarByLevel[level] ?? []));
    }
    return mastered;
}
//# sourceMappingURL=assessment.routes.js.map