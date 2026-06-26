import 'dotenv/config';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyWebsocket from '@fastify/websocket';
import { getDb } from '@englishi/database';
import { getSettingBool } from './shared/settings.js';

// 路由模块
import { authRoutes } from './modules/user/auth.routes.js';
import { userRoutes } from './modules/user/user.routes.js';
import { assessmentRoutes } from './modules/assessment/assessment.routes.js';
import { dailyPackRoutes } from './modules/scheduler/daily-pack.routes.js';
import { vocabularyRoutes } from './modules/vocabulary/vocabulary.routes.js';
import { grammarRoutes } from './modules/grammar/grammar.routes.js';
import { readingRoutes } from './modules/reading/reading.routes.js';
import { listeningRoutes } from './modules/listening/listening.routes.js';
import { speakingRoutes } from './modules/speaking/speaking.routes.js';
import { writingRoutes } from './modules/writing/writing.routes.js';
import { progressRoutes } from './modules/progress/progress.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev_secret';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
    },
  });

  // ── 插件注册 ──────────────────────────────
  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  await app.register(fastifyRateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  await app.register(fastifyJwt, {
    secret: JWT_SECRET,
    sign: { expiresIn: '7d' },
  });

  await app.register(fastifyWebsocket);

  // ── 维护模式拦截 ──────────────────────────
  // 维护期间放行健康检查、登录与管理后台（便于管理员关闭维护），其余学习接口返回 503
  app.addHook('onRequest', async (request, reply) => {
    const url = request.raw.url ?? '';
    if (url === '/health' || url.startsWith('/v1/auth') || url.startsWith('/v1/admin')) return;
    if (await getSettingBool('maintenance_mode', false)) {
      return reply.code(503).send({
        success: false,
        error: { code: 'MAINTENANCE', message: '系统维护中，请稍后再试' },
      });
    }
  });

  // ── 认证钩子 ──────────────────────────────
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    }
  });

  // ── 健康检查 ──────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }));

  // ── 路由注册 (统一前缀 /v1) ───────────────
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(userRoutes, { prefix: '/v1/users' });
  await app.register(assessmentRoutes, { prefix: '/v1/assessment' });
  await app.register(dailyPackRoutes, { prefix: '/v1/daily-pack' });
  await app.register(vocabularyRoutes, { prefix: '/v1/vocabulary' });
  await app.register(grammarRoutes, { prefix: '/v1/grammar' });
  await app.register(readingRoutes, { prefix: '/v1/reading' });
  await app.register(listeningRoutes, { prefix: '/v1/listening' });
  await app.register(speakingRoutes, { prefix: '/v1/speaking' });
  await app.register(writingRoutes, { prefix: '/v1/writing' });
  await app.register(progressRoutes, { prefix: '/v1/progress' });
  await app.register(adminRoutes, { prefix: '/v1/admin' });

  // ── 全局错误处理 ──────────────────────────
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);

    if (error.validation) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: error.validation },
      });
    }

    const statusCode = error.statusCode ?? 500;
    return reply.code(statusCode).send({
      success: false,
      error: {
        code: statusCode === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message: statusCode === 500 ? 'An internal error occurred' : error.message,
      },
    });
  });

  return app;
}

async function start() {
  try {
    const app = await buildServer();

    // 验证数据库连接
    getDb();
    app.log.info('Database connection established');

    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`EnglishiApp API running on port ${PORT}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

