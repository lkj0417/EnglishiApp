/**
 * 静默能力模型更新引擎（Silent UCL Updater）
 *
 * 实现 PRD Phase2 §1.3.1 设计的「持续评测 / 静默能力模型更新」：
 *   每完成一个学习单元 → 用表现分以 EMA 方式微调对应技能维度的 CEFR，
 *   重算综合 CEFR 与雅思预测分，并写入 / 更新当日能力快照（供进度曲线使用）。
 *
 * 该函数被 API 各学习模块（阅读 / 听力 / 词汇 / 语法）与 AI Service
 * 的写作 / 口语 Worker 复用，是「AI 原生自适应」闭环的核心。
 */
import { eq } from 'drizzle-orm';
import { userAbilityModels, abilityModelSnapshots } from './schema/index.js';
import type { Db } from './index.js';

// ── 内联的 CEFR↔IELTS / 能力更新数学（保持 database 包零外部业务依赖）──

/** CEFR 数值 → 雅思预测分（与 @englishi/cefr-utils.cefrToIeltsPrediction 一致）*/
function cefrToIeltsPrediction(cefr: number): number {
  const mapping: Array<[number, number]> = [
    [1.0, 1.0], [2.0, 3.0], [3.0, 4.5], [4.0, 6.0], [5.0, 7.5], [6.0, 9.0],
  ];
  for (let i = 0; i < mapping.length - 1; i++) {
    const [c1, b1] = mapping[i]!;
    const [c2, b2] = mapping[i + 1]!;
    if (cefr >= c1 && cefr <= c2) {
      const t = (cefr - c1) / (c2 - c1);
      return Math.round((b1 + t * (b2 - b1)) * 2) / 2;
    }
  }
  return 9.0;
}

/**
 * 能力值 EMA 更新（PRD Phase2 §1.3.1）：
 *   new = old × 0.85 + performance_score × target × 0.15，限制在 A1(1.0)–C2(6.0)。
 */
function nextAbilityEstimate(oldCefr: number, performanceScore: number, targetCefr: number): number {
  const perf = Math.max(0, Math.min(1, performanceScore));
  const updated = oldCefr * 0.85 + perf * targetCefr * 0.15;
  return Math.max(1.0, Math.min(6.0, parseFloat(updated.toFixed(2))));
}

export type AbilitySkill =
  | 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'speaking' | 'writing';

const SKILL_COLUMN: Record<AbilitySkill, string> = {
  vocabulary: 'vocabularyCefr',
  grammar:    'grammarCefr',
  reading:    'readingCefr',
  listening:  'listeningCefr',
  speaking:   'speakingCefr',
  writing:    'writingCefr',
};

export interface AbilityUpdateInput {
  userId: string;
  skill: AbilitySkill;
  performanceScore: number;   // 0-1，见 cefr-utils.computePerformanceScore
  contentCefr?: number;       // 本单元内容的目标难度（通常为 i+1），缺省取当前技能值
}

export interface AbilityUpdateResult {
  skill: AbilitySkill;
  before: number;             // 该技能更新前 CEFR
  after: number;              // 该技能更新后 CEFR
  overallBefore: number;
  overallAfter: number;
  ieltsPrediction: number;
}

const num = (v: string | number | null | undefined, fallback = 3.0): number => {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '');
  return Number.isFinite(n) ? n : fallback;
};
const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * 在一次学习事件后更新用户能力模型，并 upsert 当日快照。
 * 若用户尚无能力模型（未完成测评）则返回 null，不抛错。
 */
export async function updateAbilityAfterEvent(
  db: Db,
  input: AbilityUpdateInput,
): Promise<AbilityUpdateResult | null> {
  const [model] = await db.select().from(userAbilityModels)
    .where(eq(userAbilityModels.userId, input.userId)).limit(1);
  if (!model) return null;

  const overallBefore = num(model.overallCefr);
  const dims: Record<AbilitySkill, number> = {
    vocabulary: num(model.vocabularyCefr, overallBefore),
    grammar:    num(model.grammarCefr, overallBefore),
    reading:    num(model.readingCefr, overallBefore),
    listening:  num(model.listeningCefr, overallBefore),
    speaking:   num(model.speakingCefr, overallBefore),
    writing:    num(model.writingCefr, overallBefore),
  };

  const before = dims[input.skill];
  const target = input.contentCefr && input.contentCefr > 0 ? input.contentCefr : before;
  const after = nextAbilityEstimate(before, input.performanceScore, target);
  dims[input.skill] = after;

  const overallAfter = round1(
    (dims.vocabulary + dims.grammar + dims.reading + dims.listening + dims.speaking + dims.writing) / 6,
  );
  const ielts = cefrToIeltsPrediction(overallAfter);

  await db.update(userAbilityModels).set({
    [SKILL_COLUMN[input.skill]]: after.toFixed(1),
    overallCefr: overallAfter.toFixed(1),
    ieltsPrediction: ielts.toFixed(1),
    version: (model.version ?? 1) + 1,
    updatedAt: new Date(),
  }).where(eq(userAbilityModels.userId, input.userId));

  // upsert 当日能力快照（同一天多次学习只保留最新值）
  const today = new Date().toISOString().split('T')[0]!;
  const snapshotValues = {
    overallCefr:    overallAfter.toFixed(1),
    vocabularyCefr: dims.vocabulary.toFixed(1),
    grammarCefr:    dims.grammar.toFixed(1),
    readingCefr:    dims.reading.toFixed(1),
    listeningCefr:  dims.listening.toFixed(1),
    speakingCefr:   dims.speaking.toFixed(1),
    writingCefr:    dims.writing.toFixed(1),
    ieltsPrediction: ielts.toFixed(1),
  };
  await db.insert(abilityModelSnapshots).values({
    userId: input.userId,
    snapshotDate: today,
    ...snapshotValues,
  }).onConflictDoUpdate({
    target: [abilityModelSnapshots.userId, abilityModelSnapshots.snapshotDate],
    set: snapshotValues,
  });

  return {
    skill: input.skill,
    before: round1(before),
    after: round1(after),
    overallBefore,
    overallAfter,
    ieltsPrediction: ielts,
  };
}



