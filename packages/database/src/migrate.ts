import 'dotenv/config';
import { getDb } from './index.js';
import { sql } from 'drizzle-orm';

async function migrate() {
  const db = getDb();
  console.log('Running database migrations...');

  // 创建 pgvector 扩展
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  console.log('✓ Extensions created');

  console.log('✅ Migrations completed. Use drizzle-kit push for schema sync.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

