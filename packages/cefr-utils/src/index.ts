/**
 * CEFR 工具库
 * 数值映射：A1=1.0, A2=2.0, B1=3.0, B2=4.0, C1=5.0, C2=6.0
 * 精度：0.1 级
 */

export type CefrLabel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

const LABEL_TO_NUM: Record<CefrLabel, number> = {
  A1: 1.0, A2: 2.0, B1: 3.0, B2: 4.0, C1: 5.0, C2: 6.0,
};

const NUM_BREAKPOINTS: Array<[number, CefrLabel]> = [
  [1.5, 'A1'], [2.5, 'A2'], [3.5, 'B1'], [4.5, 'B2'], [5.5, 'C1'], [Infinity, 'C2'],
];

/** 将 CEFR 标签转换为数值 (e.g., "B1" → 3.0, "B1.5" → 3.5) */
export function cefrToNum(label: string): number {
  // 处理 "B1.5" 这样的精度标签
  const match = label.match(/^([A-C][12])\.(\d)$/);
  if (match) {
    const base = LABEL_TO_NUM[match[1] as CefrLabel];
    const fraction = parseInt(match[2]) / 10;
    return base + fraction;
  }
  return LABEL_TO_NUM[label as CefrLabel] ?? 3.0;
}

/** 将数值转换为 CEFR 标签 (e.g., 3.7 → "B1") */
export function numToCefrLabel(num: number): CefrLabel {
  for (const [threshold, label] of NUM_BREAKPOINTS) {
    if (num < threshold) return label;
  }
  return 'C2';
}

/** 将数值转换为精确 CEFR 标签 (e.g., 3.7 → "B1.7") */
export function numToCefrPrecise(num: number): string {
  const label = numToCefrLabel(num);
  const base = LABEL_TO_NUM[label];
  const fraction = Math.round((num - base) * 10);
  if (fraction === 0) return label;
  return `${label}.${fraction}`;
}

/** 将 CEFR 数值转换为雅思预测分 */
export function cefrToIeltsPrediction(cefr: number): number {
  // 线性插值映射表（基于 Cambridge 对照研究）
  const mapping: Array<[number, number]> = [
    [1.0, 1.0],  // A1 → Band 1
    [2.0, 3.0],  // A2 → Band 3
    [3.0, 4.5],  // B1 → Band 4.5
    [4.0, 6.0],  // B2 → Band 6
    [5.0, 7.5],  // C1 → Band 7.5
    [6.0, 9.0],  // C2 → Band 9
  ];

  // 找到上下界，线性插值
  for (let i = 0; i < mapping.length - 1; i++) {
    const [c1, b1] = mapping[i]!;
    const [c2, b2] = mapping[i + 1]!;
    if (cefr >= c1 && cefr <= c2) {
      const t = (cefr - c1) / (c2 - c1);
      const raw = b1 + t * (b2 - b1);
      // 四舍五入到 0.5
      return Math.round(raw * 2) / 2;
    }
  }
  return 9.0;
}

/** 计算文章的目标词数（根据 CEFR 级别）*/
export function calcTargetWordCount(cefr: number): number {
  if (cefr < 2.0) return 80;       // A1
  if (cefr < 3.0) return 150;      // A2
  if (cefr < 3.5) return 250;      // B1低
  if (cefr < 4.0) return 350;      // B1高
  if (cefr < 4.5) return 500;      // B2低
  if (cefr < 5.0) return 650;      // B2高
  if (cefr < 5.5) return 800;      // C1低
  return 950;                       // C1高 / C2
}

/** 根据 CEFR 计算推荐听力语速 (wpm) */
export function calcTargetSpeechRate(cefr: number): number {
  if (cefr < 2.0) return 90;
  if (cefr < 3.0) return 110;
  if (cefr < 4.0) return 130;
  if (cefr < 4.5) return 150;
  if (cefr < 5.0) return 165;
  if (cefr < 5.5) return 178;
  return 195; // C1-C2 接近原速
}

