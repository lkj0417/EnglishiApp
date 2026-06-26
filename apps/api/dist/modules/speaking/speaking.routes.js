"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.speakingRoutes = speakingRoutes;
const database_1 = require("@englishi/database");
const drizzle_orm_1 = require("drizzle-orm");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
let speakingReportQueue = null;
function getSpeakingReportQueue() {
    if (!speakingReportQueue) {
        const redis = new ioredis_1.default(process.env['REDIS_URL'] ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
        speakingReportQueue = new bullmq_1.Queue('speaking-report', { connection: redis });
    }
    return speakingReportQueue;
}
async function speakingRoutes(app) {
    app.addHook('preHandler', app.authenticate);
    // POST /v1/speaking/sessions — 创建口语会话
    app.post('/sessions', async (req, reply) => {
        const userId = req.user.userId;
        const { sessionType = 'Part1' } = req.body;
        const db = (0, database_1.getDb)();
        const [session] = await db.insert(database_1.speakingSessions).values({
            userId,
            sessionType,
            status: 'recording',
        }).returning({ id: database_1.speakingSessions.id });
        // 生成 WebSocket Token（有效期 2 小时）
        const wsToken = app.jwt.sign({ userId, sessionId: session.id, type: 'ws' }, { expiresIn: '2h' });
        return reply.code(201).send({
            success: true,
            data: {
                sessionId: session.id,
                wsToken,
                wsUrl: `ws://${req.hostname}:${process.env['PORT'] ?? 3001}/v1/speaking/sessions/${session.id}/stream`,
                sessionType,
            },
        });
    });
    // GET /v1/speaking/sessions/:id/report — 获取会话报告
    app.get('/sessions/:id/report', async (req, reply) => {
        const userId = req.user.userId;
        const { id } = req.params;
        const db = (0, database_1.getDb)();
        const [session] = await db.select().from(database_1.speakingSessions)
            .where((0, drizzle_orm_1.eq)(database_1.speakingSessions.id, id)).limit(1);
        if (!session || session.userId !== userId) {
            return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
        }
        if (session.status !== 'completed') {
            return reply.code(202).send({
                success: true,
                data: { status: session.status, message: 'Report not ready yet. Please retry.' },
            });
        }
        return reply.send({
            success: true,
            data: {
                sessionId: id,
                sessionType: session.sessionType,
                bandScores: session.bandScores,
                feedbackReport: session.feedbackReport,
                audioDurationSec: session.audioDurationSec,
                completedAt: session.completedAt,
            },
        });
    });
    // WebSocket: 口语实时流
    app.get('/sessions/:id/stream', { websocket: true }, (socket, req) => {
        const { id: sessionId } = req.params;
        const transcript = [];
        // fastify-websocket wraps the raw ws socket
        const ws = socket.socket ?? socket;
        const send = (data) => {
            try {
                ws.send(JSON.stringify(data));
            }
            catch { }
        };
        app.log.info(`Speaking session ${sessionId} WebSocket connected`);
        ws.on('message', async (rawMsg) => {
            try {
                const msg = JSON.parse(rawMsg.toString());
                switch (msg.type) {
                    case 'session_start': {
                        send({
                            type: 'examiner_question',
                            payload: {
                                qId: 'T1Q1',
                                text: "Let's begin. Can you tell me a little about yourself and where you're from?",
                            },
                            session_id: sessionId,
                            timestamp: Date.now(),
                        });
                        break;
                    }
                    case 'audio_chunk': {
                        // Audio chunks received — in production, accumulate and send to ASR service
                        // For now just acknowledge receipt
                        break;
                    }
                    case 'candidate_recording_end': {
                        send({
                            type: 'transcription_stream',
                            payload: { text: '...', is_final: false },
                            session_id: sessionId,
                            timestamp: Date.now(),
                        });
                        const transcription = msg.mock_text ?? '[Transcription would appear here]';
                        transcript.push({
                            speaker: 'candidate',
                            text: transcription,
                            tsStart: msg.ts_start ?? 0,
                            tsEnd: msg.ts_end ?? (msg.duration_ms ?? 0) / 1000,
                        });
                        send({
                            type: 'transcription_final',
                            payload: { text: transcription, qId: msg.qId },
                            session_id: sessionId,
                            timestamp: Date.now(),
                        });
                        if (msg.is_last_question) {
                            send({
                                type: 'session_complete',
                                payload: { report_available_at: new Date(Date.now() + 30000).toISOString() },
                                session_id: sessionId,
                                timestamp: Date.now(),
                            });
                            const db = (0, database_1.getDb)();
                            // 更新会话状态
                            await db.update(database_1.speakingSessions).set({
                                transcript,
                                status: 'processing',
                                audioDurationSec: Math.round(msg.total_duration_sec ?? 120),
                            }).where((0, drizzle_orm_1.eq)(database_1.speakingSessions.id, sessionId));
                            // 获取用户 ID 并触发报告生成 Worker
                            const [session] = await db.select({ userId: database_1.speakingSessions.userId, sessionType: database_1.speakingSessions.sessionType })
                                .from(database_1.speakingSessions).where((0, drizzle_orm_1.eq)(database_1.speakingSessions.id, sessionId)).limit(1);
                            if (session) {
                                const queue = getSpeakingReportQueue();
                                await queue.add('generate-report', {
                                    sessionId,
                                    userId: session.userId,
                                    transcript,
                                    acousticData: {
                                        fillerWordCount: msg.filler_word_count ?? 0,
                                        fillerWordsFound: msg.filler_words ?? [],
                                        avgSpeechRateWpm: msg.avg_speech_rate_wpm ?? 130,
                                        pauseFrequencyPerMinute: msg.pause_frequency ?? 2,
                                    },
                                    sessionType: session.sessionType,
                                }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
                            }
                            ws.close();
                        }
                        break;
                    }
                }
            }
            catch (err) {
                app.log.error({ err }, 'WebSocket message error');
                send({
                    type: 'error',
                    payload: { code: 'PROCESSING_ERROR', message: 'Failed to process audio' },
                    session_id: sessionId,
                    timestamp: Date.now(),
                });
            }
        });
        ws.on('close', () => {
            app.log.info(`Speaking session ${sessionId} WebSocket closed`);
        });
    });
}
//# sourceMappingURL=speaking.routes.js.map