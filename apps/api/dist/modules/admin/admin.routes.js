"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = adminRoutes;
exports.getDefaultBaseUrl = getDefaultBaseUrl;
exports.getActiveProvider = getActiveProvider;
const database_1 = require("@englishi/database");
const drizzle_orm_1 = require("drizzle-orm");
const zod_1 = require("zod");
// ─────────────────────────────────────────────
// 管理员鉴权中间件
// ─────────────────────────────────────────────
async function requireAdmin(request, reply) {
    try {
        await request.jwtVerify();
        const user = request.user;
        if (!['admin', 'super_admin'].includes(user.role)) {
            return reply.code(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
        }
    }
    catch {
        return reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
}
// ─────────────────────────────────────────────
// AES-256 简单加解密（生产环境用 KMS）
// ─────────────────────────────────────────────
const crypto_1 = require("crypto");
const ENCRYPTION_KEY = (process.env['ENCRYPTION_KEY'] ?? 'default-32-byte-key-change-this!!').slice(0, 32).padEnd(32, '0');
function encryptApiKey(text) {
    const iv = (0, crypto_1.randomBytes)(16);
    const cipher = (0, crypto_1.createCipheriv)('aes-256-cbc', ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}
function decryptApiKey(encrypted) {
    try {
        const [ivHex, encHex] = encrypted.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const enc = Buffer.from(encHex, 'hex');
        const decipher = (0, crypto_1.createDecipheriv)('aes-256-cbc', ENCRYPTION_KEY, iv);
        return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    }
    catch {
        return '';
    }
}
const ProviderSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    provider: zod_1.z.enum(['openai', 'deepseek', 'gemini', 'anthropic', 'newapi', 'ollama', 'azure_openai', 'custom']),
    baseUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    apiKey: zod_1.z.string().min(1),
    modelId: zod_1.z.string().min(1),
    tier: zod_1.z.enum(['high', 'fast']),
    isActive: zod_1.z.boolean().default(true),
    isDefault: zod_1.z.boolean().default(false),
    priority: zod_1.z.number().int().min(1).max(100).default(1),
    maxTokens: zod_1.z.number().int().positive().optional(),
    temperature: zod_1.z.number().min(0).max(2).optional(),
    requestsPerMin: zod_1.z.number().int().positive().optional(),
    notes: zod_1.z.string().optional(),
});
const ProviderPatchSchema = ProviderSchema.partial().extend({
    // 编辑时允许前端传空字符串表示“不修改 API Key”
    apiKey: zod_1.z.string().optional(),
});
const SettingUpdateSchema = zod_1.z.object({
    value: zod_1.z.string(),
});
async function adminRoutes(app) {
    app.addHook('preHandler', requireAdmin);
    // ══════════════════════════════════════════
    // 仪表盘概览
    // ══════════════════════════════════════════
    app.get('/dashboard', async (req, reply) => {
        const db = (0, database_1.getDb)();
        const [userCount, providerCount, todayUsage, recentErrors,] = await Promise.all([
            db.select({ count: (0, drizzle_orm_1.sql) `count(*)` }).from(database_1.users),
            db.select({ count: (0, drizzle_orm_1.sql) `count(*)` }).from(database_1.aiProviders).where((0, drizzle_orm_1.eq)(database_1.aiProviders.isActive, true)),
            db.select({
                totalRequests: (0, drizzle_orm_1.sql) `count(*)`,
                totalTokensIn: (0, drizzle_orm_1.sql) `sum(${database_1.apiUsageLogs.tokensIn})`,
                totalTokensOut: (0, drizzle_orm_1.sql) `sum(${database_1.apiUsageLogs.tokensOut})`,
                avgLatency: (0, drizzle_orm_1.sql) `avg(${database_1.apiUsageLogs.latencyMs})`,
                errors: (0, drizzle_orm_1.sql) `count(*) filter (where ${database_1.apiUsageLogs.success} = false)`,
            }).from(database_1.apiUsageLogs).where((0, drizzle_orm_1.sql) `${database_1.apiUsageLogs.createdAt} >= now() - interval '24 hours'`),
            db.select().from(database_1.apiUsageLogs)
                .where((0, drizzle_orm_1.eq)(database_1.apiUsageLogs.success, false))
                .orderBy((0, drizzle_orm_1.desc)(database_1.apiUsageLogs.createdAt))
                .limit(5),
        ]);
        const providers = await db.select({
            id: database_1.aiProviders.id,
            name: database_1.aiProviders.name,
            provider: database_1.aiProviders.provider,
            tier: database_1.aiProviders.tier,
            isDefault: database_1.aiProviders.isDefault,
            totalRequests: database_1.aiProviders.totalRequests,
            totalTokensIn: database_1.aiProviders.totalTokensIn,
            totalTokensOut: database_1.aiProviders.totalTokensOut,
            lastUsedAt: database_1.aiProviders.lastUsedAt,
        }).from(database_1.aiProviders).orderBy((0, drizzle_orm_1.desc)(database_1.aiProviders.totalRequests)).limit(5);
        return reply.send({
            success: true,
            data: {
                stats: {
                    totalUsers: Number(userCount[0]?.count ?? 0),
                    activeProviders: Number(providerCount[0]?.count ?? 0),
                    today: todayUsage[0],
                },
                topProviders: providers,
                recentErrors,
            },
        });
    });
    // ══════════════════════════════════════════
    // API 提供商管理
    // ══════════════════════════════════════════
    // GET /v1/admin/providers
    app.get('/providers', async (req, reply) => {
        const db = (0, database_1.getDb)();
        const providers = await db.select({
            id: database_1.aiProviders.id,
            name: database_1.aiProviders.name,
            provider: database_1.aiProviders.provider,
            baseUrl: database_1.aiProviders.baseUrl,
            apiKeyHint: database_1.aiProviders.apiKeyHint,
            modelId: database_1.aiProviders.modelId,
            tier: database_1.aiProviders.tier,
            isActive: database_1.aiProviders.isActive,
            isDefault: database_1.aiProviders.isDefault,
            priority: database_1.aiProviders.priority,
            maxTokens: database_1.aiProviders.maxTokens,
            temperature: database_1.aiProviders.temperature,
            requestsPerMin: database_1.aiProviders.requestsPerMin,
            totalRequests: database_1.aiProviders.totalRequests,
            totalTokensIn: database_1.aiProviders.totalTokensIn,
            totalTokensOut: database_1.aiProviders.totalTokensOut,
            lastUsedAt: database_1.aiProviders.lastUsedAt,
            notes: database_1.aiProviders.notes,
            createdAt: database_1.aiProviders.createdAt,
        }).from(database_1.aiProviders).orderBy(database_1.aiProviders.tier, database_1.aiProviders.priority);
        return reply.send({ success: true, data: providers });
    });
    // POST /v1/admin/providers
    app.post('/providers', async (req, reply) => {
        const body = ProviderSchema.safeParse(req.body);
        if (!body.success) {
            return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
        }
        const db = (0, database_1.getDb)();
        const data = body.data;
        const encryptedKey = encryptApiKey(data.apiKey);
        const keyHint = `...${data.apiKey.slice(-4)}`;
        // 若设为默认，先清除同 tier 其他默认
        if (data.isDefault) {
            await db.update(database_1.aiProviders).set({ isDefault: false })
                .where((0, drizzle_orm_1.eq)(database_1.aiProviders.tier, data.tier));
        }
        const [created] = await db.insert(database_1.aiProviders).values({
            name: data.name,
            provider: data.provider,
            baseUrl: data.baseUrl || null,
            apiKey: encryptedKey,
            apiKeyHint: keyHint,
            modelId: data.modelId,
            tier: data.tier,
            isActive: data.isActive,
            isDefault: data.isDefault,
            priority: data.priority,
            maxTokens: data.maxTokens,
            temperature: data.temperature?.toString(),
            requestsPerMin: data.requestsPerMin,
            notes: data.notes,
        }).returning({ id: database_1.aiProviders.id });
        return reply.code(201).send({ success: true, data: { id: created.id, message: 'Provider created' } });
    });
    // PATCH /v1/admin/providers/:id
    app.patch('/providers/:id', async (req, reply) => {
        const { id } = req.params;
        const body = ProviderPatchSchema.safeParse(req.body);
        if (!body.success) {
            return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
        }
        const db = (0, database_1.getDb)();
        const updates = { updatedAt: new Date() };
        if (body.data.name !== undefined)
            updates['name'] = body.data.name;
        if (body.data.provider !== undefined)
            updates['provider'] = body.data.provider;
        if (body.data.baseUrl !== undefined)
            updates['baseUrl'] = body.data.baseUrl || null;
        if (body.data.modelId !== undefined)
            updates['modelId'] = body.data.modelId;
        if (body.data.tier !== undefined)
            updates['tier'] = body.data.tier;
        if (body.data.isActive !== undefined)
            updates['isActive'] = body.data.isActive;
        if (body.data.priority !== undefined)
            updates['priority'] = body.data.priority;
        if (body.data.maxTokens !== undefined)
            updates['maxTokens'] = body.data.maxTokens;
        if (body.data.temperature !== undefined)
            updates['temperature'] = body.data.temperature?.toString();
        if (body.data.requestsPerMin !== undefined)
            updates['requestsPerMin'] = body.data.requestsPerMin;
        if (body.data.notes !== undefined)
            updates['notes'] = body.data.notes;
        // 更新 API Key（如有）
        if (body.data.apiKey && body.data.apiKey.trim().length > 0) {
            updates['apiKey'] = encryptApiKey(body.data.apiKey);
            updates['apiKeyHint'] = `...${body.data.apiKey.slice(-4)}`;
        }
        // 设为默认时清除同 tier 其他默认
        if (body.data.isDefault) {
            const [existing] = await db.select({ tier: database_1.aiProviders.tier }).from(database_1.aiProviders).where((0, drizzle_orm_1.eq)(database_1.aiProviders.id, id)).limit(1);
            if (existing) {
                await db.update(database_1.aiProviders).set({ isDefault: false }).where((0, drizzle_orm_1.eq)(database_1.aiProviders.tier, existing.tier));
            }
            updates['isDefault'] = true;
        }
        await db.update(database_1.aiProviders).set(updates).where((0, drizzle_orm_1.eq)(database_1.aiProviders.id, id));
        return reply.send({ success: true, data: { message: 'Provider updated' } });
    });
    // DELETE /v1/admin/providers/:id
    app.delete('/providers/:id', async (req, reply) => {
        const { id } = req.params;
        const db = (0, database_1.getDb)();
        await db.update(database_1.aiProviders).set({ isActive: false }).where((0, drizzle_orm_1.eq)(database_1.aiProviders.id, id));
        return reply.send({ success: true, data: { message: 'Provider deactivated' } });
    });
    // POST /v1/admin/providers/:id/test — 测试 API 连通性
    app.post('/providers/:id/test', async (req, reply) => {
        const { id } = req.params;
        const db = (0, database_1.getDb)();
        const [provider] = await db.select().from(database_1.aiProviders).where((0, drizzle_orm_1.eq)(database_1.aiProviders.id, id)).limit(1);
        if (!provider)
            return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Provider not found' } });
        const apiKey = decryptApiKey(provider.apiKey);
        const baseUrl = provider.baseUrl ?? getDefaultBaseUrl(provider.provider);
        try {
            const testStart = Date.now();
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: provider.modelId,
                    messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
                    max_tokens: 10,
                }),
                signal: AbortSignal.timeout(10000),
            });
            const latency = Date.now() - testStart;
            const data = await response.json();
            if (!response.ok) {
                return reply.send({ success: false, data: { status: 'failed', error: data?.error?.message ?? response.statusText, latency } });
            }
            return reply.send({ success: true, data: { status: 'ok', response: data?.choices?.[0]?.message?.content ?? 'OK', latency } });
        }
        catch (err) {
            return reply.send({ success: false, data: { status: 'failed', error: err.message } });
        }
    });
    // ══════════════════════════════════════════
    // 全局配置管理
    // ══════════════════════════════════════════
    // GET /v1/admin/settings
    app.get('/settings', async (req, reply) => {
        const db = (0, database_1.getDb)();
        const settings = await db.select({
            id: database_1.appSettings.id,
            category: database_1.appSettings.category,
            key: database_1.appSettings.key,
            value: database_1.appSettings.value,
            valueType: database_1.appSettings.valueType,
            label: database_1.appSettings.label,
            description: database_1.appSettings.description,
            isSecret: database_1.appSettings.isSecret,
            updatedAt: database_1.appSettings.updatedAt,
        }).from(database_1.appSettings).orderBy(database_1.appSettings.category, database_1.appSettings.key);
        // 敏感项隐藏原值
        const masked = settings.map(s => ({
            ...s,
            value: s.isSecret ? '••••••••' : s.value,
        }));
        return reply.send({ success: true, data: masked });
    });
    // PATCH /v1/admin/settings/:key
    app.patch('/settings/:key', async (req, reply) => {
        const { key } = req.params;
        const body = SettingUpdateSchema.safeParse(req.body);
        if (!body.success) {
            return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
        }
        const adminId = req.user.userId;
        const db = (0, database_1.getDb)();
        const [updated] = await db.update(database_1.appSettings)
            .set({ value: body.data.value, updatedBy: adminId, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(database_1.appSettings.key, key))
            .returning({ id: database_1.appSettings.id });
        if (!updated) {
            return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Setting not found' } });
        }
        return reply.send({ success: true, data: { message: 'Setting updated' } });
    });
    // POST /v1/admin/settings/batch — 批量更新配置
    app.post('/settings/batch', async (req, reply) => {
        const { updates } = req.body;
        const adminId = req.user.userId;
        const db = (0, database_1.getDb)();
        for (const u of updates) {
            await db.update(database_1.appSettings)
                .set({ value: u.value, updatedBy: adminId, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(database_1.appSettings.key, u.key));
        }
        return reply.send({ success: true, data: { message: `${updates.length} settings updated` } });
    });
    // ══════════════════════════════════════════
    // Prompt 模板管理
    // ══════════════════════════════════════════
    app.get('/prompts', async (req, reply) => {
        const db = (0, database_1.getDb)();
        const templates = await db.select({
            id: database_1.promptTemplates.id,
            engineName: database_1.promptTemplates.engineName,
            version: database_1.promptTemplates.version,
            tier: database_1.promptTemplates.tier,
            isActive: database_1.promptTemplates.isActive,
            isCurrent: database_1.promptTemplates.isCurrent,
            abTestGroup: database_1.promptTemplates.abTestGroup,
            abTestWeight: database_1.promptTemplates.abTestWeight,
            cqvPassRate: database_1.promptTemplates.cqvPassRate,
            notes: database_1.promptTemplates.notes,
            createdAt: database_1.promptTemplates.createdAt,
        }).from(database_1.promptTemplates).orderBy((0, drizzle_orm_1.desc)(database_1.promptTemplates.createdAt));
        return reply.send({ success: true, data: templates });
    });
    app.get('/prompts/:id', async (req, reply) => {
        const { id } = req.params;
        const db = (0, database_1.getDb)();
        const [tmpl] = await db.select().from(database_1.promptTemplates).where((0, drizzle_orm_1.eq)(database_1.promptTemplates.id, id)).limit(1);
        if (!tmpl)
            return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
        return reply.send({ success: true, data: tmpl });
    });
    app.post('/prompts', async (req, reply) => {
        const { engineName, version, tier, systemPrompt, userPromptTemplate, notes, abTestGroup, abTestWeight } = req.body;
        const adminId = req.user.userId;
        const db = (0, database_1.getDb)();
        const [created] = await db.insert(database_1.promptTemplates).values({
            engineName, version, tier,
            systemPrompt, userPromptTemplate,
            isActive: false, isCurrent: false,
            abTestGroup, abTestWeight,
            notes, createdBy: adminId,
        }).returning({ id: database_1.promptTemplates.id });
        return reply.code(201).send({ success: true, data: { id: created.id } });
    });
    // 设为当前生产版本
    app.post('/prompts/:id/activate', async (req, reply) => {
        const { id } = req.params;
        const db = (0, database_1.getDb)();
        const [tmpl] = await db.select().from(database_1.promptTemplates).where((0, drizzle_orm_1.eq)(database_1.promptTemplates.id, id)).limit(1);
        if (!tmpl)
            return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
        // 先清除同引擎的当前标记
        await db.update(database_1.promptTemplates).set({ isCurrent: false })
            .where((0, drizzle_orm_1.eq)(database_1.promptTemplates.engineName, tmpl.engineName));
        // 激活新版本
        await db.update(database_1.promptTemplates).set({ isActive: true, isCurrent: true })
            .where((0, drizzle_orm_1.eq)(database_1.promptTemplates.id, id));
        return reply.send({ success: true, data: { message: `${tmpl.engineName} ${tmpl.version} is now active` } });
    });
    // ══════════════════════════════════════════
    // 用户管理
    // ══════════════════════════════════════════
    app.get('/users', async (req, reply) => {
        const { page = 1, limit = 20, role, search } = req.query;
        const db = (0, database_1.getDb)();
        const conditions = [];
        if (role)
            conditions.push((0, drizzle_orm_1.eq)(database_1.users.role, role));
        // search 功能省略（生产版可加 ilike）
        const userList = await db.select({
            id: database_1.users.id,
            email: database_1.users.email,
            displayName: database_1.users.displayName,
            role: database_1.users.role,
            onboardingCompleted: database_1.users.onboardingCompleted,
            createdAt: database_1.users.createdAt,
            lastActiveAt: database_1.users.lastActiveAt,
        }).from(database_1.users)
            .where(conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined)
            .limit(Number(limit))
            .offset((Number(page) - 1) * Number(limit))
            .orderBy((0, drizzle_orm_1.desc)(database_1.users.createdAt));
        const [total] = await db.select({ count: (0, drizzle_orm_1.sql) `count(*)` }).from(database_1.users)
            .where(conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined);
        return reply.send({ success: true, data: userList, meta: { total: Number(total?.count ?? 0), page: Number(page), limit: Number(limit) } });
    });
    // 修改用户角色
    app.patch('/users/:id/role', async (req, reply) => {
        const { id } = req.params;
        const { role } = req.body;
        if (!['student', 'admin', 'super_admin'].includes(role)) {
            return reply.code(400).send({ success: false, error: { code: 'INVALID_ROLE', message: 'Invalid role' } });
        }
        const db = (0, database_1.getDb)();
        await db.update(database_1.users).set({ role }).where((0, drizzle_orm_1.eq)(database_1.users.id, id));
        return reply.send({ success: true, data: { message: 'Role updated' } });
    });
    // ══════════════════════════════════════════
    // 使用统计
    // ══════════════════════════════════════════
    app.get('/usage/stats', async (req, reply) => {
        const { days = 7 } = req.query;
        const db = (0, database_1.getDb)();
        const stats = await db.select({
            date: (0, drizzle_orm_1.sql) `date(${database_1.apiUsageLogs.createdAt})`,
            taskType: database_1.apiUsageLogs.taskType,
            totalRequests: (0, drizzle_orm_1.sql) `count(*)`,
            totalTokensIn: (0, drizzle_orm_1.sql) `sum(${database_1.apiUsageLogs.tokensIn})`,
            totalTokensOut: (0, drizzle_orm_1.sql) `sum(${database_1.apiUsageLogs.tokensOut})`,
            avgLatency: (0, drizzle_orm_1.sql) `avg(${database_1.apiUsageLogs.latencyMs})`,
            errors: (0, drizzle_orm_1.sql) `count(*) filter (where ${database_1.apiUsageLogs.success} = false)`,
        }).from(database_1.apiUsageLogs)
            .where((0, drizzle_orm_1.sql) `${database_1.apiUsageLogs.createdAt} >= now() - (${Number(days)} * interval '1 day')`)
            .groupBy((0, drizzle_orm_1.sql) `date(${database_1.apiUsageLogs.createdAt})`, database_1.apiUsageLogs.taskType)
            .orderBy((0, drizzle_orm_1.sql) `date(${database_1.apiUsageLogs.createdAt}) desc`);
        return reply.send({ success: true, data: stats });
    });
}
// ─────────────────────────────────────────────
// 辅助：提供商默认 Base URL
// ─────────────────────────────────────────────
function getDefaultBaseUrl(provider) {
    const defaults = {
        openai: 'https://api.openai.com/v1',
        deepseek: 'https://api.deepseek.com/v1',
        gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
        anthropic: 'https://api.anthropic.com/v1',
        newapi: 'https://api.newapi.ge/v1',
        ollama: 'http://localhost:11434/v1',
        azure_openai: 'https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT',
    };
    return defaults[provider] ?? 'https://api.openai.com/v1';
}
// ─────────────────────────────────────────────
// 从数据库获取当前活跃提供商并解密 Key
// ─────────────────────────────────────────────
async function getActiveProvider(tier) {
    const db = (0, database_1.getDb)();
    const [provider] = await db.select().from(database_1.aiProviders)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.aiProviders.tier, tier), (0, drizzle_orm_1.eq)(database_1.aiProviders.isActive, true), (0, drizzle_orm_1.eq)(database_1.aiProviders.isDefault, true)))
        .limit(1);
    if (!provider)
        return null;
    return {
        ...provider,
        apiKeyDecrypted: decryptApiKey(provider.apiKey),
        baseUrl: provider.baseUrl ?? getDefaultBaseUrl(provider.provider),
    };
}
//# sourceMappingURL=admin.routes.js.map