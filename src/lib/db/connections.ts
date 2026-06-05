import type { ConnectInput } from './schemas';

export type ConnectionStatus = 'new' | 'in_progress' | 'done';

export interface Connection {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  steps: string[];
  message: string | null;
  status: string;
  created_at: string;
}

interface ConnectionRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  steps: string;
  message: string | null;
  status: string;
  created_at: string;
}

function parseSteps(s: string): string[] {
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function createConnection(db: D1Database, input: ConnectInput): Promise<void> {
  await db
    .prepare('INSERT INTO connections (name, email, phone, steps, message) VALUES (?, ?, ?, ?, ?)')
    .bind(input.name, input.email, input.phone || null, JSON.stringify(input.steps ?? []), input.message || null)
    .run();
}

export async function listConnections(db: D1Database, limit = 200): Promise<Connection[]> {
  const { results } = await db
    .prepare(
      'SELECT id, name, email, phone, steps, message, status, created_at FROM connections ORDER BY id DESC LIMIT ?',
    )
    .bind(limit)
    .all<ConnectionRow>();
  return results.map((r) => ({ ...r, steps: parseSteps(r.steps) }));
}

export async function setConnectionStatus(db: D1Database, id: number, status: ConnectionStatus): Promise<void> {
  await db.prepare('UPDATE connections SET status = ? WHERE id = ?').bind(status, id).run();
}

export async function deleteConnection(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM connections WHERE id = ?').bind(id).run();
}
