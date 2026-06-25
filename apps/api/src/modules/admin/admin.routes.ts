import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb, users, aiProviders, appSettings, promptTemplates, apiUsageLogs } from '@englishi/database';
import { eq, desc, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

// ─────────────────────────────────────────────
// 管理员鉴权中间件
// ─────────────────────────────────────────────
async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const user = request.user as any;
    if (!['admin', 'super_admin'].includes(user.role)) {
      return reply.code(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    }
  } catch {
    return reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }
}

// ─────────────────────────────────────────────
// AES-256 简单加解密（生产环境用 KMS）
// ─────────────────────────────────────────────
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = (process.env['ENCRYPTION_KEY'] ?? 'default-32-byte-key-change-this!!').slice(0, 32).padEnd(32, '0');

function encryptApiKey(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptApiKey(encrypted: string): string {
  try {
    const [ivHex, encHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex!, 'hex');
    const enc = Buffer.from(encHex!, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

const ProviderSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.enum(['openai', 'deepseek', 'gemini', 'anthropic', 'newapi', 'ollama', 'azure_openai', 'custom']),
  baseUrl: z.string().url().optional().or(z.literal('')),
  apiKey: z.string().min(1),
  modelId: z.string().min(1),
  tier: z.enum(['high', 'fast']),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  priority: z.number().int().min(1).max(100).default(1),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  requestsPerMin: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

const SettingUpdateSchema = z.object({
  value: z.string(),
});

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);

  // ══════════════════════════════════════════
  // 仪表盘概览
  // ══════════════════════════════════════════
  app.get('/dashboard', async (req, reply) => {
    const db = getDb();

    const [
      userCount,
      providerCount,
      todayUsage,
      recentErrors,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(aiProviders).where(eq(aiProviders.isActive, true)),
      db.select({
        totalRequests: sql<number>`count(*)`,
        totalTokensIn: sql<number>`sum(${apiUsageLogs.tokensIn})`,
        totalTokensOut: sql<number>`sum(${apiUsageLogs.tokensOut})`,
        avgLatency: sql<number>`avg(${apiUsageLogs.latencyMs})`,
        errors: sql<number>`count(*) filter (where ${apiUsageLogs.success} = false)`,
      }).from(apiUsageLogs).where(
        sql`${apiUsageLogs.createdAt} >= now() - interval '24 hours'`,
      ),
      db.select().from(apiUsageLogs)
        .where(eq(apiUsageLogs.success, false))
        .orderBy(desc(apiUsageLogs.createdAt))
        .limit(5),
    ]);

    const providers = await db.select({
      id: aiProviders.id,
      name: aiProviders.name,
      provider: aiProviders.provider,
      tier: aiProviders.tier,
      isDefault: aiProviders.isDefault,
      totalRequests: aiProviders.totalRequests,
      totalTokensIn: aiProviders.totalTokensIn,
      totalTokensOut: aiProviders.totalTokensOut,
      lastUsedAt: aiProviders.lastUsedAt,
    }).from(aiProviders).orderBy(desc(aiProviders.totalRequests)).limit(5);

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
    const db = getDb();
    const providers = await db.select({
      id: aiProviders.id,
      name: aiProviders.name,
      provider: aiProviders.provider,
      baseUrl: aiProviders.baseUrl,
      apiKeyHint: aiProviders.apiKeyHint,
      modelId: aiProviders.modelId,
      tier: aiProviders.tier,
      isActive: aiProviders.isActive,
      isDefault: aiProviders.isDefault,
      priority: aiProviders.priority,
      maxTokens: aiProviders.maxTokens,
      temperature: aiProviders.temperature,
      requestsPerMin: aiProviders.requestsPerMin,
      totalRequests: aiProviders.totalRequests,
      totalTokensIn: aiProviders.totalTokensIn,
      totalTokensOut: aiProviders.totalTokensOut,
      lastUsedAt: aiProviders.lastUsedAt,
      notes: aiProviders.notes,
      createdAt: aiProviders.createdAt,
    }).from(aiProviders).orderBy(aiProviders.tier, aiProviders.priority);

    return reply.send({ success: true, data: providers });
  });

  // POST /v1/admin/providers
  app.post('/providers', async (req, reply) => {
    const body = ProviderSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
    }
    const db = getDb();
    const data = body.data;

    const encryptedKey = encryptApiKey(data.apiKey);
    const keyHint = `...${data.apiKey.slice(-4)}`;

    // 若设为默认，先清除同 tier 其他默认
    if (data.isDefault) {
      await db.update(aiProviders).set({ isDefault: false })
        .where(eq(aiProviders.tier, data.tier));
    }

    const [created] = await db.insert(aiProviders).values({
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
    }).returning({ id: aiProviders.id });

    return reply.code(201).send({ success: true, data: { id: created!.id, message: 'Provider created' } });
  });

  // PATCH /v1/admin/providers/:id
  app.patch('/providers/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = ProviderSchema.partial().safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
    }
    const db = getDb();
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.data.name !== undefined)         updates['name'] = body.data.name;
    if (body.data.provider !== undefined)     updates['provider'] = body.data.provider;
    if (body.data.baseUrl !== undefined)      updates['baseUrl'] = body.data.baseUrl || null;
    if (body.data.modelId !== undefined)      updates['modelId'] = body.data.modelId;
    if (body.data.tier !== undefined)         updates['tier'] = body.data.tier;
    if (body.data.isActive !== undefined)     updates['isActive'] = body.data.isActive;
    if (body.data.priority !== undefined)     updates['priority'] = body.data.priority;
    if (body.data.maxTokens !== undefined)    updates['maxTokens'] = body.data.maxTokens;
    if (body.data.temperature !== undefined)  updates['temperature'] = body.data.temperature?.toString();
    if (body.data.requestsPerMin !== undefined) updates['requestsPerMin'] = body.data.requestsPerMin;
    if (body.data.notes !== undefined)        updates['notes'] = body.data.notes;

    // 更新 API Key（如有）
    if (body.data.apiKey) {
      updates['apiKey'] = encryptApiKey(body.data.apiKey);
      updates['apiKeyHint'] = `...${body.data.apiKey.slice(-4)}`;
    }

    // 设为默认时清除同 tier 其他默认
    if (body.data.isDefault) {
      const [existing] = await db.select({ tier: aiProviders.tier }).from(aiProviders).where(eq(aiProviders.id, id)).limit(1);
      if (existing) {
        await db.update(aiProviders).set({ isDefault: false }).where(eq(aiProviders.tier, existing.tier));
      }
      updates['isDefault'] = true;
    }

    await db.update(aiProviders).set(updates).where(eq(aiProviders.id, id));
    return reply.send({ success: true, data: { message: 'Provider updated' } });
  });

  // DELETE /v1/admin/providers/:id
  app.delete('/providers/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    await db.update(aiProviders).set({ isActive: false }).where(eq(aiProviders.id, id));
    return reply.send({ success: true, data: { message: 'Provider deactivated' } });
  });

  // POST /v1/admin/providers/:id/test — 测试 API 连通性
  app.post('/providers/:id/test', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();

    const [provider] = await db.select().from(aiProviders).where(eq(aiProviders.id, id)).limit(1);
    if (!provider) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Provider not found' } });

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
      const data = await response.json() as any;

      if (!response.ok) {
        return reply.send({ success: false, data: { status: 'failed', error: data?.error?.message ?? response.statusText, latency } });
      }

      return reply.send({ success: true, data: { status: 'ok', response: data?.choices?.[0]?.message?.content ?? 'OK', latency } });
    } catch (err: any) {
      return reply.send({ success: false, data: { status: 'failed', error: err.message } });
    }
  });

  // ══════════════════════════════════════════
  // 全局配置管理
  // ══════════════════════════════════════════

  // GET /v1/admin/settings
  app.get('/settings', async (req, reply) => {
    const db = getDb();
    const settings = await db.select({
      id: appSettings.id,
      category: appSettings.category,
      key: appSettings.key,
      value: appSettings.value,
      valueType: appSettings.valueType,
      label: appSettings.label,
      description: appSettings.description,
      isSecret: appSettings.isSecret,
      updatedAt: appSettings.updatedAt,
    }).from(appSettings).orderBy(appSettings.category, appSettings.key);

    // 敏感项隐藏原值
    const masked = settings.map(s => ({
      ...s,
      value: s.isSecret ? '••••••••' : s.value,
    }));

    return reply.send({ success: true, data: masked });
  });

  // PATCH /v1/admin/settings/:key
  app.patch('/settings/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    const body = SettingUpdateSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
    }

    const adminId = (req.user as any).userId;
    const db = getDb();

    const [updated] = await db.update(appSettings)
      .set({ value: body.data.value, updatedBy: adminId, updatedAt: new Date() })
      .where(eq(appSettings.key, key))
      .returning({ id: appSettings.id });

    if (!updated) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Setting not found' } });
    }

    return reply.send({ success: true, data: { message: 'Setting updated' } });
  });

  // POST /v1/admin/settings/batch — 批量更新配置
  app.post('/settings/batch', async (req, reply) => {
    const { updates } = req.body as { updates: Array<{ key: string; value: string }> };
    const adminId = (req.user as any).userId;
    const db = getDb();

    for (const u of updates) {
      await db.update(appSettings)
        .set({ value: u.value, updatedBy: adminId, updatedAt: new Date() })
        .where(eq(appSettings.key, u.key));
    }
    return reply.send({ success: true, data: { message: `${updates.length} settings updated` } });
  });

  // ══════════════════════════════════════════
  // Prompt 模板管理
  // ══════════════════════════════════════════

  app.get('/prompts', async (req, reply) => {
    const db = getDb();
    const templates = await db.select({
      id: promptTemplates.id,
      engineName: promptTemplates.engineName,
      version: promptTemplates.version,
      tier: promptTemplates.tier,
      isActive: promptTemplates.isActive,
      isCurrent: promptTemplates.isCurrent,
      abTestGroup: promptTemplates.abTestGroup,
      abTestWeight: promptTemplates.abTestWeight,
      cqvPassRate: promptTemplates.cqvPassRate,
      notes: promptTemplates.notes,
      createdAt: promptTemplates.createdAt,
    }).from(promptTemplates).orderBy(desc(promptTemplates.createdAt));
    return reply.send({ success: true, data: templates });
  });

  app.get('/prompts/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const [tmpl] = await db.select().from(promptTemplates).where(eq(promptTemplates.id, id)).limit(1);
    if (!tmpl) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    return reply.send({ success: true, data: tmpl });
  });

  app.post('/prompts', async (req, reply) => {
    const { engineName, version, tier, systemPrompt, userPromptTemplate, notes, abTestGroup, abTestWeight } = req.body as any;
    const adminId = (req.user as any).userId;
    const db = getDb();

    const [created] = await db.insert(promptTemplates).values({
      engineName, version, tier,
      systemPrompt, userPromptTemplate,
      isActive: false, isCurrent: false,
      abTestGroup, abTestWeight,
      notes, createdBy: adminId,
    }).returning({ id: promptTemplates.id });

    return reply.code(201).send({ success: true, data: { id: created!.id } });
  });

  // 设为当前生产版本
  app.post('/prompts/:id/activate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();

    const [tmpl] = await db.select().from(promptTemplates).where(eq(promptTemplates.id, id)).limit(1);
    if (!tmpl) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });

    // 先清除同引擎的当前标记
    await db.update(promptTemplates).set({ isCurrent: false })
      .where(eq(promptTemplates.engineName, tmpl.engineName));

    // 激活新版本
    await db.update(promptTemplates).set({ isActive: true, isCurrent: true })
      .where(eq(promptTemplates.id, id));

    return reply.send({ success: true, data: { message: `${tmpl.engineName} ${tmpl.version} is now active` } });
  });

  // ══════════════════════════════════════════
  // 用户管理
  // ══════════════════════════════════════════

  app.get('/users', async (req, reply) => {
    const { page = 1, limit = 20, role, search } = req.query as any;
    const db = getDb();

    const conditions = [];
    if (role) conditions.push(eq(users.role, role));
    // search 功能省略（生产版可加 ilike）

    const userList = await db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      onboardingCompleted: users.onboardingCompleted,
      createdAt: users.createdAt,
      lastActiveAt: users.lastActiveAt,
    }).from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(Number(limit))
      .offset((Number(page) - 1) * Number(limit))
      .orderBy(desc(users.createdAt));

    const [total] = await db.select({ count: sql<number>`count(*)` }).from(users);

    return reply.send({ success: true, data: userList, meta: { total: Number(total?.count ?? 0), page: Number(page), limit: Number(limit) } });
  });

  // 修改用户角色
  app.patch('/users/:id/role', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { role } = req.body as { role: string };

    if (!['student', 'admin', 'super_admin'].includes(role)) {
      return reply.code(400).send({ success: false, error: { code: 'INVALID_ROLE', message: 'Invalid role' } });
    }

    const db = getDb();
    await db.update(users).set({ role }).where(eq(users.id, id));
    return reply.send({ success: true, data: { message: 'Role updated' } });
  });

  // ══════════════════════════════════════════
  // 使用统计
  // ══════════════════════════════════════════

  app.get('/usage/stats', async (req, reply) => {
    const { days = 7 } = req.query as any;
    const db = getDb();

    const stats = await db.select({
      date: sql<string>`date(${apiUsageLogs.createdAt})`,
      taskType: apiUsageLogs.taskType,
      totalRequests: sql<number>`count(*)`,
      totalTokensIn: sql<number>`sum(${apiUsageLogs.tokensIn})`,
      totalTokensOut: sql<number>`sum(${apiUsageLogs.tokensOut})`,
      avgLatency: sql<number>`avg(${apiUsageLogs.latencyMs})`,
      errors: sql<number>`count(*) filter (where ${apiUsageLogs.success} = false)`,
    }).from(apiUsageLogs)
      .where(sql`${apiUsageLogs.createdAt} >= now() - interval '${sql.raw(String(Number(days)))} days'`)
      .groupBy(sql`date(${apiUsageLogs.createdAt})`, apiUsageLogs.taskType)
      .orderBy(sql`date(${apiUsageLogs.createdAt}) desc`);

    return reply.send({ success: true, data: stats });
  });
}

