import { FastifyRequest, FastifyReply } from 'fastify';
/**
 * authenticate — 验证 JWT，注入 req.user
 * 用法: app.addHook('preHandler', authenticate)
 * 或者: { preHandler: [authenticate] }
 */
export declare function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
/**
 * requireAdmin — 验证 JWT 且角色必须为 admin 或 super_admin
 */
export declare function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
/**
 * requireSuperAdmin — 仅 super_admin 可访问
 */
export declare function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
//# sourceMappingURL=auth.d.ts.map