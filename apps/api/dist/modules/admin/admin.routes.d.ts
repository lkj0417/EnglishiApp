import { FastifyInstance } from 'fastify';
export declare function adminRoutes(app: FastifyInstance): Promise<void>;
export declare function getDefaultBaseUrl(provider: string): string;
export declare function getActiveProvider(tier: 'high' | 'fast'): Promise<{
    apiKeyDecrypted: string;
    baseUrl: string;
    id: string;
    name: string;
    provider: string;
    apiKey: string;
    apiKeyHint: string | null;
    modelId: string;
    tier: string;
    isActive: boolean | null;
    isDefault: boolean | null;
    priority: number | null;
    maxTokens: number | null;
    temperature: string | null;
    requestsPerMin: number | null;
    totalRequests: number | null;
    totalTokensIn: number | null;
    totalTokensOut: number | null;
    lastUsedAt: Date | null;
    notes: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
} | null>;
//# sourceMappingURL=admin.routes.d.ts.map