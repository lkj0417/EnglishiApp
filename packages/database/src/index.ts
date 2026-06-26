import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export * from './schema/index.js';
export { schema };
export * from './ability-updater.js';

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb(databaseUrl?: string) {
  if (_db) return _db;

  const url = databaseUrl ?? process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set');

  const client = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  _db = drizzle(client, { schema });
  return _db;
}

export type Db = ReturnType<typeof getDb>;

