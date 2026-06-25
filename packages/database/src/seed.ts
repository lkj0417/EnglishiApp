import 'dotenv/config';
import { getDb, appSettings, users } from '@englishi/database';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const DEFAULT_SETTINGS = [
  // ── AI 配置 ──────────────────────────────
  { category: 'ai', key: 'default_temperature', value: '0.7', valueType: 'number', label: '默认温度', description: 'LLM 生成随机性（0-2，越高越随机）' },
  { category: 'ai', key: 'max_retries', value: '3', valueType: 'number', label: '最大重试次数', description: 'LLM 调用失败后的最大重试次数' },
  { category: 'ai', key: 'enable_usage_logging', value: 'true', valueType: 'boolean', label: '启用调用日志', description: '是否记录每次 API 调用明细' },
  { category: 'ai', key: 'fallback_to_env_key', value: 'true', valueType: 'boolean', label: '回退到环境变量', description: '数据库无配置时使用 .env 中的 OPENAI_API_KEY' },

  // ── 教学配置 ──────────────────────────────
  { category: 'learning', key: 'target_new_word_rate', value: '0.06', valueType: 'number', label: '目标生词率', description: '阅读文章中 i+1 新词占比（建议 0.04-0.08）' },
  { category: 'learning', key: 'gate_review_pass_threshold', value: '0.70', valueType: 'number', label: '关卡测验通过分', description: 'Gate Review 通过所需正确率（0-1）' },
  { category: 'learning', key: 'gate_review_trigger_units', value: '10', valueType: 'number', label: '关卡触发间隔', description: '每完成 N 个学习单元触发一次 Gate Review' },
  { category: 'learning', key: 'vocab_mastered_choice_streak', value: '3', valueType: 'number', label: '词汇选择连续正确次数', description: '判定词汇"已掌握"所需选择题连续正确次数' },
  { category: 'learning', key: 'vocab_mastered_context_streak', value: '2', valueType: 'number', label: '词汇语境连续正确次数', description: '判定词汇"已掌握"所需语境填空连续正确次数' },
  { category: 'learning', key: 'grammar_mastered_streak', value: '4', valueType: 'number', label: '语法掌握连续正确次数', description: '判定语法点"已掌握"所需练习连续正确次数' },
  { category: 'learning', key: 'daily_task_min_minutes', value: '10', valueType: 'number', label: '每日最少学习时长(分)', description: '每日任务包最少时长（防止任务包过少）' },
  { category: 'learning', key: 'daily_task_max_minutes', value: '90', valueType: 'number', label: '每日最多学习时长(分)', description: '每日任务包最多时长（超出时给出提示）' },
  { category: 'learning', key: 'speaking_day_interval', value: '2', valueType: 'number', label: '口语训练间隔(天)', description: '每隔 N 天安排一次口语任务（其余天安排写作）' },

  // ── 测评配置 ──────────────────────────────
  { category: 'assessment', key: 'cat_initial_difficulty', value: '3.0', valueType: 'number', label: 'CAT 初始难度', description: '入门测评初始题目难度（CEFR 数值，B1=3.0）' },
  { category: 'assessment', key: 'cat_max_questions', value: '20', valueType: 'number', label: 'CAT 最大题数', description: '入门测评最多回答题目数' },
  { category: 'assessment', key: 'cat_convergence_range', value: '0.5', valueType: 'number', label: 'CAT 收敛范围', description: '题目难度波动范围小于此值时判定为收敛' },

  // ── 内容生成 ──────────────────────────────
  { category: 'content', key: 'reading_cqv_max_retries', value: '3', valueType: 'number', label: '阅读生成最大重试', description: 'CQV 校验失败后的最大重新生成次数' },
  { category: 'content', key: 'content_cache_hours', value: '168', valueType: 'number', label: '内容缓存时长(小时)', description: '语法讲解、词汇解析等可共享内容的缓存时间' },
  { category: 'content', key: 'article_similarity_threshold', value: '0.80', valueType: 'number', label: '文章去重相似度阈值', description: 'embedding 余弦相似度超过此值判定为重复内容' },

  // ── 系统配置 ──────────────────────────────
  { category: 'system', key: 'maintenance_mode', value: 'false', valueType: 'boolean', label: '维护模式', description: '开启后所有 API 返回维护提示' },
  { category: 'system', key: 'new_user_registration', value: 'true', valueType: 'boolean', label: '允许新用户注册', description: '关闭后无法注册新账号' },
  { category: 'system', key: 'max_daily_ai_calls_per_user', value: '100', valueType: 'number', label: '每用户每日 AI 调用上限', description: '单用户每日最多调用 AI 服务次数（0=不限）' },
];

async function seed() {
  console.log('🌱 Seeding database...');
  const db = getDb();

  // 插入默认配置（跳过已存在的）
  for (const setting of DEFAULT_SETTINGS) {
    await db.insert(appSettings).values(setting).onConflictDoNothing();
  }
  console.log(`✓ ${DEFAULT_SETTINGS.length} default settings inserted`);

  // 创建超级管理员账户
  const ADMIN_EMAIL = process.env['ADMIN_EMAIL'] ?? 'admin@englishi.app';
  const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] ?? 'Admin@123456';

  const existing = await db.select({ id: users.id }).from(users)
    .where(sql`${users.email} = ${ADMIN_EMAIL}`).limit(1);

  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await db.insert(users).values({
      email: ADMIN_EMAIL,
      passwordHash,
      displayName: 'Super Admin',
      role: 'super_admin',
      onboardingCompleted: true,
    });
    console.log(`✓ Super admin created: ${ADMIN_EMAIL}`);
    console.log(`  Initial password: ${ADMIN_PASSWORD} (please change immediately!)`);
  } else {
    console.log(`✓ Admin account already exists: ${ADMIN_EMAIL}`);
  }

  console.log('\n✅ Database seeding completed!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

