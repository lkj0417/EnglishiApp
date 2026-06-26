import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import Redis from 'ioredis';
import { registerWorkers } from './workers.js';
import { generatePart3FollowUp } from './engines/speaking.engine.js';
import { callLLM } from './lib/openai-client.js';

const PORT = parseInt(process.env['PORT'] ?? '3002', 10);

const redisConnection = new Redis(
  process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  { maxRetriesPerRequest: null },
) as any;

// 启动全部 BullMQ Worker（阅读 / 写作 / 口语 / 语法 / 听力）
const workers = registerWorkers(redisConnection);


// ─────────────────────────────────────────────
// HTTP API（内部服务，供 core-service 调用）
// ─────────────────────────────────────────────
async function buildAIServer() {
  const app = Fastify({ logger: { level: 'info' } });
  await app.register(fastifyCors, { origin: true });

  app.get('/health', async () => ({
    status: 'ok',
    workers: { reading: 'active', writing: 'active', speaking: 'active', grammar: 'active', listening: 'active' },
  }));

  // 词汇解析（同步，快速）
  app.post('/vocab/explain', async (req, reply) => {
    const { word, wordCefr, learnerCefr, interestDomain } = req.body as any;

    const result = await callLLM<any>({
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
    const { originalQuestion, candidateResponse, speakingCefr } = req.body as any;
    const result = await generatePart3FollowUp({ originalQuestion, candidateResponse, speakingCefr });
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

// 优雅关闭：先关闭 Worker，避免任务被强杀
async function shutdown() {
  console.log('AI Service shutting down, closing workers...');
  await Promise.allSettled(workers.map(w => w.close()));
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch(err => {
  console.error('AI Service failed to start:', err);
  process.exit(1);
});


