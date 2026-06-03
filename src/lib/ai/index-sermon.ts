import type { AIClient, VectorStore } from './clients';
import { composeSermonText, truncate, type SermonTextFields } from './text';

export interface IndexableSermon extends SermonTextFields {
  id: number;
  slug: string;
  published?: number | boolean;
}

export async function indexSermon(deps: { ai: AIClient; store: VectorStore }, sermon: IndexableSermon): Promise<void> {
  const text = truncate(composeSermonText(sermon), 2000);
  const values = await deps.ai.embed(text);
  await deps.store.upsert([
    {
      id: String(sermon.id),
      values,
      metadata: { slug: sermon.slug, title: sermon.title, published: !!sermon.published },
    },
  ]);
}

export async function removeSermon(store: VectorStore, id: number): Promise<void> {
  await store.remove([String(id)]);
}
