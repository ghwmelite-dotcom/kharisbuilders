export interface AIClient {
  embed(text: string): Promise<number[]>;
  generate(messages: { role: string; content: string }[]): Promise<string>;
}

export interface VectorStore {
  upsert(vectors: { id: string; values: number[]; metadata?: Record<string, unknown> }[]): Promise<void>;
  query(values: number[], topK: number): Promise<{ id: string; score: number }[]>;
  remove(ids: string[]): Promise<void>;
}

// Minimal structural shapes of the Cloudflare bindings (avoids depending on global types).
interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<{ data?: number[][]; response?: string }>;
}
interface VectorizeBinding {
  upsert(vectors: { id: string; values: number[]; metadata?: Record<string, unknown> }[]): Promise<unknown>;
  query(values: number[], opts: { topK: number }): Promise<{ matches: { id: string; score: number }[] }>;
  deleteByIds(ids: string[]): Promise<unknown>;
}

const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';
const GEN_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export function workersAi(ai: AiBinding): AIClient {
  return {
    async embed(text) {
      const r = await ai.run(EMBED_MODEL, { text });
      return r.data?.[0] ?? [];
    },
    async generate(messages) {
      const r = await ai.run(GEN_MODEL, { messages, max_tokens: 1024 });
      return r.response ?? '';
    },
  };
}

export function vectorize(index: VectorizeBinding): VectorStore {
  return {
    async upsert(vectors) {
      await index.upsert(vectors);
    },
    async query(values, topK) {
      const r = await index.query(values, { topK });
      return r.matches.map((m) => ({ id: m.id, score: m.score }));
    },
    async remove(ids) {
      await index.deleteByIds(ids);
    },
  };
}
