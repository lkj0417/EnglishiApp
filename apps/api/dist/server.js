"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const cors_1 = __importDefault(require("@fastify/cors"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const database_1 = require("@englishi/database");
// 路由模块
const auth_routes_js_1 = require("./modules/user/auth.routes.js");
const user_routes_js_1 = require("./modules/user/user.routes.js");
const assessment_routes_js_1 = require("./modules/assessment/assessment.routes.js");
const daily_pack_routes_js_1 = require("./modules/scheduler/daily-pack.routes.js");
const vocabulary_routes_js_1 = require("./modules/vocabulary/vocabulary.routes.js");
const grammar_routes_js_1 = require("./modules/grammar/grammar.routes.js");
const reading_routes_js_1 = require("./modules/reading/reading.routes.js");
const listening_routes_js_1 = require("./modules/listening/listening.routes.js");
const speaking_routes_js_1 = require("./modules/speaking/speaking.routes.js");
const writing_routes_js_1 = require("./modules/writing/writing.routes.js");
const progress_routes_js_1 = require("./modules/progress/progress.routes.js");
const admin_routes_js_1 = require("./modules/admin/admin.routes.js");
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev_secret';
async function buildServer() {
    const app = (0, fastify_1.default)({
        logger: {
            level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
        },
    });
    // ── 插件注册 ──────────────────────────────
    await app.register(cors_1.default, {
        origin: true,
        credentials: true,
    });
    await app.register(rate_limit_1.default, {
        max: 200,
        timeWindow: '1 minute',
    });
    await app.register(jwt_1.default, {
        secret: JWT_SECRET,
        sign: { expiresIn: '7d' },
    });
    await app.register(websocket_1.default);
    // ── 认证钩子 ──────────────────────────────
    app.decorate('authenticate', async (request, reply) => {
        try {
            await request.jwtVerify();
        }
        catch (err) {
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
    await app.register(auth_routes_js_1.authRoutes, { prefix: '/v1/auth' });
    await app.register(user_routes_js_1.userRoutes, { prefix: '/v1/users' });
    await app.register(assessment_routes_js_1.assessmentRoutes, { prefix: '/v1/assessment' });
    await app.register(daily_pack_routes_js_1.dailyPackRoutes, { prefix: '/v1/daily-pack' });
    await app.register(vocabulary_routes_js_1.vocabularyRoutes, { prefix: '/v1/vocabulary' });
    await app.register(grammar_routes_js_1.grammarRoutes, { prefix: '/v1/grammar' });
    await app.register(reading_routes_js_1.readingRoutes, { prefix: '/v1/reading' });
    await app.register(listening_routes_js_1.listeningRoutes, { prefix: '/v1/listening' });
    await app.register(speaking_routes_js_1.speakingRoutes, { prefix: '/v1/speaking' });
    await app.register(writing_routes_js_1.writingRoutes, { prefix: '/v1/writing' });
    await app.register(progress_routes_js_1.progressRoutes, { prefix: '/v1/progress' });
    await app.register(admin_routes_js_1.adminRoutes, { prefix: '/v1/admin' });
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
        (0, database_1.getDb)();
        app.log.info('Database connection established');
        await app.listen({ port: PORT, host: '0.0.0.0' });
        app.log.info(`EnglishiApp API running on port ${PORT}`);
    }
    catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}
start();
//# sourceMappingURL=server.js.map