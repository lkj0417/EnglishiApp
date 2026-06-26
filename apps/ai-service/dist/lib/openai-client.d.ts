import OpenAI from 'openai';
export type ModelTier = 'high' | 'fast';
export declare function callLLM<T>(params: {
    tier: ModelTier;
    messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
    }>;
    temperature?: number;
    maxRetries?: number;
    taskLabel?: string;
    userId?: string;
}): Promise<T>;
export declare function getOpenAIClient(): OpenAI;
export declare function selectModel(tier: ModelTier): string;
//# sourceMappingURL=openai-client.d.ts.map