/**
 * SM-2 算法：根据用户评分更新词汇复习参数
 * @param quality 0-5 (0-2: 不记得, 3: 勉强记住, 4: 正确, 5: 完美)
 */
export function sm2Update(
  easeFactor: number,
  intervalDays: number,
  repetitions: number,
  quality: number, // 0-5
): { easeFactor: number; intervalDays: number; repetitions: number } {
  if (quality < 3) {
    // 答错：重置
    return { easeFactor, intervalDays: 1, repetitions: 0 };
  }

  // 更新 ease factor
  const newEF = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  let newInterval: number;
  const newReps = repetitions + 1;

  if (repetitions === 0) {
    newInterval = 1;
  } else if (repetitions === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(intervalDays * newEF);
  }

  return { easeFactor: newEF, intervalDays: newInterval, repetitions: newReps };
}

/**
 * IRT 三参数模型（3PL）：计算答对概率
 * @param theta 被测者能力值
 * @param a 区分度 (0.5-2.0)
 * @param b 难度 (对应 CEFR 数值)
 * @param c 猜测参数 (选择题约 0.2)
 */
export function irtProbability(theta: number, a: number, b: number, c: number): number {
  const exp = Math.exp(a * (theta - b));
  return c + (1 - c) * (exp / (1 + exp));
}

/**
 * CAT 算法：根据答题记录估算能力值（最大似然估计）
 */
export function estimateAbility(
  answers: Array<{ difficulty: number; correct: boolean; a?: number; c?: number }>,
): number {
  if (answers.length === 0) return 3.0; // 默认 B1

  // 使用简化的加权平均估计（完整版应用牛顿迭代法）
  let sumCorrectDiff = 0;
  let sumWeights = 0;

  for (const ans of answers) {
    const weight = ans.a ?? 1.0;
    if (ans.correct) {
      sumCorrectDiff += ans.difficulty * weight;
    } else {
      sumCorrectDiff += (ans.difficulty - 0.5) * weight;
    }
    sumWeights += weight;
  }

  const estimate = sumCorrectDiff / sumWeights;
  // 限制在 A1-C2 范围内
  return Math.max(1.0, Math.min(6.0, estimate));
}

/** 格式化 CEFR 数值用于显示 */
export function formatCefrForDisplay(num: number): string {
  return numToCefrPrecise(parseFloat(num.toFixed(1)));
}

/** 计算从当前 CEFR 到目标雅思分所需的 CEFR 提升量 */
export function calcCefrGapToIeltsTarget(currentCefr: number, ieltsTarget: number): number {
  // 反向映射：目标雅思分需要的 CEFR
  const mapping: Array<[number, number]> = [
    [1.0, 1.0], [3.0, 2.0], [4.5, 3.0], [6.0, 4.0], [7.5, 5.0], [9.0, 6.0],
  ];

  let targetCefr = 6.0;
  for (let i = 0; i < mapping.length - 1; i++) {
    const [b1, c1] = mapping[i]!;
    const [b2, c2] = mapping[i + 1]!;
    if (ieltsTarget >= b1 && ieltsTarget <= b2) {
      const t = (ieltsTarget - b1) / (b2 - b1);
      targetCefr = c1 + t * (c2 - c1);
      break;
    }
  }

  return Math.max(0, targetCefr - currentCefr);
}

/** 基于学习时间和 CEFR 差距估算完成周数 */
export function estimateWeeksToGoal(
  cefrGap: number,
  dailyMinutes: number,
): number {
  // 粗略估算：每 0.5 CEFR 约需 8-12 周（每天 30 分钟基准）
  const baseWeeksPerHalfCefr = 10;
  const dailyMinutesFactor = 30 / Math.max(dailyMinutes, 10);
  const totalCefrSteps = cefrGap / 0.5;
  return Math.round(totalCefrSteps * baseWeeksPerHalfCefr * dailyMinutesFactor);
}

