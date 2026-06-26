import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDb, users, userAbilityModels, abilityModelSnapshots } from '@englishi/database';
import { eq, desc } from 'drizzle-orm';

const UpdateProfileSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  interestTags: z.array(z.string()).max(10).optional(),
  primaryInterest: z.string().optional(),
  iletsTargetBand: z.number().min(4).max(9).step(0.5).optional(),
  targetDeadline: z.string().optional(),
  dailyMinutesGoal: z.number().min(10).max(240).optional(),
  timezone: z.string().optional(),
});

export async function userRoutes(app: FastifyInstance) {
  // 所有路由需要认证
  app.addHook('preHandler', (app as any).authenticate);

  // GET /v1/users/me — 获取当前用户信息
  app.get('/me', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const db = getDb();

    const [user] = await db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      interestTags: users.interestTags,
      primaryInterest: users.primaryInterest,
      iletsTargetBand: users.iletsTargetBand,
      targetDeadline: users.targetDeadline,
      dailyMinutesGoal: users.dailyMinutesGoal,
      onboardingCompleted: users.onboardingCompleted,
      timezone: users.timezone,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      return reply.code(404).send({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    return reply.send({ success: true, data: user });
  });

  // PATCH /v1/users/me — 更新用户设置
  app.patch('/me', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const body = UpdateProfileSchema.safeParse(req.body);

    if (!body.success) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
    }

    const db = getDb();
    const updates: Record<string, unknown> = {};

    if (body.data.displayName) updates['displayName'] = body.data.displayName;
    if (body.data.interestTags) updates['interestTags'] = body.data.interestTags;
    if (body.data.primaryInterest) updates['primaryInterest'] = body.data.primaryInterest;
    if (body.data.iletsTargetBand) updates['iletsTargetBand'] = body.data.iletsTargetBand.toString();
    if (body.data.targetDeadline) updates['targetDeadline'] = body.data.targetDeadline;
    if (body.data.dailyMinutesGoal) updates['dailyMinutesGoal'] = body.data.dailyMinutesGoal;
    if (body.data.timezone) updates['timezone'] = body.data.timezone;

    const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();

    return reply.send({ success: true, data: updated });
  });

  // GET /v1/users/me/ability — 获取用户能力模型
  app.get('/me/ability', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const db = getDb();

    const [model] = await db.select().from(userAbilityModels)
      .where(eq(userAbilityModels.userId, userId)).limit(1);

    if (!model) {
      return reply.code(404).send({
        success: false,
        error: { code: 'ABILITY_NOT_FOUND', message: 'Please complete the onboarding assessment first' },
      });
    }

    return reply.send({ success: true, data: model });
  });

  // GET /v1/users/me/ability/history — 获取能力历史快照（折线图数据）
  app.get('/me/ability/history', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const db = getDb();

    const snapshots = await db.select().from(abilityModelSnapshots)
      .where(eq(abilityModelSnapshots.userId, userId))
      .orderBy(desc(abilityModelSnapshots.snapshotDate))
      .limit(90); // 最近 90 天

    return reply.send({ success: true, data: snapshots.reverse() }); // 按时间正序返回
  });
}

