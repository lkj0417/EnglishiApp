/**
 * UCL（User Capability Level）构建工具
 *
 * 将数据库能力模型行（userAbilityModels）转换为标准 UCL 对象，
 * 供所有 AI Engine 和路由复用。
 */
import type { UserCapabilityLevel, ErrorPattern } from '@englishi/shared-types';
/**
 * 将 DB 能力模型行转换为 UCL 对象
 */
export declare function buildUCL(userId: string, model: {
    overallCefr: string | null;
    vocabularyCefr: string | null;
    grammarCefr: string | null;
    readingCefr: string | null;
    listeningCefr: string | null;
    speakingCefr: string | null;
    writingCefr: string | null;
    estimatedVocabSize: number | null;
    ieltsPrediction: string | null;
    masteredGrammar: unknown;
    weakAreas: unknown;
    errorPatterns: unknown;
    confidenceInterval: string | null;
    updatedAt: Date | null;
}): UserCapabilityLevel;
/**
 * 从 UCL 提取内容生成所需的最小难度参数
 */
export declare function extractDifficultyParams(ucl: UserCapabilityLevel, skill: 'reading' | 'listening' | 'writing' | 'speaking'): {
    vocabCeiling: number;
    contentCefr: number;
    targetNewWordRate: number;
    grammarAllowed: string[];
    grammarForbidden: string[];
};
/**
 * 更新 UCL 中的错误模式（在写作/口语批改后调用）
 */
export declare function mergeErrorPattern(existing: ErrorPattern[], newType: string): ErrorPattern[];
//# sourceMappingURL=ucl.builder.d.ts.map