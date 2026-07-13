import { describe, expect, it, vi } from 'vitest';

describe('sync-player-skill-ratings-from-clip', () => {
  it('converts fraction ratings to clamped 0-100 integers', async () => {
    const {
      toPercentRating
    } = await import('../../../../../scripts/video-processing/sync-player-skill-ratings-from-clip.js');

    expect(toPercentRating(0.84)).toBe(84);
    expect(toPercentRating(1.2)).toBe(100);
    expect(toPercentRating(-0.1)).toBe(0);
    expect(toPercentRating('not-a-number')).toBeNull();
  });

  it('upserts catalog skills at percent scale', async () => {
    const pool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('FROM skills')) {
          expect(params?.[0]).toBe('Passing');
          return { rows: [{ id: 's_passing' }] };
        }
        if (sql.includes('SELECT rating FROM player_skill_ratings')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO player_skill_ratings')) {
          expect(params).toEqual(['p_10', 's_passing', 84]);
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO player_data_audits')) {
          expect(params?.[2]).toBe('s_passing');
          expect(params?.[4]).toBe('84');
          return { rows: [] };
        }
        return { rows: [] };
      })
    };

    const { syncPlayerSkillRatingsFromClip } = await import(
      '../../../../../scripts/video-processing/sync-player-skill-ratings-from-clip.js'
    );
    const result = await syncPlayerSkillRatingsFromClip(pool, {
      playerId: 'p_10',
      skillRatings: { Passing: 0.84 },
      clipId: 'c_1'
    });

    expect(result).toEqual({ upserted: 1, skipped: 0 });
    expect(pool.query.mock.calls.some((call) => String(call[0]).includes('INSERT INTO player_data_audits'))).toBe(true);
  });

  it('skips audit when rating is unchanged', async () => {
    const pool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('FROM skills')) {
          return { rows: [{ id: 's_passing' }] };
        }
        if (sql.includes('SELECT rating FROM player_skill_ratings')) {
          return { rows: [{ rating: 84 }] };
        }
        if (sql.includes('INSERT INTO player_skill_ratings')) {
          return { rows: [] };
        }
        return { rows: [] };
      })
    };

    const { syncPlayerSkillRatingsFromClip } = await import(
      '../../../../../scripts/video-processing/sync-player-skill-ratings-from-clip.js'
    );
    await syncPlayerSkillRatingsFromClip(pool, {
      playerId: 'p_10',
      skillRatings: { Passing: 0.84 }
    });

    expect(pool.query.mock.calls.some((call) => String(call[0]).includes('INSERT INTO player_data_audits'))).toBe(false);
  });

  it('no-ops for empty or null skill ratings', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [] })) };
    const { syncPlayerSkillRatingsFromClip } = await import(
      '../../../../../scripts/video-processing/sync-player-skill-ratings-from-clip.js'
    );

    expect(await syncPlayerSkillRatingsFromClip(pool, { playerId: 'p_10', skillRatings: {} }))
      .toEqual({ upserted: 0, skipped: 0 });
    expect(await syncPlayerSkillRatingsFromClip(pool, { playerId: 'p_10', skillRatings: null as never }))
      .toEqual({ upserted: 0, skipped: 0 });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('skips unknown skill names without throwing', async () => {
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM skills')) {
          return { rows: [] };
        }
        return { rows: [] };
      })
    };

    const { syncPlayerSkillRatingsFromClip } = await import(
      '../../../../../scripts/video-processing/sync-player-skill-ratings-from-clip.js'
    );
    const result = await syncPlayerSkillRatingsFromClip(pool, {
      playerId: 'p_10',
      skillRatings: { General: 0.9 }
    });

    expect(result).toEqual({ upserted: 0, skipped: 1 });
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls.some((call) => String(call[0]).includes('INSERT'))).toBe(false);
  });

  it('backfill applies clips oldest-first so latest rating wins', async () => {
    const upserts: Array<{ skillId: string; rating: number }> = [];
    const pool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('FROM clips')) {
          return {
            rows: [
              { playerId: 'p_10', skillRatings: { Passing: 0.8, Finishing: 0.7 } },
              { playerId: 'p_10', skillRatings: { Passing: 0.6 } }
            ]
          };
        }
        if (sql.includes('FROM skills')) {
          const name = String(params?.[0] || '');
          if (name.toLowerCase() === 'passing') {
            return { rows: [{ id: 's_passing' }] };
          }
          if (name.toLowerCase() === 'finishing') {
            return { rows: [{ id: 's_finishing' }] };
          }
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO player_skill_ratings')) {
          upserts.push({
            skillId: String(params?.[1]),
            rating: Number(params?.[2])
          });
          return { rows: [] };
        }
        return { rows: [] };
      })
    };

    const { backfillPlayerSkillRatingsFromClips } = await import(
      '../../../../../scripts/video-processing/sync-player-skill-ratings-from-clip.js'
    );
    const result = await backfillPlayerSkillRatingsFromClips(pool);

    expect(result.clips).toBe(2);
    expect(result.upserted).toBe(3);
    expect(upserts).toEqual([
      { skillId: 's_passing', rating: 80 },
      { skillId: 's_finishing', rating: 70 },
      { skillId: 's_passing', rating: 60 }
    ]);
  });
});
