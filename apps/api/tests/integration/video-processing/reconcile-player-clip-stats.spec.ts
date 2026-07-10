import { describe, expect, it, vi } from 'vitest';

describe('reconcile-player-clip-stats', () => {
  it('updates player_stats from live clip counts', async () => {
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return { rows: [{ submitted: 2, assessed: 1, pending: 1 }] };
        }
        if (sql.includes('UPDATE player_stats')) {
          return {
            rows: [{
              clipSubmittedCount: 2,
              clipAssessedCount: 1,
              clipPendingCount: 1
            }]
          };
        }
        return { rows: [] };
      })
    };

    const { reconcilePlayerClipStats } = await import(
      '../../../../../scripts/video-processing/reconcile-player-clip-stats.js'
    );
    const result = await reconcilePlayerClipStats(pool, 'p_test');
    expect(result).toEqual({
      clipSubmittedCount: 2,
      clipAssessedCount: 1,
      clipPendingCount: 1
    });
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('inserts player_stats when missing', async () => {
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return { rows: [{ submitted: 1, assessed: 1, pending: 0 }] };
        }
        if (sql.includes('UPDATE player_stats')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO player_stats')) {
          return {
            rows: [{
              clipSubmittedCount: 1,
              clipAssessedCount: 1,
              clipPendingCount: 0
            }]
          };
        }
        return { rows: [] };
      })
    };

    const { reconcilePlayerClipStats } = await import(
      '../../../../../scripts/video-processing/reconcile-player-clip-stats.js'
    );
    const result = await reconcilePlayerClipStats(pool, 'p_new');
    expect(result).toEqual({
      clipSubmittedCount: 1,
      clipAssessedCount: 1,
      clipPendingCount: 0
    });
    expect(pool.query).toHaveBeenCalledTimes(3);
  });
});
