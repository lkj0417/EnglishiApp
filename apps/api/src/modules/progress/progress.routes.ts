import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb, abilityModelSnapshots, learningEvents, userAbilityModels, writingTasks, speakingSessions, vocabularyItems, users } from '@englishi/database';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { cefrToIeltsPrediction, estimateWeeksToGoal, calcCefrGapToIeltsTarget, formatCefrForDisplay } from '@englishi/cefr-utils';

export async function progressRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (app as any).authenticate);

  // GET /v1/progress/overview — 进度总览（雷达图数据）
  app.get('/overview', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const db = getDb();

    const [ability] = await db.select().from(userAbilityModels)
      .where(eq(userAbilityModels.userId, userId)).limit(1);

    if (!ability) {
      return reply.code(404).send({ success: false, error: { code: 'NO_ABILITY', message: 'Complete assessment first' } });
    }

    // 最近 30 天学习事件统计
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const events = await db.select({
      skill: learningEvents.skill,
      count: sql<number>`count(*)`,
      avgScore: sql<number>`avg(${learningEvents.performanceScore})`,
    }).from(learningEvents)
      .where(and(eq(learningEvents.userId, userId), gte(learningEvents.createdAt, thirtyDaysAgo)))
      .groupBy(learningEvents.skill);

    // 能力雷达图数据（使用英文 skill key，前端自行翻译）
    const radarData = [
      { skill: 'vocabulary', label: '词汇', value: parseFloat(ability.vocabularyCefr ?? '3'), max: 6 },
      { skill: 'grammar',    label: '语法', value: parseFloat(ability.grammarCefr ?? '3'), max: 6 },
      { skill: 'reading',    label: '阅读', value: parseFloat(ability.readingCefr ?? '3'), max: 6 },
      { skill: 'listening',  label: '听力', value: parseFloat(ability.listeningCefr ?? '3'), max: 6 },
      { skill: 'speaking',   label: '口语', value: parseFloat(ability.speakingCefr ?? '3'), max: 6 },
      { skill: 'writing',    label: '写作', value: parseFloat(ability.writingCefr ?? '3'), max: 6 },
    ];

    // 词汇掌握统计
    const vocabStats = await db.select({
      status: vocabularyItems.status,
      count: sql<number>`count(*)`,
    }).from(vocabularyItems)
      .where(eq(vocabularyItems.userId, userId))
      .groupBy(vocabularyItems.status);

    const overallCefr = parseFloat(ability.overallCefr ?? '3');
    const ieltsPrediction = cefrToIeltsPrediction(overallCefr);

    return reply.send({
      success: true,
      data: {
        overallCefr,
        cefrLabel: formatCefrForDisplay(overallCefr),
        ieltsPrediction,
        radarData,
        activityLast30Days: events,
        vocabularyStats: vocabStats,
        weakAreas: ability.weakAreas,
        errorPatterns: ability.errorPatterns,
      },
    });
  });

  // GET /v1/progress/weekly-report
  app.get('/weekly-report', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const db = getDb();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 本周事件
    const weekEvents = await db.select().from(learningEvents)
      .where(and(eq(learningEvents.userId, userId), gte(learningEvents.createdAt, sevenDaysAgo)))
      .orderBy(desc(learningEvents.createdAt));

    // 本周能力快照对比
    const snapshots = await db.select().from(abilityModelSnapshots)
      .where(and(eq(abilityModelSnapshots.userId, userId), gte(abilityModelSnapshots.snapshotDate, sevenDaysAgo.toISOString().split('T')[0]!)))
      .orderBy(abilityModelSnapshots.snapshotDate);

    const [ability] = await db.select().from(userAbilityModels)
      .where(eq(userAbilityModels.userId, userId)).limit(1);

    // 统计本周学习分钟数
    const totalMinutes = weekEvents.reduce((sum, e) => sum + (e.timeSpentSec ?? 0), 0) / 60;
    const studyDates = new Set(weekEvents.map(e => e.createdAt?.toISOString().split('T')[0]).filter(Boolean));
    const daysStudied = studyDates.size;

    // 口语最新 Band Score
    const recentSpeaking = await db.select({ bandScores: speakingSessions.bandScores })
      .from(speakingSessions)
      .where(and(eq(speakingSessions.userId, userId), eq(speakingSessions.status, 'completed')))
      .orderBy(desc(speakingSessions.createdAt))
      .limit(3);

    // 写作最新 Band Score
    const recentWriting = await db.select({ bandScores: writingTasks.bandScores })
      .from(writingTasks)
      .where(and(eq(writingTasks.userId, userId), eq(writingTasks.status, 'completed')))
      .orderBy(desc(writingTasks.submittedAt))
      .limit(3);

    const overallCefr = parseFloat(ability?.overallCefr ?? '3');
    const ieltsPrediction = cefrToIeltsPrediction(overallCefr);

    return reply.send({
      success: true,
      data: {
        weekStats: {
          totalStudyMinutes: Math.round(totalMinutes),
          daysStudied,
          totalEvents: weekEvents.length,
        },
        abilitySnapshots: snapshots,
        currentAbility: ability,
        recentSpeakingScores: recentSpeaking,
        recentWritingScores: recentWriting,
        ieltsPrediction,
      },
    });
  });

  // GET /v1/progress/ielts-timeline — 雅思达标时间线预测
  app.get('/ielts-timeline', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const db = getDb();

    const [ability] = await db.select().from(userAbilityModels)
      .where(eq(userAbilityModels.userId, userId)).limit(1);

    if (!ability) {
      return reply.code(404).send({ success: false, error: { code: 'NO_ABILITY', message: 'Complete assessment first' } });
    }

    const overallCefr = parseFloat(ability.overallCefr ?? '3');

    // 从用户资料读取目标和每日时长（不使用硬编码）
    const [userProfile] = await db.select({
      iletsTargetBand: users.iletsTargetBand,
      dailyMinutesGoal: users.dailyMinutesGoal,
    }).from(users).where(eq(users.id, userId)).limit(1);

    const targetBand = parseFloat(userProfile?.iletsTargetBand ?? '7.0');
    const cefrGap = calcCefrGapToIeltsTarget(overallCefr, targetBand);
    const weeksNeeded = estimateWeeksToGoal(cefrGap, userProfile?.dailyMinutesGoal ?? 45);

    // 生成里程碑
    const milestones = [];
    let tempCefr = overallCefr;
    let week = 0;
    while (tempCefr < 6.0 && milestones.length < 6) {
      tempCefr = Math.min(6.0, tempCefr + 0.5);
      week += estimateWeeksToGoal(0.5, 45);
      milestones.push({
        cefrLevel: parseFloat(tempCefr.toFixed(1)),
        cefrLabel: formatCefrForDisplay(tempCefr),
        ieltsPrediction: cefrToIeltsPrediction(tempCefr),
        estimatedWeek: week,
        estimatedDate: new Date(Date.now() + week * 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
      });
      if (cefrToIeltsPrediction(tempCefr) >= targetBand) break;
    }

    return reply.send({
      success: true,
      data: {
        currentCefr: overallCefr,
        currentIeltsPrediction: cefrToIeltsPrediction(overallCefr),
        targetBand,
        estimatedWeeksToTarget: weeksNeeded,
        estimatedTargetDate: new Date(Date.now() + weeksNeeded * 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
        milestones,
      },
    });
  });
}

