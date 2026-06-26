"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = userRoutes;
const zod_1 = require("zod");
const database_1 = require("@englishi/database");
const drizzle_orm_1 = require("drizzle-orm");
const UpdateProfileSchema = zod_1.z.object({
    displayName: zod_1.z.string().min(2).max(100).optional(),
    interestTags: zod_1.z.array(zod_1.z.string()).max(10).optional(),
    primaryInterest: zod_1.z.string().optional(),
    iletsTargetBand: zod_1.z.number().min(4).max(9).step(0.5).optional(),
    targetDeadline: zod_1.z.string().optional(),
    dailyMinutesGoal: zod_1.z.number().min(10).max(240).optional(),
    timezone: zod_1.z.string().optional(),
});
async function userRoutes(app) {
    // 所有路由需要认证
    app.addHook('preHandler', app.authenticate);
    // GET /v1/users/me — 获取当前用户信息
    app.get('/me', async (req, reply) => {
        const userId = req.user.userId;
        const db = (0, database_1.getDb)();
        const [user] = await db.select({
            id: database_1.users.id,
            email: database_1.users.email,
            displayName: database_1.users.displayName,
            interestTags: database_1.users.interestTags,
            primaryInterest: database_1.users.primaryInterest,
            iletsTargetBand: database_1.users.iletsTargetBand,
            targetDeadline: database_1.users.targetDeadline,
            dailyMinutesGoal: database_1.users.dailyMinutesGoal,
            onboardingCompleted: database_1.users.onboardingCompleted,
            timezone: database_1.users.timezone,
            createdAt: database_1.users.createdAt,
        }).from(database_1.users).where((0, drizzle_orm_1.eq)(database_1.users.id, userId)).limit(1);
        if (!user) {
            return reply.code(404).send({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
        }
        return reply.send({ success: true, data: user });
    });
    // PATCH /v1/users/me — 更新用户设置
    app.patch('/me', async (req, reply) => {
        const userId = req.user.userId;
        const body = UpdateProfileSchema.safeParse(req.body);
        if (!body.success) {
            return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
        }
        const db = (0, database_1.getDb)();
        const updates = {};
        if (body.data.displayName)
            updates['displayName'] = body.data.displayName;
        if (body.data.interestTags)
            updates['interestTags'] = body.data.interestTags;
        if (body.data.primaryInterest)
            updates['primaryInterest'] = body.data.primaryInterest;
        if (body.data.iletsTargetBand)
            updates['iletsTargetBand'] = body.data.iletsTargetBand.toString();
        if (body.data.targetDeadline)
            updates['targetDeadline'] = body.data.targetDeadline;
        if (body.data.dailyMinutesGoal)
            updates['dailyMinutesGoal'] = body.data.dailyMinutesGoal;
        if (body.data.timezone)
            updates['timezone'] = body.data.timezone;
        const [updated] = await db.update(database_1.users).set(updates).where((0, drizzle_orm_1.eq)(database_1.users.id, userId)).returning();
        return reply.send({ success: true, data: updated });
    });
    // GET /v1/users/me/ability — 获取用户能力模型
    app.get('/me/ability', async (req, reply) => {
        const userId = req.user.userId;
        const db = (0, database_1.getDb)();
        const [model] = await db.select().from(database_1.userAbilityModels)
            .where((0, drizzle_orm_1.eq)(database_1.userAbilityModels.userId, userId)).limit(1);
        if (!model) {
            return reply.code(404).send({
                success: false,
                error: { code: 'ABILITY_NOT_FOUND', message: 'Please complete the onboarding assessment first' },
            });
        }
        return reply.send({ success: true, data: model });
    });
    // GET /v1/users/me/ability/history — 获取能力历史快照（折线图数据）
    app.get('/me/ability/history', async (req, reply) => {
        const userId = req.user.userId;
        const db = (0, database_1.getDb)();
        const snapshots = await db.select().from(database_1.abilityModelSnapshots)
            .where((0, drizzle_orm_1.eq)(database_1.abilityModelSnapshots.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(database_1.abilityModelSnapshots.snapshotDate))
            .limit(90); // 最近 90 天
        return reply.send({ success: true, data: snapshots.reverse() }); // 按时间正序返回
    });
}
//# sourceMappingURL=user.routes.js.map