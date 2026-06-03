import type { VisitorInput } from './schemas';

export async function createVisitor(db: D1Database, input: VisitorInput): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO visitors (name, email, phone, visiting_service, source)
       VALUES (?, ?, ?, ?, 'visit_form')`,
    )
    .bind(input.name, input.email, input.phone || null, input.visiting_service || null)
    .run();
  return Number(result.meta.last_row_id);
}
