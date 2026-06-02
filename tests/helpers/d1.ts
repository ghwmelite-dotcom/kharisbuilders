import { Miniflare } from 'miniflare';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface TestDb {
  db: D1Database;
  dispose: () => Promise<void>;
}

/** Split a .sql file into individual statements (strips `--` line comments). */
function splitStatements(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Spin up an in-memory Miniflare D1 with every `migrations/*.sql` applied, in order.
 * Returns the D1 binding plus a dispose function — call dispose in afterAll.
 * Seed data (db/seed.sql) is intentionally NOT applied, so tests stay deterministic.
 */
export async function createTestDb(): Promise<TestDb> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {};',
    d1Databases: { DB: ':memory:' },
  });
  const db = (await mf.getD1Database('DB')) as unknown as D1Database;

  const dir = join(process.cwd(), 'migrations');
  if (existsSync(dir)) {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      const sql = readFileSync(join(dir, file), 'utf8');
      for (const stmt of splitStatements(sql)) {
        await db.prepare(stmt).run();
      }
    }
  }

  return { db, dispose: () => mf.dispose() };
}
