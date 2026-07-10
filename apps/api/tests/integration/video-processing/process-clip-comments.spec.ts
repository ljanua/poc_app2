import { describe, expect, it, vi } from 'vitest';

describe('process-clip comments persistence', () => {
  it('markClipFailed stores the same text in error_message and comments', async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const pool = {
      query: vi.fn(async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return { rows: [] };
      })
    };

    const { markClipFailed } = await import(
      '../../../../../scripts/video-processing/process-clip.js'
    );
    await markClipFailed(pool, 'c_test', 'ffmpeg not found');

    const update = queries.find((entry) => entry.sql.includes('UPDATE clips'));
    expect(update).toBeDefined();
    expect(update?.sql).toContain('comments');
    expect(update?.params).toEqual(['c_test', 'ffmpeg not found']);
  });
});
