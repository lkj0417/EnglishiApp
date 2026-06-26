import type { UserCapabilityLevel, WritingCritiqueReport } from '@englishi/shared-types';
interface WritingCritiqueParams {
    ucl: UserCapabilityLevel;
    taskType: string;
    taskPrompt: string;
    submissionText: string;
}
export declare function critiqueWriting(params: WritingCritiqueParams): Promise<WritingCritiqueReport>;
export {};
//# sourceMappingURL=writing.engine.d.ts.map