// ─────────────────────────────────────────────
// 辅助：提供商默认 Base URL
// ─────────────────────────────────────────────
export function getDefaultBaseUrl(provider: string): string {
  const defaults: Record<string, string> = {
    openai:       'https://api.openai.com/v1',
    deepseek:     'https://api.deepseek.com/v1',
    gemini:       'https://generativelanguage.googleapis.com/v1beta/openai',
    anthropic:    'https://api.anthropic.com/v1',
    newapi:       'https://api.newapi.ge/v1',
    ollama:       'http://localhost:11434/v1',
    azure_openai: 'https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT',
  };
  return defaults[provider] ?? 'https://api.openai.com/v1';
}

// ─────────────────────────────────────────────
// 从数据库获取当前活跃提供商并解密 Key
// ─────────────────────────────────────────────
export async function getActiveProvider(tier: 'high' | 'fast') {
  const db = getDb();
  const [provider] = await db.select().from(aiProviders)
    .where(and(eq(aiProviders.tier, tier), eq(aiProviders.isActive, true), eq(aiProviders.isDefault, true)))
    .limit(1);

  if (!provider) return null;

  return {
    ...provider,
    apiKeyDecrypted: decryptApiKey(provider.apiKey),
    baseUrl: provider.baseUrl ?? getDefaultBaseUrl(provider.provider),
  };
}

