/**
 * CAT 题库（入门测评用）
 * 每道题包含：id, skill, type, question, options, correctAnswer, difficulty（CEFR数值）, discrimination
 *
 * 正式生产版本应从数据库加载 (generated_content 表)
 * 此处内嵌约 60 道核心题目覆盖 A1-C1 范围
 */
export interface AssessmentQuestion {
    id: string;
    skill: 'vocabulary' | 'grammar' | 'reading' | 'listening';
    type: 'multiple_choice' | 'fill_blank' | 'error_correction';
    question: string;
    options?: string[];
    correctAnswer: string;
    difficulty: number;
    discrimination?: number;
    explanation?: string;
}
export declare const QUESTION_BANK: AssessmentQuestion[];
//# sourceMappingURL=question-bank.d.ts.map