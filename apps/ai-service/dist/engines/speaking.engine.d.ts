import type { UserCapabilityLevel, SpeakingFeedbackReport } from '@englishi/shared-types';
interface SpeakingReportParams {
    ucl: UserCapabilityLevel;
    transcript: Array<{
        speaker: 'examiner' | 'candidate';
        text: string;
        tsStart: number;
        tsEnd: number;
    }>;
    acousticData: {
        fillerWordCount: number;
        fillerWordsFound: string[];
        avgSpeechRateWpm: number;
        pauseFrequencyPerMinute: number;
    };
    sessionType: 'Part1' | 'Part2' | 'Part3' | 'Full_Test';
}
export declare function generateSpeakingReport(params: SpeakingReportParams): Promise<SpeakingFeedbackReport>;
/** 生成 Part 1 题目集 */
export declare function generatePart1Questions(params: {
    ucl: UserCapabilityLevel;
    recentTopics: string[];
}): Promise<{
    topics: Array<{
        topicName: string;
        questions: Array<{
            qId: string;
            question: string;
            expectedLengthSeconds: number;
        }>;
    }>;
}>;
/** 动态生成 Part 3 追问 */
export declare function generatePart3FollowUp(params: {
    originalQuestion: string;
    candidateResponse: string;
    speakingCefr: number;
}): Promise<{
    followUpQuestion: string;
    followUpType: string;
}>;
export {};
//# sourceMappingURL=speaking.engine.d.ts.map