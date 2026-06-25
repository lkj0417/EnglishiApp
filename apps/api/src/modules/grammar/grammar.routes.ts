import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb, grammarItems, userAbilityModels } from '@englishi/database';
import { eq, and } from 'drizzle-orm';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

// 68 个核心语法点，按 CEFR 级别排序
const GRAMMAR_POINTS = [
  // A1
  { point: 'present_simple', cefr: 1.0, title: '一般现在时', prereqs: [] },
  { point: 'past_simple', cefr: 1.2, title: '一般过去时', prereqs: ['present_simple'] },
  { point: 'basic_articles', cefr: 1.3, title: '冠词 (a/an/the)', prereqs: [] },
  { point: 'plural_nouns', cefr: 1.0, title: '名词复数', prereqs: [] },
  // A2
  { point: 'present_continuous', cefr: 2.0, title: '现在进行时', prereqs: ['present_simple'] },
  { point: 'future_will', cefr: 2.2, title: '将来时 (will)', prereqs: ['present_simple'] },
  { point: 'comparative_adjectives', cefr: 2.0, title: '形容词比较级', prereqs: ['basic_articles'] },
  { point: 'can_modal', cefr: 2.0, title: '情态动词 can', prereqs: [] },
  // B1
  { point: 'present_perfect', cefr: 3.0, title: '现在完成时', prereqs: ['past_simple'] },
  { point: 'passive_voice_simple', cefr: 3.2, title: '简单被动语态', prereqs: ['past_simple'] },
  { point: 'relative_clauses_basic', cefr: 3.0, title: '定语从句（who/which/that）', prereqs: ['past_simple'] },
  { point: 'conditional_type_1', cefr: 3.3, title: '一型条件句（真实条件）', prereqs: ['future_will'] },
  { point: 'reported_speech', cefr: 3.5, title: '间接引语', prereqs: ['past_simple', 'present_simple'] },
  // B2
  { point: 'past_perfect', cefr: 4.0, title: '过去完成时', prereqs: ['present_perfect'] },
  { point: 'passive_voice_complex', cefr: 4.0, title: '复杂被动语态', prereqs: ['passive_voice_simple'] },
  { point: 'modal_verbs_all', cefr: 4.0, title: '全部情态动词', prereqs: ['can_modal'] },
  { point: 'conditional_type_2', cefr: 4.2, title: '二型条件句（虚拟条件）', prereqs: ['conditional_type_1'] },
  // C1
  { point: 'subjunctive_mood', cefr: 5.0, title: '虚拟语气', prereqs: ['conditional_type_2'] },
  { point: 'inversion_basic', cefr: 5.0, title: '基础倒装句', prereqs: ['reported_speech'] },
  { point: 'participle_clauses', cefr: 5.2, title: '分词从句', prereqs: ['present_continuous'] },
  { point: 'cleft_sentences', cefr: 5.0, title: '强调句型（It is...that）', prereqs: ['relative_clauses_basic'] },
];

let grammarQueue: Queue | null = null;

function getGrammarQueue() {
  if (!grammarQueue) {
    const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    grammarQueue = new Queue('grammar-lesson', { connection: redis as any });
  }
  return grammarQueue;
}

