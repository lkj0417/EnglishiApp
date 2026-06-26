"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.progressRoutes = progressRoutes;
const database_1 = require("@englishi/database");
const drizzle_orm_1 = require("drizzle-orm");
const cefr_utils_1 = require("@englishi/cefr-utils");
async function progressRoutes(app) {
    app.addHook('preHandler', app.authenticate);
    // GET /v1/progress/overview — 进度总览（雷达图数据）
    app.get('/overview', async (req, reply) => {
        const userId = req.user.userId;
        const db = (0, database_1.getDb)();
        const [ability] = await db.select().from(database_1.userAbilityModels)
            .where((0, drizzle_orm_1.eq)(database_1.userAbilityModels.userId, userId)).limit(1);
        if (!ability) {
            return reply.code(404).send({ success: false, error: { code: 'NO_ABILITY', message: 'Complete assessment first' } });
        }
        // 最近 30 天学习事件统计
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const events = await db.select({
            skill: database_1.learningEvents.skill,
            count: (0, drizzle_orm_1.sql) `count(*)`,
            avgScore: (0, drizzle_orm_1.sql) `avg(${database_1.learningEvents.performanceScore})`,
        }).from(database_1.learningEvents)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.learningEvents.userId, userId), (0, drizzle_orm_1.gte)(database_1.learningEvents.createdAt, thirtyDaysAgo)))
            .groupBy(database_1.learningEvents.skill);
        // 能力雷达图数据（使用英文 skill key，前端自行翻译）
        const radarData = [
            { skill: 'vocabulary', label: '词汇', value: parseFloat(ability.vocabularyCefr ?? '3'), max: 6 },
            { skill: 'grammar', label: '语法', value: parseFloat(ability.grammarCefr ?? '3'), max: 6 },
            { skill: 'reading', label: '阅读', value: parseFloat(ability.readingCefr ?? '3'), max: 6 },
            { skill: 'listening', label: '听力', value: parseFloat(ability.listeningCefr ?? '3'), max: 6 },
            { skill: 'speaking', label: '口语', value: parseFloat(ability.speakingCefr ?? '3'), max: 6 },
            { skill: 'writing', label: '写作', value: parseFloat(ability.writingCefr ?? '3'), max: 6 },
        ];
        // 词汇掌握统计
        const vocabStats = await db.select({
            status: database_1.vocabularyItems.status,
            count: (0, drizzle_orm_1.sql) `count(*)`,
        }).from(database_1.vocabularyItems)
            .where((0, drizzle_orm_1.eq)(database_1.vocabularyItems.userId, userId))
            .groupBy(database_1.vocabularyItems.status);
        const overallCefr = parseFloat(ability.overallCefr ?? '3');
        const ieltsPrediction = (0, cefr_utils_1.cefrToIeltsPrediction)(overallCefr);
        return reply.send({
            success: true,
            data: {
                overallCefr,
                cefrLabel: (0, cefr_utils_1.formatCefrForDisplay)(overallCefr),
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
    app.get('/weekly-report', async (req, reply) => {
        const userId = req.user.userId;
        const db = (0, database_1.getDb)();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        // 本周事件
        const weekEvents = await db.select().from(database_1.learningEvents)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.learningEvents.userId, userId), (0, drizzle_orm_1.gte)(database_1.learningEvents.createdAt, sevenDaysAgo)))
            .orderBy((0, drizzle_orm_1.desc)(database_1.learningEvents.createdAt));
        // 本周能力快照对比
        const snapshots = await db.select().from(database_1.abilityModelSnapshots)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.abilityModelSnapshots.userId, userId), (0, drizzle_orm_1.gte)(database_1.abilityModelSnapshots.snapshotDate, sevenDaysAgo.toISOString().split('T')[0])))
            .orderBy(database_1.abilityModelSnapshots.snapshotDate);
        const [ability] = await db.select().from(database_1.userAbilityModels)
            .where((0, drizzle_orm_1.eq)(database_1.userAbilityModels.userId, userId)).limit(1);
        // 统计本周学习分钟数
        const totalMinutes = weekEvents.reduce((sum, e) => sum + (e.timeSpentSec ?? 0), 0) / 60;
        const studyDates = new Set(weekEvents.map(e => e.createdAt?.toISOString().split('T')[0]).filter(Boolean));
        const daysStudied = studyDates.size;
        // 口语最新 Band Score
        const recentSpeaking = await db.select({ bandScores: database_1.speakingSessions.bandScores })
            .from(database_1.speakingSessions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.speakingSessions.userId, userId), (0, drizzle_orm_1.eq)(database_1.speakingSessions.status, 'completed')))
            .orderBy((0, drizzle_orm_1.desc)(database_1.speakingSessions.createdAt))
            .limit(3);
        // 写作最新 Band Score
        const recentWriting = await db.select({ bandScores: database_1.writingTasks.bandScores })
            .from(database_1.writingTasks)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.writingTasks.userId, userId), (0, drizzle_orm_1.eq)(database_1.writingTasks.status, 'completed')))
            .orderBy((0, drizzle_orm_1.desc)(database_1.writingTasks.submittedAt))
            .limit(3);
        const overallCefr = parseFloat(ability?.overallCefr ?? '3');
        const ieltsPrediction = (0, cefr_utils_1.cefrToIeltsPrediction)(overallCefr);
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
    app.get('/ielts-timeline', async (req, reply) => {
        const userId = req.user.userId;
        const db = (0, database_1.getDb)();
        const [ability] = await db.select().from(database_1.userAbilityModels)
            .where((0, drizzle_orm_1.eq)(database_1.userAbilityModels.userId, userId)).limit(1);
        if (!ability) {
            return reply.code(404).send({ success: false, error: { code: 'NO_ABILITY', message: 'Complete assessment first' } });
        }
        const overallCefr = parseFloat(ability.overallCefr ?? '3');
        // 从用户资料读取目标和每日时长（不使用硬编码）
        const [userProfile] = await db.select({
            iletsTargetBand: database_1.users.iletsTargetBand,
            dailyMinutesGoal: database_1.users.dailyMinutesGoal,
        }).from(database_1.users).where((0, drizzle_orm_1.eq)(database_1.users.id, userId)).limit(1);
        const targetBand = parseFloat(userProfile?.iletsTargetBand ?? '7.0');
        const cefrGap = (0, cefr_utils_1.calcCefrGapToIeltsTarget)(overallCefr, targetBand);
        const weeksNeeded = (0, cefr_utils_1.estimateWeeksToGoal)(cefrGap, userProfile?.dailyMinutesGoal ?? 45);
        // 生成里程碑
        const milestones = [];
        let tempCefr = overallCefr;
        let week = 0;
        while (tempCefr < 6.0 && milestones.length < 6) {
            tempCefr = Math.min(6.0, tempCefr + 0.5);
            week += (0, cefr_utils_1.estimateWeeksToGoal)(0.5, 45);
            milestones.push({
                cefrLevel: parseFloat(tempCefr.toFixed(1)),
                cefrLabel: (0, cefr_utils_1.formatCefrForDisplay)(tempCefr),
                ieltsPrediction: (0, cefr_utils_1.cefrToIeltsPrediction)(tempCefr),
                estimatedWeek: week,
                estimatedDate: new Date(Date.now() + week * 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
            });
            if ((0, cefr_utils_1.cefrToIeltsPrediction)(tempCefr) >= targetBand)
                break;
        }
        return reply.send({
            success: true,
            data: {
                currentCefr: overallCefr,
                currentIeltsPrediction: (0, cefr_utils_1.cefrToIeltsPrediction)(overallCefr),
                targetBand,
                estimatedWeeksToTarget: weeksNeeded,
                estimatedTargetDate: new Date(Date.now() + weeksNeeded * 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
                milestones,
            },
        });
    });
}
//# sourceMappingURL=progress.routes.js.map