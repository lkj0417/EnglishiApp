"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireAdmin = requireAdmin;
exports.requireSuperAdmin = requireSuperAdmin;
/**
 * authenticate — 验证 JWT，注入 req.user
 * 用法: app.addHook('preHandler', authenticate)
 * 或者: { preHandler: [authenticate] }
 */
async function authenticate(request, reply) {
    try {
        await request.jwtVerify();
    }
    catch {
        return reply.code(401).send({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        });
    }
}
/**
 * requireAdmin — 验证 JWT 且角色必须为 admin 或 super_admin
 */
async function requireAdmin(request, reply) {
    try {
        await request.jwtVerify();
        const user = request.user;
        if (!user?.role || !['admin', 'super_admin'].includes(user.role)) {
            return reply.code(403).send({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Admin access required' },
            });
        }
    }
    catch {
        return reply.code(401).send({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        });
    }
}
/**
 * requireSuperAdmin — 仅 super_admin 可访问
 */
async function requireSuperAdmin(request, reply) {
    try {
        await request.jwtVerify();
        const user = request.user;
        if (user?.role !== 'super_admin') {
            return reply.code(403).send({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Super admin access required' },
            });
        }
    }
    catch {
        return reply.code(401).send({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        });
    }
}
//# sourceMappingURL=auth.js.map