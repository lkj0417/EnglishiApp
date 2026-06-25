import OpenAI from 'openai';
import { getDb, aiProviders, apiUsageLogs, appSettings } from '@englishi/database';
import { eq, and } from 'drizzle-orm';
import { createDecipheriv } from 'crypto';

// ─────────────────────────────────────────────
// 解密 API Key（与 admin.routes.ts 相同逻辑）
// ─────────────────────────────────────────────
const ENCRYPTION_KEY = (process.env['ENCRYPTION_KEY'] ?? 'default-32-byte-key-change-this!!').slice(0, 32).padEnd(32, '0');

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

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai:       'https://api.openai.com/v1',
  deepseek:     'https://api.deepseek.com/v1',
  gemini:       'https://generativelanguage.googleapis.com/v1beta/openai',
  anthropic:    'https://api.anthropic.com/v1',
  newapi:       'https://api.newapi.ge/v1',
  ollama:       'http://localhost:11434/v1',
  azure_openai: '',
  custom:       '',
};

// ─────────────────────────────────────────────
// 从数据库动态获取活跃提供商
// ─────────────────────────────────────────────
async function getProviderConfig(tier: 'high' | 'fast') {
  try {
    const db = getDb();
    const [provider] = await db.select()
      .from(aiProviders)
      .where(and(eq(aiProviders.tier, tier), eq(aiProviders.isActive, true), eq(aiProviders.isDefault, true)))
      .limit(1);

    if (provider) {
      return {
        id: provider.id,
        apiKey: decryptApiKey(provider.apiKey),
        baseURL: provider.baseUrl ?? DEFAULT_BASE_URLS[provider.provider] ?? 'https://api.openai.com/v1',
        modelId: provider.modelId,
        maxTokens: provider.maxTokens ?? undefined,
        temperature: provider.temperature ? parseFloat(provider.temperature) : undefined,
      };
    }
  } catch {
    // DB 未连接时回退到环境变量
  }

  // 回退：使用环境变量
  return {
    id: null,
    apiKey: process.env['OPENAI_API_KEY'] ?? '',
    baseURL: 'https://api.openai.com/v1',
    modelId: tier === 'high' ? 'gpt-4o' : 'gpt-4o-mini',
    maxTokens: undefined,
    temperature: undefined,
  };
}

export type ModelTier = 'high' | 'fast';

// ─────────────────────────────────────────────
// 通用 LLM 调用封装（支持任意 OpenAI 兼容接口）
// ─────────────────────────────────────────────
export async function callLLM<T>(params: {
  tier: ModelTier;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxRetries?: number;
  taskLabel?: string;
  userId?: string;
}): Promise<T> {
  const maxRetries = params.maxRetries ?? 3;
  const providerConfig = await getProviderConfig(params.tier);

  const client = new OpenAI({
    apiKey: providerConfig.apiKey,
    baseURL: providerConfig.baseURL,
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const startTime = Date.now();
    try {
      const response = await client.chat.completions.create({
        model: providerConfig.modelId,
        messages: params.messages,
        temperature: params.temperature ?? providerConfig.temperature ?? 0.7,
        max_tokens: providerConfig.maxTokens,
        response_format: { type: 'json_object' },
      });

      const latencyMs = Date.now() - startTime;
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty LLM response');

      const parsed = JSON.parse(content) as T;

      // 异步记录 API 调用日志
      logUsage({
        providerId: providerConfig.id,
        userId: params.userId,
        taskType: params.taskLabel,
        modelId: providerConfig.modelId,
        tokensIn: response.usage?.prompt_tokens ?? 0,
        tokensOut: response.usage?.completion_tokens ?? 0,
        latencyMs,
        success: true,
      }).catch(() => {});

      return parsed;

    } catch (err: any) {
      lastError = err;
      const latencyMs = Date.now() - startTime;

      // 记录失败日志
      logUsage({
        providerId: providerConfig.id,
        userId: params.userId,
        taskType: params.taskLabel,
        modelId: providerConfig.modelId,
        tokensIn: 0, tokensOut: 0,
        latencyMs,
        success: false,
        errorCode: err?.status?.toString() ?? 'unknown',
      }).catch(() => {});

      if (err?.status === 429) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        // 速率限制时尝试切换备用提供商
        continue;
      }
      if (err instanceof SyntaxError) continue;
      throw err;
    }
  }

  throw lastError ?? new Error('LLM call failed');
}

// ─────────────────────────────────────────────
// 异步写入使用日志
// ─────────────────────────────────────────────
async function logUsage(data: {
  providerId: string | null;
  userId?: string;
  taskType?: string;
  modelId: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
}) {
  try {
    const db = getDb();
    await db.insert(apiUsageLogs).values({
      providerId: data.providerId ?? undefined,
      userId: data.userId,
      taskType: data.taskType,
      modelId: data.modelId,
      tokensIn: data.tokensIn,
      tokensOut: data.tokensOut,
      latencyMs: data.latencyMs,
      success: data.success,
      errorCode: data.errorCode,
    });

    // 同步更新提供商累计统计
    if (data.providerId && data.success) {
      await db.update(aiProviders).set({
        totalRequests: aiProviders.totalRequests,  // drizzle 暂用原始 SQL 递增
        lastUsedAt: new Date(),
      }).where(eq(aiProviders.id, data.providerId));
    }
  } catch {
    // 日志写入失败不影响主流程
  }
}

// 保留旧接口兼容
export function getOpenAIClient(): OpenAI {
  return new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] ?? '' });
}
export function selectModel(tier: ModelTier): string {
  return tier === 'high' ? 'gpt-4o' : 'gpt-4o-mini';
}

