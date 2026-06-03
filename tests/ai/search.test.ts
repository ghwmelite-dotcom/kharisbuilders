import { describe, it, expect, vi } from 'vitest';
import { searchSermonIds } from '../../src/lib/ai/search';

describe('searchSermonIds', () => {
  it('embeds the query and returns ordered numeric ids', async () => {
    const ai = { embed: vi.fn(async () => [0.1, 0.2]), generate: vi.fn() };
    const store = {
      upsert: vi.fn(),
      remove: vi.fn(),
      query: vi.fn(async () => [
        { id: '7', score: 0.9 },
        { id: '3', score: 0.8 },
      ]),
    };
    const ids = await searchSermonIds({ ai, store }, 'anxiety', 5);
    expect(ai.embed).toHaveBeenCalledWith('anxiety');
    expect(store.query).toHaveBeenCalledWith([0.1, 0.2], 5);
    expect(ids).toEqual([7, 3]);
  });
});
