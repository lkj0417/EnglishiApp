import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb, dailyPacks, userAbilityModels, appSettings, learningEvents } from '@englishi/database';
import { eq, and, sql } from 'drizzle-orm';
import { calcTargetWordCount, calcTargetSpeechRate } from '@englishi/cefr-utils';

export async function dailyPackRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (app as any).authenticate);

  // GET /v1/daily-pack/today
  app.get('/today', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const db = getDb();
    const today = new Date().toISOString().split('T')[0]!;

    // 尝试获取今日已有的任务包
    const [existing] = await db.select().from(dailyPacks)
      .where(and(eq(dailyPacks.userId, userId), eq(dailyPacks.packDate, today)))
      .limit(1);

    if (existing) {
      return reply.send({ success: true, data: existing });
    }

    // 生成新任务包
    const [ability] = await db.select().from(userAbilityModels)
      .where(eq(userAbilityModels.userId, userId)).limit(1);

    if (!ability) {
      return reply.code(400).send({ success: false, error: { code: 'NO_ABILITY', message: 'Complete assessment first' } });
    }

    const overallCefr = parseFloat(ability.overallCefr ?? '3.0');
    const vocabCeiling = Math.min(6.0, overallCefr + 1.0);

    // 从 app_settings 读取口语间隔天数配置
    const [speakingDaySetting] = await db.select({ value: appSettings.value })
      .from(appSettings).where(and(eq(appSettings.category, 'learning'), eq(appSettings.key, 'speaking_day_interval'))).limit(1);
    const speakingDayInterval = parseInt(speakingDaySetting?.value ?? '2', 10);

    // 从 app_settings 读取 Gate Review 触发间隔
    const [gateReviewSetting] = await db.select({ value: appSettings.value })
      .from(appSettings).where(and(eq(appSettings.category, 'learning'), eq(appSettings.key, 'gate_review_trigger_units'))).limit(1);
    const gateReviewTriggerUnits = parseInt(gateReviewSetting?.value ?? '10', 10);

    // 计算今天是否是口语训练日（基于间隔天数）
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const isSpeakingDay = dayOfYear % speakingDayInterval === 0;

    // 检查是否需要 Gate Review（统计总学习事件数，每 N 个触发一次）
    const totalCompletedUnits = await db.select({ count: sql<number>`count(*)` })
      .from(learningEvents)
      .where(eq(learningEvents.userId, userId));
    const completedCount = Number(totalCompletedUnits[0]?.count ?? 0);
    const gateReviewDue = completedCount > 0 && completedCount % gateReviewTriggerUnits === 0;

    const difficultyParams = {
      vocabCeiling,
      grammarAllowed: ability.masteredGrammar as string[],
      grammarForbidden: (ability.weakAreas as any)?.grammar ?? [],
      targetNewWordRate: 0.06,
      articleWordCount: calcTargetWordCount(overallCefr),
      speechRateWpm: calcTargetSpeechRate(overallCefr),
    };

    // 构建任务列表
    const tasks = [
      { id: crypto.randomUUID(), type: 'vocab_review', status: 'pending', estimatedMinutes: 8 },
      { id: crypto.randomUUID(), type: 'grammar_exercise', status: 'pending', estimatedMinutes: 5 },
      { id: crypto.randomUUID(), type: 'reading_article', status: 'pending', estimatedMinutes: 12 },
      { id: crypto.randomUUID(), type: 'listening_audio', status: 'pending', estimatedMinutes: 10 },
      isSpeakingDay
        ? { id: crypto.randomUUID(), type: 'speaking_session', status: 'pending', estimatedMinutes: 10 }
        : { id: crypto.randomUUID(), type: 'writing_task', status: 'pending', estimatedMinutes: 15 },
      // Gate Review 作为独立任务追加（触发时）
      ...(gateReviewDue ? [{ id: crypto.randomUUID(), type: 'gate_review', status: 'pending', estimatedMinutes: 5 }] : []),
    ];

    const [newPack] = await db.insert(dailyPacks).values({
      userId,
      packDate: today,
      tasks,
      totalTasks: tasks.length,
      completedTasks: 0,
      totalMinutesEstimated: tasks.reduce((s, t) => s + t.estimatedMinutes, 0),
      difficultyParams,
      gateReviewDue,
    }).returning();

    return reply.send({ success: true, data: newPack });
  });

  // POST /v1/daily-pack/tasks/:taskId/complete
  app.post('/tasks/:taskId/complete', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const { taskId } = req.params as { taskId: string };
    const { timeSpentSec = 0 } = req.body as { timeSpentSec?: number };

    const db = getDb();
    const today = new Date().toISOString().split('T')[0]!;

    const [pack] = await db.select().from(dailyPacks)
      .where(and(eq(dailyPacks.userId, userId), eq(dailyPacks.packDate, today)))
      .limit(1);

    if (!pack) {
      return reply.code(404).send({ success: false, error: { code: 'NO_PACK', message: 'No pack for today' } });
    }

    const tasks = (pack.tasks as any[]).map(t =>
      t.id === taskId ? { ...t, status: 'completed' } : t,
    );
    const completedTasks = tasks.filter(t => t.status === 'completed').length;

    await db.update(dailyPacks).set({
      tasks,
      completedTasks,
      totalMinutesActual: (pack.totalMinutesActual ?? 0) + Math.round(timeSpentSec / 60),
      completedAt: completedTasks === pack.totalTasks ? new Date() : null,
    }).where(eq(dailyPacks.id, pack.id));

    return reply.send({ success: true, data: { taskId, status: 'completed', completedTasks, totalTasks: pack.totalTasks } });
  });

  // GET /v1/daily-pack/gate-review
  app.get('/gate-review', async (req: FastifyRequest, reply: FastifyReply) => {
    // 返回简化版 Gate Review 题目
    return reply.send({
      success: true,
      data: {
        questions: [
          { id: 'gr_01', type: 'vocabulary', question: 'What does "inevitable" mean?', options: ['A: avoidable', 'B: impossible to prevent', 'C: surprising', 'D: slow'], correctAnswer: 'B' },
          { id: 'gr_02', type: 'grammar', question: 'Choose the correct sentence:', options: ['A: Neither she nor I are ready.', 'B: Neither she nor I is ready.', 'C: Neither she nor I were ready.', 'D: Neither she nor I was ready.'], correctAnswer: 'B' },
        ],
        timeLimit: 300,
        passingScore: 0.7,
      },
    });
  });

  // POST /v1/daily-pack/gate-review/submit
  app.post('/gate-review/submit', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const { answers } = req.body as { answers: Record<string, string> };
    // 简化评分逻辑
    const correct = { gr_01: 'B', gr_02: 'B' };
    let score = 0;
    for (const [qId, ans] of Object.entries(answers)) {
      if ((correct as any)[qId] === ans) score++;
    }
    const passed = score / Object.keys(correct).length >= 0.7;
    const db = getDb();
    const today = new Date().toISOString().split('T')[0]!;
    await db.update(dailyPacks).set({
      gateReviewPassed: passed,
      gateReviewScore: (score / Object.keys(correct).length).toString(),
    }).where(and(eq(dailyPacks.userId, userId), eq(dailyPacks.packDate, today)));

    return reply.send({ success: true, data: { passed, score: score / Object.keys(correct).length, message: passed ? '通过！继续下一阶段' : '未通过，系统将安排针对性复习' } });
  });
}

