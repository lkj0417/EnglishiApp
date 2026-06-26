"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildUCL = buildUCL;
exports.extractDifficultyParams = extractDifficultyParams;
exports.mergeErrorPattern = mergeErrorPattern;
/**
 * 将 DB 能力模型行转换为 UCL 对象
 */
function buildUCL(userId, model) {
    const overall = parseFloat(model.overallCefr ?? '3.0');
    return {
        userId,
        overallCefr: overall,
        dimensions: {
            vocabulary: parseFloat(model.vocabularyCefr ?? overall.toString()),
            grammar: parseFloat(model.grammarCefr ?? overall.toString()),
            reading: parseFloat(model.readingCefr ?? overall.toString()),
            listening: parseFloat(model.listeningCefr ?? overall.toString()),
            speaking: parseFloat(model.speakingCefr ?? overall.toString()),
            writing: parseFloat(model.writingCefr ?? overall.toString()),
        },
        estimatedVocabSize: model.estimatedVocabSize ?? estimateVocabSizeFromCefr(overall),
        ieltsPrediction: parseFloat(model.ieltsPrediction ?? '5.0'),
        masteredGrammar: model.masteredGrammar ?? [],
        notYetGrammar: [], // 从语法知识图谱动态计算，此处默认为空
        weakAreas: model.weakAreas ?? {
            grammar: [], listening: [], writing: [], speaking: [], vocabulary: [],
        },
        errorPatterns: model.errorPatterns ?? [],
        confidenceInterval: parseFloat(model.confidenceInterval ?? '0.5'),
        updatedAt: model.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
}
/**
 * 从 UCL 提取内容生成所需的最小难度参数
 */
function extractDifficultyParams(ucl, skill) {
    const skillCefr = ucl.dimensions[skill];
    return {
        vocabCeiling: Math.min(6.0, skillCefr + 1.0),
        contentCefr: skillCefr,
        targetNewWordRate: 0.06,
        grammarAllowed: ucl.masteredGrammar,
        grammarForbidden: ucl.notYetGrammar,
    };
}
/**
 * 将 CEFR 数值转换为粗略的词汇量估算
 */
function estimateVocabSizeFromCefr(cefr) {
    const mapping = { 1: 500, 2: 1200, 3: 2500, 4: 4500, 5: 7000, 6: 10000 };
    const base = Math.floor(cefr);
    const fraction = cefr - base;
    const low = mapping[base] ?? 500;
    const high = mapping[base + 1] ?? 10000;
    return Math.round(low + fraction * (high - low));
}
/**
 * 更新 UCL 中的错误模式（在写作/口语批改后调用）
 */
function mergeErrorPattern(existing, newType) {
    const today = new Date().toISOString().split('T')[0];
    const found = existing.find(e => e.type === newType);
    if (found) {
        return existing.map(e => e.type === newType
            ? { ...e, frequency: e.frequency + 1, lastSeen: today }
            : e);
    }
    return [...existing, { type: newType, frequency: 1, lastSeen: today }];
}
//# sourceMappingURL=ucl.builder.js.map