export async function grammarRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (app as any).authenticate);

  // GET /v1/grammar/priority-point — 获取当前优先学习的语法点
  app.get('/priority-point', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const db = getDb();

    const [ability] = await db.select().from(userAbilityModels)
      .where(eq(userAbilityModels.userId, userId)).limit(1);

    const grammarCefr = parseFloat(ability?.grammarCefr ?? '3.0');
    const masteredGrammar = (ability?.masteredGrammar as string[]) ?? [];

    // 找到当前水平范围内未掌握的语法点
    const notMastered = GRAMMAR_POINTS.filter(gp => {
      const levelMatch = gp.cefr >= grammarCefr - 0.5 && gp.cefr <= grammarCefr + 0.5;
      const notYetMastered = !masteredGrammar.includes(gp.point);
      const prereqsMet = gp.prereqs.every(r => masteredGrammar.includes(r));
      return levelMatch && notYetMastered && prereqsMet;
    });

    const priority = notMastered[0] ?? GRAMMAR_POINTS.find(gp => !masteredGrammar.includes(gp.point));

    return reply.send({
      success: true,
      data: priority ? {
        grammarPoint: priority.point,
        title: priority.title,
        cefrLevel: priority.cefr,
        prereqsMet: priority.prereqs.every(r => masteredGrammar.includes(r)),
      } : { message: 'All grammar points at current level mastered!' },
    });
  });

  // GET /v1/grammar/:point/lesson — 获取语法讲解（AI 生成，带缓存）
  app.get('/:point/lesson', async (req: FastifyRequest, reply: FastifyReply) => {
    const { point } = req.params as { point: string };
    const userId = (req.user as any).userId;

    const grammarInfo = GRAMMAR_POINTS.find(g => g.point === point);
    if (!grammarInfo) {
      return reply.code(404).send({ success: false, error: { code: 'UNKNOWN_GRAMMAR', message: 'Grammar point not found' } });
    }

    // 将语法讲解生成请求加入队列（异步，结果存入缓存）
    const queue = getGrammarQueue();
    const jobId = `grammar-${point}-lesson`;
    await queue.add('generate-lesson', { grammarPoint: point, userId }, { jobId, deduplication: { id: jobId } });

    return reply.send({
      success: true,
      data: {
        grammarPoint: point,
        title: grammarInfo.title,
        cefrLevel: grammarInfo.cefr,
        status: 'generating',
        message: 'Lesson content being generated. Retry in a few seconds.',
      },
    });
  });

  // POST /v1/grammar/:point/exercises/submit — 提交语法练习结果
  app.post('/:point/exercises/submit', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req.user as any).userId;
    const { point } = req.params as { point: string };
    const { results } = req.body as { results: Array<{ questionId: string; correct: boolean }> };

    const db = getDb();
    const totalQuestions = results.length;
    const correctCount = results.filter(r => r.correct).length;
    const accuracy = correctCount / totalQuestions;

    // 更新语法掌握状态
    const existing = await db.select().from(grammarItems)
      .where(and(eq(grammarItems.userId, userId), eq(grammarItems.grammarPoint, point)))
      .limit(1);

    const grammarInfo = GRAMMAR_POINTS.find(g => g.point === point);

    if (existing.length === 0) {
      await db.insert(grammarItems).values({
        userId,
        grammarPoint: point,
        cefrLevel: (grammarInfo?.cefr ?? 3.0).toString(),
        status: 'practicing',
        exerciseAccuracy: accuracy.toString(),
        exerciseCorrectStreak: accuracy >= 0.85 ? 1 : 0,
        consecutiveErrors: accuracy < 0.5 ? 1 : 0,
        introducedAt: new Date(),
        lastPracticedAt: new Date(),
      });
    } else {
      const curr = existing[0]!;
      const newStreak = accuracy >= 0.85 ? (curr.exerciseCorrectStreak! + 1) : 0;
      const newStatus = newStreak >= 4 ? 'mastered' : 'practicing';
      await db.update(grammarItems).set({
        exerciseAccuracy: accuracy.toString(),
        exerciseCorrectStreak: newStreak,
        consecutiveErrors: accuracy < 0.5 ? (curr.consecutiveErrors! + 1) : 0,
        status: newStatus,
        masteredAt: newStatus === 'mastered' ? new Date() : curr.masteredAt,
        lastPracticedAt: new Date(),
      }).where(and(eq(grammarItems.userId, userId), eq(grammarItems.grammarPoint, point)));
    }

    return reply.send({
      success: true,
      data: {
        accuracy,
        correctCount,
        totalQuestions,
        mastered: accuracy >= 0.85,
        message: accuracy >= 0.85 ? '语法点掌握良好！' : '继续练习，巩固这个语法点。',
      },
    });
  });
}

