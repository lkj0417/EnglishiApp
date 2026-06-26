"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const database_1 = require("@englishi/database");
const drizzle_orm_1 = require("drizzle-orm");
const reading_engine_js_1 = require("./engines/reading.engine.js");
const writing_engine_js_1 = require("./engines/writing.engine.js");
const speaking_engine_js_1 = require("./engines/speaking.engine.js");
const redisConnection = new ioredis_1.default(process.env['REDIS_URL'] ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
// ─────────────────────────────────────────────
// Worker 1：阅读文章生成
// ─────────────────────────────────────────────
const readingWorker = new bullmq_1.Worker('reading-generate', async (job) => {
    console.log(`[ReadingWorker] Processing job ${job.id}`);
    const { userId, topic, abilitySnapshot } = job.data;
    const ucl = {
        userId,
        overallCefr: parseFloat(abilitySnapshot.overallCefr),
        dimensions: {
            vocabulary: parseFloat(abilitySnapshot.vocabularyCefr),
            grammar: parseFloat(abilitySnapshot.grammarCefr),
            reading: parseFloat(abilitySnapshot.readingCefr),
            listening: parseFloat(abilitySnapshot.listeningCefr),
            speaking: parseFloat(abilitySnapshot.speakingCefr),
            writing: parseFloat(abilitySnapshot.writingCefr),
        },
        estimatedVocabSize: abilitySnapshot.estimatedVocabSize ?? 2000,
        ieltsPrediction: parseFloat(abilitySnapshot.ieltsPrediction ?? '5.0'),
        masteredGrammar: abilitySnapshot.masteredGrammar ?? [],
        notYetGrammar: [],
        weakAreas: abilitySnapshot.weakAreas ?? {},
        errorPatterns: abilitySnapshot.errorPatterns ?? [],
        confidenceInterval: 0.3,
        updatedAt: new Date().toISOString(),
    };
    const article = await (0, reading_engine_js_1.generateReadingArticle)({
        ucl,
        interestDomain: 'technology', // 实际应从用户设置读取
        topic,
    });
    // 存入缓存表
    const db = (0, database_1.getDb)();
    const [saved] = await db.insert(database_1.generatedContent).values({
        contentType: 'reading_article',
        cefrLevel: ucl.overallCefr.toString(),
        interestDomain: 'technology',
        contentJson: article,
        cqvPassed: true,
        cqvCheckedAt: new Date(),
        useCount: 0,
    }).returning();
    console.log(`[ReadingWorker] Generated article ${saved.id}`);
    return { ...article, id: saved.id };
}, { connection: redisConnection, concurrency: 3 });
// ─────────────────────────────────────────────
// Worker 2：写作批改
// ─────────────────────────────────────────────
const writingWorker = new bullmq_1.Worker('writing-critique', async (job) => {
    console.log(`[WritingWorker] Processing job ${job.id}`);
    const { submissionId, userId, taskType, taskPrompt, submissionText } = job.data;
    const db = (0, database_1.getDb)();
    const { userAbilityModels } = await import('@englishi/database');
    const [ability] = await db.select().from(userAbilityModels)
        .where((0, drizzle_orm_1.eq)(userAbilityModels.userId, userId)).limit(1);
    if (!ability)
        throw new Error('No ability model found for user');
    const ucl = {
        userId,
        overallCefr: parseFloat(ability.overallCefr),
        dimensions: {
            vocabulary: parseFloat(ability.vocabularyCefr),
            grammar: parseFloat(ability.grammarCefr),
            reading: parseFloat(ability.readingCefr),
            listening: parseFloat(ability.listeningCefr),
            speaking: parseFloat(ability.speakingCefr),
            writing: parseFloat(ability.writingCefr),
        },
        estimatedVocabSize: ability.estimatedVocabSize ?? 2000,
        ieltsPrediction: parseFloat(ability.ieltsPrediction ?? '5.0'),
        masteredGrammar: ability.masteredGrammar ?? [],
        notYetGrammar: [],
        weakAreas: ability.weakAreas ?? {},
        errorPatterns: ability.errorPatterns ?? [],
        confidenceInterval: 0.3,
        updatedAt: new Date().toISOString(),
    };
    const startTime = Date.now();
    const report = await (0, writing_engine_js_1.critiqueWriting)({ ucl, taskType, taskPrompt, submissionText });
    const duration = Date.now() - startTime;
    await db.update(database_1.writingTasks).set({
        status: 'completed',
        bandScores: report.overall,
        critiqueReport: report,
        processingDurationMs: duration,
        critiqueCompletedAt: new Date(),
    }).where((0, drizzle_orm_1.eq)(database_1.writingTasks.id, submissionId));
    console.log(`[WritingWorker] Critique completed for ${submissionId} in ${duration}ms`);
    return { submissionId, overall: report.overall };
}, { connection: redisConnection, concurrency: 2 });
// ─────────────────────────────────────────────
// Worker 3：口语报告生成
// ─────────────────────────────────────────────
const speakingWorker = new bullmq_1.Worker('speaking-report', async (job) => {
    console.log(`[SpeakingWorker] Processing job ${job.id}`);
    const { sessionId, userId, transcript, acousticData } = job.data;
    const db = (0, database_1.getDb)();
    const { userAbilityModels } = await import('@englishi/database');
    const [ability] = await db.select().from(userAbilityModels)
        .where((0, drizzle_orm_1.eq)(userAbilityModels.userId, userId)).limit(1);
    if (!ability)
        throw new Error('No ability model found');
    const ucl = {
        userId,
        overallCefr: parseFloat(ability.overallCefr),
        dimensions: {
            vocabulary: parseFloat(ability.vocabularyCefr),
            grammar: parseFloat(ability.grammarCefr),
            reading: parseFloat(ability.readingCefr),
            listening: parseFloat(ability.listeningCefr),
            speaking: parseFloat(ability.speakingCefr),
            writing: parseFloat(ability.writingCefr),
        },
        estimatedVocabSize: ability.estimatedVocabSize ?? 2000,
        ieltsPrediction: parseFloat(ability.ieltsPrediction ?? '5.0'),
        masteredGrammar: ability.masteredGrammar ?? [],
        notYetGrammar: [],
        weakAreas: ability.weakAreas ?? {},
        errorPatterns: ability.errorPatterns ?? [],
        confidenceInterval: 0.3,
        updatedAt: new Date().toISOString(),
    };
    const report = await (0, speaking_engine_js_1.generateSpeakingReport)({
        ucl,
        transcript: transcript ?? [],
        acousticData: acousticData ?? { fillerWordCount: 0, fillerWordsFound: [], avgSpeechRateWpm: 130, pauseFrequencyPerMinute: 2 },
        sessionType: 'Part1',
    });
    await db.update(database_1.speakingSessions).set({
        status: 'completed',
        bandScores: report.dimensionScores,
        feedbackReport: report,
        completedAt: new Date(),
    }).where((0, drizzle_orm_1.eq)(database_1.speakingSessions.id, sessionId));
    console.log(`[SpeakingWorker] Report generated for session ${sessionId}`);
    return { sessionId, overallBand: report.overallBand };
}, { connection: redisConnection, concurrency: 2 });
// 错误处理
[readingWorker, writingWorker, speakingWorker].forEach(worker => {
    worker.on('failed', (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed:`, err.message);
    });
});
console.log('✅ EnglishiApp AI Service Workers started');
console.log('  → ReadingWorker: listening on queue "reading-generate"');
console.log('  → WritingWorker: listening on queue "writing-critique"');
console.log('  → SpeakingWorker: listening on queue "speaking-report"');
//# sourceMappingURL=workers.js.map