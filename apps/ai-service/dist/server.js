"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const database_1 = require("@englishi/database");
const drizzle_orm_1 = require("drizzle-orm");
const reading_engine_js_1 = require("./engines/reading.engine.js");
const writing_engine_js_1 = require("./engines/writing.engine.js");
const speaking_engine_js_1 = require("./engines/speaking.engine.js");
const openai_client_js_1 = require("./lib/openai-client.js");
const PORT = parseInt(process.env['PORT'] ?? '3002', 10);
const redisConnection = new ioredis_1.default(process.env['REDIS_URL'] ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
// ─────────────────────────────────────────────
// BullMQ Workers
// ─────────────────────────────────────────────
const readingWorker = new bullmq_1.Worker('reading-generate', async (job) => {
    const { userId, topic, abilitySnapshot } = job.data;
    const db = (0, database_1.getDb)();
    // 读取用户兴趣标签，优先使用 primaryInterest
    const [userProfile] = await db.select({ primaryInterest: database_1.users.primaryInterest, interestTags: database_1.users.interestTags })
        .from(database_1.users).where((0, drizzle_orm_1.eq)(database_1.users.id, userId)).limit(1);
    const interestDomain = userProfile?.primaryInterest
        ?? userProfile?.interestTags?.[0]
        ?? 'general knowledge';
    const ucl = snapshotToUCL(userId, abilitySnapshot);
    const article = await (0, reading_engine_js_1.generateReadingArticle)({ ucl, interestDomain, topic });
    const [saved] = await db.insert(database_1.generatedContent).values({
        contentType: 'reading_article',
        cefrLevel: ucl.overallCefr.toString(),
        interestDomain,
        contentJson: article,
        cqvPassed: true,
        cqvCheckedAt: new Date(),
        useCount: 0,
    }).returning();
    return { ...article, id: saved.id };
}, { connection: redisConnection, concurrency: 3 });
const writingWorker = new bullmq_1.Worker('writing-critique', async (job) => {
    const { submissionId, userId, taskType, taskPrompt, submissionText } = job.data;
    const db = (0, database_1.getDb)();
    const [ability] = await db.select().from(database_1.userAbilityModels).where((0, drizzle_orm_1.eq)(database_1.userAbilityModels.userId, userId)).limit(1);
    if (!ability)
        throw new Error('No ability model found');
    const ucl = snapshotToUCL(userId, ability);
    const startTime = Date.now();
    const report = await (0, writing_engine_js_1.critiqueWriting)({ ucl, taskType, taskPrompt, submissionText });
    await db.update(database_1.writingTasks).set({
        status: 'completed',
        bandScores: report.overall,
        critiqueReport: report,
        processingDurationMs: Date.now() - startTime,
        critiqueCompletedAt: new Date(),
    }).where((0, drizzle_orm_1.eq)(database_1.writingTasks.id, submissionId));
    return { submissionId, overall: report.overall };
}, { connection: redisConnection, concurrency: 2 });
const speakingWorker = new bullmq_1.Worker('speaking-report', async (job) => {
    const { sessionId, userId, transcript, acousticData } = job.data;
    const db = (0, database_1.getDb)();
    const [ability] = await db.select().from(database_1.userAbilityModels).where((0, drizzle_orm_1.eq)(database_1.userAbilityModels.userId, userId)).limit(1);
    if (!ability)
        throw new Error('No ability model found');
    const ucl = snapshotToUCL(userId, ability);
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
    return { sessionId, overallBand: report.overallBand };
}, { connection: redisConnection, concurrency: 2 });
const grammarWorker = new bullmq_1.Worker('grammar-lesson', async (job) => {
    const { grammarPoint, userId } = job.data;
    const db = (0, database_1.getDb)();
    const [ability] = await db.select().from(database_1.userAbilityModels).where((0, drizzle_orm_1.eq)(database_1.userAbilityModels.userId, userId)).limit(1);
    const grammarCefr = parseFloat(ability?.grammarCefr ?? '3.0');
    const lesson = await (0, openai_client_js_1.callLLM)({
        tier: 'fast',
        messages: [{
                role: 'user',
                content: `Generate an EFL grammar lesson for the grammar point "${grammarPoint}" at CEFR level ${grammarCefr.toFixed(1)}.
      
      Output JSON only:
      {
        "grammar_point": "string",
        "one_line_rule": "string (max 20 words, plain English)",
        "inductive_examples": [
          {"context": "string", "correct": "string", "incorrect": "string", "difference_highlight": "string"}
        ],
        "when_to_use": ["string"],
        "when_not_to_use": ["string"],
        "chinese_learner_pitfall": "string",
        "quick_reference": "string",
        "exercises": [
          {"id": 1, "type": "string", "instruction": "string", "question": "string", "options": ["string"], "correct_answer": "string", "explanation": "string"}
        ]
      }`,
            }],
        temperature: 0.5,
        taskLabel: 'GrammarLesson',
    });
    // 缓存生成的语法讲解
    await db.insert(database_1.generatedContent).values({
        contentType: 'grammar_lesson',
        cefrLevel: grammarCefr.toString(),
        grammarPoint,
        contentJson: lesson,
        cqvPassed: true,
        cqvCheckedAt: new Date(),
    }).onConflictDoNothing();
    return lesson;
}, { connection: redisConnection, concurrency: 5 });
// 听力生成 Worker
const listeningWorker = new bullmq_1.Worker('listening-generate', async (job) => {
    const { userId, topic, subSkill, abilitySnapshot } = job.data;
    const db = (0, database_1.getDb)();
    const ucl = snapshotToUCL(userId, abilitySnapshot);
    const listeningCefr = ucl.dimensions.listening.toFixed(1);
    const speechRateWpm = ucl.dimensions.listening < 3 ? 90
        : ucl.dimensions.listening < 4 ? 120
            : ucl.dimensions.listening < 5 ? 150
                : 170;
    const lesson = await (0, openai_client_js_1.callLLM)({
        tier: 'fast',
        messages: [{
                role: 'user',
                content: `Generate an IELTS-style listening exercise for an EFL learner at CEFR ${listeningCefr}.

Topic: ${topic ?? 'everyday life'}
Sub-skill focus: ${subSkill ?? 'detail_comprehension'}
Speech rate target: ~${speechRateWpm} wpm (embed [PAUSE:1s] markers in script)
Accent: neutral British or American

Sub-skill types: detail_comprehension | number_extraction | attitude_opinion | topic_change | inference

Output JSON only:
{
  "title": "string",
  "cefr_level": "string",
  "speech_rate_wpm": "integer",
  "duration_seconds": "integer",
  "sub_skill": "string",
  "transcript": "string (full spoken text with [PAUSE:Xs] markers)",
  "tts_params": {"voice": "string", "rate": "string (0.8-1.2)"},
  "questions": [
    {
      "id": "integer",
      "sub_skill": "string",
      "question": "string",
      "type": "string (multiple_choice|short_answer|fill_blank)",
      "options": ["string"] ,
      "correct_answer": "string",
      "explanation": "string (max 30 words)"
    }
  ],
  "vocab_focus": [{"word": "string", "definition_zh": "string", "phonetic": "string"}]
}`,
            }],
        temperature: 0.7,
        taskLabel: 'ListeningEngine',
        userId,
    });
    const [saved] = await db.insert(database_1.generatedContent).values({
        contentType: 'listening_audio',
        cefrLevel: ucl.dimensions.listening.toString(),
        interestDomain: topic ?? 'general',
        contentJson: lesson,
        cqvPassed: true,
        cqvCheckedAt: new Date(),
        useCount: 0,
    }).returning();
    return { ...lesson, id: saved.id };
}, { connection: redisConnection, concurrency: 3 });
// 错误处理（加入 listeningWorker）
[readingWorker, writingWorker, speakingWorker, grammarWorker, listeningWorker].forEach(w => {
    w.on('failed', (job, err) => console.error(`Worker job ${job?.id} failed:`, err.message));
    w.on('completed', job => console.log(`Worker job ${job.id} completed`));
});
// ─────────────────────────────────────────────
// HTTP API（内部服务，供 core-service 调用）
// ─────────────────────────────────────────────
async function buildAIServer() {
    const app = (0, fastify_1.default)({ logger: { level: 'info' } });
    await app.register(cors_1.default, { origin: true });
    app.get('/health', async () => ({
        status: 'ok',
        workers: { reading: 'active', writing: 'active', speaking: 'active', grammar: 'active', listening: 'active' },
    }));
    // 词汇解析（同步，快速）
    app.post('/vocab/explain', async (req, reply) => {
        const { word, wordCefr, learnerCefr, interestDomain } = req.body;
        const result = await (0, openai_client_js_1.callLLM)({
            tier: 'fast',
            messages: [{
                    role: 'user',
                    content: `Explain the English word "${word}" (CEFR ${wordCefr}) for an EFL learner at CEFR ${learnerCefr}.
        Interest domain: ${interestDomain ?? 'general'}.
        Context vocab ceiling: CEFR ${(learnerCefr - 0.5).toFixed(1)} (all example sentence words must be below this).
        
        Output JSON only:
        {
          "word": "string",
          "phonetic": "string (IPA)",
          "cefr_level": "string",
          "part_of_speech": "string",
          "definition_en": "string (max 12 words, simple English)",
          "definition_zh": "string",
          "example_sentences": [
            {"sentence": "string", "domain": "string", "context_clues": "string"},
            {"sentence": "string", "domain": "string", "context_clues": "string"}
          ],
          "word_family": {"noun": "string|null", "verb": "string|null", "adjective": "string|null", "adverb": "string|null"},
          "common_collocations": ["string"],
          "common_errors": [{"error": "string", "correction": "string"}],
          "memory_aid": "string|null"
        }`,
                }],
            temperature: 0.6,
            taskLabel: 'VocabExplain',
        });
        return reply.send({ success: true, data: result });
    });
    // Part 3 动态追问（同步，实时性要求高）
    app.post('/speaking/follow-up', async (req, reply) => {
        const { originalQuestion, candidateResponse, speakingCefr } = req.body;
        const result = await (0, speaking_engine_js_1.generatePart3FollowUp)({ originalQuestion, candidateResponse, speakingCefr });
        return reply.send({ success: true, data: result });
    });
    return app;
}
async function start() {
    const app = await buildAIServer();
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`✅ EnglishiApp AI Service running on port ${PORT}`);
    console.log('Workers: reading, writing, speaking, grammar, listening — all active');
}
start().catch(err => {
    console.error('AI Service failed to start:', err);
    process.exit(1);
});
// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────
function snapshotToUCL(userId, snapshot) {
    return {
        userId,
        overallCefr: parseFloat(snapshot.overallCefr ?? snapshot.overall_cefr ?? '3.0'),
        dimensions: {
            vocabulary: parseFloat(snapshot.vocabularyCefr ?? snapshot.vocabulary_cefr ?? '3.0'),
            grammar: parseFloat(snapshot.grammarCefr ?? snapshot.grammar_cefr ?? '3.0'),
            reading: parseFloat(snapshot.readingCefr ?? snapshot.reading_cefr ?? '3.0'),
            listening: parseFloat(snapshot.listeningCefr ?? snapshot.listening_cefr ?? '3.0'),
            speaking: parseFloat(snapshot.speakingCefr ?? snapshot.speaking_cefr ?? '3.0'),
            writing: parseFloat(snapshot.writingCefr ?? snapshot.writing_cefr ?? '3.0'),
        },
        estimatedVocabSize: snapshot.estimatedVocabSize ?? snapshot.estimated_vocab_size ?? 2000,
        ieltsPrediction: parseFloat(snapshot.ieltsPrediction ?? snapshot.ielts_prediction ?? '5.0'),
        masteredGrammar: snapshot.masteredGrammar ?? snapshot.mastered_grammar ?? [],
        notYetGrammar: [],
        weakAreas: snapshot.weakAreas ?? snapshot.weak_areas ?? {},
        errorPatterns: snapshot.errorPatterns ?? snapshot.error_patterns ?? [],
        confidenceInterval: 0.3,
        updatedAt: new Date().toISOString(),
    };
}
//# sourceMappingURL=server.js.map