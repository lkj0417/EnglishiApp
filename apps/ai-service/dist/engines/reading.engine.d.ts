import type { UserCapabilityLevel, ReadingArticle } from '@englishi/shared-types';
interface GenerateReadingParams {
    ucl: UserCapabilityLevel;
    interestDomain: string;
    topic?: string;
}
export declare function generateReadingArticle(params: GenerateReadingParams): Promise<ReadingArticle>;
export {};
//# sourceMappingURL=reading.engine.d.ts.map