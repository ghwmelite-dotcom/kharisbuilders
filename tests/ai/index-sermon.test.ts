import { describe, it, expect, vi } from 'vitest';
import { indexSermon, removeSermon } from '../../src/lib/ai/index-sermon';

describe('indexSermon', () => {
  it('embeds the composed text and upserts a vector with metadata', async () => {
    const ai = { embed: vi.fn(async () => [1, 2, 3]), generate: vi.fn() };
    const store = { upsert: vi.fn(async () => {}), remove: vi.fn(), query: vi.fn() };
    await indexSermon({ ai, store }, { id: 9, slug: 'faith', title: 'Faith', description: 'x', published: 1 });
    expect(ai.embed).toHaveBeenCalled();
    expect(store.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: '9',
        values: [1, 2, 3],
        metadata: expect.objectContaining({ slug: 'faith', published: true }),
      }),
    ]);
  });
});

describe('removeSermon', () => {
  it('removes by string id', async () => {
    const store = { upsert: vi.fn(), remove: vi.fn(async () => {}), query: vi.fn() };
    await removeSermon(store, 9);
    expect(store.remove).toHaveBeenCalledWith(['9']);
  });
});
