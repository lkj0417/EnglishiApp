import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb, speakingSessions, userAbilityModels } from '@englishi/database';
import { eq } from 'drizzle-orm';

export async function speakingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (app as any).authenticate);

  // POST /v1/speaking/sessions — 创建口语会话
  app.post('/sessions', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const { sessionType = 'Part1' } = req.body as { sessionType?: string };

    const db = getDb();
    const [session] = await db.insert(speakingSessions).values({
      userId,
      sessionType,
      status: 'recording',
    }).returning({ id: speakingSessions.id });

    // 生成 WebSocket Token（有效期 2 小时）
    const wsToken = app.jwt.sign({ userId, sessionId: session!.id, type: 'ws' }, { expiresIn: '2h' });

    return reply.code(201).send({
      success: true,
      data: {
        sessionId: session!.id,
        wsToken,
        wsUrl: `ws://${req.hostname}:${process.env['PORT'] ?? 3001}/v1/speaking/sessions/${session!.id}/stream`,
        sessionType,
      },
    });
  });

  // GET /v1/speaking/sessions/:id/report — 获取会话报告
  app.get('/sessions/:id/report', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const { id } = req.params as { id: string };

    const db = getDb();
    const [session] = await db.select().from(speakingSessions)
      .where(eq(speakingSessions.id, id)).limit(1);

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
  app.get('/sessions/:id/stream', { websocket: true }, (socket: any, req) => {
    const { id: sessionId } = req.params as { id: string };
    let audioChunks: Buffer[] = [];
    let transcript: Array<{ speaker: string; text: string; tsStart: number; tsEnd: number }> = [];

    // fastify-websocket wraps the raw ws socket
    const ws = socket.socket ?? socket;

    const send = (data: object) => {
      try { ws.send(JSON.stringify(data)); } catch {}
    };

    app.log.info(`Speaking session ${sessionId} WebSocket connected`);

    ws.on('message', async (rawMsg: Buffer) => {
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
            const chunk = Buffer.from(msg.data, 'base64');
            audioChunks.push(chunk);
            break;
          }

          case 'candidate_recording_end': {
            audioChunks = [];

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

              const db = getDb();
              await db.update(speakingSessions).set({
                transcript,
                status: 'processing',
                audioDurationSec: Math.round(msg.total_duration_sec ?? 120),
              }).where(eq(speakingSessions.id, sessionId));

              ws.close();
            }
            break;
          }
        }
      } catch (err) {
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

