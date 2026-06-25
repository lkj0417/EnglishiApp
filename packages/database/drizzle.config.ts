import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema/index.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env['DATABASE_URL'] ?? 'postgresql://englishi:englishi_dev_password@localhost:5432/englishi_db',
  },
} satisfies Config;

