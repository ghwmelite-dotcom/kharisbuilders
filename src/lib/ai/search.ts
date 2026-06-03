import type { AIClient, VectorStore } from './clients';

export async function searchSermonIds(
  deps: { ai: AIClient; store: VectorStore },
  query: string,
  topK: number,
): Promise<number[]> {
  const vec = await deps.ai.embed(query);
  const matches = await deps.store.query(vec, topK);
  return matches.map((m) => Number(m.id)).filter((n) => Number.isFinite(n));
}
