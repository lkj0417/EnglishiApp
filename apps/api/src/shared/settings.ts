/**
 * 全局配置读取助手（带 30s 内存缓存）。
 *
 * 让 app_settings 表中的开关（维护模式、是否开放注册、每日 AI 调用上限等）
 * 真正在运行时生效，而不只是后台可改的「死配置」。
 */
import { getDb, appSettings } from '@englishi/database';
import { eq } from 'drizzle-orm';

const TTL_MS = 30_000;
const cache = new Map<string, { value: string | null; ts: number }>();

/** 清除某个 key 的缓存（管理员更新配置后可调用，立即生效）*/
export function invalidateSettingCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

export async function getSettingValue(key: string): Promise<string | null> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.value;

  let value: string | null = null;
  try {
    const db = getDb();
    const [row] = await db.select({ value: appSettings.value })
      .from(appSettings).where(eq(appSettings.key, key)).limit(1);
    value = row?.value ?? null;
  } catch {
    value = null; // DB 不可用时不阻断主流程
  }
  cache.set(key, { value, ts: Date.now() });
  return value;
}

export async function getSettingBool(key: string, fallback = false): Promise<boolean> {
  const v = await getSettingValue(key);
  return v == null ? fallback : v === 'true';
}

export async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const v = await getSettingValue(key);
  const n = v == null ? NaN : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

